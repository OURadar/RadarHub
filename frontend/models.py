import os
import tarfile
import numpy as np
from netCDF4 import Dataset
from django.db import models
from django.core.validators import int_list_validator

# Create your models here.
class File(models.Model):
    name = models.CharField(max_length=32)
    path = models.CharField(max_length=256)
    date = models.DateTimeField()
    size = models.PositiveIntegerField(0)
    offset = models.PositiveIntegerField(default=0)
    offset_data = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=['date', ]), ]
    
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

    def read(self, fid):
        with Dataset('dummy', mode='r', memory=fid.read()) as nc:
            name = nc.getncattr('TypeName')
            elevations = np.array(nc.variables['Elevation'][:], dtype=np.float32)
            azimuths = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
            gatewidth = np.array(nc.variables['GateWidth'][:], dtype=np.float32)
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
                'gatewidth': gatewidth,
                'elevations': elevations,
                'azimuths': azimuths,
                'values': values
            }

    def getData(self):
        if any([ext in self.path for ext in ['tgz', 'tar.xz']]):
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

    def __repr__(self):
        return f'{self.date}   count = {self.count}  B:{self.blue} G:{self.green} O:{self.orange} R:{self.red}'
