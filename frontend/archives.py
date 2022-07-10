import re
import json
import time
import zlib
import pprint
import struct
import logging
import datetime
import threading

from functools import lru_cache

from django.views.decorators.cache import never_cache

from django.http import HttpResponse, Http404
from django.conf import settings

from .models import File, Day, Visitor
from common import colorize, color_name_value, is_valid_time, get_client_ip

logger = logging.getLogger('frontend')

origins = {}

pp = pprint.PrettyPrinter(indent=1, depth=3, width=80, sort_dicts=False)

pattern_x_yyyymmdd_hhmmss = re.compile(r'(?<=-)20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])-([01][0-9]|2[0-3])[0-5][0-9][0-5][0-9]')
pattern_yyyymm = re.compile(r'20[0-9][0-9](0[0-9]|1[012])')
pattern_bad_agents = re.compile(r'[Ww]get|[Cc]url|ureq')

invalid_query = HttpResponse(f'Invalid Query', status=204)
forbidden_request = HttpResponse(f'Forbidden. Mistaken? Tell Us.', status=403)

radar_prefix = {}
for prefix, item in settings.RADARS.items():
    radar = item['folder'].lower()
    radar_prefix[radar] = prefix

visitor_stats = {}
visitor_stats_lock = threading.Lock()
visitor_stats_monitor_thread = None

# Learning modules

def binary(request, name):
    ip, malicious = screen(request)
    show = colorize('binary()', 'green')
    show += '   ' + color_name_value('name', name)
    show += '   ' + color_name_value('ip', ip)
    show += '   ' + color_name_value('malicious', malicious)
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

def screen(request, count=False):
    global visitor_stats
    global visitor_stats_monitor_thread
    headers = dict(request.headers)
    headers.pop('Cookie', None)
    ip = get_client_ip(request)
    if ip not in visitor_stats:
        visitor = {'payload': 0, 'bandwidth': 0, 'headers': headers, 'count': 1, 'last_visited': datetime.datetime.today()}
        visitor_stats[ip] = visitor
    else:
        visitor = visitor_stats[ip]
        if visitor['headers']['User-Agent'] != headers['User-Agent']:
            visitor['headers']['User-Agent'] = headers['User-Agent']
        if count:
            visitor['count'] += 1
        visitor['last_visited'] = datetime.datetime.today().replace(tzinfo=datetime.timezone.utc)
    if visitor_stats_monitor_thread is None:
        visitor_stats_monitor_thread = threading.Thread(target=monitor)
        visitor_stats_monitor_thread.start()
    malicious = False
    if 'Accept-Encoding' not in headers or 'deflate' not in headers['Accept-Encoding']:
        malicious = True
    # if 'Referer' not in request.headers and 'Connection' not in request.headers:
    #     malicious = True
    return ip, malicious

def http_response(ip, payload, cache=False):
    global visitor_stats
    visitor_stats[ip]['payload'] += len(payload)
    net_payload = zlib.compress(payload)
    net_size = len(net_payload)
    visitor_stats[ip]['bandwidth'] += net_size
    response = HttpResponse(net_payload, content_type='application/octet-stream')
    if cache:
        response['Cache-Control'] = 'max-age=604800'
    response['Content-Encoding'] = 'deflate'
    response['Content-Length'] = net_size
    return response

# Stats

def stats(_, mode=''):
    if mode == 'recent-visitors':
        payload = pp.pformat(visitor_stats)
    elif mode == 'visitors':
        stats = []
        for visitor in Visitor.objects.all():
            stats.append(visitor.dict())
        payload = pp.pformat(stats)
    elif mode == 'cache':
        cache_info = _load.cache_info()
        payload = str(cache_info)
    else:
        raise Http404

    return HttpResponse(payload, content_type='text/plain')

# Data

'''
    radar - a string of the radar name
          - e.g., px1000, raxpol, or px10k

    day - a string in the forms of
          - YYYYMM
'''
def month(request, radar, day):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.month()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        logger.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day == 'undefined' or pattern_yyyymm.match(day) is None:
        return invalid_query
    y = int(day[0:4])
    m = int(day[4:6])
    prefix = radar_prefix[radar]
    entries = Day.objects.filter(date__year=y, date__month=m, name=prefix)
    date = datetime.date(y, m, 1)
    step = datetime.timedelta(days=1)
    array = {}
    while date.month == m:
        key = date.strftime(r'%Y-%m-%d')
        entry = entries.filter(date=date).last()
        array[key] = entry.weather_condition() if entry else 0
        date += step
    payload = json.dumps(array)
    payload = bytes(payload, 'utf-8')
    return http_response(ip, payload)

'''
    Count of data - returns an array of 24 elements

    radar - a string of the radar name
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

def count(request, radar, day):
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.count()', 'green')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('day', day)
        logger.debug(show)
    ip, malicious = screen(request)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day == 'undefined' or not is_valid_time(day):
        return invalid_query
    prefix = radar_prefix[radar]
    data = {
        'count': _count(prefix, day)
    }
    payload = json.dumps(data)
    visitor_stats[ip]['bandwidth'] += len(payload)
    response = HttpResponse(payload, content_type='application/json')
    return response

'''
    List of files - returns an array of strings

    radar - a string of the radar name
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

