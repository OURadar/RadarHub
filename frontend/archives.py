import json
import struct
import numpy as np
from django.http import HttpResponse

# from django.utils.dateparse import parse_datetime
# from django.utils import timezone

from .models import File
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

def file(request, name):
    show = colorize(name, 'green')
    print(f'archives.file() {show}')

    match = File.objects.filter(name=name)
    print(match)
    if len(match):
        match = match[0]
    else:
        return HttpResponse('', content_type='application/octet-stream')

    sweep = match.getData()
    if sweep is None:
        return HttpResponse('', content_type='application/octet-stream')
    head = struct.pack('hh', *sweep['values'].shape)
    data = np.array(sweep['values'] * 0.5 + 32, dtype=np.uint8)
    payload = bytes(head) + bytes(sweep['azimuths']) + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response
