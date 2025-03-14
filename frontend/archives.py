import re
import json
import time
import pprint
import struct
import logging
import datetime
import threading
import multiprocessing
import numpy as np

from django.conf import settings
from django.http import HttpResponse, Http404, HttpResponseForbidden
from django.views.decorators.cache import never_cache

from .models import Day, Sweep
from common import colorize, colored_variables, is_valid_time, get_client_ip

logger = logging.getLogger("frontend")

origins = {}

lock = threading.Lock()
task_workers = []
task_queue = multiprocessing.Queue()
data_queue = multiprocessing.Queue()
worker_run = multiprocessing.Value("i", 1)
agg_output = {}

pp = pprint.PrettyPrinter(indent=1, depth=3, width=80, sort_dicts=False)

re_yyyymm = re.compile(r"20\d{2}(0[0-9]|1[012])")
re_yyyymmdd = re.compile(r"20\d{2}(0[0-9]|1[012])([012]\d|3[01])")
re_bad_agents = re.compile(r"[Ww]get|[Cc]url|ureq")

invalid_query = HttpResponse(f"Invalid Query\n", status=204)
nice_reply = "If you believe the data exist, please email data request to data@arrc.ou.edu"
not_allowed_request = HttpResponse(f"Method not allowed. {nice_reply}\n", status=405)
forbidden_request = HttpResponseForbidden("Forbidden. Mistaken? Tell my father.\n")


# region Helpers


def binary(request, name):
    ip = get_client_ip(request)
    dirty = is_dirty_request(request)
    myname = colorize("binary()", "green")
    logger.info(f"{myname}   {colored_variables(name, ip, dirty)}")
    payload = b"\x01\x02\x03\x04\x05\x06\x07\x08"
    response = HttpResponse(payload, content_type="application/octet-stream")
    return response


def header(_, name):
    myname = colorize("header()", "green")
    logger.debug(f"{myname}   {colored_variables(name)}")
    data = {"elev": 0.5, "count": 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type="application/json")
    return response


def is_dirty_request(request):
    if isinstance(request, str) and request == "django-test":
        return False
    headers = dict(request.headers)
    headers.pop("Cookie", None)
    if "Accept-Encoding" not in headers or "gzip" not in headers["Accept-Encoding"]:
        return True
    # if 'Referer' not in request.headers and 'Connection' not in request.headers:
    #     return True
    return False


def stat(request, mode="alive"):
    if is_dirty_request(request):
        return forbidden_request
    if mode == "alive":
        return HttpResponse("Alive\n", content_type="text/plain")
    elif mode == "403":
        return forbidden_request
    raise Http404


# region Month

"""
    pathway - a string of the pathway name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
"""


def _month(prefix, day):
    y = int(day[0:4])
    m = int(day[4:6])
    entries = Day.objects.filter(date__year=y, date__month=m, name=prefix)
    date = datetime.date(y, m, 1)
    step = datetime.timedelta(days=1)
    array = {}
    while date.month == m:
        key = date.strftime(r"%Y%m%d")
        entry = entries.filter(date=date).last()
        array[key] = entry.weather_condition() if entry else 0
        date += step
    return array


def month(request, pathway, day):
    if settings.VERBOSE > 1:
        myname = colorize("archive.month()", "green")
        logger.debug(f"{myname}   {colored_variables(pathway, day)}")
    if is_dirty_request(request):
        return forbidden_request
    if pathway == "undefined" or pathway not in settings.RADARS or day == "undefined" or re_yyyymm.match(day) is None:
        return invalid_query
    prefix = settings.RADARS[pathway]["prefix"]
    array = _month(prefix, day)
    payload = json.dumps(array, separators=(",", ":"))
    return HttpResponse(payload, content_type="application/json")


# region Count

"""
    Count of data - returns an array of 24 elements

    pathway - a string of the pathway name
            - e.g., px1000, raxpol, or px10k

    name - prefix part of the data files
         -  e.g., PX for PX-20240628-050130-E4.0, RAXPOL for RAXPOL-20240628-050130-E2.0, etc.

    day - a string in the forms of
          - YYYYMMDD
"""


