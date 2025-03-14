#!/usr/bin/env python

#
#  dbtool.py
#  Database Tool
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021-2022 Boonleng Cheong.
#

import os
import re
import sys
import glob
import tqdm
import django
import pprint
import logging
import argparse
import textwrap
import datetime
import logparse
import time as tm

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "radarhub.settings")
django.setup()

from django.conf import settings
from common import colorize, truncate_array, colored_variables
from common import log_format, log_indent
from frontend.models import Sweep, Day, Visitor
from setproctitle import setproctitle

__prog__ = os.path.splitext(os.path.basename(sys.argv[0]))[0]

tzinfo = datetime.timezone.utc
logger = logging.getLogger(__prog__)


pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)
pattern_yyyy = re.compile(r"20\d{2}")
pattern_yyyymmdd = re.compile(r"20\d{2}(0[0-9]|1[012])([0-2]\d|3[01])")
pattern_x_yyyymmdd = re.compile(r"(?<=[-/])20\d{2}(0\d|1[012])([0-2]\d|3[01])")


def params_from_source(source, dig=False):
    """
    Parse name, date, datetime, etc. from a source string

    - source - could either be:
        - a string with day only, e.g., YYYYMMDD
        - a string with name and day, e.g., PX-20220127,
        - a path to the data, e.g., /mnt/data/PX1000/2022/20220127
    - dig - dig deeper for the name if the source is a folder
    """
    myname = colorize("params_from_source()", "green")
    file = None
    name = None
    day_string = None
    date_range = None
    source_date = None
    source_datetime = None
    logger.debug(f"{myname}   {colored_variables(source, dig)}")
    if "*" == source[-1]:
        if "-" in source:
            name, query = source.split("-")
        else:
            query = source
        logger.debug(f"{myname}   {colored_variables(name, query)}")
        # Exactly *
        if len(query) == 1:
            date_range = [datetime.datetime(2000, 1, 1, tzinfo=tzinfo), datetime.datetime(2100, 1, 1, tzinfo=tzinfo)]
        # Like 2024*
        elif len(query) < 6:
            y = int(query[0:4])
            date_range = [datetime.datetime(y, 1, 1, tzinfo=tzinfo), datetime.datetime(y, 12, 31, tzinfo=tzinfo)]
        # Like 202401*
        elif len(query) > 6:
            y = int(query[0:4])
            m = int(query[4:6])
            start = datetime.datetime(y, m, 1, tzinfo=tzinfo)
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1
            end = datetime.datetime(y, m, 1, tzinfo=tzinfo)
            end -= datetime.timedelta(days=1)
            date_range = [start, end]
        else:
            logger.warning(f"{myname} Error. Please specify YYYY* or a YYYYMM*, e.g., 2024* or 202407*")
    if os.path.isdir(source):
        if source[-1] == "/":
            source = source[:-1]
        folder, day_string = os.path.split(source)
        if "/" in folder:
            pathway = os.path.basename(os.path.dirname(folder)).lower()
            name = settings.RADARS.get(pathway, {}).get("prefix", None)
        elif dig:
            files = list_files(source)
            file = os.path.basename(files[0]) if len(files) else None
    elif os.path.exists(source):
        folder, file = os.path.split(source)
        if "_original" in folder:
            folder, _ = os.path.split(folder)
        else:
            logger.warning(f"{myname} Expected '_original' in source folder {folder}")
        day_string = os.path.basename(folder)
        if file:
            logger.debug(f"{myname} file[0] = {file}")
            c = os.path.splitext(file)[0].split("-")
            name = c[0]
            time_string = c[1] + c[2]
            if day_string != c[1]:
                logger.warning(f"Warning. Inconsistent day_string = {day_string} != c[1] = {c[1]} (*)")
                day_string = c[1]
            source_datetime = datetime.datetime.strptime(time_string, r"%Y%m%d%H%M%S").replace(tzinfo=tzinfo)
    elif "/" in source:
        logger.error(f"Error. Folder {source} does not exist")
        day_string = pattern_x_yyyymmdd.search(source)
        if day_string:
            day_string = day_string.group(0)
    elif "-" in source:
        name, day_string = source.split("-")
        if "*" in day_string:
            day_string = None
    else:
        day_string = pattern_yyyymmdd.search(source)
        if day_string:
            day_string = day_string.group(0)
        else:
            day_string = None
            name = source
    if day_string:
        source_date = datetime.datetime.strptime(day_string, r"%Y%m%d").date()
        start = datetime.datetime(source_date.year, source_date.month, source_date.day, tzinfo=tzinfo)
        date_range = [start, start + datetime.timedelta(days=1)]
        if name is None:
            logger.debug(f"{myname} Only day string from {source}")
    return {
        "file": file,
        "name": name,
        "date": source_date,
        "datetime": source_datetime,
        "date_range": date_range,
    }


