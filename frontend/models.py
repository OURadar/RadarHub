# frontend/consumers.py
#
#   RadarHub
#   Frontend models of the data
#
#   Created by Boonleng Cheong
#

# Proposed nomenclature going forward since August 2024:
#   - sweep: a single radar scan
#   - volume: a collection of sweeps
#   - prefix: the first part of the filename, e.g., PX, RAXPOL, etc.
#   - datetime: the second part of the filename, e.g., 20130520-191000
#   - scan: the third part of the filename, e.g., E2.6, A42.0, etc.
#   - symbol: the fourth part of the filename, e.g., Z, V, W, D, P, R, etc.
#   - source_string: a string that contains the prefix, datetime, scan, and symbol (4 parts)
#   - locator: a string that contains the datetime and scan (2 parts)

import os
import re
import json
import radar
import pprint
import logging
import datetime
import threading
import numpy as np

from django.conf import settings
from django.core.validators import int_list_validator
from django.utils.translation import gettext_lazy
from django.db import models

from . import algos

from common import colorize, get_user_agent_string, is_valid_time

# __prog__ = os.path.basename(sys.argv[0])
# logger = dailylog.Logger(os.path.splitext(__prog__)[0], home=settings.LOG_DIR, dailyfile=settings.DEBUG)

logger = logging.getLogger("frontend")
pp = pprint.PrettyPrinter(indent=1, depth=2, width=120, sort_dicts=False)
tzinfo = datetime.timezone.utc
dot_colors = ["black", "gray", "blue", "green", "orange"]
super_numbers = [" ", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹", "⁺", "⁻", "⁼", "⁽", "⁾"]
vbar = [" ", "\U00002581", "\U00002582", "\U00002583", "\U00002584", "\U00002585", "\U00002586", "\U00002587"]

user_agent_strings = {}
if os.path.exists(settings.USER_AGENT_TABLE):
    with open(settings.USER_AGENT_TABLE, "r") as fid:
        user_agent_strings = json.load(fid)

np.set_printoptions(precision=2, threshold=5, linewidth=120)

dummy_data = {
    "kind": "U",
    "txrx": "M",
    "symbol": "Z",
    "time": 1369071296.0,
    "latitude": 35.25527,
    "longitude": -97.422413,
    "sweepElevation": 4.0,
    "sweepAzimuth": 42.0,
    "gatewidth": 150.0,
    "waveform": "s01",
    "prf": 1000.0,
    "elevations": np.array([15, 14.0, 14.2, 16.0], dtype=np.float32),
    "azimuths": np.array([15.0, 30.0, 45.0, 60.0], dtype=np.float32),
    "products": {
        "Z": np.array([[0, 22, -1], [-11, -6, -9], [9, 14, 9], [24, 29, 34]], dtype=np.float32),
        "V": np.array([[1, -3, 4], [-12, -10, -9], [11, 9, 3], [-3, -10, -9]], dtype=np.float32),
    },
}

lock = threading.Lock()
client = None


# Some helper functions

"""
    value - Raw values
"""


def val2ind(v, symbol="Z"):
    def rho2ind(x):
        m3 = x > 0.93
        m2 = np.logical_and(x > 0.7, ~m3)
        index = x * 52.8751
        index[m2] = x[m2] * 300.0 - 173.0
        index[m3] = x[m3] * 1000.0 - 824.0
        return index

    if symbol == "Z":
        u8 = v * 2.0 + 64.0
    elif symbol == "V":
        u8 = v * 2.0 + 128.0
    elif symbol == "W":
        u8 = v * 20.0
    elif symbol == "D":
        u8 = v * 10.0 + 100.0
    elif symbol == "P":
        u8 = v * 128.0 / np.pi + 128.0
    elif symbol == "R":
        u8 = rho2ind(v)
    elif symbol == "I":
        u8 = (v - 0.5) * 42 + 46
    else:
        u8 = v
    # Map to closest integer, 0 is transparent, 1+ is finite.
    # np.nan will be converted to 0 during np.nan_to_num(...)
    return np.nan_to_num(np.clip(np.round(u8), 1.0, 255.0), copy=False).astype(np.uint8)


def starts_with_cf(string):
    return bool(re.match(r"^cf", string, re.IGNORECASE))


# Create your models here.


class File(models.Model):
    """
    File (deprecated)

    - name = filename of the sweep, e.g., PX-20130520-191000-E2.6-Z.nc
    - path = absolute path of the data, e.g., /mnt/data/PX1000/2013/20130520/_original/PX-20130520-191000-E2.6.tar.xz
    - date = date in database native format (UTC)
    - size = size of the .nc file (from tarinfo)
    - offset = offset of the .nc file (from tarinfo)
    - offset_data = offset_data of the .nc file (from tarinfo)

    - show() - shows the self representation on screen
    - get_path() - returns full path of the archive that contains the file
    - get_age() - returns the current age of the file
    - read() - reads from a plain path or a .tgz / .txz / .tar.xz archive using _read() and returns a sweep
    - _read() - reads from a file object, returns a dictionary with the data
    """

    name = models.CharField(max_length=48)
    path = models.CharField(max_length=256)
    date = models.DateTimeField()
    size = models.PositiveIntegerField(0)
    offset = models.PositiveIntegerField(default=0)
    offset_data = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["name"]),
        ]

    def __repr__(self):
        return f"{self.name} @ {self.path}"

    def show(self):
        print(self.__repr__())

    def get_path(self, search=True):
        path = os.path.join(self.path, self.name)
        if os.path.exists(path):
            return path
        if not search:
            return None
        path = os.path.join(self.path.replace("/mnt/data", "/Volumes/Data"), self.name)
        if os.path.exists(path):
            return path
        path = os.path.join(os.path.expanduser("~/Downloads"), self.name)
        if os.path.exists(path):
            return path
        return None

    def get_age(self):
        now = datetime.datetime.now(datetime.UTC)
        return now - self.date

    def read(self, finite=False):
        return radar.read(self.path, finite=finite)

    @staticmethod
    def dummy_sweep(name="PX-20130520-123456-Z.nc"):
        parts = name.split("-")
        sweep = dummy_data.copy()
        sweep["time"] = datetime.datetime.strptime(parts[1] + parts[2], r"%Y%m%d%H%M%S").timestamp()
        sweep["sweepElevation"] = float(parts[3][1:]) if "E" in parts[3] else 0.0
        sweep["sweepAzimuth"] = float(parts[3][1:]) if "A" in parts[3] else 42.0
        sweep["symbol"] = parts[4] if len(parts) > 4 else "Z"
        return sweep

    @staticmethod
    def load(name):
        # Database is indexed by date so we extract the time first for a quicker search
        match = radar.re_4parts.search(name)
        if match is None:
            logger.error(f"Invalid name {name}")
            return radar.empty_sweep
        parts = match.groupdict()
        s = parts["datetime"]
        if not is_valid_time(s):
            return radar.empty_sweep
        date = f"{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z"

        # product = {
        #     'Z': {'source': name, 'process': algos.passthrough, 'valuemap': 'Z'},
        #     'V': {'source': name, 'process': algos.passthrough, 'valuemap': 'V'},
        # }

        symbol = parts["symbol"]
        if symbol in ["Z", "V", "W", "D", "P", "R"]:
            source = name
            process = algos.passthrough
            valuemap = parts["symbol"]
        elif symbol == "I":
            source = "-".join([parts["prefix"], parts["datetime"], parts["scan"], "V"])
            process = algos.vlabel
            valuemap = "I"
        elif symbol == "U":
            source = "-".join([parts["prefix"], parts["datetime"], parts["scan"], "V"])
            process = algos.vunfold
            valuemap = "V"
        elif symbol == "Y":
            source = "-".join([parts["prefix"], parts["datetime"], parts["scan"], "Z"])
            process = algos.zshift
            valuemap = "Z"
        else:
            return radar.empty_sweep

        match = File.objects.filter(date=date).filter(name__startswith=source)
        if match.exists():
            match = match.first()
            sweep = match.read()
            sweep["values"] = process(sweep["values"])
            sweep["u8"] = val2ind(sweep["values"], symbol=valuemap)
            return sweep
        else:
            return radar.empty_sweep


