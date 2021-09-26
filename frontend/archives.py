import json
import time
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

'''
    day - a string in the forms of
          - YYYYMMDD
'''
def count(request, day):
    show = colorize(day, 'orange')
    print(f'archives.count() {show}')
    prefix = time.strftime('%Y-%m-%d', time.strptime(day, '%Y%m%d'))
    n = [0 for _ in range(24)]
    for h in range(24):
        dateRange = [f'{prefix} {h:02d}:00Z', f'{prefix} {h:02d}:59Z']
        matches = File.objects.filter(name__contains='-Z', date__range=dateRange)
        n[h] = len(matches)
    data = {
        'count': n
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    hour - a string in the forms of
           - YYYYMMDD-HHMM
           - YYYYMMDD-HH
           - YYYYMMDD
'''
def list(request, hour):
    show = colorize(hour, 'orange')
    print(f'archives.list() {show}')
    if hour == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)

    if len(hour) == 13:
        s = time.strptime(hour, '%Y%m%d-%H%M')
        e = time.localtime(time.mktime(s) + 3600)
        ss = time.strftime('%Y-%m-%d %H:%MZ', s)
        ee = time.strftime('%Y-%m-%d %H:%MZ', e)
        dateRange = [ss, ee]
    elif len(hour) == 11:
        prefix = time.strftime('%Y-%m-%d %H', time.strptime(hour, '%Y%m%d-%H'))
        dateRange = [f'{prefix}:00Z', f'{prefix}:59Z']
    elif len(hour) == 8:
        prefix = time.strftime('%Y-%m-%d', time.strptime(hour, '%Y%m%d'))
        dateRange = [f'{prefix} 00:00Z', f'{prefix} 00:59Z']

    matches = File.objects.filter(name__contains='-Z', date__range=dateRange)[:200]
    data = {
        'list': [o.name for o in matches]
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def load(request, name):
    show = colorize(name, 'green')
    print(f'archives.load() {show}')

    match = File.objects.filter(name=name)
    if len(match):
        match = match[0]
    else:
        return HttpResponse(f'No match of {name} in database', status=404)

    sweep = match.getData()
    if sweep is None:
        return HttpResponse(f'File {name} not found', status=404)
    head = struct.pack('hh', *sweep['values'].shape)
    data = np.array(sweep['values'] * 0.5 + 32, dtype=np.uint8)
    payload = bytes(head) + bytes(sweep['azimuths']) + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

