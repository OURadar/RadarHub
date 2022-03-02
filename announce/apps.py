import time
import datetime
import threading

from django.apps import AppConfig
from django_eventstream import send_event


class AnnounceConfig(AppConfig):
    # default_auto_field = 'django.db.models.BigAutoField'
    name = 'announce'

    def ready(self):
        ensure_worker_started()

worker_started = False


def ensure_worker_started():
    global worker_started

    if worker_started:
        return

    if not is_db_ready():
        return

    worker_started = True

    thread = threading.Thread(target=send_worker)
    thread.daemon = True
    thread.start()


def send_worker():
    while True:
        data = datetime.datetime.utcnow().isoformat()
        print(f'data = {data}')
        send_event('test', 'message', data)
        time.sleep(1)


def is_db_ready():
    from django.db import DatabaseError
    from django_eventstream.models import Event
    try:
        # see if db tables are present
        Event.objects.count()
        return True
    except DatabaseError:
        return False