def list_files(folder):
    """
    List .txz or .tar.xz files in a folder

    - folder - path to list, e.g., /mnt/data/PX1000/2022/20220128
    """
    files = sorted(glob.glob(os.path.join(folder, "[A-Za-z0-9]*.txz")))
    if len(files) == 0:
        files = sorted(glob.glob(os.path.join(folder, "[A-Za-z0-9]*.tar.xz")))
    if len(files) == 0:
        folder = os.path.join(folder, "_original")
        files = sorted(glob.glob(os.path.join(folder, "[A-Za-z0-9]*.txz")))
        if len(files) == 0:
            files = sorted(glob.glob(os.path.join(folder, "[A-Za-z0-9]*.tar.xz")))
    return files


def xz_folder(folder, **kwargs):
    """
    Inspects a folder with .xz archives and create Sweep entries for the database.

    Parameters:
    - `folder`: the folder with .xz archives, e.g., /mnt/data/PX1000/2022/20220128

    Optional parameters:
    - hour=0 - only insert files after this hour, e.g., hour=2
    - skip=False - skip the folder if it already has the same number of entries
    - single=True - do not use multiprocessing
    - progress=True - show progress bar
    - quick_insert=True - insert without checking for duplicates
    - verbose=0 - verbosity level

    """
    import radar
    import shutil

    radar.set_logger(logger)

    hour = kwargs.get("hour", 0)
    skip = kwargs.get("skip", None)
    single = kwargs.get("single", False)
    progress = kwargs.get("progress", None)
    quick_insert = kwargs.get("quick_insert", False)
    verbose = kwargs.get("verbose", 0)

    myname = colorize("xz_folder()", "green")
    logger.info(f"{myname}   {colored_variables(folder, verbose, quick_insert)}")

    use_mp = "linux" in sys.platform and not single
    if use_mp:
        import multiprocessing

    basename = os.path.basename(folder)
    s = pattern_yyyymmdd.search(basename)
    if s:
        s = s.group(0)
    else:
        logger.info(f"Error searching YYYYMMDD in folder name {basename}")
        return

    raw_archives = list_files(folder)
    if len(raw_archives) == 0:
        logger.info(f"No files in {folder}. Unable to continue.")
        return

    d = check_day(folder)
    if d:
        d = d[0]

    if quick_insert and d:
        show = colorize(" WARNING ", "warning")
        logger.warning(
            f"{show} There {'are' if d.count > 1 else 'is'} {d.count:,d} existing entr{'ies' if d.count > 1 else 'y'}."
        )
        logger.warning(f"{show} Quick insert will result in duplicates. Try normal insert instead.")
        ans = input("Do you still want to continue (y/[n])? ")
        if not ans == "y":
            logger.info("Whew. Nothing happend.")
            return

    if d.count == len(raw_archives):
        logger.info(f"Files in {folder} == Day({basename}).count = {d.count:,}")
        if skip is None:
            ans = input("Do you still want to continue (y/[n])? ")
            if not ans == "y":
                logger.info(f"Folder {folder} skipped")
                return
        elif skip == True:
            logger.info(f"Folder {folder} skipped")
            return

    day_string = f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    time_range = [f"{day_string} {hour:02d}:00Z", f"{day_string} 23:59:59.99Z"]
    show = colorize("date_range", "orange") + colorize(" = ", "red")
    show += "[" + colorize(time_range[0], "yellow") + ", " + colorize(time_range[1], "yellow") + "]"
    logger.debug(show)

    archives = []
    for path in raw_archives:
        basename = os.path.basename(path)
        file_hour = int(basename.split("-")[2][0:2])
        if file_hour >= hour:
            archives.append(path)
    if len(archives) == 0:
        logger.info(f"No files in {folder} after {hour:02d}:00")
        return

    # Use the first file to determine the name, kind and symbols
    basename = os.path.basename(archives[0])
    parts = radar.re_3parts.search(basename)
    if parts:
        parts = parts.groupdict()
        name = parts["name"]
    else:
        logger.error(f"Error. Unable to determine name from basename {basename}")
        return
    first = radar.read(archives[0], verbose=verbose)
    kind = first["kind"]
    if kind == Sweep.Kind.UNK:
        logger.error(f"Kind {kind}. Unable to continue.")
        return
    else:
        kindString = colorize(Sweep.Kind(kind).name, "yellow")
        logger.info(f"Kind is {kind} ({kindString})")
    symbols = " ".join(list(first["products"].keys()))

    def process_archives(id, run, queue, out):
        setproctitle(f"{__prog__} # process_archives[{id}]")
        while run.value:
            try:
                task = queue.get(False)
                archive = task["archive"]
                ramfile = task["ramfile"]
                logger.debug(f"{id:02d}: {archive} {ramfile}")
                basename = os.path.basename(archive)
                parts = radar.re_3parts.search(basename)
                if parts:
                    elem = parts.groupdict()
                    scan = elem["scan"]
                    time = datetime.datetime.strptime(elem["time"], r"%Y%m%d-%H%M%S").replace(tzinfo=tzinfo)
                    tarinfo = radar.read_tarinfo(archive)
                    out.put({"file": basename, "info": (time, scan, archive, tarinfo)})
                else:
                    logger.error(f"Error. Unable to parse {archive}")
                os.remove(ramfile)
            except:
                tm.sleep(0.1)
                pass
        logger.debug(f"process_archives[{id:02}] done")
        return

    keys = []
    output = {}

    # Extracting parameters of the archives
    desc = "Pass 1 / 2 - Scanning archives"
    if not progress:
        logger.info(f"{desc} ...")

    e = tm.time()

    if use_mp:
        task_queue = multiprocessing.Queue()
        db_queue = multiprocessing.Queue()
        run = multiprocessing.Value("i", 1)

        count = min(multiprocessing.cpu_count(), 12)

        processes = []
        for n in range(count):
            p = multiprocessing.Process(target=process_archives, args=(n, run, task_queue, db_queue))
            processes.append(p)
            p.start()

        def _dequeue_and_update():
            while not db_queue.empty():
                out = db_queue.get()
                key = out["file"]
                keys.append(key)
                output[key] = out["info"]

        for path in tqdm.tqdm(archives, desc=f"{log_indent}{desc}") if progress else archives:
            # Copy the file to ramdisk and queue the work after the file is copied
            basename = os.path.basename(path)
            if os.path.exists("/mnt/ramdisk"):
                ramfile = f"/mnt/ramdisk/{basename}"
            else:
                ramfile = f"{basename}"
            shutil.copy(path, ramfile)
            task_queue.put({"archive": path, "ramfile": ramfile})
            # Wait if the task queue is too long
            while task_queue.qsize() > 2 * count:
                tm.sleep(0.1)
            _dequeue_and_update()
        # Wait for the tasks to finish
        while task_queue.qsize() > 0:
            tm.sleep(0.1)
        run.value = 0
        for p in processes:
            p.join()
        _dequeue_and_update()
    else:
        for path in tqdm.tqdm(archives) if progress else archives:
            basename = os.path.basename(path)
            parts = radar.re_3parts.search(basename)
            if parts:
                elem = parts.groupdict()
                scan = elem["scan"]
                time = datetime.datetime.strptime(elem["time"], r"%Y%m%d-%H%M%S").replace(tzinfo=tzinfo)
                tarinfo = radar.read_tarinfo(path)
                keys.append(basename)
                output[basename] = (time, scan, path, tarinfo)
            else:
                logger.error(f"Error. Unable to parse {path}")

    if verbose > 2:
        pprint.pp(output)

    # Consolidating results
    if len(keys) == 0:

        desc = "Pass 2 / 2 - No new entries. Skipping ..."
        print(f"{log_indent}{desc}")

    else:

        keys = sorted(keys)
        entries = Sweep.objects.filter(time__range=time_range, name=name)
        if len(entries) == 0:
            logger.debug(f"No Swwep entries for {name} {time_range}. Overriding quick_insert = True ...")
            quick_insert = True

        if quick_insert:

            t = tm.time()
            desc = "Pass 2 / 2 - Creating entries"
            if not progress:
                logger.info(f"{desc} ...")
            creates = []
            for key in tqdm.tqdm(keys, desc=f"{log_indent}{desc}") if progress else keys:
                time, scan, path, tarinfo = output[key]
                x = Sweep(time=time, name=name, kind=kind, scan=scan, path=path, symbols=symbols, tarinfo=tarinfo)
                creates.append(x)
            Sweep.objects.bulk_create(creates)
            t = tm.time() - t
            a = len(creates) / t
            logger.info(f"Created {t:.2f} sec ({a:,.0f} files / sec)")

        else:

            t = tm.time()
            entries = Sweep.objects.filter(time__range=time_range, name=name)
            desc = "Pass 2 / 2 - Gathering entries"
            if not progress:
                logger.info(f"{desc} ... {colored_variables(name)}")
            creates = []
            updates = []
            count_ignore = 0
            for key in tqdm.tqdm(keys, desc=f"{log_indent}{desc}") if progress else keys:
                time, scan, path, tarinfo = output[key]
                n = entries.filter(time=time)
                if n:
                    x = n.first()
                    if x.scan != scan or x.path != path or x.symbols != symbols or x.tarinfo != tarinfo:
                        mode = "U"
                        x.kind = kind
                        x.scan = scan
                        x.path = path
                        x.symbols = symbols
                        x.tarinfo = tarinfo
                        updates.append(x)
                    else:
                        mode = "I"
                        count_ignore += 1
                else:
                    mode = "N"
                    x = Sweep(time=time, name=name, kind=kind, scan=scan, path=path, symbols=symbols, tarinfo=tarinfo)
                    creates.append(x)
                logger.debug(f"{mode} : {name} {time.strftime(r'%Y%m%d-%H%M%S')} @ {path}")
            if len(creates):
                Sweep.objects.bulk_create(creates)
            if len(updates):
                Sweep.objects.bulk_update(
                    updates, ["time", "name", "kind", "scan", "path", "symbols", "tarinfo"], batch_size=1000
                )
            t = tm.time() - t
            a = len(keys) / t
            logger.info(
                f"Updated {t:.2f} sec ({a:,.0f} files / sec)   c: {len(creates)}  u: {len(updates)}  i: {count_ignore}"
            )

        # Make a Day entry
        day_str = parts["time"][:8]
        build_day(f"{name}-{day_str}", bgor=True)

    e = tm.time() - e
    a = len(archives) / e
    show = colorize(f"{e:.2f}", "teal")
    logger.info(f"Total elapsed time = {show} sec ({a:,.0f} files / sec)")


