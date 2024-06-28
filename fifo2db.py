#!/usr/bin/env python

#
#  fifo2db.py
#  File entries from fifoshare to the Database
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2022 Boonleng Cheong.
#

import os
import sys
import glob
import radar
import django
import select
import signal
import socket
import argparse
import datetime
import textwrap
import threading
import time as tm

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "radarhub.settings")
django.setup()

import dbtool

from django.conf import settings
from frontend.models import Sweep, Day
from common import colorize, color_name_value, dailylog

__prog__ = os.path.basename(sys.argv[0])

keepReading = True
tzinfo = datetime.timezone.utc
radars = settings.RADARS.copy()
logger = dailylog.Logger(os.path.splitext(__prog__)[0], home=settings.LOG_DIR, dailyfile=settings.DEBUG)
# Populate other keys as local parameters
for name, item in radars.items():
    item["step"] = 0
    item["count"] = 0


def signalHandler(sig, frame):
    global keepReading
    keepReading = False
    # Print a return line for cosmetic
    print("\r")
    logger.info("SIGINT received, finishing up ...")


def proper(file, root="/mnt/data", verbose=0):
    basename = os.path.basename(file)
    parts = radar.re_3parts.search(basename)
    if parts is None:
        if verbose:
            fn_name = colorize("proper()", "green")
            logger.info(f"{fn_name} unexpected filename {basename}")
        return None
    parts = parts.groupdict()
    name = parts["name"]
    if name not in radars:
        logger.info(f"Radar {name} not recognized.")
        return None
    sub = radars[name]["folder"]
    day = parts["time"][0:8]
    year = parts["time"][0:4]
    dayTree = f"{year}/{day}"
    filename = f"{root}/{sub}/{dayTree}/_original/{basename}"
    if not os.path.exists(filename):
        filename = f"{root}/{sub}/{dayTree}/{basename}"
    if not os.path.exists(filename):
        logger.info(f"proper() Could not find {basename}")
        filename = None
    return filename


def catchupV1(file, root="/mnt/data"):
    logger.info(colorize("catchup()", "green"))
    logger.info(color_name_value("file", file))
    basename = os.path.basename(file)
    c = basename.split("-")
    d = c[1]
    prefix = c[0] + "-"
    if not Day.objects.filter(name=prefix).exists():
        return
    day = Day.objects.filter(name=prefix).latest("date")
    hour = day.last_hour()
    if prefix in radars:
        sub = radars[prefix]["folder"]
        folder = f"{root}/{sub}"
    else:
        logger.warning(f"Radar {prefix} not recognized.")
        return

    date = day.date
    stride = datetime.timedelta(days=1)
    filedate = datetime.date(int(d[0:4]), int(d[4:6]), int(d[6:8]))
    while date <= filedate:
        dayTree = date.strftime(r"%Y/%Y%m%d")
        dayFolder = f"{folder}/{dayTree}"
        logger.info(color_name_value("folder", dayFolder) + "   " + color_name_value("hour", hour))
        dbtool.xz_folder(dayFolder, hour)
        date += stride
        hour = 0


def catchup(root="/mnt/data"):
    global radars
    logger.info(colorize("catchup()", "green"))
    for prefix, radar in radars.items():
        folder = radar["folder"]
        folder = f"{root}/{folder}"
        show = color_name_value("prefix", prefix)
        show += "  " + color_name_value("folder", folder)
        logger.info(show)
        if not Day.objects.filter(name=prefix).exists():
            logger.info("Skipping ...")
            continue
        folderYear = sorted(glob.glob(f"{folder}/20[0-9][0-9]"))[-1]
        year = os.path.basename(folderYear)
        path = f"{folderYear}/{year}[012][0-9][0-3][0-9]"
        folderYearDay = sorted(glob.glob(path))[-1]
        day = os.path.basename(folderYearDay)
        logger.info(f"{folderYear} -> {year} -> {day}")
        files = sorted(glob.glob(f"{folderYearDay}/_original/*.tar.xz"))
        if len(files) == 0:
            files = sorted(glob.glob(f"{folderYearDay}/*.txz"))
        if len(files) == 0:
            files = sorted(glob.glob(f"{folderYearDay}/_original/*.txz"))
        if len(files) == 0:
            logger.info("Error. No files.")
            return
        file = files[-1]
        logger.info(f"{file}")
        basename = os.path.basename(file)
        c = basename.split("-")
        d = c[1]
        filedate = datetime.date(int(d[0:4]), int(d[4:6]), int(d[6:8]))
        day = Day.objects.filter(name=prefix).latest("date")
        hour = day.last_hour()
        date = day.date
        stride = datetime.timedelta(days=1)
        while date <= filedate:
            dayTree = date.strftime(r"%Y/%Y%m%d")
            dayFolder = f"{folder}/{dayTree}"
            logger.info(color_name_value("folder", dayFolder) + "   " + color_name_value("hour", hour))
            dbtool.xz_folder(dayFolder, hour)
            date += stride
            hour = 0
        radars[prefix]["count"] += 1
        minute = int(c[2][2:4])
        step = int(minute / 20)
        radars[prefix]["step"] = 0 if step == 2 else step + 1
        if logger.level > dailylog.logging.WARNING:
            print("")


