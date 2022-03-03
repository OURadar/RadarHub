import time
import datetime
import threading

from django.apps import AppConfig
from django.db.models.signals import post_save

from django_eventstream import send_event

from common import color_name_value

worker_started = False

class AnnounceConfig(AppConfig):
    name = 'announce'
    def ready(self):
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

        from frontend.models import File

        post_save.connect(saveAnnounce, sender=File)


def announceWorker():
    while True:
        send_event('sse', 'time', datetime.datetime.utcnow().isoformat())
        send_event('sse', 'message', 'this is a test message')
        time.sleep(5)


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

def saveAnnounce(sender, instance, **kwargs):
    print(f'saveAnnounce() {sender} {instance}')