class Day(models.Model):
    """
    Day

    - date = date in database native format (UTC)
    - name = name of the dataset, e.g., PX, RAXPOL, etc.
    - count = number of volumes
    - duration = estimated collection time, assuming each volume takes 20s
    - blue = blue count
    - green = green count
    - orange = orange count
    - red = red count
    - hourly_count = number of volumes of each hour

    other properties
    - day_string - returns a day string in YYYY-MM-DD format
    - first_hour - returns the first hour with data (int)
    - last_hour - returns the last hour with data (int)
    - day_range - returns the day as a range, e.g., ['2022-01-21 00:00:00Z', '2022-01-21 23:59:59.9Z]
    - latest_datetime_range - returns the latest as a range, e.g., ['2022-01-21 03:00:00Z', '2022-01-21 03:59:59.9Z]

    methods:
    - show() - shows a few instance variables
    - fix_date() - ensures the date is a datetime.date object
    - weather_condition() - returns one of these: 1-HAS_DATA, 2-HAS_CLEAR_AIR, 3-HAS_RAIN, 4-HAS_INTENSE_RAIN
    """

    date = models.DateField()
    name = models.CharField(max_length=8, default="PX-")
    count = models.PositiveIntegerField(default=0)
    duration = models.PositiveIntegerField(default=0)
    blue = models.PositiveIntegerField(default=0)
    green = models.PositiveIntegerField(default=0)
    orange = models.PositiveIntegerField(default=0)
    red = models.PositiveIntegerField(default=0)
    hourly_count = models.CharField(
        default="0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0", max_length=120, validators=[int_list_validator]
    )

    class Meta:
        indexes = [models.Index(fields=["date"]), models.Index(fields=["name"])]

    def __repr__(self, format="pretty"):
        self.fix_date()
        date = self.date.strftime(r"%Y%m%d") if self.date else "00000000"
        dot = colorize("●", dot_colors[self.weather_condition()])
        if format == "short":
            return f"{self.name}-{date}"
        elif format == "raw":
            return f"{self.name}-{date} {dot} {self.blue},{self.green},{self.orange},{self.red} {self.count} {self.hourly_count} ({len(self.hourly_count)})"
        else:

            def _int2str(num):
                q = num // 1000
                r = num % 1000
                s = super_numbers[q] + str(r)
                return f"{s:>4}"

            counts = "".join([_int2str(int(n)) for n in self.hourly_count.split(",")])
            show = f"{self.name}-{date} {dot} {self.__vbar__()} {counts}"
        return show

    def __vbar__(self):
        b = "\033[48;5;238m"
        for s, c in [(self.blue, "blue"), (self.green, "green"), (self.orange, "orange"), (self.red, "red")]:
            i = min(7, int(s / 100))
            b += colorize(vbar[i], c, end="")
        b += "\033[m"
        return b

    def show(self, format=""):
        print(self.__repr__(format=format))

    def fix_date(self):
        if self.date is None:
            return
        if not isinstance(self.date, datetime.date):
            try:
                self.date = datetime.date.fromisoformat(self.date)
            except:
                logger.warning(f"fix_date() Unable to fix {self.date}")
                self.date = None

    @property
    def day_string(self, format=f"%Y-%m-%d"):
        if self.date is None:
            return None
        self.fix_date()
        return self.date.strftime(format)

    @property
    def first_hour(self):
        hours = [k for k, e in enumerate(self.hourly_count.split(",")) if e != "0"]
        return min(hours) if len(hours) else None

    @property
    def last_hour(self):
        hours = [k for k, e in enumerate(self.hourly_count.split(",")) if e != "0"]
        return max(hours) if len(hours) else None

    @property
    def day_range(self):
        if self.date is None:
            return None
        day = self.day_string
        return [f"{day} {self.first_hour:02d}:00Z", f"{day} {self.last_hour:02d}:59:59.9Z"]

    @property
    def latest_datetime_range(self):
        if self.date is None:
            return None
        end_time = datetime.datetime(self.date.year, self.date.month, self.date.day, self.last_hour, 59, 59)
        beg_time = end_time - datetime.timedelta(hours=2)
        return [beg_time.strftime(r"%Y-%m-%d %H:%M:%SZ"), end_time.strftime(r"%Y-%m-%d %H:%M:%SZ")]

    def weather_condition(self):
        cond = 0
        if self.blue < 100 and self.green < 500:
            cond = 1
        elif self.green < 250 and self.orange < 200:
            cond = 2
        elif self.blue > 0 and self.green / self.blue >= 0.1:
            if self.green > 0 and self.red / self.green >= 0.1:
                cond = 4
            else:
                cond = 3
        elif self.blue >= 100:
            cond = 2
        elif self.blue == 0 and self.green == 1000 and self.red == 0:
            cond = 1
        if cond == 0:
            logger.info(
                f"Day.weather_condition() {self.name}{self.date} b:{self.blue} g:{self.green} o:{self.orange} r:{self.red} -> {cond} -> 1"
            )
            cond = 1
        return cond

    def summarize(self):
        myname = colorize("Day.compute()", "green")
        logger.debug(f"{myname}")

        day_datetime = datetime.datetime(self.date.year, self.date.month, self.date.day, tzinfo=datetime.timezone.utc)
        hourly_count = [int(h) for h in self.hourly_count.split(",")]
        stride = datetime.timedelta(minutes=20)
        hour = datetime.timedelta(hours=1)

        day_set = Sweep.objects.filter(time__range=self.day_range, name=self.name)
        if day_set.count() == 0:
            return

        b = 0
        g = 0
        o = 0
        r = 0
        total = 0
        for k, count in enumerate(hourly_count):
            if count == 0:
                continue
            logger.debug(f"hour = {k}   count = {count}")
            s = day_datetime + k * hour
            e = s + hour
            date_range = [s, e]
            hour_set = day_set.filter(time__range=date_range, name=self.name)
            scans = list(np.unique([sweep.scan for sweep in hour_set]))
            if len(scans) > 1 and "E0.0" in scans:
                scans.remove("E0.0")
            for j, scan in enumerate(scans):
                sweeps = hour_set.filter(time__range=date_range, name=self.name, scan=scan)
                if sweeps.exists():
                    select = j * len(sweeps) // len(scans)
                    sweep = sweeps[select] if select < len(sweeps) else sweeps.first()
                    logger.debug(f"DEBUG: {sweep}")
                    sweep.load(finite=True, symbols=["Z"])
                    z = sweep.z
                    # Zero out the first few kilometers
                    if sweep.kind == Sweep.Kind.WDS:
                        ng = int(5000.0 / sweep.data["gatewidth"])
                    else:
                        ng = 24
                    sweep.z[:, :ng] = -100.0
                    b += np.sum(z >= 5.0)
                    g += np.sum(z >= 20.0)
                    o += np.sum(z >= 35.0)
                    r += np.sum(z >= 50.0)
                    total += z.size
                s += stride
        # print(f'total = {total}  b = {b}  g = {g}  o = {o}  r = {r}')
        r = 1000 * r / o if r else 0
        o = 1000 * o / g if o else 0
        g = 1000 * g / b if g else 0
        b = 10000 * b / total if b else 0
        # print(f'total = {total}  b = {b}  g = {g}  o = {o}  r = {r}')
        self.blue = int(b)
        self.green = int(g)
        self.orange = int(o)
        self.red = int(r)
        self.save()


