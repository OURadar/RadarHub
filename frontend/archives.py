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
    show = colorize(name, 'orange')
    print(f'archives.binary() name = {show}')
    elev = 0.5
    elev_bin = bytearray(struct.pack('f', elev));
    payload = elev_bin + b'\x00\x01\x02\x00\x00\x00\xfd\xfe\xff'
    if not isinstance(payload, bytes):
        payload = bytes(payload);
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def header(requst, name):
    show = colorize(name, 'orange')
    print(f'archives.header() name = {show}')
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response


def radar2prefix(radar):
    radarDict = {
        'px1000': 'PX-',
        'raxpol': 'RAXPOL-',
        'px10k': 'PX10K-',
        'horus': 'HORUS-',
    }
    return radarDict[radar] if radar in radarDict else 'XX-'

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
'''
def month(request, radar, day, verbose=1):
    if radar == 'undefined' or day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)    
    if verbose:
        show = colorize('archive.month()', 'green')
        show += ' ' + colorize('radar', 'orange') + ' = ' + colorize(radar, 'yellow')
        show += ' / ' + colorize('day', 'orange') + ' = ' + colorize(day, 'yellow')
        print(show)
    y = int(day[0:4])
    m = int(day[4:6])
    prefix = radar2prefix(radar)
    entries = Day.objects.filter(date__year=y, date__month=m, name=prefix)
    s = time.mktime(time.strptime(day[:6], '%Y%m'))
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
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMMDD
'''
def count(request, radar, day, verbose=1):
    if radar == 'undefined' or day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    if verbose:
        show = colorize('archive.count()', 'green')
        show += ' ' + colorize('radar', 'orange') + ' = ' + colorize(radar, 'yellow')
        show += ' / ' + colorize('day', 'orange') + ' = ' + colorize(day, 'yellow')
        print(show)
    n = [0 for _ in range(24)]
    date = time.strftime('%Y-%m-%d', time.strptime(day, '%Y%m%d'))
    prefix = radar2prefix(radar)
    d = Day.objects.filter(date=date, name=prefix)
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
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    hour - a string in the forms of
        - YYYYMMDD-HHMM-S
        - YYYYMMDD-HHMM
        - YYYYMMDD-HH-S
        - YYYYMMDD-HH
        - YYYYMMDD-S
        - YYYYMMDD
'''
def list(request, radar, hour):
    if radar == 'undefined' or hour == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)

    c = hour.split('-');
    if len(c) == 1:
        c.append('0000')
    elif len(c[1]) == 2:
        c[1] = f'{c[1]}00'
    symbol = c[2] if len(c) == 3 else 'Z'
    t = '-'.join(c[:2])
    s = time.strptime(t, '%Y%m%d-%H%M')
    e = time.localtime(time.mktime(s) + 3599)
    ss = time.strftime('%Y-%m-%d %H:%M:%SZ', s)
    ee = time.strftime('%Y-%m-%d %H:%M:%SZ', e)
    dateRange = [ss, ee]
    prefix = radar2prefix(radar)
    matches = File.objects.filter(date__range=dateRange, name__contains=f'-{symbol}.nc')
    matches = matches.filter(name__contains=prefix)
    data = {
        'list': [o.name for o in matches]
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def load(request, name, verbose=1):
    # Database is indexed by date so we extract the time first for quicker search
    s = timeFinder.search(name)[0]
    s = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
    match = File.objects.filter(date=s).filter(name=name)
    if len(match):
        match = match[0]
    else:
        return HttpResponse(f'No match of {name} in database', status=202)

    if verbose:
        show = colorize('archive.load()', 'green')
        show += ' ' + colorize('name', 'orange') + ' = ' + colorize(name, 'yellow')
        print(show)

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
    if symbol == 'Z':
        values = sweep['values'] * 2.0 + 64.0
    elif symbol == 'V':
        values = sweep['values'] * 2.0 + 128.0
    elif symbol == 'W':
        values = sweep['values'] * 20.0
    elif symbol == 'D':
        values = sweep['values'] * 10.0 + 100.0
    elif symbol == 'P':
        values = sweep['values'] * 128.0 / np.pi + 128.0
    elif symbol == 'R':
        values = rho2ind(sweep['values'])
    else:
        values = sweep['values']
    # Map to closest integer, 0 is transparent, 1+ is finite.
    # np.nan will be converted to 0 during np.float -> np.uint8
    data = np.array(np.clip(np.round(values), 1.0, 255.0), dtype=np.uint8)
    payload = bytes(head) \
            + bytes(sweep['elevations']) \
            + bytes(sweep['azimuths']) \
            + bytes(data)
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def date(request, radar):
    if radar == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    print(f'archive.date() radar = {radar}')
    prefix = radar2prefix(radar)
    file = File.objects.filter(name__contains=prefix).last()
    components = file.name.split('-')
    ymd = components[1]
    hms = components[2]
    hour = int(hms[0:2])
    data = {
        'dateString': f'{ymd}-{hour:02d}00',
        'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
        'hour': hour,
    }
    # data = {
    #     'dateString': '20220102-0200',
    #     'dayISOString': '2022/01/02',
    #     'hour': 2,
    # }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

def rho2ind(values):
    m3 = values > 0.93
    m2 = np.logical_and(values > 0.7, ~m3)
    index = values * 52.8751
    index[m2] = values[m2] * 300.0 - 173.0
    index[m3] = values[m3] * 1000.0 - 824.0
    return index
