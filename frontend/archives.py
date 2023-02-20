import re
import json
import time
import pprint
import struct
import logging
import datetime

from functools import lru_cache

from django.views.decorators.cache import never_cache

from django.shortcuts import render
from django.http import HttpResponse, Http404, HttpResponseForbidden
from django.conf import settings

from .models import File, Day
from common import colorize, color_name_value, is_valid_time, get_client_ip

logger = logging.getLogger('frontend')

origins = {}

pp = pprint.PrettyPrinter(indent=1, depth=3, width=80, sort_dicts=False)

pattern_x_yyyymmdd_hhmmss = re.compile(r'(?<=-)20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])-([01][0-9]|2[0-3])[0-5][0-9][0-5][0-9]')
pattern_yyyymm = re.compile(r'20[0-9][0-9](0[0-9]|1[012])')
pattern_bad_agents = re.compile(r'[Ww]get|[Cc]url|ureq')

invalid_query = HttpResponse(f'Invalid Query\n', status=204)
unsupported_request = HttpResponse(f'Unsupported query. Feel free to email a data request to: data@arrc.ou.edu\n', status=405)
forbidden_request = HttpResponseForbidden('Forbidden. Mistaken? Tell my father.\n')

radar_prefix = {}
for prefix, item in settings.RADARS.items():
    pathway = item['folder'].lower()
    radar_prefix[pathway] = prefix

# Learning modules

def binary(request, name):
    ip = get_client_ip(request)
    dirty = screen(request)
    show = colorize('binary()', 'green')
    show += '   ' + color_name_value('name', name)
    show += '   ' + color_name_value('ip', ip)
    show += '   ' + color_name_value('dirty', dirty)
    logger.info(show)
    payload = b'\x01\x02\x03\x04\x05\x06\x07\x08'
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def header(_, name):
    show = colorize('header()', 'green')
    show += '   ' + color_name_value('name', name)
    logger.debug(show)
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response

# Helper functions

def screen(request):
    headers = dict(request.headers)
    headers.pop('Cookie', None)
    dirty = False
    if 'Accept-Encoding' not in headers or 'gzip' not in headers['Accept-Encoding']:
        dirty = True
    # if 'Referer' not in request.headers and 'Connection' not in request.headers:
    #     dirty = True
    return dirty

# Stats

def stats(request, mode=''):
    dirty = screen(request)
    if dirty:
        return forbidden_request
    if mode == 'cache':
        cache_info = _load.cache_info()
        payload = str(cache_info)
    elif mode == '403':
        return forbidden_request
    else:
        raise Http404
    return HttpResponse(payload, content_type='text/plain')

# Data

'''
    pathway - a string of the pathway name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
'''

def _month(prefix, day):
    y = int(day[0:4])
    m = int(day[4:6])
    entries = Day.objects.filter(date__year=y, date__month=m, name=prefix)
    date = datetime.date(y, m, 1)
    step = datetime.timedelta(days=1)
    array = {}
    while date.month == m:
        key = date.strftime(r'%Y-%m-%d')
        entry = entries.filter(date=date).last()
        array[key] = entry.weather_condition() if entry else 0
        date += step
    return array

def month(_, pathway, day):
    if settings.VERBOSE > 1:
        show = colorize('archive.month()', 'green')
        show += '   ' + color_name_value('pathway', pathway)
        show += '   ' + color_name_value('day', day)
        logger.debug(show)
    if pathway == 'undefined' or pathway not in radar_prefix or day == 'undefined' or pattern_yyyymm.match(day) is None:
        return invalid_query
    prefix = radar_prefix[pathway]
    array = _month(prefix, day)
    payload = json.dumps(array, separators=(',', ':'))
    return HttpResponse(payload, content_type='application/json')

'''
    Count of data - returns an array of 24 elements

    pathway - a string of the pathway name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMMDD
'''
def _count(prefix, day):
    date = time.strftime(r'%Y-%m-%d', time.strptime(day[:8], r'%Y%m%d'))
    d = Day.objects.filter(date=date, name=prefix)
    if d:
        d = d[0]
        return [int(n) for n in d.hourly_count.split(',')]
    return [0] * 24

def count(_, pathway, day):
    if settings.VERBOSE > 1:
        show = colorize('archive.count()', 'green')
        show += '   ' + color_name_value('pathway', pathway)
        show += '   ' + color_name_value('day', day)
        logger.debug(show)
    if pathway == 'undefined' or pathway not in radar_prefix or day == 'undefined' or not is_valid_time(day):
        return invalid_query
    prefix = radar_prefix[pathway]
    data = {
        'count': _count(prefix, day)
    }
    payload = json.dumps(data, separators=(',', ':'))
    return HttpResponse(payload, content_type='application/json')