def _count(prefix, day):
    date = time.strftime(r"%Y-%m-%d", time.strptime(day[:8], r"%Y%m%d"))
    d = Day.objects.filter(date=date, name=prefix)
    if d:
        d = d[0]
        return [int(n) for n in d.hourly_count.split(",")]
    return [0] * 24


def count(request, pathway, day):
    if settings.VERBOSE > 1:
        myname = colorize("archive.count()", "green")
        logger.debug(f"{myname}   {colored_variables(pathway, day)}")
    if is_dirty_request(request):
        return not_allowed_request
    # Request from JavaScript could have "undefined" as a string when not defined
    if pathway == "undefined" or pathway not in settings.RADARS or day == "undefined" or not is_valid_time(day):
        return invalid_query
    prefix = settings.RADARS[pathway]["prefix"]
    data = {"count": _count(prefix, day)}
    payload = json.dumps(data, separators=(",", ":"))
    return HttpResponse(payload, content_type="application/json")


def _hour_offset_has_data(prefix, day_hour, hour_offset):
    c = day_hour.split("-")
    if len(c) == 1:
        c.append("0000")
    elif len(c[1]) == 2:
        c[1] = f"{c[1]}00"
    t = "-".join(c[:2])
    t = time.strptime(t, r"%Y%m%d-%H%M")
    s = time.localtime(time.mktime(t) + hour_offset * 3600)
    date = time.strftime(r"%Y-%m-%d", s)
    days = Day.objects.filter(date=date, name=prefix)
    if days:
        hour = s.tm_hour
        return days.first().hourly_count.split(",")[hour] != "0"
    return False


# region Table

"""
    Tabulated list of files - returns an array of strings
"""


def _table(name, day_hour, offset=[0, 3599], pretty=True):
    c = day_hour.split("-")
    if len(c) == 1:
        c.append("0000")
    elif len(c[1]) == 2:
        c[1] = f"{c[1]}00"
    t = "-".join(c[:2])
    t = time.strptime(t, r"%Y%m%d-%H%M")
    s = time.localtime(time.mktime(t) + offset[0])
    e = time.localtime(time.mktime(t) + offset[1])
    ss = time.strftime(r"%Y-%m-%d %H:%M:%SZ", s)
    ee = time.strftime(r"%Y-%m-%d %H:%M:%SZ", e)
    date_range = [ss, ee]
    matches = Sweep.objects.filter(time__range=date_range, name=name)
    return [o.time.strftime(r"%Y%m%d-%H%M%S-") + o.scan for o in matches] if pretty else matches


def _table_block(prefix, day_hour):
    previous = _table(prefix, day_hour, [-3600, -1])
    current = _table(prefix, day_hour, [0, 3599])
    moreBefore = _hour_offset_has_data(prefix, day_hour, -2)
    moreAfter = _hour_offset_has_data(prefix, day_hour, 1)
    return {
        "counts": [len(previous), len(current)],
        "items": [*previous, *current],
        "moreBefore": moreBefore,
        "moreAfter": moreAfter,
    }


"""
    pathway - a string of the pathway name
            - e.g., px1000, raxpol, or px10k

    day_hour - a string with day, and hour in the forms of
             - YYYYMMDD
             - YYYYMMDD-HH00

    e.g.,
        - table(request, 'bs1', '20230616-0200') that originates from /data/list/bs1/20230616-0200/
"""


