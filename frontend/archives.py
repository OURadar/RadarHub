import re
import json
import time
import struct
import numpy as np
from django.http import HttpResponse

# from django.utils.dateparse import parse_datetime
# from django.utils import timezone

from .models import File, Day
from common import colorize

timeFinder = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')

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
          - YYYYMM
'''
def month(request, day):
    if day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    y = int(day[0:4])
    m = int(day[4:6])
    entries = Day.objects.filter(date__year=y, date__month=m)
    s = time.mktime(time.strptime(day, '%Y%m'))
    m += 1
    if m == 13:
        m = 1
        day = str(int(day[:4]) + 1)
    e = time.mktime(time.strptime(f'{day[:4]}{m:02d}', '%Y%m'))
    array = {}
    for t in np.arange(s, e, 86400):
        date = time.strftime('%Y-%m-%d', time.localtime(t))
        entry = entries.filter(date=date)
        array[date] = entry[0].count if entry else 0
    payload = json.dumps(array)
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

    matches = File.objects.filter(name__contains='-Z.nc', date__range=dateRange)[:500]
    data = {
        'list': [o.name for o in matches]
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def load(request, name):
    # Database is indexed by date so we extract the time first for quicker search
    s = timeFinder.search(name)[0]
    s = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
    match = File.objects.filter(date=s).filter(name=name)
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
    symbol = sweep['symbol']
    print(f'symbol = {symbol}')
    if symbol == 'Z':
        data = np.array(sweep['values'] * 2 + 64, dtype=np.uint8)
    elif symbol == 'V':
        data = np.array(sweep['values'] * 2 + 128, dtype=np.uint8)
    elif symbol == 'W':
        data = np.array(sweep['values'] * 20, dtype=np.uint8)
    elif symbol == 'D':
        data = np.array(sweep['values'] * 10 + 100, dtype=np.uint8)
    elif symbol == 'P':
        data = np.array(sweep['values'] * 128 / 180 + 128, dtype=np.uint8)
    else:
        data = np.array(sweep['values'], dtype=np.uint8)
    payload = bytes(head) \
            + bytes(sweep['elevations']) \
            + bytes(sweep['azimuths']) \
            + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def date(request):
    print('fetching latest date ...')
    file = File.objects.last()
    components = file.name.split('-')
    ymd = components[1]
    hms = components[2]
    hour = int(hms[0:2])
    data = {
        'dateString': f'{ymd}-{hour:02d}00',
        'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
        'hour': hour,
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response
