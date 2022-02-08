import re
import json
import time
import pprint
import struct
import numpy as np
from django.http import HttpResponse
from django.conf import settings

# from django.utils.dateparse import parse_datetime
# from django.utils import timezone

from .models import File, Day
from common import colorize, color_name_value, radar_prefix

timeFinder = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')

origins = {
    'px1000': None,
    'raxpol': None,
    'px10k': None,
    'pair': None
}

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

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

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
'''
def month(request, radar, day, verbose=settings.VERBOSE):
    if radar == 'undefined' or day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)    
    if verbose:
        show = colorize('archive.month()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        print(show)
    y = int(day[0:4])
    m = int(day[4:6])
    prefix = radar_prefix(radar)
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
def count(request, radar, day, verbose=settings.VERBOSE):
    if radar == 'undefined' or day == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    if verbose:
        show = colorize('archive.count()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        print(show)
    n = [0 for _ in range(24)]
    date = time.strftime('%Y-%m-%d', time.strptime(day, '%Y%m%d'))
    prefix = radar_prefix(radar)
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

    hour_prod - a string with day, hour, and product symbol in the forms of
        - YYYYMMDD-HHMM-S
        - YYYYMMDD-HHMM
        - YYYYMMDD-HH-S
        - YYYYMMDD-HH
        - YYYYMMDD-S
        - YYYYMMDD
'''
def _list(radar, hour_prod):
    c = hour_prod.split('-');
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
    date_range = [ss, ee]
    prefix = radar_prefix(radar)
    matches = File.objects.filter(date__range=date_range, name__startswith=prefix, name__endswith=f'-{symbol}.nc')
    return [o.name for o in matches]

def list(request, radar, hour_prod, verbose=settings.VERBOSE):
    if verbose:
        show = colorize('archive.list()', 'green')
        show += '   ' + color_name_value('hour_prod', hour_prod)
        print(show)
    if radar == 'undefined' or hour_prod == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    data = {
        'list': _list(radar, hour_prod)
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    name - filename
'''
def load(request, name, verbose=settings.VERBOSE):
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

    sweep = match.read()

    if sweep is None:
        return HttpResponse(f'File {name} not found', status=202)

    gatewidth = 1.0e-3 * sweep['gatewidth']

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

def _date(radar, verbose=settings.VERBOSE):
    prefix = radar_prefix(radar)
    if prefix is None:
        return None, None
    day = Day.objects.filter(name=prefix).latest('date')
    ymd = day.date.strftime('%Y%m%d')
    if verbose:
        show = colorize('archive.date()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('prefix', prefix)
        show += '   ' + color_name_value('day', ymd)
        print(show)
    hour = max([k for k, e in enumerate(day.hourly_count.split(',')) if e != '0'])
    return ymd, hour

def date(request, radar, verbose=settings.VERBOSE):
    if radar == 'undefined':
        return HttpResponse(f'Not a valid query.', status=500)
    ymd, hour = _date(radar, verbose=verbose)
    if ymd is None:
        data = {
            'dateString': '19700101-0000',
            'dayISOString': '1970/01/01',
            'hour': 0,
        }
    else:
        data = {
            'dateString': f'{ymd}-{hour:02d}00',
            'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
            'hour': hour,
        }
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

def location(radar, verbose=settings.VERBOSE):
    if verbose:
        show = colorize('archive.location()', 'green')
        show += '   ' + color_name_value('radar', radar)
        print(show)
    global origins
    ymd, hour = _date(radar)
    if ymd is None:
        origins[radar] = {
          'longitude': -97.422413,
          'latitude': 35.25527,
          'last': '20220125'
        }
    else:
        ymd_hm = f'{ymd}-{hour:02d}00'
        if radar not in origins or origins[radar] is None or origins[radar]['last'] != ymd_hm:
            name = _list(radar, ymd_hm)[-1]
            file = File.objects.filter(name=name).first()
            data = file.read()
            origins[radar] = {
                'longitude': float(data['longitude']),
                'latitude': float(data['latitude']),
                'last': ymd_hm
            }
    if verbose:
        print(colorize('archive.location()', 'green'))
        pp.pprint(origins)
    return origins[radar]
