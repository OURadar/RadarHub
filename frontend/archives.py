import json
import struct
import numpy as np
from django.http import HttpResponse
from netCDF4 import Dataset

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
    print(f'archives.header() name = {name}')
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def file(request, name):
    print(f'archives.file() name = {name}')
    file = f'/Users/boonleng/Downloads/{name}.nc'
    print(f'file = {file}')
    with open(file, 'rb') as fid:
        with Dataset('dummy', mode='r', memory=fid.read()) as nc:
            #e = np.array(nc.variables['Elevation'][:], dtype=np.float32)
            a = np.array(nc.variables['Azimuth'][:], dtype=np.float32)
            #r = np.array(nc.variables['GateWidth'][:], dtype=np.float32)
            values = np.array(nc.variables['Corrected_Intensity'][:], dtype=np.float32)
    head = struct.pack('hh', *values.shape)
    data = np.array(values * 0.5 + 32, dtype=np.uint8)
    payload = bytes(head) + bytes(a) + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response