def process(file):
    global radars
    logger.info(colorize(file, 43))
    if not os.path.exists(file):
        archive = proper(file)
    else:
        archive = file
    if archive is None:
        logger.info(f"Ignoring {file} ...")
        return
    basename = os.path.basename(archive)
    parts = radar.re_3parts.search(basename)
    if parts is None:
        logger.error(f"Ignoring {archive} ...")
        return
    parts = parts.groupdict()
    name = parts["name"]
    if name not in radars:
        logger.info(f"Radar {name} skipped")
        return
    scan = parts["scan"]
    time = datetime.datetime.strptime(parts["time"], r"%Y%m%d-%H%M%S").replace(tzinfo=tzinfo)
    sweep = Sweep.objects.filter(time=time, name=name)
    if sweep:
        logger.debug(f"Sweep {time} {name} exists.")
        return
    data, tarinfo = radar.read(archive, want_tarinfo=True)
    if data is None:
        logger.error(f"Failed opening file {archive}")
        return
    kind = data["kind"]
    symbols = list(data["products"].keys())
    sweep = Sweep(time=time, name=name, kind=kind, scan=scan, symbols=symbols, path=archive, tarinfo=tarinfo)
    sweep.save()

    bgor = False
    if scan.startswith(radars[name]["summary"]):
        step = time.minute // 20
        target = radars[name]["step"]
        logger.debug(f"{step} vs {target}")
        if radars[name]["step"] == step:
            radars[name]["step"] = 0 if step == 2 else radars[name]["step"] + 1
            bgor = True
    day, mode = dbtool.build_day(f"{name}-{time.strftime(r'%Y%m%d')}", bgor=bgor)
    u = "+" if bgor else ""
    logger.info(f"{mode} {day.__repr__()}{u}")


def listen(host="10.197.14.59", port=9000):
    if not isinstance(port, int):
        port = int(port)
    global keepReading
    keepReading = True
    while keepReading:
        # Open a socket to connect FIFOShare
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.connect((host, port))
        except:
            logger.info("fifoshare server not available")
            k = 5
            while k > 0:
                # logger.debug('Try again in {} second{} ... '.format(k, 's' if k > 1 else ''), end='\r')
                s = "s" if k > 1 else ""
                print(f"Try again in {k} second{s} ... ", end="\r")
                tm.sleep(1.0)
                k -= 1
            continue
        sock.setblocking(0)
        logger.info(f"fifoshare connection {host} established")

        localMemory = b""

        while keepReading:
            # Check if the socket is ready to read
            readyToRead, _, selectError = select.select([sock], [], [sock], 0.1)
            if selectError:
                # logger.warning('Error in select() {}'.format(selectError))
                logger.error(f"Error in select() {selectError}")
                break
            elif readyToRead:
                try:
                    r = sock.recv(1024)
                    logger.debug(f"recv() -> {r}")
                except:
                    logger.warning("fifoshare connection interrupted.")
                    break
                if not r:
                    logger.debug("fifoshare connection closed.")
                    break
            else:
                continue

            # Concatenate the received string into local memory and consume it
            localMemory += r
            files = localMemory.decode("ascii").split("\n")
            localMemory = files[-1].encode("utf")
            logger.debug(f"files = {files}")

            for file in files[:-1]:
                # At this point, the filename is considered good
                file = os.path.expanduser(file)

                # Read in the sweep based on the known patterns: .nc, _V06, etc.
                process(file)

        # Out of the second keepReading loop. Maybe there was an error in select(), close and retry
        sock.close()
        logger.info("fifoshare connection terminated")
        if keepReading:
            k = 50
            while k > 0 and keepReading:
                tm.sleep(0.1)
                k -= 1


