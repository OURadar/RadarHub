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

    def getFullpath(self):
        path = os.path.join(self.path, self.name)
        if not os.path.exists(path):
            path = os.path.join(self.path.replace('/mnt/data', '/Volumes/Data'), self.name)
        if not os.path.exists(path):
            return None
        return path

    def getData(self):
        fullpath = self.getFullpath()
        if fullpath is None:
            return None
        with open(fullpath, 'rb') as fid:
            with Dataset('dummy', mode='r', memory=fid.read()) as nc:
                e = np.array(nc.variables['Elevation'][:], dtype=np.float32)
                a = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
                r = np.array(nc.variables['GateWidth'][:], dtype=np.float32)
                values = np.array(nc.variables['Corrected_Intensity'][:], dtype=np.float32)
        return {
            'e': e,
            'a': a,
            'r': r,
            'values': values
        }

# models.File.objects.filter(date__year=2015)
# models.File.objects.filter(date__lte='2018-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z').filter(date__lte='2018-12-31 23:59Z')