'''
    List of files - returns an array of strings

    pathway - a string of the pathway name
          - e.g., px1000, raxpol, or px10k

    day_hour_symbol - a string with day, hour, and product symbol in the forms of
        - YYYYMMDD         (assumes Z here)
        - YYYYMMDD-HH00    (assumes Z here)
        - YYYYMMDD-HH00-S
'''
def _list(prefix, day_hour_symbol):
    c = day_hour_symbol.split('-')
    if len(c) == 1:
        c.append('0000')
    elif len(c[1]) == 2:
        c[1] = f'{c[1]}00'
    symbol = c[2] if len(c) == 3 else 'Z'
    t = '-'.join(c[:2])
    s = time.strptime(t, r'%Y%m%d-%H%M')
    e = time.localtime(time.mktime(s) + 3599)
    ss = time.strftime(r'%Y-%m-%d %H:%M:%SZ', s)
    ee = time.strftime(r'%Y-%m-%d %H:%M:%SZ', e)
    date_range = [ss, ee]
    matches = File.objects.filter(date__range=date_range, name__startswith=prefix, name__endswith=f'-{symbol}.nc')
    return [o.name.rstrip('.nc') for o in matches]

def list(request, pathway, day_hour_symbol):
    show = colorize('archive.list()', 'green')
    show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
    logger.debug(show)
    dirty = screen(request)
    if dirty:
        return unsupported_request
    if pathway == 'undefined' or pathway not in radar_prefix or day_hour_symbol == 'undefined':
        return invalid_query
    if len(day_hour_symbol) not in [8, 13, 15]:
        return invalid_query
    if not is_valid_time(day_hour_symbol[:13]):
        return invalid_query
    prefix = radar_prefix[pathway]
    c = day_hour_symbol.split('-')
    day = c[0]
    if len(day) > 8:
        logger.warning(f'Invalid day_hour_symbol = {day_hour_symbol} -> day = {day}')
        return invalid_query
    hourly_count = _count(prefix, day)
    if len(c) > 1:
        hour = int(c[1][:2])
    else:
        hour = 0
    if len(c) == 3:
        symbol = c[2]
    else:
        symbol = 'Z'
    day_hour_symbol = f'{day}-{hour:02d}00-{symbol}'
    hours_with_data = [i for i, v in enumerate(hourly_count) if v]
    if hourly_count[hour] == 0:
        if len(hours_with_data):
            message = f'Hour {hour} has no files. Auto-select hour {hours_with_data[0]}.'
            hour = hours_with_data[0]
            day_hour_symbol = f'{day}-{hour:02d}00-{symbol}'
            if settings.VERBOSE > 1:
                show = colorize('archive.list()', 'green')
                show += '   ' + colorize('override', 'red')
                show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
                logger.debug(show)
        else:
            if settings.VERBOSE > 1:
                show = colorize('archive.list()', 'green')
                show += '   ' + color_name_value('pathway', pathway)
                show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
                show += '   ' + color_name_value('hourly_count', '0\'s')
                logger.debug(show)
            message = 'empty'
            hour = -1
    else:
        message = 'okay'
    data = {
        'hoursActive': _count(prefix, day),
        'hour': hour,
        'items': _list(prefix, day_hour_symbol) if hour >= 0 else [],
        'symbol': symbol,
        'message': message
    }
    payload = json.dumps(data, separators=(',', ':'))
    return HttpResponse(payload, content_type='application/json')

'''
    Load a sweep - returns a dictionary

    name - filename
'''
@lru_cache(maxsize=1000)
def _load(name):
    if settings.SIMULATE:
        logger.info(f'Dummy sweep {name}')
        sweep = File.dummy_sweep(name)
    else:
        # Database is indexed by date so we extract the time first for a quicker search
        s = pattern_x_yyyymmdd_hhmmss.search(name)
        if s is None:
            logger.warning(f'Bad filename {name}')
            return None
        s = s.group(0)
        if not is_valid_time(s):
            return None
        date = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
        match = File.objects.filter(date=date).filter(name=name)
        if match.exists():
            match = match.first()
            sweep = match.read()
        else:
            return None
    # Down-sample the sweep if the gate spacing is too fine
    gatewidth = 1.0e-3 * sweep['gatewidth']
    if gatewidth < 0.05:
        gatewidth *= 2.0;
        sweep['u8'] = sweep['u8'][:, ::2]
    info = json.dumps({
        'gatewidth': sweep['gatewidth'],
        'waveform': sweep['waveform']
    }, separators=(',', ':'))

    head = struct.pack('hhhhddddffff', *sweep['u8'].shape, len(info), 0,
        sweep['sweepTime'], sweep['longitude'], sweep['latitude'], 0.0,
        sweep['sweepElevation'], sweep['sweepAzimuth'], 0.0, gatewidth)
    payload = bytes(head) \
            + bytes(info, 'utf-8') \
            + bytes(sweep['elevations']) \
            + bytes(sweep['azimuths']) \
            + bytes(sweep['u8'])
    return payload

def load(request, name):
    if settings.VERBOSE > 1:
        show = colorize('archive.load()', 'green')
        show += '   ' + color_name_value('name', name)
        logger.debug(show)
    dirty = screen(request)
    if dirty:
        return unsupported_request
    payload = _load(name + '.nc')
    if payload is None:
        return HttpResponse(f'Data {name} not found', status=204)
    response = HttpResponse(payload, content_type='application/octet-stream')
    response['Cache-Control'] = 'max-age=604800'
    return response


