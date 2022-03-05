import os
import re
import tarfile
import datetime
import numpy as np
from netCDF4 import Dataset
from django.db import models
from django.core.validators import int_list_validator
from django.conf import settings

from common import colorize

# Some helper functions

np.set_printoptions(precision=2, threshold=5, linewidth=120)
match_day = re.compile(r'([12][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])').match
vbar = [' ', '\U00002581', '\U00002582', '\U00002583', '\U00002584', '\U00002585', '\U00002586', '\U00002587']

def valid_day(day):
    return match_day(day) is not None

# Create your models here.

'''
File

 - name = filename of the sweep, e.g., PX-20130520-191000-E2.6-Z.nc
 - path = absolute path of the data, e.g., /mnt/data/PX1000/2013/20130520/_original/PX-20130520-191000-E2.6.tar.xz
 - date = date in database native format (UTC)
 - size = size of the .nc file (from tarinfo)
 - offset = offset of the .nc file (from tarinfo)
 - offset_data = offset_data of the .nc file (from tarinfo)

 - getFullPath() - returns full path of the archive that contains the file
 - read() - reads from a plain path or a .tar / .tar.xz archive using _read()
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

    def getFullpath(self, search=True):
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

    def read(self, finite=False):
        if any([ext in self.path for ext in ['tgz', 'tar.xz']]):
            if settings.VERBOSE:
                print(f'models.File.read() {self.path}')
            with tarfile.open(self.path) as aid:
                info = tarfile.TarInfo(self.name)
                info.size = self.size
                info.offset = self.offset
                info.offset_data = self.offset_data
                with aid.extractfile(info) as fid:
                    return self._read(fid, finite=finite)
        else:
            fullpath = self.getFullpath()
            if fullpath is None:
                return None
            with open(fullpath, 'rb') as fid:
                return self._read(fid, finite=finite)

    def _read(self, fid, finite=False):
        with Dataset('memory', mode='r', memory=fid.read()) as nc:
            name = nc.getncattr('TypeName')
            elevations = np.array(nc.variables['Elevation'][:], dtype=np.float32)
            azimuths = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
            values = np.array(nc.variables[name][:], dtype=np.float32)
            if finite:
                values = np.nan_to_num(values)
            else:
                values[values < -90] = np.nan
            longitude = nc.getncattr('Longitude')
            latitude = nc.getncattr('Latitude')
            sweepElevation = nc.getncattr('Elevation')
            sweepTime = nc.getncattr('Time')
            gatewidth = float(nc.variables['GateWidth'][:][0])
            symbol = self.name.split('.')[-2].split('-')[-1]
            return {
                'symbol': symbol,
                'longitude': longitude,
                'latitude': latitude,
                'sweepTime': sweepTime,
                'sweepElevation': sweepElevation,
                'gatewidth': gatewidth,
                'elevations': elevations,
                'azimuths': azimuths,
                'values': values
            }

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
 - first_hour() - returns the first hour with data (int)
 - last_hour() - returns the last hour with data (int)
 - last_date_range() - returns the last hour as range, e.g., ['2022-01-21 00:00:00Z', '2022-01-21 00:59:59.9Z]
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
            return self.name + self.date.strftime(r'%Y%m%d')
        elif long:
            return f'{self.name}{date} {self.count} {self.hourly_count}  B:{self.blue} G:{self.green} O:{self.orange} R:{self.red}'
        else:
            counts = ' '.join([f'{n:>3}' for n in self.hourly_count.split(',')])
            b = '\033[48;5;238m'
            for s, c in [(self.blue, 'blue'), (self.green, 'green'), (self.orange, 'orange'), (self.red, 'red')]:
                i = min(7, int(s / 100))
                b += colorize(vbar[i], c, end='')
            b += '\033[m'
            show = f'{self.name}{date} {counts} {b}'
        return show

    def show(self, long=False, short=False):
        print(self.__repr__(long=long, short=short))

    def fix_date(self):
        if self.date is None:
            return
        if not isinstance(self.date, datetime.date):
            self.date = datetime.date.fromisoformat(self.date) if valid_day(self.date) else None

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
        return self.date.strftime('%Y-%m-%d')

    def last_hour_range(self):
        day = self.day_string()
        hour = self.last_hour()
        day_hour = f'{day} {hour:02d}'
        return [f'{day_hour}:00:00Z', f'{day_hour}:59:59.9Z']

    def day_range(self):
        day = self.day_string()
        first = self.first_hour()
        last = self.last_hour()
        return [f'{day} {first:02d}:00Z', f'{day} {last:02d}:59:59.9Z']