def build_day(source, bgor=False, verbose=0):
    """
    Build an entry to the Day table

    - source - common source pattern (see params_from_source())
    - bgor - compute the bgor values of the day
    """
    myname = colorize("build_day()", "green")
    if verbose:
        logger.debug(f"{myname}   {colored_variables(source, bgor)}")

    params = params_from_source(source, dig=True)
    name = params["name"]
    date = params["date"]

    if name is None:
        logger.error(f"Error. Unble to determine name from {source}")
        return None

    if date is None:
        logger.error(f"Error. build_day() needs an exact date.")
        return None

    date_range = params["date_range"]
    if date_range:
        sweeps = Sweep.objects.filter(time__range=date_range, name=name)
        if sweeps.count() == 0:
            logger.error(f"Error. No Sweep entries for {date_range} / {name}")
            return None

    day_string = date.strftime(r"%Y-%m-%d")

    tic = tm.time()

    mode = "N"
    day = Day.objects.filter(date=date, name=name)
    if day:
        mode = "U"
        day = day.first()
    else:
        day = Day(date=date, name=name)

    total = 0
    counts = [0] * 24
    for k in range(24):
        date_range = [f"{day_string} {k:02d}:00:00Z", f"{day_string} {k:02d}:59:59.9Z"]
        matches = Sweep.objects.filter(time__range=date_range, name=name)
        counts[k] = matches.count()
        total += counts[k]

    if total > 0:
        day.count = total
        day.duration = day.count * 20
        day.hourly_count = ",".join([str(c) for c in counts])
        day.save()
    elif mode == "U" and total == 0:
        mode = "D"
        day.delete()
        day = None
    else:
        mode = "I"

    if day is not None and bgor:
        day.summarize()
        logger.debug(f"{mode} {day.strfday(format='full')}")
    else:
        logger.debug(f"{mode} {day}")

    tic = tm.time() - tic

    logger.debug(f"Elapsed time: {tic:.2f}s")

    return day, mode


