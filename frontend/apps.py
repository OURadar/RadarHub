import os
import sys
import json
import time
import datetime
import threading

from django.apps import AppConfig
from django.conf import settings

from django_eventstream import send_event

from common import color_name_value
from common.cosmetics import colorize

worker_started = False

# from common import colorize, color_name_value

# show = colorize('frontend.apps.py', 'mint')
# show += '  ' + color_name_value('DATABASES.ENGINE', settings.DATABASES['default']['ENGINE'])
# print(show)

class FrontendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'frontend'

    def ready(self):
        prog = sys.argv[0]
        if 'fifo2db' in prog:
            return

        if not tableExists():
            return

        # RUN_MAIN is set to "true" in StatReloader thread
        run_main = os.environ.get('RUN_MAIN', None)
        if run_main is not None:
            return

        global worker_started
        if worker_started:
            show = color_name_value('worker_started', worker_started)
            print(f'Already has a worker   {show}')
            return

        worker_started = True

        if settings.SIMULATE:
            thread = threading.Thread(target=simulate)
        else:
            thread = threading.Thread(target=monitor)
        thread.daemon = True
        thread.start()

def monitor():
    from .models import Day, File
    # print('monitor() connecting post_save ...')
    # post_save.connect(announce, sender=File)

    prefix = 'PX-'

    day = Day.objects.filter(name=prefix).last()
    hourly_count = day.hourly_count
    files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())

    show = colorize('frontend.apps.monitor()', 'green')
    print(f'{show} started')

    tic = 0
    while True:
        if tic > 30:
            tic = 0
            send_event('sse', 'ping', datetime.datetime.utcnow().isoformat())
        day = Day.objects.last()
        if hourly_count != day.hourly_count:
            hourly_count = day.hourly_count
            latest_files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())
            delta = [file for file in latest_files if file not in files]
            if len(delta):
                payload = {
                    'files':  [file.name for file in delta],
                    'count': [int(c) for c in hourly_count.split(',')],
                    'time': datetime.datetime.utcnow().isoformat()
                }
                send_event('sse', 'message', payload)
                files = latest_files
                tic = 0
        time.sleep(1)
        tic += 1

def simulate():
    show = colorize('frontend.apps.simulate()', 'green')
    print(f'{show} started')

    prefix = 'PX'
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
                filename = f'{prefix}-{time_string}-{scan}-{symbol}.nc'
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
        return False

def announce(sender, **kwargs):
    file = kwargs['instance']
    show = colorize('frontend.announce()', 'green')
    print(f'{show} {file.name}')
    send_event('sse', 'file', file.name)