def read(pipe="/tmp/radarhub.fifo"):
    global keepReading
    keepReading = True

    if not os.path.exists(pipe):
        try:
            os.mkfifo(pipe)
        except:
            raise

    # Put something into the pipe to get things moving
    def initpipe(pipe, string):
        tm.sleep(0.169)
        with open(pipe, "at") as fid:
            fid.write(string)

    initstring = ":/radarhub/rocks"
    threading.Thread(
        target=initpipe,
        args=(
            pipe,
            initstring,
        ),
    ).start()

    while keepReading:
        # Open the pipe
        try:
            fid = open(pipe)
        except:
            logger.warning("Pipe not available")
            k = 5
            while k > 0:
                # logger.debug('Try again in {} second{} ... '.format(k, 's' if k > 1 else ''), end='\r')
                s = "s" if k > 1 else ""
                print(f"Try again in {k} second{s} ... ", end="\r")
                tm.sleep(1.0)
                k -= 1
            continue
        logger.info(f"pipe {pipe} opened")

        while keepReading:
            # Check if the fid is ready to read
            readyToRead, _, selectError = select.select([fid], [], [fid], 0.1)
            if selectError:
                # logger.warning('Error in select() {}'.format(selectError))
                logger.error(f"Error in select() {selectError}")
                break
            elif readyToRead:
                files = fid.read()
                if len(files) == 0:
                    logger.debug("fid.read() ->nothing")
                    tm.sleep(0.1)
                    continue
            else:
                continue

            files = files.split("\n")
            for file in files:
                logger.debug(f"read() -> {file}")
                if file == initstring:
                    continue

                # At this point, the filename is considered good
                file = os.path.expanduser(file)
                process(file)

        # Out of the second keepReading loop. Maybe there was an error in select(), close and retry
        fid.close()
        logger.info("pipe closed")
        if keepReading:
            k = 50
            while k > 0 and keepReading:
                tm.sleep(0.1)
                k -= 1


def fifo2db():
    parser = argparse.ArgumentParser(
        prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(
            f"""\
        FIFO to Database

        Examples:
            {__prog__} -v
            {__prog__} 10.197.14.59
            {__prog__} -p /tmp/radarhub.fifo
        """
        ),
        epilog="Copyright (c) 2021-2022 Boonleng Cheong",
    )
    parser.add_argument("source", default=None, type=str, nargs="?", help="source to retrieve files")
    parser.add_argument("--port", default=9000, help="sets the port (default = 9000)")
    parser.add_argument("-p", dest="pipe", action="store_true", help="reads from a pipe")
    parser.add_argument(
        "-t",
        dest="test",
        default=0,
        type=int,
        help=textwrap.dedent(
            """\
            runs a test
            1 - Test handling a corrupted tar archive
            2 - Test catching an exception
            """
        ),
    )
    parser.add_argument("--version", action="version", version="%(prog)s " + settings.VERSION)
    parser.add_argument("-v", dest="verbose", default=0, action="count", help="increases verbosity")
    args = parser.parse_args()

    if args.verbose:
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)
        logger.showLogOnScreen()

    # Populate the default source if not specified
    if args.source is None:
        if "tcp" in settings.FIFO:
            args.source = settings.FIFO["tcp"]
        elif "pipe" in settings.FIFO:
            args.source = settings.FIFO["pipe"]
            args.pipe = True
        else:
            args.source = "10.197.14.59:9000"
    if ":" in args.source:
        args.source, args.port = args.source.split(":")
        args.port = int(args.port)

    if args.test > 0:
        logger.showLogOnScreen()
        if args.test == 1:
            logger.info("Test 1: Handling a corrupted archive")
            process("blob/FAKE-20220205-100000-E4.0.tar.xz")
            return
        elif args.test == 2:
            logger.info("Test 2: Catching an exception")
            d = Day(date="2022-02-14")
            s = d.date.strftime(r"%Y%m%d")
            print(f"Unable to generate {s}")
            return
        elif args.test == 3:
            catchupV1()
            return
        else:
            print("Unknown test")
            return

    # Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    logger.info("--- Started ---")
    logger.info(f"Using timezone {tzinfo}")

    catchup()

    if args.pipe:
        logger.info(color_name_value("pipe", args.source))
        read(args.source)
    else:
        show = color_name_value("host", args.source)
        show += "   " + color_name_value("port", args.port)
        logger.info(show)
        listen(args.source, port=args.port)

    logger.info("--- Finished ---")


###

if __name__ == "__main__":
    fifo2db()
