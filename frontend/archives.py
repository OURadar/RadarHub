import json
import struct
import numpy as np
from django.http import HttpResponse

# from django.utils.dateparse import parse_datetime
# from django.utils import timezone

from .models import File
from netCDF4 import Dataset
from common import colorize

def binary(request, name):
    print(f'archives.binary() name={name}')
    elev = 0.5
    elev_bin = bytearray(struct.pack('f', elev));
    payload = elev_bin + b'\x00\x01\x02\x00\x00\x00\xfd\xfe\xff'
    if not isinstance(payload, bytes):
        payload = bytes(payload);
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def header(requst, name):
    show = colorize(name, 'orange')
    print(f'archives.header() {show}')
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

# def find(name):
#     files = File.objects.all()
#     print(files[0].name, files[0].path)
#     # file = f'/Users/boonleng/Downloads/{name}.nc'
#     file = files[0].path
#     print(f'file = {file}')
#     return file

def file(request, name):
    show = colorize(name, 'green')
    print(f'archives.file() {show}')
    # file = find(name)
    # with open(file, 'rb') as fid:
    #     with Dataset('dummy', mode='r', memory=fid.read()) as nc:
    #         #e = np.array(nc.variables['Elevation'][:], dtype=np.float32)
    #         a = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
    #         #r = np.array(nc.variables['GateWidth'][:], dtype=np.float32)
    #         values = np.array(nc.variables['Corrected_Intensity'][:], dtype=np.float32)
    # head = struct.pack('hh', *values.shape)
    # data = np.array(values * 0.5 + 32, dtype=np.uint8)

    x = File.objects.filter(name=name)
    if len(x):
        x = x[0]
    else:
        return HttpResponse('', content_type='application/octet-stream')

    sweep = x.getData()
    head = struct.pack('hh', *sweep['values'].shape)
    data = np.array(sweep['values'] * 0.5 + 32, dtype=np.uint8)
    payload = bytes(head) + bytes(sweep['azimuths']) + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response