def check_day(source, format=""):
    """
    Check a Day entry from the database

    - source - common source pattern (see params_from_source())
    """
    myname = colorize("check_day()", "green")
    logger.info(f"{myname}   {colored_variables(source)}")
    params = params_from_source(source)
    if params["name"] is None:
        # names = list(settings.RADARS.keys())
        names = [item["prefix"] for item in settings.RADARS.values()]
    elif isinstance(params["name"], str):
        names = [params["name"]]
    else:
        logger.error("Unable to continue")
        pp.pprint(params)
    ddd = []
    date = params["date"]
    date_range = params["date_range"]
    for name in names:
        if date:
            dd = Day.objects.filter(name=name, date=date).order_by("date")
        elif date_range:
            dd = Day.objects.filter(name=name, date__range=date_range).order_by("date")
        else:
            dd = Day.objects.filter(name=name).order_by("date")
        if len(dd) == 0:
            continue
        for d in dd:
            ddd.append(d)
            show = d.strfday(format=format)
            logger.info(f"R {show}")
    if len(ddd) == 0:
        logger.info(f"Day entry of {source} does not exist")
    return ddd


def check_source(source, progress=True, remove=False):
    """
    Check Sweep entries and verify existence of Sweep.path

    - source - common source pattern (see params_from_source())
    """
    myname = colorize("check_source()", "green")
    logger.info(f"{myname}   {colored_variables(source, progress, remove)}")
    params = params_from_source(source, dig=True)
    print(params)
    if params["name"] is None or params["name"] == "*":
        names = [item["prefix"] for item in settings.RADARS.values()]
    elif isinstance(params["name"], str):
        names = [params["name"]]
    else:
        logger.error("Unable to continue")
        pp.pprint(params)

    for name in names:
        scans = Sweep.objects.filter(time__range=params["date_range"], name=name)
        count = scans.count()
        logger.info(f"{myname}   {colored_variables(name, count)}")
        if count == 0:
            continue
        paths = []
        count = 0
        removed = 0
        for scan in tqdm.tqdm(scans, desc=f"{log_indent}Screening paths ...") if progress else scans:
            if not os.path.exists(scan.path):
                paths.append(scan.path)
                count += 1
                if remove:
                    scan.delete()
                    removed += 1
        if count:
            pp.pprint(truncate_array(paths))
            s = "s" if count > 1 else ""
            logger.info(f"{source} has {count} missing file{s}")
        if removed:
            logger.info(f"Removed {removed} entries")
            if not Sweep.objects.filter(time__range=params["date_range"], name=name).exists():
                day_str = params["date"]
                logger.info(f"No more entries for {name}. Deleting Day entry ...")
                day = Day.objects.filter(date=params["date"], name=name)
                if day:
                    day = day.first()
                    day.delete()
            else:
                build_day(source, bgor=True)


