#!/usr/bin/env python
#
# util.py
# A collection of utility functions for RadarHub
#
# Created by Boonleng Cheong
# Copyright (c) Boonleng Cheong

import os
import re
import sys
import json
import glob
import gzip
import time
import radar
import django
import random
import urllib
import argparse
import datetime
import textwrap
import threading

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "radarhub.settings")
django.setup()

from django.conf import settings
from frontend.models import Sweep

from common import FIFOBuffer
from common import check, cross

__prog__ = os.path.basename(sys.argv[0])
missing_headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
}
prefix_radar = {"PX": "PX1000", "PX10K": "PX10k", "RAXPOL": "RaXPol"}
tzinfo = datetime.timezone.utc

re_ymd_h = re.compile(r"20\d{2}(0\d|1[012])([012]\d|3[01])-(\d{2})")
re_ymd = re.compile(r"20\d{2}(0\d|1[012])([012]\d|3[01])")
re_ym = re.compile(r"20\d{2}(0\d|1[012])")

#


def quick_check(data, file):
    unixTime = data["time"]
    timestamp = datetime.datetime.fromtimestamp(unixTime, tz=tzinfo)
    timeString = timestamp.strftime(r"%Y%m%d-%H%M%S")
    basename = os.path.basename(file)
    fileTime = radar.re_datetime_b.search(basename).group(0)
    print(f"Out: {basename} -> {timeString} {check if fileTime == timeString else cross}")


def load_by_path(path="/mnt/data/PX1000/2024/20240820/_original/"):
    print(f"load_by_path() {path} ...")
    files = sorted(glob.glob(os.path.join(path, "*.*")))
    if ":" in settings.DATASHOP:
        host, port = settings.DATASHOP.split(":")
        port = int(port)
    else:
        host = settings.DATASHOP
        port = 50000

    client = radar.product.Client(host=host, port=port, count=4)

    def getfile(file):
        print(f"Req: {file} ...")
        data = client.get(file)
        quick_check(data, file)

    tic = time.time()
    fifo = FIFOBuffer()
    for file in files[-100:]:
        th = threading.Thread(target=getfile, args=(file,))
        th.start()
        fifo.enqueue(th)
        while fifo.size() >= 8:
            th = fifo.dequeue()
            th.join()
    for th in fifo.queue:
        th.join()
    toc = time.time()
    print(f"Elapsed: {toc - tic:.3f} s")
    return


def load_by_model():
    Sweep.useDataShop()
    sweeps = Sweep.objects.filter(name="PX", time__range=["2024-08-20 22:00Z", "2024-08-20 23:59Z"])
    origin = max(0, len(sweeps) - 100)

    # Load one sweep to get the model.client initialized
    sweeps[0].load()

    def load_sweep(sweep):
        print(f"Req: {sweep.path} ...")
        data = sweep.load()
        quick_check(data, sweep.path)

    tic = time.time()
    fifo = FIFOBuffer()
    for sweep in sweeps[origin:]:
        # print(sweep.path)
        th = threading.Thread(target=load_sweep, args=(sweep,))
        th.start()
        fifo.enqueue(th)
        while fifo.size() >= 8:
            th = fifo.dequeue()
            th.join()
    for th in fifo.queue:
        th.join()
    toc = time.time()
    print(f"Elapsed: {toc - tic:.3f} s")
    return


def load_by_url(server="https://radarhub.arrc.ou.edu", pathway="px1000", locator="202408"):

    def get_url(url):
        print(f"Requesting {url} ...")
        req = urllib.request.Request(url, headers=missing_headers)
        response = urllib.request.urlopen(req)
        if response.status != 200:
            print(f"Error: {response.status}")
            return None
        content = response.read()
        if response.headers.get("Content-Encoding") == "gzip":
            content = gzip.decompress(content)
        if response.headers.get("Content-Type") == "application/json":
            content = json.loads(content)
        return content

    month, day, hour = None, None, None

    if re_ymd_h.match(locator):
        month = locator[:6]
        day = locator[:8]
        hour = locator[-2:]
    elif re_ymd.match(locator):
        month = locator[:6]
        day = locator[:8]
    elif re_ym.match(locator):
        month = locator

    print(f"locator = {locator}   month = {month}   day = {day}   hour = {hour}")

    if day is None:
        url = f"{server}/data/month/{pathway}/{month}/"
        content = get_url(url)
        days = [d for d, v in content.items() if v]
        print(f"days = {days}")
        day = random.choice(days)
        print(f"Selected day: {day}")

    if hour is None or "*" in locator:
        url = f"{server}/data/table/{pathway}/{day}/"
        content = get_url(url)
        hoursActive = content.get("hoursActive")
        print(f"hourlyCount = {hoursActive}")
        indices = [i for i, v in enumerate(hoursActive) if v > 0]
        if "*" in locator:
            # Select the last non-zero hour
            hour = f"{indices[-1]:02d}"
        else:
            hour = f"{random.choice(indices):02d}"
        print(f"Selected hour: {hour}")

    url = f"{server}/data/table/{pathway}/{day}-{hour}00/"
    content = get_url(url)
    items = content.get("items")
    print(f"{len(items)} items found.")

    fifo = FIFOBuffer()
    for item in items:
        url = f"{server}/data/load/{pathway}/{item}-Z/"
        th = threading.Thread(target=get_url, args=(url,))
        th.start()
        fifo.enqueue(th)
        while fifo.size() >= 8:
            th = fifo.dequeue()
            th.join()
    for th in fifo.queue:
        th.join()
    print("Done.")


