import json
import time
import struct
import numpy as np
from django.http import HttpResponse

# from django.utils.dateparse import parse_datetime
# from django.utils import timezone

from .models import File, Day
from common import colorize

def binary(request, name):
    if name == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
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
    if day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)

    n = [0 for _ in range(24)]
    date = time.strftime('%Y-%m-%d', time.strptime(day, '%Y%m%d'))
    print(date)
    d = Day.objects.filter(date=date)
    if d:
        d = d[0]
        n = [int(n) for n in d.hourly_count.split(',')]
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
    match = File.objects.filter(name=name)
    if len(match):
        match = match[0]
    else:
        return HttpResponse(f'No match of {name} in database', status=202)

    sweep = match.getData()

    if sweep is None:
        return HttpResponse(f'File {name} not found', status=202)

    gatewidth = 1.0e-3 * sweep['gatewidth'][0]

    if gatewidth < 0.05:
        gatewidth *= 2.0;
        sweep['values'] = sweep['values'][:, ::2]

    head = struct.pack('hhhhddddffff', *sweep['values'].shape, 0, 0,
        sweep['sweepTime'], sweep['longitude'], sweep['latitude'], 0.0,
        sweep['sweepElevation'], 0.0, 0.0, gatewidth)
    data = np.array(sweep['values'] * 2 + 64, dtype=np.uint8)
    payload = bytes(head) \
            + bytes(sweep['elevations']) \
            + bytes(sweep['azimuths']) \
            + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response