def find_duplicates(source, remove=False):
    """
    Finds duplicate Sweep entries

    - source - common source pattern (see params_from_source())
    - remove - remove duplicate entries (copy > 1) if set to True
    """
    myname = colorize("find_duplicates()", "green")
    logger.info(f"{myname}   {colored_variables(source, remove)}")
    params = params_from_source(source)
    date_range = params["date_range"]
    name = params["name"]
    logger.info(f"{myname}   {colored_variables(date_range, name)}")

    if name:
        entries = Sweep.objects.filter(time__range=date_range, name=name)
    else:
        entries = Sweep.objects.filter(time__range=date_range)
    files = [entry.path for entry in entries]
    if len(files) == 0:
        logger.info("No match")
        return

    count = 0
    removed = 0
    for file in tqdm.tqdm(files, desc=f"{log_indent}Checking duplicates"):
        if files.count(file) == 1:
            continue
        count += 1
        x = entries.filter(path=file)
        logger.debug(f"{file} has {len(x)} entries")
        for o in x[1:]:
            logger.debug(o.__repr__())
            if remove:
                removed += 1
                o.delete()

    if count:
        logger.info(f"Found {count} duplicates")
    if removed:
        logger.info(f"Removed {removed} files")


def check_latest(source=[], markdown=False):
    """
    Check for latest entries from each radar
    """
    myname = colorize("check_latest()", "green")
    logger.info(f"{myname}   {colored_variables(source, markdown)}")
    pathways = [k for k, v in settings.RADARS.items() if v["prefix"] in source]
    logger.debug(f"{myname}   {source} -> {pathways}")
    message = "| Radars | Latest Scan | Age |\n|---|---|---|\n"
    for pathway in pathways:
        prefix = settings.RADARS[pathway]["prefix"]
        day = Day.objects.filter(name=prefix)
        if not day:
            continue
        day = day.latest("date")
        latest = day.latest_datetime_range
        sweep = Sweep.objects.filter(name=prefix, time__range=latest).latest("time")
        folder = settings.RADARS[pathway]["folder"]
        logger.info(f"{myname}   {colored_variables(latest)}")
        logger.info(f"{myname}   {colored_variables(sweep.path)}")
        age = sweep.age
        age_str = ""
        if age.days > 0:
            s = "s" if age.days > 1 else ""
            age_str += f"{age.days} day{s} "
        hours = age.seconds // 3600
        if hours > 0:
            s = "s" if hours > 1 else ""
            age_str += f"{hours} hour{s} "
        mins = (age.seconds - 3600 * hours) // 60
        s = "s" if mins > 1 else ""
        age_str += f"{mins} min{s}"
        logger.info(f"{myname}   {colored_variables(age_str)}")
        message += f"{folder} | {sweep.path} | {age_str} |\n"
        # logger.info(show)
    if markdown:
        print(message)
    return message


def show_sweep_summary(source, markdown=False):
    """Show sweep summary.

    - source (str): name in either one of the following forms:
        - [PREFIX]-YYYYMMDD-hhmm
        - [PREFIX]
    - markdown (bool, optional): Defaults to False.

    """
    myname = colorize("show_sweep_summary()", "green")
    logger.info(f"{myname}   {colored_variables(source, markdown)}")
    c = source.split("-")
    name = c[0]
    if len(c) >= 2:
        t = datetime.datetime.strptime(c[1] + c[2], r"%Y%m%d%H%M%S").replace(tzinfo=tzinfo)
        o = Sweep.objects.filter(time=t, name=name).last()
    else:
        logger.info(f"Retrieving last entry with name = {name} ...")
        d = Day.objects.filter(name=name).last()
        o = Sweep.objects.filter(time__range=d.latest_datetime_range, name=name).last()
    if o:
        logger.debug(o.__repr__())
        o.summary(markdown=markdown)
    else:
        logger.info(f"No entry found for {source}")


