import re
import json
import time
import zlib
import pprint
import struct
import logging
import datetime
import threading
import numpy as np

from functools import lru_cache

from django.http import HttpResponse
from django.conf import settings

from .models import File, Day, Visitor
from common import colorize, color_name_value, is_valid_time, get_client_ip

logger = logging.getLogger('frontend')

origins = {}

pp = pprint.PrettyPrinter(indent=1, depth=3, width=80, sort_dicts=False)

pattern_x_yyyymmdd_hhmmss = re.compile(r'(?<=-)20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])-([01][0-9]|2[0-3])[0-5][0-9][0-5][0-9]')
pattern_yyyymm = re.compile(r'20[0-9][0-9](0[0-9]|1[012])')
pattern_bad_agents = re.compile(r'[Ww]get|[Cc]url|ureq')

invalid_query = HttpResponse(f'Invalid Query', status=204)
forbidden_request = HttpResponse(f'Forbidden. Mistaken? Tell Us.', status=403)

radar_prefix = {}
for prefix, item in settings.RADARS.items():
    radar = item['folder'].lower()
    radar_prefix[radar] = prefix

visitor_stats = {}
visitor_stats_access = threading.Lock()
visitor_stats_monitor_thread = None

def binary(_, name):
    if settings.VERBOSE > 1:
        show = colorize('binary()', 'green')
        show += '   ' + color_name_value('name', name)
        logging.debug(show)
    if name == 'undefined':
        return invalid_query
    elev = 0.5
    elev_bin = bytearray(struct.pack('f', elev));
    payload = elev_bin + b'\x00\x01\x02\x00\x00\x00\xfd\xfe\xff'
    if not isinstance(payload, bytes):
        payload = bytes(payload);
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def header(_, name):
    if settings.VERBOSE > 1:
        show = colorize('header()', 'green')
        show += '   ' + color_name_value('name', name)
        logging.debug(show)
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def screen(request):
    global visitor_stats
    global visitor_stats_monitor_thread
    ip = get_client_ip(request)
    if ip not in visitor_stats:
        headers = dict(request.headers)
        headers.pop('Cookie', None)
        visitor = {'bandwidth': 0, 'headers': headers, 'count': 1, 'last_visited': datetime.datetime.today()}
        visitor_stats[ip] = visitor
    else:
        visitor = visitor_stats[ip]
        if visitor['headers']['User-Agent'] != request.headers['User-Agent']:
            visitor['headers']['User-Agent'] = request.headers['User-Agent']
        visitor['count'] += 1
        visitor['last_visited'] = datetime.datetime.today().replace(tzinfo=datetime.timezone.utc)
    if visitor_stats_monitor_thread is None:
        visitor_stats_monitor_thread = threading.Thread(target=monitor)
        visitor_stats_monitor_thread.start()
    malicious = False
    if pattern_bad_agents.match(request.headers['User-Agent']):
        malicious = True
    if 'Referer' not in request.headers and 'Connection' not in request.headers:
        malicious = True
    return ip, malicious

def visitors(_):
    # global visitor_stats
    # payload = pp.pformat(visitor_stats)
    stats = []
    for visitor in Visitor.objects.all():
        stats.append(visitor.dict())
    payload = pp.pformat(stats)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
'''
def month(request, radar, day):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.month()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        logging.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day == 'undefined' or pattern_yyyymm.match(day) is None:
        return invalid_query
    y = int(day[0:4])
    m = int(day[4:6])
    prefix = radar_prefix[radar]
    entries = Day.objects.filter(date__year=y, date__month=m, name=prefix)
    date = datetime.date(y, m, 1)
    step = datetime.timedelta(days=1)
    array = {}
    while date.month == m:
        key = date.strftime(r'%Y-%m-%d')
        entry = entries.filter(date=date).last()
        array[key] = entry.weather_condition() if entry else 0
        date += step
    payload = json.dumps(array)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMMDD
'''
def _count(prefix, day):
    date = time.strftime(r'%Y-%m-%d', time.strptime(day[:8], r'%Y%m%d'))
    d = Day.objects.filter(date=date, name=prefix)
    if d:
        d = d[0]
        return [int(n) for n in d.hourly_count.split(',')]
    return [0] * 24