def upload(source="/data/moment", **kwargs):
    user = kwargs.get("user", "radarhub")
    host = kwargs.get("host", "dcv01")
    target = kwargs.get("target", "/mnt/data")
    verbose = kwargs.get("verbose", 0)
    execute = not kwargs.get("no_go", False)
    user_host = f"{user}@{host}:"
    if verbose > 1:
        print(f"user_host = {user_host}")
    day_folders = sorted(glob.glob(os.path.join(source, "20*")))

    def is_valid_daytime(time_string):
        try:
            time.strptime(time_string, r"%Y%m%d")
            return True
        except:
            return False

    for folder in day_folders:
        print("...")
        yyyymmdd = os.path.basename(folder)
        if verbose > 1:
            print(f"folder = {folder} -> yyyymmdd = {yyyymmdd}")
        pattern = os.path.join(folder, "[A-Z]*xz")
        if verbose > 1:
            print(f"prefix_finder = {pattern}")
        files = sorted(glob.glob(pattern))
        if len(files):
            prefix = os.path.basename(files[0]).split("-")[0]
            radar = prefix_radar.get(prefix, "Unknown")
        else:
            continue
        if not is_valid_daytime(yyyymmdd):
            print(f"ERROR: Invalid day folder {yyyymmdd}")
        yyyy = yyyymmdd[:4]
        source_pattern = f"{folder}/{prefix}-*xz"
        target_pattern = f"{user_host}{target}/{radar}/{yyyy}/{yyyymmdd}/_original/"
        cmd = f"rsync -an --size-only --stats {source_pattern} {target_pattern}"
        if verbose:
            print(f"source = {source_pattern}")
            print(f"target = {target_pattern}")
            if verbose > 1:
                print(cmd)
        lines = os.popen(cmd).read().split("\n")
        count = 0
        for line in lines:
            if verbose > 1:
                print("   ", line)
            if "files transferred" in line:
                count = int(line.split()[-1])
        if verbose:
            print(f"count = {count:,} / {len(files):,}")
        if count == 0:
            print("No transfer necessary")
            continue
        cmd = f"rsync -av --size-only --stats {source_pattern} {target_pattern}"
        cmd += f" | tqdm --unit loc --unit_scale --desc {yyyymmdd} --total {count} --unit files >> /dev/null"
        if verbose:
            print(cmd)
        if execute:
            os.system(cmd)


def fun(arg1="1", arg2="2"):
    print(f"arg1={arg1} arg2={arg2}")


#

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(
            f"""\
        RadarHub Utility

           {__prog__} [VERB] [SOURCE ...]

        Examples:

            {__prog__}
            {__prog__} upload ~/Downloads/gdrive
            {__prog__} upload -v /Volumes/seagate1/peril-20230405
            {__prog__} test url px1000 20241223-12
        """
        ),
        epilog="Copyright (c) Boonleng Cheong",
    )
    parser.add_argument(
        "verb",
        type=str,
        nargs=1,
        help=textwrap.dedent(
            f"""\
        Verb to execute:

        test url        Test loading data from browsing URLs, e.g.,

                        {__prog__} test url px1000 202408
                        {__prog__} test url px1000 20241223
                        {__prog__} test url px1000 20241223-12
                        {__prog__} test url px1000 20241223-*

        test path       Test loading data from a local path
        test model      Test loading data from the database model

        upload [SOURCE] Upload data in SOURCE to RadarHub, where
                        SOURCE is the folder that contains a bunch of day folders, i.e., YYYYMMDD
        """
        ),
    )
    parser.add_argument("-n", dest="no_go", action="store_true", help="do not execute, just show the command")
    parser.add_argument("-v", dest="verbose", default=0, action="count", help="increases verbosity")
    parser.add_argument(
        "--server",
        type=str,
        default="https://radarhub.arrc.ou.edu",
        help="RadarHub server URL, defaul = https://radarhub.arrc.ou.edu",
    )
    parser.add_argument("source", type=str, nargs="*", help="souce(s) to process")
    args = parser.parse_args()

    if args.verb[0] == "test":
        if args.source[0] == "path":
            load_by_path(*args.source[1:])
        elif args.source[0] == "model":
            load_by_model()
        elif args.source[0] == "url":
            load_by_url(args.server, *args.source[1:])
    elif args.verb[0] == "upload":
        for folder in args.source:
            print(f"Uploading {folder} ...")
            upload(source=folder, no_go=args.no_go, verbose=args.verbose)
    elif args.verb[0] == "fun":
        fun(*args.source)

    # stat = Client().stats()
    # print(stat)
