import sys
import json
import time
import datetime
import threading

from django.apps import AppConfig

from django_eventstream import send_event

from common import color_name_value

worker_started = False

class AnnounceConfig(AppConfig):
    name = 'announce'
    def ready(self):
        master = sys.argv[0]
        if 'fifo2db' in master:
            return

        global worker_started

        if worker_started:
            show = color_name_value('worker_started', worker_started)
            print(f'Already has a worker   {show}')
            return

        if not tableExists():
            return

        worker_started = True

        thread = threading.Thread(target=announceWorker)
        thread.daemon = True
        thread.start()


def announceWorker():
    from frontend.models import Day, File
    # print('Announce() connecting post_save ...')
    # post_save.connect(saveAnnounce, sender=File)

    prefix = 'PX-'

    day = Day.objects.filter(name=prefix).last()
    hourly_count = day.hourly_count
    files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())

    print('announceWorker() started')

    k = 0
    while True:
        if k % 15 == 0:
            send_event('sse', 'time', datetime.datetime.utcnow().isoformat())
        day = Day.objects.last()
        if hourly_count != day.hourly_count:
            hourly_count = day.hourly_count
            latest_files = File.objects.filter(name__startswith=prefix, date__range=day.last_hour_range())
            delta = [file for file in latest_files if file not in files]
            if len(delta):
                payload = json.dumps([file.name for file in delta])
                send_event('sse', 'file', payload)
                files = latest_files
        time.sleep(1)
        k += 1

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

def saveAnnounce(sender, **kwargs):
    file = kwargs['instance']
    print(f'saveAnnounce() {file.name}')
    send_event('sse', 'file', file.name)