'''
    Latest date - returns the latest YYYYMMDD and HH

    prefix - prefix of a pathway, e.g., PX- for PX-1000, RAXPOL- for RaXPol
'''
def latest(prefix):
    if prefix is None:
        return None, None
    day = Day.objects.filter(name=prefix)
    if day.exists():
        day = day.latest('date')
    else:
        show = colorize('archive.date()', 'green')
        show += '   ' + colorize('Empty Day table.', 'white')
        logger.warning(show)
        return None, None
    ymd = day.date.strftime(r'%Y%m%d')
    if settings.VERBOSE > 1:
        show = colorize('archive.latest()', 'green')
        show += '   ' + color_name_value('prefix', prefix)
        show += '   ' + color_name_value('day', ymd)
        logger.info(show)
    hour = day.last_hour()
    if hour is None:
        show = colorize('archive.latest()', 'green')
        show += '   ' + colorize(' WARNING ', 'warning')
        show += '   ' + colorize(f'Day {day.date} with', 'white')
        show += color_name_value(' .hourly_count', 'zeros')
        logger.warning(show)
        return None, None
    return ymd, hour


'''
    Location - returns a dictionary with latitude, longitude

    pathway - Input pathway, e.g., px1000, raxpol, etc.
'''
def location(pathway):
    global origins
    if settings.VERBOSE > 1:
        show = colorize('archive.location()', 'green')
        show += '   ' + color_name_value('pathway', pathway)
        logger.debug(show)
    if pathway in radar_prefix:
        prefix = radar_prefix[pathway]
    else:
        prefix = None
    ymd, hour = latest(prefix)
    if ymd is None:
        origins[pathway] = {
          'longitude': -97.422413,
          'latitude': 35.25527,
          'last': '20220125'
        }
    else:
        ymd_hm = f'{ymd}-{hour:02d}00'
        if pathway not in origins or origins[pathway] is None or origins[pathway]['last'] != ymd_hm:
            name = _list(prefix, ymd_hm)[-1] + '.nc'
            file = File.objects.filter(name=name).first()
            data = file.read()
            origins[pathway] = {
                'longitude': float(data['longitude']),
                'latitude': float(data['latitude']),
                'last': ymd_hm
            }
    if settings.VERBOSE > 1:
        logger.debug(colorize('archive.location()', 'green'))
        logger.debug(f'origins = {origins}')
        pp.pprint(origins)
    return origins[pathway]

'''
    prefix - prefix of a pathway, e.g., PX- for PX-1000, RAXPOL- for RaXPol
'''
def _latest_scan(prefix, scan='E4.0', symbol='Z'):
    day = Day.objects.filter(name=prefix).latest('date')
    last = day.last_hour_range()
    files = File.objects.filter(name__startswith=prefix, name__endswith=f'{scan}-{symbol}.nc', date__range=last)
    if files.exists():
        file = files.latest('date')
        return file.name.rstrip('.nc')
    else:
        return ''

def _years(prefix):
    if prefix == 'PX-':
        return [int(x > 12) for x in range(23)]
    if prefix == 'RAXPOL-':
        return [int(x > 16) for x in range(23)]
    if prefix == 'PX10K-':
        return [int(x == 19) for x in range(23)]
    return []

'''
    pathway - Input pathway name, e.g., px1000, raxpol, etc.
    scan - The 4-th component of filename describing the scan, e.g., E4.0, A120.0, etc.
    symbol - The symbol of a product, e.g., Z, V, W, etc.
'''
@never_cache
def catchup(request, pathway, scan='E4.0', symbol='Z'):
    if settings.VERBOSE > 1:
        show = colorize('archive.catchup()', 'green')
        show += '   ' + color_name_value('pathway', pathway)
        logger.debug(show)
    dirty = screen(request)
    if dirty:
        return unsupported_request
    if pathway == 'undefined' or pathway not in radar_prefix:
        return invalid_query
    prefix = radar_prefix[pathway]
    ymd, hour = latest(prefix)
    if ymd is None:
        data = {
            'dateTimeString': '19700101-0000',
            'dayISOString': '1970/01/01',
            'daysActive': {},
            'yearsActive': [],
            'hoursActive': [0] * 24,
            'hour': -1,
            'items': [],
            'latestScan': '',
        }
    else:
        date_time_string = f'{ymd}-{hour:02d}00'
        data = {
            'dateTimeString': date_time_string,
            'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
            'daysActive': _month(prefix, ymd),
            'yearsActive': _years(prefix),
            'hoursActive': _count(prefix, ymd),
            'hour': hour,
            'items': _list(prefix, f'{date_time_string}-{symbol}'),
            'latestScan': _latest_scan(prefix, scan, symbol),
        }
    payload = json.dumps(data, separators=(',', ':'))
    return HttpResponse(payload, content_type='application/json')