def count(request, radar, day):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.count()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        logging.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day == 'undefined' or not is_valid_time(day):
        return invalid_query
    prefix = radar_prefix[radar]
    data = {
        'count': _count(prefix, day)
    }
    payload = json.dumps(data)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day_hour_symbol - a string with day, hour, and product symbol in the forms of
        - YYYYMMDD         (assumes Z here)
        - YYYYMMDD-HH00    (assumes Z here)
        - YYYYMMDD-HH00-S
'''
def _list(prefix, day_hour_symbol):
    c = day_hour_symbol.split('-')
    if len(c) == 1:
        c.append('0000')
    elif len(c[1]) == 2:
        c[1] = f'{c[1]}00'
    symbol = c[2] if len(c) == 3 else 'Z'
    t = '-'.join(c[:2])
    s = time.strptime(t, r'%Y%m%d-%H%M')
    e = time.localtime(time.mktime(s) + 3599)
    ss = time.strftime(r'%Y-%m-%d %H:%M:%SZ', s)
    ee = time.strftime(r'%Y-%m-%d %H:%M:%SZ', e)
    date_range = [ss, ee]
    matches = File.objects.filter(date__range=date_range, name__startswith=prefix, name__endswith=f'-{symbol}.nc')
    return [o.name.rstrip('.nc') for o in matches]

def list(request, radar, day_hour_symbol):
    global visitor_stats
    show = colorize('archive.list()', 'green')
    show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
    logging.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day_hour_symbol == 'undefined':
        return invalid_query
    if len(day_hour_symbol) not in [8, 13, 15]:
        return invalid_query
    if not is_valid_time(day_hour_symbol[:13]):
        return invalid_query
    prefix = radar_prefix[radar]
    c = day_hour_symbol.split('-')
    day = c[0]
    if len(day) > 8:
        logging.warning(f'Invalid day_hour_symbol = {day_hour_symbol} -> day = {day}')
        return invalid_query
    hourly_count = _count(prefix, day)
    if len(c) > 1:
        hour = int(c[1][:2])
    else:
        hour = 0
    if len(c) == 3:
        symbol = c[2]
    else:
        symbol = 'Z'
    hours_with_data = [i for i, v in enumerate(hourly_count) if v]
    if hourly_count[hour] == 0:
        if len(hours_with_data):
            message = f'Hour {hour} has no files. Auto-select hour {hours_with_data[0]}.'
            hour = hours_with_data[0]
            day_hour_symbol = f'{day}-{hour:02d}00-{symbol}'
            if settings.VERBOSE > 1:
                show = colorize('archive.list()', 'green')
                show += '   ' + colorize('override', 'red')
                show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
                logging.debug(show)
        else:
            show = colorize('archive.list()', 'green')
            show += '   ' + color_name_value('radar', radar)
            show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
            show += '   ' + color_name_value('hourly_count', '0\'s')
            logging.warning(show)
            message = 'All zeros in hourly_count'
            hour = -1
    else:
        message = 'okay'
    data = {
        'count': _count(prefix, day),
        'hour': hour,
        'last': hours_with_data[-1] if len(hours_with_data) else -1,
        'list': _list(prefix, day_hour_symbol) if hour >= 0 else [],
        'symbol': symbol,
        'message': message
    }
    payload = json.dumps(data)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    name - filename
'''
@lru_cache(maxsize=512)
def _load(name):
    if settings.SIMULATE:
        elements = name.split('-')
        logging.info(f'Dummy sweep {name}')
        sweep = {
            'symbol': elements[4] if len(elements) > 4 else "Z",
            'longitude': -97.422413,
            'latitude': 35.25527,
            'sweepTime': time.mktime(time.strptime(elements[1] + elements[2], r'%Y%m%d%H%M%S')),
            'sweepElevation': float(elements[3][1:]) if "E" in elements[3] else 0.0,
            'sweepAzimuth': float(elements[3][1:]) if "A" in elements[3] else 4.0,
            'gatewidth': 60.0,
            'elevations': np.array([4.0, 4.0, 4.0, 4.0], dtype=float),
            'azimuths': np.array([0.0, 15.0, 30.0, 45.0], dtype=float),
            'values': np.array([[0, 22, -1], [-11, -6, -9], [9, 14, 9], [24, 29, 34]])
        }
    else:
        # Database is indexed by date so we extract the time first for a quicker search
        s = pattern_x_yyyymmdd_hhmmss.search(name)
        if s is None:
            return None
        s = s[0]
        if not is_valid_time(s):
            return None
        date = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
        match = File.objects.filter(date=date).filter(name=name)
        if match.exists():
            match = match.first()
            sweep = match.read()
        else:
            return None

    gatewidth = 1.0e-3 * sweep['gatewidth']
    if gatewidth < 0.05:
        gatewidth *= 2.0;
        sweep['values'] = sweep['values'][:, ::2]

    head = struct.pack('hhhhddddffff', *sweep['values'].shape, 0, 0,
        sweep['sweepTime'], sweep['longitude'], sweep['latitude'], 0.0,
        sweep['sweepElevation'], sweep['sweepAzimuth'], 0.0, gatewidth)
    symbol = sweep['symbol']
    if symbol == 'Z':
        values = sweep['values'] * 2.0 + 64.0
    elif symbol == 'V':
        values = sweep['values'] * 2.0 + 128.0
    elif symbol == 'W':
        values = sweep['values'] * 20.0
    elif symbol == 'D':
        values = sweep['values'] * 10.0 + 100.0
    elif symbol == 'P':
        values = sweep['values'] * 128.0 / np.pi + 128.0
    elif symbol == 'R':
        values = rho2ind(sweep['values'])
    else:
        values = sweep['values']
    # Map to closest integer, 0 is transparent, 1+ is finite.
    # np.nan will be converted to 0 during np.float -> np.uint8
    data = np.array(np.clip(np.round(values), 1.0, 255.0), dtype=np.uint8)
    payload = bytes(head) \
            + bytes(sweep['elevations']) \
            + bytes(sweep['azimuths']) \
            + bytes(data)
    return payload