def show_visitor_log(markdown=False, show_city=False, recent=0):
    """Shows visitor summary, something like:

    | IP Address      |      Payload (B) |    Bandwidth (B) |     Count |         OS / Browser | Last Visit | Location                       |
    | --------------- |----------------- |----------------- | --------- | -------------------- | ---------- | ------------------------------ |
    | 75.111.159.35   |       13,836,684 |        1,361,384 |        42 |       macOS / Chrome | 2022/07/22 | Texas, United States           |
    | 186.221.73.23   |    1,380,023,303 |      151,369,900 |     3,797 |       Linux / Chrome | 2022/07/22 | Goiás, Brazil                  |
    | 174.109.29.230  |    1,413,313,725 |      281,190,422 |    14,658 |  Windows 10 / Chrome | 2022/07/22 | North Carolina, United States  |
    """
    print(
        "| IP Address      |      Payload (B) |    Bandwidth (B) |     Count |         OS / Browser | Last Visit | Location                       |"
    )
    print(
        "| --------------- | ---------------- | ---------------- | --------- | -------------------- | ---------- | ------------------------------ |"
    )

    def show_visitor(visitor, markdown):
        agent = logparse.get_user_agent_string(visitor.user_agent, width=20)
        date_string = visitor.last_visited_date_string()
        origin = logparse.get_ip_location(visitor.ip, show_city=show_city)
        if markdown:
            print(
                f"| `{visitor.ip}` | `{visitor.payload:,}` | `{visitor.bandwidth:,}` | `{visitor.count:,}` | {agent} | {date_string} | {origin} |"
            )
        else:
            print(
                f"| {visitor.ip:15} | {visitor.payload:16,} | {visitor.bandwidth:16,} | {visitor.count:9,} | {agent:>20} | {date_string} | {origin:30} |"
            )

    visitors = Visitor.objects.order_by("-last_visited")
    if recent:
        day = datetime.datetime.today().replace(tzinfo=tzinfo) - datetime.timedelta(days=recent)
        visitors = visitors.filter(last_visited__gte=day)
    for visitor in visitors.exclude(ip__startswith="10."):
        show_visitor(visitor, markdown=markdown)
    for visitor in visitors.filter(ip__startswith="10."):
        show_visitor(visitor, markdown=markdown)


def update_visitors(verbose=0):
    """
    Update Visitor table
    """
    myname = colorize("update_visitors()", "green")
    logger.info(f"{myname}  {colored_variables(verbose)}")

    visitors = {}
    uu = re.compile(r"(/data/load|/data/list)")

    file = "/var/log/nginx/access.log"
    lines = logparse.readlines(file)
    if lines is None:
        print("ERROR. Unable to continue.")
    while file and len(lines) == 0:
        logger.info(f"File {file} is empty")
        file = logparse.find_previous_log(file)
        if file is None:
            logger.error("ERROR. Unable to continue.")
            return
        lines = logparse.readlines(file)

    logger.info(f"Processing {file} ... total lines = {len(lines):,d}")

    parser = logparse.LogParser(parser="nginx")

    if Visitor.objects.count():
        last = Visitor.objects.latest("last_visited")

        parser.decode(lines[-1])
        if last.last_visited >= parser.datetime:
            o = parser.datetime.strftime(r"%m/%d %H:%M:%S")
            t = last.last_visited.strftime(r"%m/%d %H:%M:%S")
            logger.info(f"Seen it all: last_visited {t} >= last log entry {o}.")
            return

        parser.decode(lines[0])
        if last.last_visited <= parser.datetime:
            delta = parser.datetime - last.last_visited
            logger.warning(f"Potential data gap: {delta}")
            file = logparse.find_previous_log(file)
            if file is None:
                logger.warning("No previous logs that provide continuity.")
                ans = input("Do you really want to continue (y/[n])? ")
                if not ans == "y":
                    logger.info("Whew. Nothing happend.")
                    return
            while file:
                front = logparse.readlines(file)
                lines = [*front, *lines]
                logger.info(f"Rolling back to {file} ... total lines -> {len(lines):,d}")
                parser.decode(lines[0])
                if last.last_visited > parser.datetime:
                    break
                file = logparse.find_previous_log(file)

    for line in lines:
        parser.decode(line)
        if parser.status == 0 or parser.status > 300:
            continue
        if uu.search(parser.url) is None:
            continue

        if parser.ip not in visitors:
            db_visitors = Visitor.objects.filter(ip=parser.ip)
            if db_visitors:
                visitor = db_visitors.first()
                if visitor.last_visited >= parser.datetime:
                    continue
            else:
                visitor = Visitor.objects.create(ip=parser.ip, last_visited=parser.datetime)
            visitors[parser.ip] = visitor
        else:
            visitor = visitors[parser.ip]

        visitor.count += 1
        visitor.payload += int(parser.bytes * parser.compression)
        visitor.bandwidth += parser.bytes
        visitor.user_agent = parser.user_agent
        visitor.last_visited = parser.datetime
        if verbose:
            print(parser)

    for _, visitor in visitors.items():
        if verbose:
            pp.pprint(visitor.dict())
        visitor.save()

    count = len(visitors)
    if count:
        s = "s" if count > 1 else ""
        logger.info(f"Updated {count} visitor{s}")
    else:
        logger.info("No updates")

    if verbose:
        show_visitor_log(recent=7)


