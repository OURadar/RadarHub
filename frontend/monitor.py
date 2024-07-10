import datetime
import logging
import random
import threading
import time

from django.conf import settings
from django_eventstream import send_event

from common import color_name_value
from common.cosmetics import colorize

logger = logging.getLogger("frontend")


def monitor(radar="px1000", name="PX"):
    time.sleep(2.718281828459045)

    show = colorize("monitor.monitor()", "green")
    show += "   " + color_name_value("name", name)
    show += "   " + color_name_value("radar", radar)
    logger.info(show)

    from .models import Day, Sweep

    sweeps = []
    day = Day.objects.filter(name=name)
    if day.exists():
        day = day.latest("date")
        hourly_count = day.hourly_count
        sweeps = Sweep.objects.filter(time__range=day.last_hour_range(), name=name)
    else:
        hourly_count = ",".join("0" * 24)
        logger.info(f"No Day objects yet for {radar} / {name}")

    no_day_warning = 0
    while True:
        time.sleep(3.0)
        day = Day.objects.filter(name=name)
        if not day.exists():
            no_day_warning += 1
            if no_day_warning < 3 or no_day_warning % 100 == 0:
                logger.info(f"No Day objects yet for {radar} / {name}")
            continue
        day = day.latest("date")
        if hourly_count == day.hourly_count:
            continue
        if settings.VERBOSE > 1:
            day.show()
        hourly_count = day.hourly_count
        latest_sweeps = Sweep.objects.filter(time__range=day.last_hour_range(), name=name)
        delta = [sweep for sweep in latest_sweeps if sweep not in sweeps]
        if len(delta) == 0:
            continue
        payload = {
            "items": [sweep.locator for sweep in delta],
            "hoursActive": [int(c) for c in hourly_count.split(",")],
            "time": datetime.datetime.now(datetime.UTC).isoformat(),
        }
        if any([".nc" in item for item in payload["items"]]):
            print("This should not happen:")
            print(payload["items"])
            print(delta)
        send_event("sse", radar, payload)
        sweeps = latest_sweeps


def simulate(radar="px1000", name="PX"):
    show = colorize("monitor.simulate()", "green")
    show += "   " + color_name_value("name", name)
    show += "   " + color_name_value("radar", radar)
    logger.info(show)

    hourly_count = [0] * 24
    sweep_time = datetime.datetime(2022, 3, 10, 23, 50, 12)
    sweep_day = sweep_time.day

    tic = 0
    block = 1
    scans = ["E2.0", "E4.0", "E6.0", "E8.0", "E10.0"]
    while True:
        items = []
        for _ in range(random.randint(1, 3)):
            sweep_time += datetime.timedelta(seconds=300)
            time_string = sweep_time.strftime(r"%Y%m%d-%H%M%S")
            if sweep_day != sweep_time.day:
                sweep_day = sweep_time.day
                hourly_count = [0] * 24
            if tic % block == 0:
                scan = scans[int(tic / block) % len(scans)]
                items.append(f"{time_string}-{scan}")
                hourly_count[sweep_time.hour] += 1
            tic += 1
        payload = {"items": items, "hoursActive": hourly_count, "time": sweep_time.isoformat()}
        logger.debug(f"{radar} / {time_string}-{scan}  {hourly_count}")
        send_event("sse", radar, payload)
        time.sleep(5)


def tablesExist():
    myname = colorize("monitor.tablesExist()", "green")
    logger.info(f"{myname} started")
    # from django.db import DatabaseError
    # from django_eventstream.models import Event
    # try:
    #     # Make sure the table exists, even if it's empty
    #     Event.objects.count()
    #     return True
    # except DatabaseError:
    #     logger.error('DatabaseError. Need to make a new table Event.')
    #     logger.error('Run manage.py makemigrations && manage.py migrate --database=event')
    #     return False

    from django.db import connection
    from .models import Day, Sweep, Visitor

    tables = connection.introspection.table_names()
    if "django_eventstream_event" not in tables:
        logger.error("DatabaseError. Need to make a new table Event.")
        logger.error("Run manage.py makemigrations && manage.py migrate --database=event")
        return False
    if "frontend_day" not in tables:
        name = colorize("Day", "green")
        logger.error(f"DatabaseError. Need to make a new table {name}.")
        logger.error("Run manage.py makemigrations frontend && manage.py migrate")
        return False
    if "frontend_sweep" not in tables:
        name = colorize("Sweep", "green")
        logger.error(f"DatabaseError. Need to make a new table {name}.")
        logger.error("Run manage.py makemigrations frontend && manage.py migrate")
        return False
    if "frontend_visitor" not in tables:
        name = colorize("Visitor", "green")
        logger.error(f"DatabaseError. Need to make a new table {name}.")
        logger.error("Run manage.py makemigrations frontend && manage.py migrate")
        return False
    return True


def launch(sender, **kwargs):

    # if tablesExist():
    #     print("Tables exist")

    for pathway, item in settings.RADARS.items():
        # pathway = item["pathway"]
        if pathway == "demo":
            continue
        elif settings.SIMULATE:
            thread = threading.Thread(target=simulate, args=(pathway, item["prefix"]))
        else:
            thread = threading.Thread(target=monitor, args=(pathway, item["prefix"]))
        thread.daemon = True
        thread.start()


def announce(sender, **kwargs):
    file = kwargs["instance"]
    show = colorize("announce()", "green")
    logger.info(f"{show} {file.name}")
    send_event("sse", "file", file.name)
