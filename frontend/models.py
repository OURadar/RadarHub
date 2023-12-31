# frontend/consumers.py
#
#   RadarHub
#   Frontend models of the data
#
#   Created by Boonleng Cheong
#

import os
import json
import logging
import tarfile
import datetime

import numpy as np

from common import colorize, get_user_agent_string
from django.conf import settings
from django.core.validators import int_list_validator
from django.db import models
from netCDF4 import Dataset

logger = logging.getLogger('frontend')

dot_colors = ['black', 'gray', 'blue', 'green', 'orange']

user_agent_strings = {}
if os.path.exists(settings.USER_AGENT_TABLE):
    with open(settings.USER_AGENT_TABLE, 'r') as fid:
        user_agent_strings = json.load(fid)

np.set_printoptions(precision=2, threshold=5, linewidth=120)

vbar = [' ', '\U00002581', '\U00002582', '\U00002583', '\U00002584', '\U00002585', '\U00002586', '\U00002587']

super_numbers = [' ', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁺', '⁻', '⁼', '⁽', '⁾']

empty_sweep = {
    'symbol': 'U',
    'longitude': -97.422413,
    'latitude': 35.25527,
    'sweepTime': 1369071296.0,
    'sweepElevation': 0.5,
    'sweepAzimuth': 42.0,
    'gatewidth': 15.0,
    'waveform': 's0',
    'elevations': np.empty((0, 0), dtype=np.float32),
    'azimuths': np.empty((0, 0), dtype=np.float32),
    'values': np.empty((0, 0), dtype=np.float32),
    'u8': np.empty((0, 0), dtype=np.uint8)
}

dummy_sweep = {
    'symbol': "Z",
    'longitude': -97.422413,
    'latitude': 35.25527,
    'sweepTime': 1369071296.0,
    'sweepElevation': 4.0,
    'sweepAzimuth': 42.0,
    'gatewidth': 150.0,
    'waveform': 's01',
    'elevations': np.array([4.0, 4.0, 4.0, 4.0], dtype=np.float32),
    'azimuths': np.array([0.0, 15.0, 30.0, 45.0], dtype=np.float32),
    'values': np.array([[0, 22, -1], [-11, -6, -9], [9, 14, 9], [24, 29, 34]], dtype=np.float32),
    'u8': np.array([[64, 108, 62], [42, 52, 46], [82, 92, 82], [112, 122, 132]], dtype=np.uint8)
}

# Some helper functions

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

# Create your models here.

'''
File

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
'''
class File(models.Model):
    name = models.CharField(max_length=48)
    path = models.CharField(max_length=256)
    date = models.DateTimeField()
    size = models.PositiveIntegerField(0)
    offset = models.PositiveIntegerField(default=0)
    offset_data = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['date', ]),
                   models.Index(fields=['name', ])]

    def __repr__(self):
        return f'{self.name} @ {self.path}'

    def show(self):
        print(self.__repr__())

    def get_path(self, search=True):
        path = os.path.join(self.path, self.name)
        if os.path.exists(path):
            return path
        if not search:
            return None
        path = os.path.join(self.path.replace('/mnt/data', '/Volumes/Data'), self.name)
        if os.path.exists(path):
            return path
        path = os.path.join(os.path.expanduser('~/Downloads'), self.name)
        if os.path.exists(path):
            return path
        return None

    def get_age(self):
        now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
        return now - self.date

    def read(self, finite=False):
        if any([ext in self.path for ext in ['tgz', 'txz', 'tar.xz']]):
            if settings.VERBOSE > 1:
                print(f'models.File.read() {self.path}')
            try:
                with tarfile.open(self.path) as aid:
                    info = tarfile.TarInfo(self.name)
                    info.size = self.size
                    info.offset = self.offset
                    info.offset_data = self.offset_data
                    with aid.extractfile(info) as fid:
                        return self._read(fid, finite=finite)
            except:
                logger.error(f'Error opening archive {self.path}')
                return empty_sweep
        else:
            source = self.get_path()
            if source is None:
                return empty_sweep
            with open(source, 'rb') as fid:
                return self._read(fid, finite=finite)

    def _read(self, fid, finite=False):
        try:
            with Dataset('memory', mode='r', memory=fid.read()) as nc:
                symbol = self.name.split('.')[-2].split('-')[-1]
                name = nc.getncattr('TypeName')
                longitude = nc.getncattr('Longitude')
                latitude = nc.getncattr('Latitude')
                sweepTime = nc.getncattr('Time')
                sweepElevation = nc.getncattr('Elevation')
                sweepAzimuth = nc.getncattr('Azimuth')
                attrs = nc.ncattrs()
                waveform = nc.getncattr('Waveform') if 'Waveform' in attrs else ''
                gatewidth = float(nc.variables['GateWidth'][:][0])
                elevations = np.array(nc.variables['Elevation'][:], dtype=np.float32)
                azimuths = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
                values = np.array(nc.variables[name][:], dtype=np.float32)
                createdBy = nc.getncattr('CreatedBy')
                if finite:
                    values = np.nan_to_num(values)
                else:
                    values[values < -90] = np.nan
                if symbol == 'Z':
                    u8 = values * 2.0 + 64.0
                elif symbol == 'V':
                    u8 = values * 2.0 + 128.0
                elif symbol == 'W':
                    u8 = values * 20.0
                elif symbol == 'D':
                    u8 = values * 10.0 + 100.0
                elif symbol == 'P':
                    u8 = values * 128.0 / np.pi + 128.0
                elif symbol == 'R':
                    u8 = rho2ind(values)
                else:
                    u8 = values
                # Map to closest integer, 0 is transparent, 1+ is finite.
                # np.nan will be converted to 0 during np.nan_to_num(...)
                u8 = np.nan_to_num(np.clip(np.round(u8), 1.0, 255.0), copy=False).astype(np.uint8)
                return {
                    'symbol': symbol,
                    'longitude': longitude,
                    'latitude': latitude,
                    'sweepTime': sweepTime,
                    'sweepElevation': sweepElevation,
                    'sweepAzimuth': sweepAzimuth,
                    'gatewidth': gatewidth,
                    'waveform': waveform,
                    'createdBy': createdBy,
                    'elevations': elevations,
                    'azimuths': azimuths,
                    'values': values,
                    'u8': u8
                }
        except:
            logger.error(f'Error reading {self.name}')
            return empty_sweep

    @staticmethod
    def dummy_sweep(name='PX-20130520-123456-Z.nc'):
        parts = name.split('-')
        sweep = dummy_sweep.copy()
        sweep['symbol'] = parts[4] if len(parts) > 4 else "Z"
        sweep['sweepTime'] = datetime.datetime.strptime(parts[1] + parts[2], r'%Y%m%d%H%M%S').timestamp()
        sweep['sweepElevation'] = float(parts[3][1:]) if "E" in parts[3] else 0.0
        sweep['sweepAzimuth'] = float(parts[3][1:]) if "A" in parts[3] else 42.0
        return sweep

