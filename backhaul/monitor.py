import sys
import json
import time
import redis
import pprint
import random
import logging
import datetime
import threading

from django.conf import settings

from common import colorize, color_name_value, pretty_object_name

from frontend.models import Day, Sweep

logger = logging.getLogger("backhaul")

pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)

relay = redis.StrictRedis()


def relay_event(data):
    logger.info(f"Relaying event ... {color_name_value('items', data['items'])}")
    json_data = json.dumps(data).encode("utf-8")
    relay.publish("sse-relay", json_data)


def _load_sweep(sweep):
    sweep.load()


def monitor():
    myname = colorize("monitor()", "green")
    # Django 5 discourages the use of the ORM before the app registry is ready
    time.sleep(1)
    collection = {}
    for pathway, item in settings.RADARS.items():
        if pathway == "demo":
            continue
        name = item["prefix"]
        sweeps = []
        day = Day.objects.filter(name=name)
        if day.exists():
            day = day.latest("date")
            hourly_count = day.hourly_count
            sweeps = Sweep.objects.filter(time__range=day.latest_datetime_range, name=name)
        else:
            hourly_count = ",".join("0" * 24)
            logger.info(f"{myname} No Day objects yet for {pathway} / {name}")
        count = len(sweeps)
        logger.info(f"{myname} Building cache for {color_name_value('pathway', pathway)} ...")
        threads = []
        for sweep in sweeps[max(0, count - 16) : count]:
            t = threading.Thread(target=_load_sweep, args=(sweep,))
            threads.append(t)
            t.start()
            if len(threads) >= 4:
                for t in threads:
                    t.join()
                threads = []
        for t in threads:
            t.join()
        collection[pathway] = (sweeps, hourly_count)

    logger.info(f"{myname} Started")

    no_day_warning = 0
    while True:
        busy_count = 0
        for pathway, item in settings.RADARS.items():
            if pathway == "demo":
                continue
            name = item["prefix"]
            sweeps, hourly_count = collection[pathway]
            day = Day.objects.filter(name=name)
            if not day.exists():
                no_day_warning += 1
                if no_day_warning < 3 or no_day_warning % 100 == 0:
                    logger.info(f"{myname} No Day objects yet for {pathway} / {name}")
                continue
            day = day.latest("date")
            if hourly_count == day.hourly_count:
                continue
            if settings.VERBOSE > 1:
                day.show()
            hourly_count = day.hourly_count
            latest_sweeps = Sweep.objects.filter(time__range=day.latest_datetime_range, name=name)
            delta = [item for item in latest_sweeps if item not in sweeps]
            if len(delta) == 0:
                continue
            # Do a read to cache the latest data
            for sweep in delta:
                logger.info(f"{myname} Added new: {name}-{sweep.locator} ...")
                sweep.load()
            data = {
                "pathway": pathway,
                "items": [sweep.locator for sweep in delta],
                "hoursActive": [int(c) for c in hourly_count.split(",")],
                "time": datetime.datetime.now(datetime.UTC).isoformat(),
            }
            busy_count += 1
            relay_event(data)
            collection[pathway] = (latest_sweeps, hourly_count)
        if busy_count == 0:
            if settings.VERBOSE > 1 and settings.DEBUG:
                logger.debug(f"{myname} Sleeping ...")
            for _ in range(10):
                time.sleep(0.1)


def simulate():
    myname = colorize("monitor.simulate()", "green")
    logger.info(f"{myname} Started")
    logger.info(f"{myname} {url}")

    hourly_count = [0] * 24
    sweep_time = datetime.datetime(2022, 3, 10, 23, 50, 12)
    sweep_day = sweep_time.day

    tic = 0
    block = 1
    scans = ["E2.0", "E4.0", "E6.0", "E8.0", "E10.0"]
    while True:
        for pathway in settings.RADARS.keys():
            if pathway == "demo":
                continue
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
            data = {"pathway": pathway, "items": items, "hoursActive": hourly_count, "time": sweep_time.isoformat()}
            relay_event(data)
        time.sleep(5)


def launch():
    if settings.SIMULATE:
        thread = threading.Thread(target=simulate)
    else:
        thread = threading.Thread(target=monitor)
    thread.daemon = True
    thread.start()
