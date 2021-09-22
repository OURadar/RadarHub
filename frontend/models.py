import os
import numpy as np
from netCDF4 import Dataset
from django.db import models

# Create your models here.
class File(models.Model):
    name = models.CharField(max_length=32)
    path = models.CharField(max_length=512)
    date = models.DateTimeField('date')

    def __repr__(self):
        return f'name = {self.name}   path = {self.getFullpath()}'

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
        fullpath = self.getFullpath()
        if fullpath is None:
            return None
        with open(fullpath, 'rb') as fid:
            with Dataset('dummy', mode='r', memory=fid.read()) as nc:
                type = nc.getncattr('TypeName')
                elevations = np.array(nc.variables['Elevation'][:], dtype=np.float32)
                azimuths = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
                gatewidth = np.array(nc.variables['GateWidth'][:], dtype=np.float32)
                values = np.array(nc.variables[type][:], dtype=np.float32)
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

# models.File.objects.filter(date__year=2015)
# models.File.objects.filter(date__lte='2018-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z').filter(date__lte='2018-12-31 23:59Z')