def check_path(folder, args):
    original = os.path.join(folder, "_original")
    original_tgz = os.path.join(folder, "_original_tgz")
    if os.path.exists(original) and os.path.exists(original_tgz):
        archives = glob.glob(f"{original}/*.tar.xz")
        if len(archives):
            # print(f'{original_tgz} is safe to remove')
            cmd = f"rm -rf {original_tgz}"
            if args.verbose:
                print(cmd)
            # os.system(cmd)
    elif os.path.exists(original):
        archives = glob.glob(f"{original}/[A-Z]*.tar.xz")
        if len(archives):
            print(f"{original} " + colorize("ok", "green"))
            return
        archives = glob.glob(f"{original}/[A-Z]*.tgz")
        if len(archives):
            print(f"{original} " + colorize("contains .tgz files", "orange"))
        else:
            files = glob.glob(f"{original}/*.*")
            if len(files):
                print(f"{original} " + colorize("ontains something else", "orange"))
            else:
                print(f"{original} " + colorize("empty", "orange"))
    else:
        archives = glob.glob(f"{folder}/[A-Z]*.tgz")
        if len(archives):
            cmd = f"mkdir {original}"
            print(cmd)
            # os.system(cmd)
            cmd = f"mv {folder}/[A-Z]*.tgz {original}"
            print(cmd)
            # os.system(cmd)
        else:
            print(f"{folder} structure unexpected")


#