class Visitor(models.Model):
    """
    Visitor

    - ip = IP address of the visitor
    - count = total number of screening
    - payload = raw payload size (B)
    - bandwidth = network bandwidth usage (B)
    - user_agent = the last inspected OS / browser
    - last_visitor = last visited date time

    - machine() - returns the OS
    - browser() - returns the browser
    - dict() - returns self as a dictionary
    """

    ip = models.GenericIPAddressField()
    count = models.PositiveIntegerField(default=0)
    payload = models.PositiveIntegerField(default=0)
    bandwidth = models.PositiveIntegerField(default=0)
    user_agent = models.CharField(max_length=256, default="")
    last_visited = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=["ip"])]

    def __repr__(self):
        time_string = self.last_visited_time_string()
        return f"{self.ip} : {self.count} : {self.bandwidth} : {time_string}"

    def last_visited_date_string(self):
        return self.last_visited.strftime(r"%Y/%m/%d")

    def last_visited_time_string(self):
        return self.last_visited.strftime(r"%Y/%m/%d %H:%M")

    def user_agent_string(self):
        return get_user_agent_string(self.user_agent)

    def dict(self, num2str=True):
        return {
            "ip": self.ip,
            "count": f"{self.count:,d}" if num2str else self.count,
            "payload": f"{self.payload:,d}" if num2str else self.payload,
            "bandwidth": f"{self.bandwidth:,d}" if num2str else self.bandwidth,
            "user_agent": self.user_agent,
            "last_visited": self.last_visited,
        }