def table(request, pathway, day_hour):
    myname = colorize("archive.table()", "green")
    if settings.VERBOSE > 1:
        logger.debug(f"{myname}   {colored_variables(pathway, day_hour)}")
    if is_dirty_request(request):
        return not_allowed_request
    if pathway == "undefined" or pathway not in settings.RADARS:
        logger.debug(f"Invalid pathway = {pathway}")
        return invalid_query
    if day_hour == "undefined" or not is_valid_time(day_hour):
        logger.debug(f"Invalid day_hour = {day_hour}")
        return invalid_query
    prefix = settings.RADARS[pathway]["prefix"]
    c = day_hour.split("-")
    day = c[0]
    if not re_yyyymmdd.match(day):
        logger.warning(f"Invalid day = {day} <- {day_hour}")
        return invalid_query
    hourly_count = _count(prefix, day)
    if len(c) > 1:
        hour = int(c[1][:2])
    else:
        hour = 0
    day_hour = f"{day}-{hour:02d}00"
    hours_with_data = [i for i, v in enumerate(hourly_count) if v]
    if hourly_count[hour] == 0:
        if len(hours_with_data):
            message = f"Hour {hour} has no files. Auto-select hour {hours_with_data[0]}."
            hour = hours_with_data[0]
            day_hour = f"{day}-{hour:02d}00"
            if settings.VERBOSE > 1:
                logger.debug(f"{myname}   {colored_variables(day_hour)}   [auto selected]")
        else:
            if settings.VERBOSE > 1:
                logger.debug(f"{myname}   {colored_variables(pathway, day_hour)}   [empty]")
            message = "empty"
            hour = -1
    else:
        message = "okay"
    add = _table_block(prefix, day_hour)
    data = {"hoursActive": _count(prefix, day), "hour": hour, "message": message}
    data = {**data, **add}
    payload = json.dumps(data, separators=(",", ":"))
    return HttpResponse(payload, content_type="application/json")


# region Display

"""
    load_display_data_by_source_string

    source_string - the source of the sweep, e.g., PX-20230616-020024-E2.6-Z
"""


def load_display_data_by_source_string(source_string):
    if settings.SIMULATE:
        sweep = Sweep.dummy_data(source_string, u8=True)
    else:
        sweep = Sweep.read(source_string, u8=True)
    # The sweep is not found or the sweep is empty (symbol not valid/found)
    if sweep is None or not sweep["u8"]:
        return None
    symbol = list(sweep["u8"].keys())[0]
    # Down-sample the sweep if the gate spacing is too fine (to save internet bandwidth)
    elevations = sweep["elevations"]
    azimuths = sweep["azimuths"]
    values = sweep["u8"][symbol]
    gatewidth = 1.0e-3 * sweep["gatewidth"]
    # Only show up to gate 400 for bistatic data
    if sweep["txrx"] == "B":
        values = values[:, :400]
    elif values.shape[1] > 1000:
        stride = values.shape[1] // 1000
        gatewidth *= float(stride)
        values = values[:, ::stride]
    if sweep.get("comment", None):
        info = json.dumps({"comment": sweep["comment"]}, separators=(",", ":"))
    else:
        info = json.dumps(
            {"wf": sweep["waveform"], "prf": round(sweep["prf"])},
            separators=(",", ":"),
        )
    # Final assembly of the payload
    ei16 = np.array(elevations / 180.0 * 32768.0, dtype=np.int16)
    au16 = np.array(azimuths / 360.0 * 65536.0, dtype=np.uint16)
    attr = 1 if sweep["txrx"] == "B" else 0
    head = struct.pack(
        "<hhhhddddffffffff",
        *values.shape,
        len(info),
        attr,
        sweep["time"],
        sweep["latitude"],
        sweep["longitude"],
        0.0,
        sweep["rxOffsetX"] if attr else 0.1,
        sweep["rxOffsetY"] if attr else 0.2,
        sweep["rxOffsetZ"] if attr else 0.3,
        0.4,
        sweep["sweepElevation"],
        sweep["sweepAzimuth"],
        0.0,
        gatewidth,
    )
    payload = bytes(head) + bytes(info, "utf-8") + bytes(ei16) + bytes(au16) + bytes(values)
    # logger.debug(f"Payload size = {len(payload):,d} B")
    return payload


"""
    Load a sweep - returns a dictionary

    pathway - the radar pathway, e.g., px1000, raxpol, etc.
    locator - the locator of the sweep, e.g., 20230616-020024-E2.6-Z
"""


def load(request, pathway, locator):
    if settings.VERBOSE > 1:
        myname = colorize("archive.load()", "green")
        logger.debug(f"{myname}   {colored_variables(pathway, locator)}")
    if is_dirty_request(request):
        return not_allowed_request
    if pathway == "undefined" or pathway not in settings.RADARS:
        return invalid_query
    prefix = settings.RADARS[pathway]["prefix"]
    payload = load_display_data_by_source_string(f"{prefix}-{locator}")
    if payload is None:
        return HttpResponse(f"{prefix}-{locator} not found. {nice_reply}", status=205)
    response = HttpResponse(payload, content_type="application/octet-stream")
    response["Cache-Control"] = "max-age=604800"
    return response