def dbtool_main():
    parser = argparse.ArgumentParser(
        prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(
            f"""\
        Database Tool

        Examples:
            {__prog__} -c 20220127
            {__prog__} -c PX-202201*
            {__prog__} -c RAXPOL-202206*
            {__prog__} -c --format=pretty RAXPOL-20220603
            {__prog__} -c RAXPOL-*
            {__prog__} -d PX-20220226
            {__prog__} -d RAXPOL-20220225
            {__prog__} -d /mnt/data/PX1000/2022/20220226
            {__prog__} -i /mnt/data/PX1000/2013/20130520
            {__prog__} -i /mnt/data/PX1000/2013/201305*
            {__prog__} -i --skip /mnt/data/PX1000/2022/2022*
            {__prog__} -i --skip --progress /mnt/data/PX1000/2022/2022*
            {__prog__} -i --no-skip --progress /mnt/data/PX1000/2022/202206*
            {__prog__} -l
            {__prog__} -l RAXPOL
            {__prog__} -l RAXPOL PX
            {__prog__} -s
            {__prog__} -s RAXPOL
            {__prog__} -s PX-20130520-191000
            {__prog__} -f 20220225
            {__prog__} -f RAXPOL-20220225
            {__prog__} -f --remove 20220127
            {__prog__} --check-path /mnt/data/RaXPol/2022/202206*
            {__prog__} -u
        """
        ),
        epilog="Copyright (c) 2021-2022 Boonleng Cheong",
    )
    parser.add_argument(
        "source",
        type=str,
        nargs="*",
        help=textwrap.dedent(
            """\
             source(s) to process, which can be one of the following:
              - file entry (e.g., PX-20220223-192249-E16.0) for --show-sweep
              - path (e.g., /mnt/data/PX1000/2022/20220223) for -c, -i, -I, or -f
              - prefix + day (e.g., RAXPOL-20220225)
              - day (e.g., 20220223) for -c, -d
             """
        ),
    )
    parser.add_argument("--all", action="store_true", help="sets to use all for --visitor")
    parser.add_argument("-b", dest="hour", default=0, type=int, help="sets beginning hour of the day to catalog")
    parser.add_argument("-c", "--check-day", action="store_true", help="checks entries from the Day table")
    parser.add_argument("-C", "--check-sweep", action="store_true", help="checks entries from the Sweep table")
    parser.add_argument("-d", dest="build_day", action="store_true", help="builds a Day entry")
    parser.add_argument("-f", "--find-duplicates", action="store_true", help="finds duplicate Sweep entries")
    parser.add_argument("--format", default="pretty", choices=["raw", "short", "pretty"], help="sets output format")
    parser.add_argument("-i", dest="insert", action="store_true", help="inserts a folder")
    parser.add_argument("-I", dest="quick_insert", action="store_true", help="inserts (without check) a folder")
    parser.add_argument("--last", action="store_true", help="shows the absolute last entry in the database")
    parser.add_argument("-l", "--latest", action="store_true", help="shows the latest entries of each radar")
    parser.add_argument("--markdown", action="store_true", help="generates output in markdown")
    parser.add_argument("--no-bgor", dest="bgor", default=True, action="store_false", help="skips computing bgor")
    parser.add_argument("-p", "--check-path", action="store_true", help="checks the storage path")
    parser.add_argument("--progress", action="store_true", help="shows progress bar")
    parser.add_argument("--prune", action="store_true", help="prunes the database")
    parser.add_argument("-q", dest="quiet", action="store_true", help="runs the tool in silent mode (verbose = 0)")
    parser.add_argument("--recent", default=7, type=int, help="shows recent N days of entries")
    parser.add_argument("--remove", action="store_true", help="removes entries when combined with --find-duplicates")
    parser.add_argument("-s", dest="sweep", action="store_true", help="shows a sweep summary")
    parser.add_argument("--show-city", action="store_true", help="shows city of IP location")
    parser.add_argument("--single", action="store_true", default=False, help="uses single-threading")
    parser.add_argument("--skip", action="store_true", default=None, help="skips when with Day.county == count")
    parser.add_argument("--no-skip", dest="skip", action="store_false", default=None, help="do no skip folders")
    parser.add_argument("-u", "--update", action="store_true", help="updates visitor table from access log")
    parser.add_argument("-v", dest="verbose", default=1, action="count", help="increases verbosity (default = 1)")
    parser.add_argument("--version", action="version", version="%(prog)s " + settings.VERSION)
    parser.add_argument("-V", "--visitor", action="store_true", help="shows visitor log")
    parser.add_argument("-z", dest="test", action="store_true", help="dev")
    args = parser.parse_args()

    # Set logger level to INFO by default
    level = logging.DEBUG if args.verbose > 1 else logging.WARNING if args.quiet else logging.INFO
    logging.basicConfig(format=log_format, level=level)

    if args.check_day:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -c needs a source, e.g.,

                { __prog__} -c 20220223
                { __prog__} -c RK-202202*
            """
                )
            )
            return
        for day in args.source:
            if args.build_day:
                build_day(day, bgor=args.bgor)
            check_day(day, format=args.format)
    elif args.check_sweep:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -C needs a source, e.g.,

                { __prog__} -C RAXPOL-20211006
            """
                )
            )
            return
        for source in args.source:
            check_source(source, remove=args.remove)
    elif args.build_day:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -d needs a source, e.g.,

                { __prog__} -d 20130520
                { __prog__} -d PX-20220224
                { __prog__} -d /mnt/data/PX1000/2022/20220224
            """
                )
            )
            return
        for day in args.source:
            build_day(day, bgor=True)
    elif args.find_duplicates:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -f needs a source with prefix, e.g.,

                { __prog__} -f PX-20220223
                { __prog__} -b /mnt/data/PX1000/2022/20220223
            """
                )
            )
            return
        logger.info("Finding duplicates ...")
        for folder in args.source:
            find_duplicates(folder, remove=args.remove)
    elif args.insert:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -i needs at least a source folder, e.g.,

                { __prog__} -i /mnt/data/PX1000/2022/20220223
            """
                )
            )
            return
        logger.info("Inserting folder(s) with .txz / .tar.xz archives")
        for folder in args.source:
            folder = folder[:-1] if folder[-1] == "/" else folder
            if len(args.source) > 1:
                logger.info("...")
            xz_folder(folder, **vars(args))
    elif args.quick_insert:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -I needs a source folder, e.g.,

                { __prog__} -I /mnt/data/PX1000/2022/20220223
            """
                )
            )
            return
        logger.info("Quick inserting folder(s) with .txz / .tar.xz archives")
        for folder in args.source:
            if len(args.source) > 1:
                logger.info("...")
            folder = folder[:-1] if folder[-1] == "/" else folder
            xz_folder(folder, **vars(args))
    elif args.last:
        logger.info("Retrieving the absolute last entry ...")
        o = Sweep.objects.last()
        logger.info(o)
    elif args.latest:
        if args.markdown:
            logger.hideLogOnScreen()
        check_latest(args.source, markdown=args.markdown)
    elif args.prune:
        if len(args.source) == 0:
            args.source = "*"
        for source in args.source:
            check_source(source, remove=True)
    elif args.sweep:
        if args.markdown:
            logger.hideLogOnScreen()
        if len(args.source) == 0:
            o = Sweep.objects.last()
            show_sweep_summary(o.name, markdown=args.markdown)
        else:
            for source in args.source:
                show_sweep_summary(source, markdown=args.markdown)
    elif args.test:
        print("A placeholder for test routines")
        params = params_from_source("RAXPOL-202202*")
        pp.pprint(params)
    elif args.update:
        update_visitors(verbose=0 if args.quiet else args.verbose)
    elif args.visitor:
        show_visitor_log(markdown=args.markdown, show_city=args.show_city, recent=0 if args.all else args.recent)
    elif args.check_path:
        for folder in args.source:
            folder = folder[:-1] if folder[-1] == "/" else folder
            check_path(folder, args=args)
    else:
        parser.print_help(sys.stderr)


###

if __name__ == "__main__":
    dbtool_main()