def load(request, name):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.load()', 'green')
        show += '   ' + color_name_value('name', name)
        logging.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    payload = _load(name + '.nc')
    if payload is None:
        return HttpResponse(f'Data {name} not found', status=204)
    payload = zlib.compress(payload)
    response = HttpResponse(payload, content_type='application/octet-stream')
    response['Content-Encoding'] = 'deflate'
    response['Content-Length'] = len(payload)
    visitor_stats[ip]['bandwidth'] += len(payload)
    return response

'''
    prefix - prefix of a radar, e.g., PX- for PX-1000, RAXPOL- for RaXPol
'''
def _date(prefix):
    if prefix is None:
        return None, None
    day = Day.objects.filter(name=prefix)
    if day.exists():
        day = day.latest('date')
    else:
        show = colorize('archive.date()', 'green')
        show += '   ' + colorize('Empty Day table.', 'white')
        logger.warning(show)
        return None, None
    ymd = day.date.strftime(r'%Y%m%d')
    if settings.VERBOSE > 1:
        show = colorize('archive._date()', 'green')
        show += '   ' + color_name_value('prefix', prefix)
        show += '   ' + color_name_value('day', ymd)
        logger.info(show)
    hour = day.last_hour()
    if hour is None:
        show = colorize('archive._date()', 'green')
        show += '   ' + colorize(' WARNING ', 'warning')
        show += '   ' + colorize(f'Day {day.date} with', 'white')
        show += color_name_value(' .hourly_count', 'zeros')
        logger.warning(show)
        return None, None
    return ymd, hour

def date(request, radar):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.date()', 'green')
        show += '   ' + color_name_value('radar', radar)
        logging.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix:
        return invalid_query
    prefix = radar_prefix[radar]
    ymd, hour = _date(prefix)
    if ymd is None:
        data = {
            'dateString': '19700101-0000',
            'dayISOString': '1970/01/01',
            'hour': 0,
        }
    else:
        data = {
            'dateString': f'{ymd}-{hour:02d}00',
            'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
            'hour': hour,
        }
    payload = json.dumps(data)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    value - Raw RhoHV values