# region Misc

"""
    Latest date - returns the latest YYYYMMDD and HH

    name - name of the Sweep entries (case sensitive),
    e.g., PX for data like PX-20240628-050130-E4.0
          RAXPOL data like RAXPOL-20240628-050130-E2.0
"""


def latest(name):
    if name is None:
        return None, None
    myname = colorize("archive.latest()", "green")
    query = Day.objects.filter(name=name)
    if not query:
        logger.debug(f"{myname} No Day entry for {colored_variables(name)}")
        return None, None
    day = query.latest("date")
    ymd = day.date.strftime(r"%Y%m%d")
    if settings.VERBOSE:
        logger.debug(f"{myname}   {colored_variables(name, ymd)}")
    hour = day.last_hour
    if hour is None:
        logger.debug(f"{myname}   {day} has empty hourly_count")
        return None, None
    return ymd, hour


"""
    Location - returns a dictionary with latitude, longitude

    pathway - Input pathway, e.g., px1000, raxpol, etc.
"""


def location(pathway):
    global origins
    myname = colorize("archive.location()", "green")
    prefix = settings.RADARS.get(pathway, {}).get("prefix", None)
    logger.debug(f"{myname}   {colored_variables(pathway, prefix)}")
    if prefix is None:
        return {"longitude": -97.4373016, "latitude": 35.1812820, "last": "20090103"}
    origins[pathway] = Sweep.location(prefix)
    logger.debug(f"{myname}   {colored_variables(origins)}")
    return origins[pathway]


"""
    prefix - prefix of a pathway, e.g., PX for PX-1000, RAXPOL for RaXPol
"""


def _latest_scan(prefix, scan="E4.0"):
    day = Day.objects.filter(name=prefix).latest("date")
    last = day.latest_datetime_range
    sweeps = Sweep.objects.filter(time__range=last, name=prefix, scan=scan)
    if sweeps.exists():
        sweep = sweeps.latest("time")
        if settings.VERBOSE > 1:
            fn_name = colorize("archive._latest_scan()", "green")
            logger.debug(f"{fn_name}: {sweep}")
        return sweep.time.strftime(r"%Y%m%d-%H%M%S")
    else:
        return ""


def _years(prefix):
    if prefix == "PX":
        return [int(x > 12) for x in range(23)]
    if prefix == "RAXPOL":
        return [int(x > 16) for x in range(23)]
    if prefix == "PX10K":
        return [int(x == 19) for x in range(23)]
    return []


"""
    pathway - Input pathway name, e.g., px1000, raxpol, etc.
    scan - The 4-th component of filename describing the scan, e.g., E4.0, A120.0, etc.
    symbol - The symbol of a product, e.g., Z, V, W, etc.
"""


@never_cache
def catchup(request, pathway, scan="E4.0", symbol="Z"):
    if settings.VERBOSE > 1:
        myname = colorize("archive.catchup()", "green")
        logger.debug(f"{myname}   {colored_variables(pathway, scan, symbol)}")
    if is_dirty_request(request):
        return not_allowed_request
    if pathway == "undefined" or pathway not in settings.RADARS:
        return invalid_query
    prefix = settings.RADARS[pathway]["prefix"]
    ymd, hour = latest(prefix)
    if ymd is None:
        data = {
            "dateTimeString": "19700101-0000",
            "dayISOString": "1970/01/01Z",
            "daysActive": {},
            "yearsActive": [],
            "hoursActive": [0] * 24,
            "hour": -1,
            "counts": [0, 0],
            "items": [],
            "latestScan": "",
        }
    else:
        date_time_string = f"{ymd}-{hour:02d}00"
        add = _table_block(prefix, f"{date_time_string}-{symbol}")
        data = {
            "dateTimeString": date_time_string,
            "dayISOString": f"{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}Z",
            "daysActive": _month(prefix, ymd),
            "yearsActive": _years(prefix),
            "hoursActive": _count(prefix, ymd),
            "hour": hour,
            "latestScan": _latest_scan(prefix, scan),
        }
        data = {**data, **add}
    payload = json.dumps(data, separators=(",", ":"))
    return HttpResponse(payload, content_type="application/json")
