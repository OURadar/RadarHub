import sys
import json
import time
import datetime
import threading

from django.apps import AppConfig
# from django.conf import settings

from django_eventstream import send_event

from common import color_name_value

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

        global worker_started
        if worker_started:
            show = color_name_value('worker_started', worker_started)
            print(f'Already has a worker   {show}')
            return

        if not tableExists():
            return

        worker_started = True

        thread = threading.Thread(target=monitor)
        thread.daemon = True
        thread.start()

def monitor():
    from .models import Day, File
    # print('Announce() connecting post_save ...')
    # post_save.connect(announce, sender=File)

    prefix = 'PX-'

    day = Day.objects.filter(name=prefix).last()
    hourly_count = day.hourly_count
    files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())

    print('frontend.monitor() started')

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
                    'file':  [file.name for file in delta],
                    'hourly_count': [int(c) for c in hourly_count.split(',')],
                    'time': datetime.datetime.utcnow().isoformat()
                }
                payload = json.dumps(payload)
                send_event('sse', 'message', payload)
                files = latest_files
                tic = 0
        time.sleep(1)
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
    print(f'frontend.announce() {file.name}')
    send_event('sse', 'file', file.name)