'''
def rho2ind(values):
    m3 = values > 0.93
    m2 = np.logical_and(values > 0.7, ~m3)
    index = values * 52.8751
    index[m2] = values[m2] * 300.0 - 173.0
    index[m3] = values[m3] * 1000.0 - 824.0
    return index

'''
    radar - Input radar name, e.g., px1000, raxpol, etc.
'''
def location(radar):
    global origins
    if settings.VERBOSE > 1:
        show = colorize('archive.location()', 'green')
        show += '   ' + color_name_value('radar', radar)
        logging.debug(show)
    if radar in radar_prefix:
        prefix = radar_prefix[radar]
    else:
        prefix = None
    ymd, hour = _date(prefix)
    if ymd is None:
        origins[radar] = {
          'longitude': -97.422413,
          'latitude': 35.25527,
          'last': '20220125'
        }
    else:
        ymd_hm = f'{ymd}-{hour:02d}00'
        if radar not in origins or origins[radar] is None or origins[radar]['last'] != ymd_hm:
            name = _list(prefix, ymd_hm)[-1] + '.nc'
            file = File.objects.filter(name=name).first()
            data = file.read()
            origins[radar] = {
                'longitude': float(data['longitude']),
                'latitude': float(data['latitude']),
                'last': ymd_hm
            }
    if settings.VERBOSE > 1:
        logger.debug(colorize('archive.location()', 'green'))
        logger.debug(f'origins = {origins}')
        pp.pprint(origins)
    return origins[radar]

'''
    prefix - prefix of a radar, e.g., PX- for PX-1000, RAXPOL- for RaXPol
'''
def _file(prefix, scan='E4.0', symbol='Z'):
    day = Day.objects.filter(name=prefix).latest('date')
    last = day.last_hour_range()
    files = File.objects.filter(name__startswith=prefix, name__endswith=f'{scan}-{symbol}.nc', date__range=last)
    if files.exists():
        file = files.latest('date')
        return file.name
    else:
        return ''

'''
    radar - Input radar name, e.g., px1000, raxpol, etc.
    scan - The 4-th component of filename describing the scan, e.g., E4.0, A120.0, etc.
    symbol - The symbol of a product, e.g., Z, V, W, etc.
'''
def catchup(request, radar, scan='E4.0', symbol='Z'):
    if settings.VERBOSE > 1:
        show = colorize('archive.catchup()', 'green')
        show += '   ' + color_name_value('radar', radar)
        logging.debug(show)
    ip, bad = screen(request)
    if bad:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix:
        return invalid_query
    prefix = radar_prefix[radar]
    ymd, hour = _date(prefix)
    if ymd is None:
        data = {
            'dateString': '19700101-0000',
            'dayISOString': '1970/01/01',
            'hour': 0,
        }
    else:
        dateString = f'{ymd}-{hour:02d}00'
        data = {
            'dateString': dateString,
            'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
            'hour': hour,
        }
        data['count'] = _count(prefix, ymd)
        data['file'] = _file(prefix, scan, symbol)
        data['list'] = _list(prefix, f'{dateString}-{symbol}')
    payload = json.dumps(data)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

def monitor():
    show = colorize('archives.monitor()', 'green')
    show += '   ' + color_name_value('Visitor.objects.count()', Visitor.objects.count())
    logger.info(show)
    while True:
        visitor_stats_access.acquire()
        for ip, stats in visitor_stats.items():
            if stats['count'] == 0 and stats['bandwidth'] == 0:
                continue
            user_agent = stats['headers']['User-Agent'] if 'User-Agent' in stats['headers'] else 'Unknown'
            match = Visitor.objects.filter(ip=ip)
            if match.exists():
                if match.count() > 1:
                    logger.error(f'More than one entries for {ip}, choosing the first ...')
                visitor = match.first()
                visitor.user_agent = user_agent
                visitor.count += stats['count']
                visitor.bandwidth += stats['bandwidth']
                visitor.last_visited = stats['last_visited']
            else:
                visitor = Visitor.objects.create(
                    ip=ip,
                    user_agent=user_agent,
                    count=stats['count'],
                    bandwidth=stats['bandwidth'],
                    last_visited=stats['last_visited'])
            stats['bandwidth'] = 0
            stats['count'] = 0
            visitor.save()
        visitor_stats_access.release()
        time.sleep(3)
