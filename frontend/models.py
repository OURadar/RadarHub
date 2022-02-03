import os
import tarfile
import numpy as np
from netCDF4 import Dataset
from django.db import models
from django.core.validators import int_list_validator
from django.conf import settings

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
 - getData() - reads from a plain path or a .tar / .tar.xz archive using read()
 - read() - reads from a file object, returns a dictionary with the data
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

    def getData(self):
        if any([ext in self.path for ext in ['tgz', 'tar.xz']]):
            if settings.VERBOSE:
                print(f'models.File.getData() {self.path}')
            with tarfile.open(self.path) as aid:
                info = tarfile.TarInfo(self.name)
                info.size = self.size
                info.offset = self.offset
                info.offset_data = self.offset_data
                with aid.extractfile(info) as fid:
                    return self.read(fid)
        else:
            fullpath = self.getFullpath()
            if fullpath is None:
                return None

            with open(fullpath, 'rb') as fid:
                return self.read(fid)

    def read(self, fid):
        with Dataset('dummy', mode='r', memory=fid.read()) as nc:
            name = nc.getncattr('TypeName')
            elevations = np.array(nc.variables['Elevation'][:], dtype=np.float32)
            azimuths = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
            values = np.array(nc.variables[name][:], dtype=np.float32)
            values[values < -90] = np.nan
            longitude = nc.getncattr('Longitude')
            latitude = nc.getncattr('Latitude')
            sweepElevation = nc.getncattr('Elevation')
            sweepTime = nc.getncattr('Time')
            symbol = self.name.split('.')[-2].split('-')[-1]
            return {
                'symbol': symbol,
                'longitude': longitude,
                'latitude': latitude,
                'sweepTime': sweepTime,
                'sweepElevation': sweepElevation,
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

    def __repr__(self):
        return f'{self.date}   count = {self.count}  B:{self.blue} G:{self.green} O:{self.orange} R:{self.red}'

    def show(self):
        show = self.date.strftime('%Y%m%d') if self.date else '00000000'
        show = f'{self.name}{show}'
        return f'{show} {self.hourly_count}'

    def first_hour(self):
        return min([k for k, e in enumerate(self.hourly_count.split(',')) if e != '0'])

    def last_hour(self):
        return max([k for k, e in enumerate(self.hourly_count.split(',')) if e != '0'])

    def last_date_range(self):
        if self.date is None:
            return None
        day = self.date.strftime('%Y-%m-%d')
        hour = self.last_hour()
        day_hour = f'{day} {hour:02d}'
        return [f'{day_hour}:00:00Z', f'{day_hour}:59:59.9Z']
