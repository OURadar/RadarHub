import os
import sys
import time
import datetime
import threading

from django.apps import AppConfig
from django.conf import settings

from django_eventstream import send_event

from common import color_name_value
from common.cosmetics import colorize

worker_started = False

# show = colorize('frontend.apps.py', 'mint')
# show += '  ' + color_name_value('DATABASES.ENGINE', settings.DATABASES['default']['ENGINE'])
# print(show)

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

        # Look for RUN_MAIN == "true" in development mode. Otherwise, it should None
        run_main = os.environ.get('RUN_MAIN', None)
        if settings.VERBOSE:
            show = colorize(prog, 'teal')
            show += '   ' + color_name_value('run_main', run_main)
            print(show)
        if 'runserver' in prog and run_main is None:
            return

        if settings.VERBOSE:
            show = color_name_value('DEBUG', settings.DEBUG)
            show += '   ' + color_name_value('SIMULATE', settings.SIMULATE)
            show += '   ' + color_name_value('VERBOSE', settings.VERBOSE)
            print(show)

            if 'postgresql' in settings.DATABASES['default']['ENGINE']:
                print('Using 🐘 \033[48;5;25;38;5;15m PostgreSQL \033[m ...')
            else:
                print('Using 🪶 \033[48;5;33;38;5;15m SQLite \033[m ...')

        global worker_started
        if worker_started:
            show = color_name_value('worker_started', worker_started)
            print(f'Already has a worker   {show}')
            return

        worker_started = True

        for radar_prefix in radar_prefix_pairs:
            if settings.SIMULATE:
                thread = threading.Thread(target=simulate, args=radar_prefix)
            else:
                thread = threading.Thread(target=monitor, args=radar_prefix)
            thread.daemon = True
            thread.start()

def monitor(radar='px1000', prefix='PX-'):
    show = colorize('frontend.apps.monitor()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('prefix', prefix)
    print(show)

    from .models import Day, File

    files = []

    day = Day.objects.filter(name=prefix).last()
    if day:
        hourly_count = day.hourly_count
        files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())
    else:
        hourly_count = ','.join('0' * 24)
        print(f'No Day objects yet for {radar} / {prefix} yet')

    no_day_warning = 0
    while True:
        time.sleep(3.0)
        day = Day.objects.filter(name=prefix).last()
        if day is None:
            no_day_warning += 1
            if no_day_warning < 3 or no_day_warning % 100 == 0:
                print(f'No Day objects yet for {radar} / {prefix} yet')
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
            'files':  [file.name for file in delta],
            'count': [int(c) for c in hourly_count.split(',')],
            'time': datetime.datetime.utcnow().isoformat()
        }
        send_event('sse', radar, payload)
        files = latest_files

def simulate(radar='px1000', prefix='PX-'):
    show = colorize('frontend.apps.simulate()', 'green')
    print(f'{show} started')

    hourly_count = [0 for _ in range(24)]
    # sweep_time = datetime.datetime.utcnow()
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
            hourly_count = [0 for _ in range(24)]
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
            print(f'{time_string}-{scan}  {hourly_count}')
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
        print('DatabaseError. Need to make the Event table.')
        print('Run manage.py makemigrations && manage.py migrate --database=event')
        return False

def announce(sender, **kwargs):
    file = kwargs['instance']
    show = colorize('frontend.announce()', 'green')
    print(f'{show} {file.name}')
    send_event('sse', 'file', file.name)