'''
Day

 - date = date in database native format (UTC)
 - name = name of the dataset, e.g., PX-
 - count = number of volumes
 - duration = estimated collection time, assuming each volume takes 20s
 - blue = for future
 - green = for future
 - orange = for future
 - red = for future
 - hourly_count = number of volumes of each hour

 - show() - shows a few instance variables
 - fix_date() - ensures the date is a datetime.date object
 - first_hour() - returns the first hour with data (int)
 - last_hour() - returns the last hour with data (int)
 - day_string() - returns a day string in YYYY-MM-DD format
 - last_hour_range() - returns the last hour as a range, e.g., ['2022-01-21 03:00:00Z', '2022-01-21 03:59:59.9Z]
 - day_range() - returns the day as a range, e.g., ['2022-01-21 00:00:00Z', '2022-01-21 23:59:59.9Z]
 - weather_condition() - returns one of these: 1-HAS_DATA, 2-HAS_CLEAR_AIR, 3-HAS_RAIN, 4-HAS_INTENSE_RAIN
'''
class Day(models.Model):
    date = models.DateField()
    name = models.CharField(max_length=8, default='PX-')
    count = models.PositiveIntegerField(default=0)
    duration = models.PositiveIntegerField(default=0)
    blue = models.PositiveIntegerField(default=0)
    green = models.PositiveIntegerField(default=0)
    orange = models.PositiveIntegerField(default=0)
    red = models.PositiveIntegerField(default=0)
    hourly_count = models.CharField(default='0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0',
        max_length=120, validators=[int_list_validator])

    class Meta:
        indexes = [models.Index(fields=['date', ]),
                   models.Index(fields=['name', ])]

    def __repr__(self, format='pretty'):
        self.fix_date()
        date = self.date.strftime(r'%Y%m%d') if self.date else '00000000'
        dot = colorize('●', dot_colors[self.weather_condition()])
        if format == 'short':
            return self.name + date
        elif format == 'raw':
            return f'{self.name}{date} {dot} {self.blue},{self.green},{self.orange},{self.red} {self.count} {self.hourly_count} ({len(self.hourly_count)})'
        else:
            def _int2str(num):
                q = num // 1000
                r = num % 1000
                s = super_numbers[q] + str(r)
                return f'{s:>4}'
            counts = ''.join([_int2str(int(n)) for n in self.hourly_count.split(',')])
            show = f'{date} {dot} {self.__vbar__()} {counts}'
        return show

    def __vbar__(self):
        b = '\033[48;5;238m'
        for s, c in [(self.blue, 'blue'), (self.green, 'green'), (self.orange, 'orange'), (self.red, 'red')]:
            i = min(7, int(s / 100))
            b += colorize(vbar[i], c, end='')
        b += '\033[m'
        return b

    def show(self, format=''):
        print(self.__repr__(format=format))

    def fix_date(self):
        if self.date is None:
            return
        if not isinstance(self.date, datetime.date):
            try:
                self.date = datetime.date.fromisoformat(self.date)
            except:
                logger.warning(f'fix_date() Unable to fix {self.date}')
                self.date = None

    def first_hour(self):
        hours = [k for k, e in enumerate(self.hourly_count.split(',')) if e != '0']
        return min(hours) if len(hours) else None

    def last_hour(self):
        hours = [k for k, e in enumerate(self.hourly_count.split(',')) if e != '0']
        return max(hours) if len(hours) else None

    def day_string(self):
        if self.date is None:
            return None
        self.fix_date()
        return self.date.strftime(f'%Y-%m-%d')

    def last_hour_range(self):
        if self.date is None:
            return None
        day = self.day_string()
        hour = self.last_hour()
        day_hour = f'{day} {hour:02d}'
        return [f'{day_hour}:00:00Z', f'{day_hour}:59:59.9Z']

    def day_range(self):
        if self.date is None:
            return None
        day = self.day_string()
        first = self.first_hour()
        last = self.last_hour()
        return [f'{day} {first:02d}:00Z', f'{day} {last:02d}:59:59.9Z']

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
            logger.info(f'Day.weather_condition() {self.name}{self.date} b:{self.blue} g:{self.green} o:{self.orange} r:{self.red} -> {cond} -> 1')
            cond = 1
        return cond

'''
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
'''

class Visitor(models.Model):
    ip = models.GenericIPAddressField()
    count = models.PositiveIntegerField(default=0)
    payload = models.PositiveIntegerField(default=0)
    bandwidth = models.PositiveIntegerField(default=0)
    user_agent = models.CharField(max_length=256, default='')
    last_visited = models.DateTimeField()

    class Meta:
        indexes = [models.Index(fields=['ip', ])]

    def __repr__(self):
        time_string = self.last_visited_time_string()
        return f'{self.ip} : {self.count} : {self.bandwidth} : {time_string}'

    def last_visited_date_string(self):
        return self.last_visited.strftime(r'%Y/%m/%d')

    def last_visited_time_string(self):
        return self.last_visited.strftime(r'%Y/%m/%d %H:%M')

    def user_agent_string(self):
        return get_user_agent_string(self.user_agent)

    def dict(self, num2str=True):
        return {
            'ip': self.ip,
            'count': f'{self.count:,d}' if num2str else self.count,
            'payload': f'{self.payload:,d}' if num2str else self.payload,
            'bandwidth': f'{self.bandwidth:,d}' if num2str else self.bandwidth,
            'user_agent': self.user_agent,
            'last_visited': self.last_visited
        }