class Sweep(models.Model):
    """
    Sweep - New model that replaces the File model. An encapsulation of a sweep that contains multiple products

    NOTE: Product symbol is no longer required in name

    - time : time in database in native datetime format (UTC)
    - kind : data storage architecture, e.g., CF-Radial, WDSS-II
    - scan : elevation, azimuth, or just number, e.g., E2.4, A42.0, N64
    - name : prefix of the data, e.g., "PX" for PX-20130520-191000-E2.6
    - path : absolute path of the data, e.g., /mnt/data/PX1000/2013/20130520/_original/PX-20130520-191000-E2.6.tar.xz
    - tarinfo: {"Z": (name, size, offset, offset_data),
                "V": (name, size, offset, offset_data),
                "W": (name, size, offset, offset_data), ...}
    """

    # name = "PX-20130520-191000-E2.6-Z.nc" for split; "BS1-20130520-191000-E2.6.nc" for single
    class Kind(models.TextChoices):
        UNK = "U", gettext_lazy("Unknown")
        CF1 = "1", gettext_lazy("CF-Radial-1")
        CF2 = "2", gettext_lazy("CF-Radial-2")
        WDS = "W", gettext_lazy("WDSS-II")

    class TxRx(models.TextChoices):
        M = "M", gettext_lazy("Monostatic")
        B = "B", gettext_lazy("Bistatic")

    time = models.DateTimeField()
    kind = models.CharField(max_length=8, default=Kind.UNK)
    scan = models.CharField(max_length=8, default="N0")
    name = models.CharField(max_length=16)
    path = models.CharField(max_length=256)
    symbols = models.CharField(max_length=256, blank=True)
    tarinfo = models.JSONField(blank=True, default=dict)
    data = None

    class Meta:
        indexes = [models.Index(fields=["time"]), models.Index(fields=["name"])]

    def __repr__(self, format=None):
        datetimeString = self.time.strftime(r"%Y%m%d-%H%M%S")
        if format == "full":
            return f"Sweep('{self.name}', '{datetimeString}', '{self.scan}', [{self.symbols}]) @ {self.path}"
        return f"Sweep('{self.name}', '{datetimeString}', '{self.scan}', {self.symbols})"

    def __str__(self):
        return self.__repr__()

    def _get_product(self, symbol):
        if self.data is None:
            self.load(suppress=True)
        return self.data["products"].get(symbol, None)

    @property
    def z(self):
        return self._get_product("Z")

    @property
    def v(self):
        return self._get_product("V")

    @property
    def w(self):
        return self._get_product("W")

    @property
    def d(self):
        return self._get_product("D")

    @property
    def p(self):
        return self._get_product("P")

    @property
    def r(self):
        return self._get_product("R")

    @property
    def locator(self):
        return f"{self.time.strftime(r'%Y%m%d-%H%M%S')}-{self.scan}"

    # def read_all(self, verbose=0):
    #     return radar.read(self.path, tarinfo=self.tarinfo, verbose=verbose)

    def load(self, symbols=["Z", "V", "W", "D", "P", "R"], finite=False, verbose=0, suppress=False):
        # if "*" in self.tarinfo:
        #     if verbose > 1:
        #         logger.debug(f"Loading {self.name}-{self.locator} @ {self.path} ...")
        #     self.data = self.read_all(verbose=verbose)
        #
        #     client = ProductClient()
        #     self.data = client.get(self.path)
        # else:
        #     self.data = radar.read(self.path, symbols=symbols, tarinfo=self.tarinfo, verbose=verbose)
        myname = colorize("Sweep.load()", "green")
        global client
        with lock:
            if client is None:
                logger.debug(f"{myname} Creating ProductClient ...")
                from product import ProductClient
                client = ProductClient(n=4)
        self.data = client.get(self.path, tarinfo=self.tarinfo)
        if verbose > 1:
            print(f"{myname} {self.__str__()}")
            print("tarinfo =")
            pp.pprint(self.tarinfo)
            print("data =")
            pp.pprint(self.data)
        if suppress:
            return
        products = self.data["products"]
        output = {k: v for k, v in self.data.items() if k != "products"}
        if finite:
            output["products"] = {k: np.nan_to_num(v) for k, v in products.items() if k in symbols}
        else:
            output["products"] = {k: v for k, v in products.items() if k in symbols}
        return output

    def summary(self, markdown=False):
        if self.data is None:
            self.load()
        shape = self.z.shape
        # Data size for the frontend
        size = 56 + 2 * shape[0] * 4 + shape[0] * shape[1]
        np.set_printoptions(formatter={"float": "{:.1f}".format})
        if markdown:
            timestr = self.time.strftime(r"%Y%m%d-%H%M%S")
            message = f"Sweep Summary of `{self.name}-{timestr}`\n\n"
            message += "| Key | Values |\n"
            message += "|---|---|\n"
            for k, v in self.data.items():
                if k == "products":
                    continue
                message += f"| `{k}` | {v} |\n"
            message += f"| shape | {shape} |\n"
            message += f"| size | {size:,d} B |\n"
            print(message)
        else:
            print("Sweep.data =")
            pp.pprint(self.data)
            print(f"Data shape = {shape}\nRaw size = {size:,d} B")

    @staticmethod
    def read(source, finite=False, u8=False, verbose=0):
        myname = colorize("Sweep.read()", "green")
        parts = radar.re_4parts.search(source)
        if parts is None:
            parts = radar.re_3parts.search(source)
            if parts is None:
                logger.error(f"Unidentified source = {source}")
                return radar.empty_sweep
            parts = parts.groupdict()
            symbols = ["Z", "V", "W", "D", "P", "R"]
        else:
            parts = parts.groupdict()
            symbols = [parts["symbol"]]
        if verbose > 1:
            print(f"{myname} {source}  {parts['time']}  {symbols}")
        time = datetime.datetime.strptime(parts["time"], r"%Y%m%d-%H%M%S").replace(tzinfo=tzinfo)
        query = Sweep.objects.filter(time=time, name=parts["name"])
        if query is None:
            logger.error(f"{myname} {source} not found")
            return radar.empty_sweep
        sweep = query.first()
        data = sweep.load(symbols=symbols, finite=finite, verbose=verbose)
        if u8:
            data["u8"] = {}
            for key, value in data["products"].items():
                if np.ma.isMaskedArray(value):
                    value = value.filled(np.nan)
                data["u8"][key] = val2ind(value, symbol=key)
        return data

    @staticmethod
    def location(source):
        myname = colorize("Sweep.location()", "green")
        origin = {"longitude": -97.43730160, "latitude": 35.1812820}
        parts = radar.re_2parts.search(source)
        if parts is None:
            day = Day.objects.filter(name=source)
            if len(day) == 0:
                return {**origin, "last": "00000000"}
        else:
            parts = parts.groupdict()
            day = Day.objects.filter(name=parts["name"])
        if not day.exists():
            logger.warn(f"Sweep.location() {source} not found")
            return {**origin, "last": "00000000"}
        day = day.latest("date")
        ymd = day.date.strftime(r"%Y%m%d")
        hour = day.last_hour
        if hour is None:
            message = colorize(f" {source} has no data for the day ", "warning")
            logger.warn(f"{myname}   {message}")
            return {**origin, "last": ymd}
        ss = datetime.datetime.strptime(f"{ymd}{hour:02d}0000Z", r"%Y%m%d%H%M%SZ").replace(tzinfo=tzinfo)
        ee = datetime.datetime.strptime(f"{ymd}{hour:02d}5959.9Z", r"%Y%m%d%H%M%S.%fZ").replace(tzinfo=tzinfo)
        name = day.name
        query = Sweep.objects.filter(time__range=[ss, ee], name=name)
        if query is None:
            message = colorize(f"{name} not found", "red")
            logger.warn(f"{myname} {message}")
            return {**origin, "last": ymd}
        sweep = query.first()
        try:
            data = sweep.load()
        except:
            return {**origin, "last": ymd}
        if hasattr(data["latitude"], "mask") and (data["latitude"].mask or data["longitude"].mask):
            date = datetime.datetime.fromtimestamp(data["time"]).strftime(r"%Y%m%d-%H%M%S")
            message = colorize(f" {name}-{date} has invalid location ", "warning")
            logger.warn(f"{myname} {message}")
            return {**origin, "last": ymd}
        return {"longitude": data["longitude"], "latitude": data["latitude"], "last": ymd}

    @staticmethod
    def dummy_data(name="PX-20130520-123456-E2.6-Z", u8=False):
        logger.info(f"Sweep.dummy_data({name})")
        parts = radar.re_4parts.search(name)
        if parts is None:
            return radar.empty_sweep
        parts = parts.groupdict()
        data = dummy_data.copy()
        data["time"] = datetime.datetime.strptime(parts["time"], r"%Y%m%d-%H%M%S").timestamp()
        data["sweepElevation"] = float(parts["scan"][1:]) if "E" in parts["scan"] else 0.0
        data["sweepAzimuth"] = float(parts["scan"][1:]) if "A" in parts["scan"] else 42.0
        data["symbol"] = parts["symbol"]
        if u8:
            data["u8"] = {}
            for key, value in data["products"].items():
                if np.ma.isMaskedArray(value):
                    value = value.filled(np.nan)
                data["u8"][key] = val2ind(value, symbol=key)
        return data