def list(request, radar, day_hour_symbol):
    global visitor_stats
    show = colorize('archive.list()', 'green')
    show += '   ' + color_name_value('day_hour_symbol', day_hour_symbol)
    logger.debug(show)
    ip, malicious = screen(request, count=True)
    if malicious:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix or day_hour_symbol == 'undefined':
        return invalid_query
    if len(day_hour_symbol) not in [8, 13, 15]:
        return invalid_query
    if not is_valid_time(day_hour_symbol[:13]):
        return invalid_query
    prefix = radar_prefix[radar]
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
                show += '   ' + color_name_value('radar', radar)
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
    payload = json.dumps(data)
    payload = bytes(payload, 'utf-8')
    return http_response(ip, payload)

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
    })

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
    global visitor_stats
    if settings.VERBOSE > 1:
        show = colorize('archive.load()', 'green')
        show += '   ' + color_name_value('name', name)
        logger.debug(show)
    ip, malicious = screen(request, count=True)
    if malicious:
        return forbidden_request
    payload = _load(name + '.nc')
    if payload is None:
        return HttpResponse(f'Data {name} not found', status=204)
    return http_response(ip, payload, cache=True)

'''
    Latest date - returns the latest YYYYMMDD and HH

    prefix - prefix of a radar, e.g., PX- for PX-1000, RAXPOL- for RaXPol
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

    radar - Input radar name, e.g., px1000, raxpol, etc.
'''
def location(radar):
    global origins
    if settings.VERBOSE > 1:
        show = colorize('archive.location()', 'green')
        show += '   ' + color_name_value('radar', radar)
        logger.debug(show)
    if radar in radar_prefix:
        prefix = radar_prefix[radar]
    else:
        prefix = None
    ymd, hour = latest(prefix)
    if ymd is None:
        origins[radar] = {
          'longitude': -97.422413,
          'latitude': 35.25527,
          'last': '20220125'
        }
    else:
        ymd_hm = f'{ymd}-{hour:02d}00'
        if radar not in origins or origins[radar] is None or origins[radar]['last'] != ymd_hm:
            name = _list(prefix, ymd_hm)[-1] + '.nc'
            file = File.objects.filter(name=name).first()
            data = file.read()
            origins[radar] = {
                'longitude': float(data['longitude']),
                'latitude': float(data['latitude']),
                'last': ymd_hm
            }
    if settings.VERBOSE > 1:
        logger.debug(colorize('archive.location()', 'green'))
        logger.debug(f'origins = {origins}')
        pp.pprint(origins)
    return origins[radar]

'''
    prefix - prefix of a radar, e.g., PX- for PX-1000, RAXPOL- for RaXPol
'''
def _file(prefix, scan='E4.0', symbol='Z'):
    day = Day.objects.filter(name=prefix).latest('date')
    last = day.last_hour_range()
    files = File.objects.filter(name__startswith=prefix, name__endswith=f'{scan}-{symbol}.nc', date__range=last)
    if files.exists():
        file = files.latest('date')
        return file.name
    else:
        return ''

def _years(prefix):
    if prefix == 'PX-':
        return [x > 12 for x in range(23)]
    if prefix == 'RAXPOL-':
        return [x > 16 for x in range(23)]
    if prefix == 'PX10K-':
        return [x == 18 for x in range(23)]
    return []

'''
    radar - Input radar name, e.g., px1000, raxpol, etc.
    scan - The 4-th component of filename describing the scan, e.g., E4.0, A120.0, etc.
    symbol - The symbol of a product, e.g., Z, V, W, etc.
'''
@never_cache
def catchup(request, radar, scan='E4.0', symbol='Z'):
    if settings.VERBOSE > 1:
        show = colorize('archive.catchup()', 'green')
        show += '   ' + color_name_value('radar', radar)
        logger.debug(show)
    ip, bad = screen(request, count=True)
    if bad:
        return forbidden_request
    if radar == 'undefined' or radar not in radar_prefix:
        return invalid_query
    prefix = radar_prefix[radar]
    ymd, hour = latest(prefix)
    if ymd is None:
        data = {
            'dateTimeString': '19700101-0000',
            'dayISOString': '1970/01/01',
            'latestScan': '',
            'yearsActive': [],
            'hoursActive': [0] * 24,
            'hour': -1,
            'items': [],
        }
    else:
        dateTimeString = f'{ymd}-{hour:02d}00'
        data = {
            'dateTimeString': dateTimeString,
            'dayISOString': f'{ymd[0:4]}/{ymd[4:6]}/{ymd[6:8]}',
            'latestScan': _file(prefix, scan, symbol),
            'yearsActive': _years(prefix),
            'hoursActive': _count(prefix, ymd),
            'hour': hour,
            'items': _list(prefix, f'{dateTimeString}-{symbol}'),
        }
    payload = json.dumps(data)
    payload = bytes(payload, 'utf-8')
    return http_response(ip, payload)

# Threads

def monitor():
    show = colorize('archives.monitor()', 'green')
    show += '   ' + color_name_value('Visitor.objects.count()', Visitor.objects.count())
    logger.info(show)
    while True:
        visitor_stats_lock.acquire()
        for ip, stats in visitor_stats.items():
            if stats['count'] == 0 and stats['bandwidth'] == 0:
                continue
            user_agent = stats['headers']['User-Agent'] if 'User-Agent' in stats['headers'] else 'Unknown'
            match = Visitor.objects.filter(ip=ip)
            if match.exists():
                if match.count() > 1:
                    logger.error(f'More than one entries for {ip}, choosing the first ...')
                visitor = match.first()
                visitor.user_agent = user_agent
                visitor.count += stats['count']
                visitor.payload += stats['payload']
                visitor.bandwidth += stats['bandwidth']
                visitor.last_visited = stats['last_visited']
            else:
                visitor = Visitor.objects.create(
                    ip=ip,
                    user_agent=user_agent,
                    count=stats['count'],
                    payload=stats['payload'],
                    bandwidth=stats['bandwidth'],
                    last_visited=stats['last_visited'])
            stats['bandwidth'] = 0
            stats['payload'] = 0
            stats['count'] = 0
            visitor.save()
        visitor_stats_lock.release()
        time.sleep(3)

