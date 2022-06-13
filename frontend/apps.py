import os
import re
import sys
import time
import logging
import datetime
import threading

from django.apps import AppConfig
from django.conf import settings

from django_eventstream import send_event

from common import color_name_value
from common.cosmetics import colorize
from common.dailylog import MultiLineFormatter

logger = logging.getLogger('frontend')

worker_started = False

radar_prefix_pairs = []
for prefix, item in settings.RADARS.items():
    radar = item['folder'].lower()
    radar_prefix_pairs.append((radar, prefix))

class FrontendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'frontend'

    def ready(self):
        prog = ' '.join(sys.argv[:3])
        if 'runserver' not in prog and 'daphne' not in prog:
            return

        if not tableExists():
            return

        root_logger = logging.getLogger()
        if len(root_logger.handlers):
            for h in root_logger.handlers:
                h.setFormatter(MultiLineFormatter('%(asctime)s %(levelname)-8s %(message)s'))
                h.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)
        elif settings.DEBUG and settings.VERBOSE:
            logger.addHandler(logging.StreamHandler())
            logger.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)

        if 'daphne' in prog:
            prog = 'daphne ' + ' '.join(sys.argv[1:6])

        # Look for RUN_MAIN == "true" in development mode. Otherwise, it should None
        run_main = os.environ.get('RUN_MAIN', None)
        show = colorize(prog, 'teal')
        show += '   ' + color_name_value('run_main', run_main)
        logger.info(show)
        if 'runserver' in prog and run_main is None:
            return

        show = color_name_value('DEBUG', settings.DEBUG)
        show += '   ' + color_name_value('SIMULATE', settings.SIMULATE)
        show += '   ' + color_name_value('VERBOSE', settings.VERBOSE)
        logger.info(show)

        if 'data' in settings.DATABASES and 'postgresql' in settings.DATABASES['data']['ENGINE']:
            logger.info('Using 🐘 \033[48;5;25;38;5;15m PostgreSQL \033[m ...')
        else:
            logger.info('Using 🪶 \033[48;5;29;38;5;15m SQLite \033[m ...')

        if 'django-insecure' not in settings.SECRET_KEY:
            logger.info('Using 🔒 \033[48;5;22;38;5;15m settings.json \033[m secret key ...')
        else:
            logger.info('Using 🔓 \033[48;5;88;38;5;15m insecure \033[m secret key ...')

        global worker_started
        if worker_started:
            show = color_name_value('worker_started', worker_started)
            logger.info(f'Already has a worker   {show}')
            return
        worker_started = True

        if 'daphne' in prog:
            tid = re.search(r'(?<=/daphne)[0-9]{1,2}(?=.sock)', prog)
            bail = tid[0] != '0' if tid else False
            if bail:
                return

        for radar_prefix in radar_prefix_pairs:
            if settings.SIMULATE:
                thread = threading.Thread(target=simulate, args=radar_prefix)
            else:
                thread = threading.Thread(target=monitor, args=radar_prefix)
            thread.daemon = True
            thread.start()

def monitor(radar='px1000', prefix='PX-'):
    show = colorize('apps.monitor()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('prefix', prefix)
    logger.info(show)

    from .models import Day, File

    files = []

    day = Day.objects.filter(name=prefix).last()
    if day:
        hourly_count = day.hourly_count
        files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())
    else:
        hourly_count = ','.join('0' * 24)
        logger.info(f'No Day objects yet for {radar} / {prefix} yet')

    no_day_warning = 0
    while True:
        time.sleep(3.0)
        day = Day.objects.filter(name=prefix).last()
        if day is None:
            no_day_warning += 1
            if no_day_warning < 3 or no_day_warning % 100 == 0:
                logger.info(f'No Day objects yet for {radar} / {prefix} yet')
            continue
        if hourly_count == day.hourly_count:
            continue
        if settings.VERBOSE > 1:
            day.show()
        hourly_count = day.hourly_count
        latest_files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())
        delta = [file for file in latest_files if file not in files]
        if len(delta) == 0:
            continue
        payload = {
            'files':  [file.name.rstrip('.nc') for file in delta],
            'count': [int(c) for c in hourly_count.split(',')],
            'time': datetime.datetime.utcnow().isoformat()
        }
        send_event('sse', radar, payload)
        files = latest_files

def simulate(radar='px1000', prefix='PX-'):
    show = colorize('apps.simulate()', 'green')
    logger.info(f'{show} started')

    hourly_count = [0] * 24
    sweep_time = datetime.datetime(2022, 3, 10, 23, 50, 12)
    sweep_day = sweep_time.day

    tic = 0
    block = 1
    scans = ['E2.0', 'E4.0', 'E6.0', 'E8.0', 'E10.0']
    while True:
        sweep_time += datetime.timedelta(seconds=300)
        time_string = sweep_time.strftime(r'%Y%m%d-%H%M%S')
        if sweep_day != sweep_time.day:
            sweep_day = sweep_time.day
            hourly_count = [0] * 24
        files = []
        if tic % block == 0:
            scan = scans[int(tic / block) % len(scans)]
            for symbol in ['Z', 'V', 'W', 'D', 'P', 'R']:
                filename = f'{prefix}{time_string}-{scan}-{symbol}.nc'
                files.append(filename)
                hourly_count[sweep_time.hour] += 1
            payload = {
                'files': files,
                'count': hourly_count,
                'time': sweep_time.isoformat()
            }
            logger.info(f'{time_string}-{scan}  {hourly_count}')
            send_event('sse', 'message', payload)
        time.sleep(2.5)
        tic += 1

def tableExists():
    from django.db import DatabaseError
    from django_eventstream.models import Event
    try:
        # Make sure the table exists
        Event.objects.count()
        return True
    except DatabaseError:
        logger.error('DatabaseError. Need to make the Event table.')
        logger.error('Run manage.py makemigrations && manage.py migrate --database=event')
        return False

def announce(sender, **kwargs):
    file = kwargs['instance']
    show = colorize('announce()', 'green')
    logger.info(f'{show} {file.name}')
    send_event('sse', 'file', file.name)
