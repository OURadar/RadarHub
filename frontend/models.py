# frontend/consumers.py
#
#   RadarHub
#   Frontend models of the data
#
#   Created by Boonleng Cheong
#

import datetime
import logging
import os
import re
import tarfile

import numpy as np
from common import colorize
from django.conf import settings
from django.core.validators import int_list_validator
from django.db import models
from netCDF4 import Dataset

logger = logging.getLogger('frontend')
pattern_firefox = re.compile(r'(?<=.)Firefox/[0-9.]{1,10}')
pattern_chrome = re.compile(r'(?<=.)Chrome/[0-9.]{1,10}')
pattern_safari = re.compile(r'(?<=.)Safari/[0-9.]{1,10}')
pattern_opera = re.compile(r'(?<=.)Opera/[0-9.]{1,10}')
dot_colors = ['black', 'gray', 'blue', 'green', 'orange']

# Some helper functions

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
 - read() - reads from a plain path or a .tgz / .txz / .tar.xz archive using _read()
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
                # np.nan will be converted to 0 during np.float32 -> np.uint8
                u8 = np.array(np.clip(np.round(u8), 1.0, 255.0), dtype=np.uint8)
                return {
                    'symbol': symbol,
                    'longitude': longitude,
                    'latitude': latitude,
                    'sweepTime': sweepTime,
                    'sweepElevation': sweepElevation,
                    'sweepAzimuth': sweepAzimuth,
                    'waveform': waveform,
                    'gatewidth': gatewidth,
                    'elevations': elevations,
                    'azimuths': azimuths,
                    'values': values,
                    'u8': u8
                }
        except:
            logger.error(f'Error reading {self.name}')
            return empty_sweep


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

    def __repr__(self, long=False, short=False):
        self.fix_date()
        date = self.date.strftime(r'%Y%m%d') if self.date else '00000000'
        if short:
            return self.name + date
        elif long:
            return f'{self.name}{date} {self.count} {self.hourly_count}  B:{self.blue} G:{self.green} O:{self.orange} R:{self.red}'
        else:
            counts = ''.join([f'{n:>4}' for n in self.hourly_count.split(',')])
            show = f'{date} {self.__vbar__()} {counts}'
        return show

    def __vbar__(self):
        b = colorize('●', dot_colors[self.weather_condition()])
        b += ' \033[48;5;238m'
        for s, c in [(self.blue, 'blue'), (self.green, 'green'), (self.orange, 'orange'), (self.red, 'red')]:
            i = min(7, int(s / 100))
            b += colorize(vbar[i], c, end='')
        b += '\033[m'
        return b

    def show(self, long=False, short=False):
        print(self.__repr__(long=long, short=short))

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
        if self.blue < 100:
            cond = 1
        elif self.green < 300 and self.orange < 200:
            cond = 2
        elif self.green / self.blue >= 0.1:
            if self.red / self.green >= 0.1:
                cond = 4
            else:
                cond = 3
        if cond == 0:
            logger.info(f'Day.weather_condition() {self.date} b:{self.blue} g:{self.green} o:{self.orange} r:{self.red} -> {cond} -> 1')
            cond = 1
        return cond

'''
Visitor

 - ip = IP address of the visitor
 - count = total number of screening
 - payload = raw payload size
 - bandwidth = estimated network bandwidth usage
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

    def last_visited_time_string(self):
        return self.last_visited.strftime(r'%Y/%m/%d %H:%M')

    def machine(self):
        # Could just use this: http://www.useragentstring.com/pages/api.php
        if 'Macintosh' in self.user_agent:
            return 'macOS'
        if 'Windows' in self.user_agent:
            return 'Windows'
        if 'Linux' in self.user_agent:
            return 'Linux'
        if 'iPhone' in self.user_agent:
            return 'iOS'
        if 'iPad' in self.user_agent:
            return 'iPadOS'
        if 'Chrome OS' in self.user_agent:
            return 'Chrome OS'
        if 'Search Bot' in self.user_agent:
            return 'Search Bot'
        return 'Unknown'

    def browser(self):
        if pattern_firefox.findall(self.user_agent):
            return 'Firefox'
        if pattern_chrome.findall(self.user_agent):
            return 'Chrome'
        if pattern_safari.findall(self.user_agent):
            return 'Safari'
        if pattern_opera.findall(self.user_agent):
            return 'Opera'
        return 'Unknown'

    def dict(self, num2str=True):
        return {
            'ip': self.ip,
            'count': f'{self.count:,d}' if num2str else self.count,
            'bandwidth': f'{self.bandwidth:,d}' if num2str else self.bandwidth,
            'user_agent': self.user_agent,
            'last_visited': self.last_visited
        }
