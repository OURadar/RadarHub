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
import radar
import django
import pprint
import shutil
import tarfile
import argparse
import textwrap
import datetime
import logparse
import multiprocessing
import time as tm

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "radarhub.settings")
django.setup()

from django.conf import settings
from common import colorize, color_name_value, dailylog
from frontend.models import Sweep, File, Day, Visitor

__prog__ = os.path.splitext(os.path.basename(sys.argv[0]))[0]

tzinfo = datetime.timezone.utc
logger = dailylog.Logger(__prog__, home=settings.LOG_DIR, dailyfile=settings.DEBUG)

radar.setLogger(logger)

pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)
pattern_yyyy = re.compile(r"20[0-9][0-9]")
pattern_yyyymmdd = re.compile(r"20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])")
pattern_x_yyyymmdd = re.compile(r"(?<=[-/])20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])")

radar_name_by_pathway = {}
for name, item in settings.RADARS.items():
    pathway = item["pathway"].lower()
    radar_name_by_pathway[pathway] = name


"""
    Parse name, date, datetime, etc. from a source string

    source - could either be:
              - a string with day only, e.g., YYYYMMDD
              - a string with name and day, e.g., PX-20220127,
              - a path to the data, e.g., /mnt/data/PX1000/2022/20220127
    dig - dig deeper for the name if the source is a folder
"""


def params_from_source(source, dig=False):
    fn_name = colorize("params_from_source()", "green")
    file = None
    name = None
    day_string = None
    date_range = None
    source_date = None
    source_datetime = None
    if "*" == source[-1]:
        if "-" in source:
            name, query = source.split("-")
        else:
            query = source
        v1 = color_name_value("name", name)
        v2 = color_name_value("query", query)
        logger.debug(f"{fn_name}   {v1}   {v2}")
        if len(query) == 5:
            y = int(query[0:4])
            start = datetime.datetime(y, 1, 1, tzinfo=tzinfo)
            end = datetime.datetime(y, 12, 31, tzinfo=tzinfo)
            date_range = [start, end]
        elif len(query) == 7:
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
    elif os.path.exists(source):
        if os.path.isdir(source):
            if source[-1] == "/":
                source = source[:-1]
            folder, day_string = os.path.split(source)
            if "/" in folder:
                pathway = os.path.basename(os.path.dirname(folder)).lower()
                if pathway in radar_name_by_pathway:
                    name = radar_name_by_pathway[pathway]
            elif dig:
                files = list_files(source)
                file = os.path.basename(files[0]) if len(files) else None
        else:
            folder, file = os.path.split(source)
            if "_original" in folder:
                folder, _ = os.path.split(folder)
            else:
                logger.warning(f'Expected "_original" in source folder {folder}')
            day_string = os.path.basename(folder)
        if file:
            logger.debug(f"{fn_name} file[0] = {file}")
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
            logger.debug(f"{fn_name} Only day string from {source}")
    return {
        "file": file,
        "name": name,
        "date": source_date,
        "datetime": source_datetime,
        "date_range": date_range,
    }


"""
    List .txz or .tar.xz files in a folder

    folder - path to list, e.g., /mnt/data/PX1000/2022/20220128
"""


def list_files(folder):
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
    hour = kwargs.get("hour", 0)
    skip = kwargs.get("skip", None)
    single = kwargs.get("single", False)
    progress = kwargs.get("progress", None)
    quick_insert = kwargs.get("quick_insert", True)
    verbose = kwargs.get("verbose", 0)

    show = colorize("xz_folder()", "green")
    show += "   " + color_name_value("folder", folder)
    show += "   " + color_name_value("verbose", verbose)
    show += "   " + color_name_value("quick_insert", quick_insert)
    logger.info(show)

    use_mp = "linux" in sys.platform and not single
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
        logger.warning(f"{show} There {'are' if d.count > 1 else 'is'} {d.count:,d} existing entr{'ies' if d.count > 1 else 'y'}.")
        logger.warning(f"{show} Quick insert will result in duplicates. Try normal insert instead.")
        ans = input("Do you still want to continue (y/[n])? ")
        if not ans == "y":
            logger.info("Whew. Nothing happend.")
            return

    if d.count == len(raw_archives):
        logger.warning(f"Files in {folder} == Day({basename}).count = {d.count:,}")
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

    def process_archives(id, run, lock, queue, out):
        while run.value == 1:
            task = None
            lock.acquire()
            if not queue.empty():
                task = queue.get()
            lock.release()
            if task:
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
            else:
                tm.sleep(0.1)
        logger.debug(f"{id} done")
        return

    keys = []
    output = {}
    indent = " " * logger.indent()

    # Extracting parameters of the archives
    desc = "Pass 1 / 2 - Scanning archives"
    if not progress:
        logger.info(f"{desc} ...")

    e = tm.time()

    if use_mp:
        task_queue = multiprocessing.Queue()
        db_queue = multiprocessing.Queue()
        lock = multiprocessing.Lock()
        run = multiprocessing.Value("i", 1)

        count = multiprocessing.cpu_count()

        processes = []
        for n in range(count):
            p = multiprocessing.Process(target=process_archives, args=(n, run, lock, task_queue, db_queue))
            processes.append(p)
            p.start()

        for path in tqdm.tqdm(archives, desc=f"{indent}{desc}") if progress else archives:
            # Copy the file to ramdisk and queue the work after the file is copied
            basename = os.path.basename(path)
            if os.path.exists("/mnt/ramdisk"):
                ramfile = f"/mnt/ramdisk/{basename}"
            else:
                ramfile = f"{basename}"
            shutil.copy(path, ramfile)
            task_queue.put({"archive": path, "ramfile": ramfile})
            while task_queue.qsize() > 2 * count:
                tm.sleep(0.1)
            while not db_queue.empty():
                out = db_queue.get()
                key = out["file"]
                keys.append(key)
                output[key] = out["info"]

        while task_queue.qsize() > 0:
            tm.sleep(0.1)
        run.value = 0
        for p in processes:
            p.join()

        while not db_queue.empty():
            out = db_queue.get()
            key = out["file"]
            keys.append(key)
            output[key] = out["info"]
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
        for key in tqdm.tqdm(keys, desc=f"{indent}{desc}") if progress else keys:
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
            show = color_name_value("name", name)
            logger.info(f"{desc} ... {show}")
        creates = []
        updates = []
        count_ignore = 0
        for key in tqdm.tqdm(keys, desc=f"{indent}{desc}") if progress else keys:
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
            Sweep.objects.bulk_update(updates, ["time", "name", "kind", "scan", "path", "symbols", "tarinfo"], batch_size=1000)
        t = tm.time() - t
        a = len(keys) / t
        logger.info(f"Updated {t:.2f} sec ({a:,.0f} files / sec)   c: {len(creates)}  u: {len(updates)}  i: {count_ignore}")

    # Make a Day entry
    day_str = parts["time"][:8]
    build_day(f"{name}-{day_str}", bgor=True)

    e = tm.time() - e
    a = len(archives) / e
    show = colorize(f"{e:.2f}", "teal")
    logger.info(f"Total elapsed time = {show} sec ({a:,.0f} files / sec)")


"""
    Insert a folder with .tar.xz / .txz archives to the database

             folder - path to insert, e.g., /mnt/data/PX1000/2022/20220128
               hour - start hour to examine
           check_db - check the database for existence (update or create)
    use_bulk_update - use django's bulk update/create functions
            verbose - verbosity level
"""


def xz_folder_v1(folder, hour=0, check_db=True, bulk_update=True, args=None):
    try:
        progress = args.progress
    except:
        progress = None
    try:
        skip = args.skip
    except:
        skip = True
    try:
        verbose = args.verbose
    except:
        verbose = 0
    show = colorize("xz_folder()", "green")
    show += "   " + color_name_value("folder", folder)
    show += "   " + color_name_value("check_db", check_db)
    show += "   " + color_name_value("bulk_update", bulk_update)
    show += "   " + color_name_value("skip", skip)
    logger.info(show)

    use_mp = "linux" in sys.platform
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

    if not check_db and d:
        show = colorize(" WARNING ", "warning")
        logger.warning(f"{show} There are {d.count:,d} existing entries.")
        logger.warning(f"{show} Quick insert will result in duplicates. Try -i instead.")
        ans = input("Do you still want to continue (y/[n])? ")
        if not ans == "y":
            logger.info("Whew. Nothing happend.")
            return

    if d.count == len(raw_archives):
        logger.warning(f"Number of files == Day({basename}).count = {d.count:,}")
        if skip is None:
            ans = input("Do you still want to continue (y/[n])? ")
            if not ans == "y":
                logger.info(f"Folder {folder} skipped")
                return
        elif skip == True:
            logger.info(f"Folder {folder} skipped")
            return

    day_string = f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    date_range = [f"{day_string} {hour:02d}:00Z", f"{day_string} 23:59:59.9Z"]
    show = colorize("date_range", "orange") + colorize(" = ", "red")
    show += "[" + colorize(date_range[0], "yellow") + ", " + colorize(date_range[1], "yellow") + "]"
    logger.debug(show)

    archives = []
    for archive in raw_archives:
        basename = os.path.basename(archive)
        file_hour = int(basename.split("-")[2][0:2])
        if file_hour >= hour:
            archives.append(archive)

    def process_archives_v1(id, run, lock, queue, out):
        while run.value == 1:
            task = None
            lock.acquire()
            if not queue.empty():
                task = queue.get()
            lock.release()
            if task:
                archive = task["archive"]
                ramfile = task["ramfile"]
                logger.debug(f"{id:02d}: {archive} {ramfile}")
                xx = []
                try:
                    with tarfile.open(archive) as tar:
                        for info in tar.getmembers():
                            xx.append([info.name, info.offset, info.offset_data, info.size, archive])
                        out.put({"name": os.path.basename(archive), "xx": xx})
                except tarfile.ReadError:
                    logger.warning(f"Failed to open {archive}")
                    os.system(f"rm -f {archive}")
                except EOFError:
                    logger.warning(f"Truncated file {archive}")
                    os.system(f"rm -f {archive}")
                os.remove(ramfile)
            else:
                tm.sleep(0.1)
        logger.debug(f"{id} done")
        return

    keys = []
    output = {}
    indent = " " * logger.indent()

    # Extracting parameters of the archives
    desc = "Pass 1 / 2 - Scanning archives"
    logger.info(f"{desc} ...")

    e = tm.time()

    if use_mp:
        task_queue = multiprocessing.Queue()
        db_queue = multiprocessing.Queue()
        lock = multiprocessing.Lock()
        run = multiprocessing.Value("i", 1)

        count = multiprocessing.cpu_count()

        processes = []
        for n in range(count):
            p = multiprocessing.Process(target=process_archives_v1, args=(n, run, lock, task_queue, db_queue))
            processes.append(p)
            p.start()

        for archive in tqdm.tqdm(archives, desc=f"{indent}{desc}") if progress else archives:
            # Copy the file to ramdisk and queue the work after the file is copied
            basename = os.path.basename(archive)
            if os.path.exists("/mnt/ramdisk"):
                ramfile = f"/mnt/ramdisk/{basename}"
            else:
                ramfile = f"{basename}"
            shutil.copy(archive, ramfile)
            task_queue.put({"archive": archive, "ramfile": ramfile})
            while task_queue.qsize() > 2 * count:
                tm.sleep(0.1)
            while not db_queue.empty():
                out = db_queue.get()
                key = out["name"]
                keys.append(key)
                output[key] = out

        while task_queue.qsize() > 0:
            tm.sleep(0.1)
        run.value = 0
        for p in processes:
            p.join()

        while not db_queue.empty():
            out = db_queue.get()
            key = out["name"]
            keys.append(key)
            output[key] = out
    else:
        for archive in tqdm.tqdm(archives) if progress else archives:
            xx = []
            try:
                with tarfile.open(archive) as tar:
                    for info in tar.getmembers():
                        xx.append([info.name, info.offset, info.offset_data, info.size, archive])
                key = os.path.basename(archive)
                keys.append(key)
                output[key] = {"name": key, "xx": xx}
            except:
                logger.warning(f"Archive {archive} failed.")
                pass

    # Consolidating results
    keys = sorted(keys)

    if check_db:
        entries = File.objects.filter(date__range=date_range)
        pattern = re.compile(r"(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]")

        def __handle_data__(xx, use_re_pattern=False, save=False):
            files = []
            count_create = 0
            count_update = 0
            count_ignore = 0

            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                n = entries.filter(name=name)
                if n:
                    x = n[0]
                    if x.path != archive or x.size != size or x.offset != offset or x.offset_data != offset_data:
                        mode = "U"
                        x.path = archive
                        x.size = size
                        x.offset = offset
                        x.offset_data = offset_data
                        count_update += 1
                    else:
                        mode = "I"
                        count_ignore += 1
                else:
                    mode = "N"
                    if use_re_pattern:
                        s = pattern.search(archive).group(0)
                        date = f"{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z"
                    else:
                        c = name.split("-")
                        date = datetime.datetime.strptime(c[1] + c[2], r"%Y%m%d%H%M%S").replace(tzinfo=tzinfo)
                    x = File.objects.create(name=name, path=archive, date=date, size=size, offset=offset, offset_data=offset_data)
                    count_create += 1
                logger.debug(f"{mode} : {name} {offset} {offset_data} {size} {archive}")
                if mode != "I":
                    if save:
                        x.save()
                    files.append(x)
            return files, count_create, count_update, count_ignore

        t = tm.time()
        count_create = 0
        count_update = 0
        count_ignore = 0

        if bulk_update:
            desc = "Pass 2 / 2 - Gathering entries"
            logger.info(f"{desc} ...")
            array_of_files = []
            for key in tqdm.tqdm(keys, desc=f"{indent}{desc}") if progress else keys:
                xx = output[key]["xx"]
                files, cc, cu, ci = __handle_data__(xx)
                array_of_files.append(files)
                count_create += cc
                count_update += cu
                count_ignore += ci
            if count_create > 0 or count_update > 0:
                files = [s for symbols in array_of_files for s in symbols]
                logger.info(f"Updating database ... {len(files):,d} entries")
                File.objects.bulk_update(files, ["name", "path", "date", "size", "offset", "offset_data"], batch_size=1000)
            else:
                logger.debug("No new File entries")
            t = tm.time() - t
            a = len(files) / t
            logger.info(f"Bulk update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}")
        else:
            for key in tqdm.tqdm(keys, desc=f"{indent}{desc}") if progress else keys:
                xx = output[key]["xx"]
                _, cc, cu, ci = __handle_data__(xx, save=True)
                count_create += cc
                count_update += cu
                count_ignore += ci
            t = tm.time() - t
            a = len((count_create + count_update)) / t
            logger.info(
                f"Individual update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}"
            )
    else:

        def __sweep_files__(xx):
            files = []
            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                c = name.split("-")
                date = datetime.datetime.strptime(c[1] + c[2], r"%Y%m%d%H%M%S").replace(tzinfo=tzinfo)
                x = File(name=name, path=archive, date=date, size=size, offset=offset, offset_data=offset_data)
                files.append(x)
            return files

        t = tm.time()
        desc = "Pass 2 / 2 - Creating entries"
        logger.info(f"{desc} ...")
        if verbose:
            array_of_files = []
            for key in tqdm.tqdm(keys, desc=desc) if progress else keys:
                xx = output[key]["xx"]
                files = __sweep_files__(xx)
                array_of_files.append(files)
        else:
            array_of_files = [__sweep_files__(output[key]["xx"]) for key in keys]
        files = [s for symbols in array_of_files for s in symbols]
        File.objects.bulk_create(files)
        t = tm.time() - t
        a = len(files) / t
        logger.info(f"Bulk create {t:.2f} sec ({a:,.0f} files / sec)")

    # Make a Day entry
    build_day(folder, bgor=True)

    e = tm.time() - e
    a = len(archives) / e
    show = colorize(f"{e:.2f}", "teal")
    logger.info(f"Total elapsed time = {show} sec ({a:,.0f} files / sec)")


"""
    Build an entry to the Day table

    source - common source pattern (see params_from_source())
    bgor - compute the bgor values of the day
"""


def build_day(source, bgor=False, verbose=0):
    if verbose:
        show = colorize("build_day()", "green")
        show += "   " + color_name_value("source", source)
        logger.debug(show)

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
        show = color_name_value("day", day.__repr__(format="short"))
        logger.info(f"New {show}")

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
        logger.info(f"{mode} {day.__repr__()}")

    tic = tm.time() - tic

    if verbose:
        logger.debug(f"Elapsed time: {tic:.2f}s")

    return day, mode


"""
    Check a Day entry from the database

    source - common source pattern (see params_from_source())
"""


def check_day(source, format=""):
    show = colorize("check_day()", "green")
    show += "   " + color_name_value("source", source)
    logger.info(show)
    params = params_from_source(source)
    if params["name"] is None:
        names = list(settings.RADARS.keys())
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
            show = d.__repr__(format=format)
            logger.info(f"R {show}")
    if len(ddd) == 0:
        logger.info(f"Day entry of {source} does not exist")
    return ddd


"""
    Check Sweep entries and verify existence of Sweep.path

    source - common source pattern (see params_from_source())
"""


def check_source(source, progress=True, remove=False):
    show = colorize("check_file()", "green")
    show += "   " + color_name_value("source", source)
    show += "   " + color_name_value("remove", remove)
    logger.info(show)
    params = params_from_source(source, dig=True)
    if params["name"] is None:
        names = list(settings.RADARS.keys())
    elif isinstance(params["name"], str):
        names = [params["name"]]
    else:
        logger.error("Unable to continue")
        pp.pprint(params)
    for name in names:
        scans = Sweep.objects.filter(time__range=params["date_range"], name=name)
        count = scans.count()
        show = color_name_value("name", name)
        show += "  " + color_name_value("count", count)
        logger.info(show)
        if count == 0:
            continue
        count = 0
        paths = []
        for scan in tqdm.tqdm(scans) if progress else scans:
            if not os.path.exists(scan.path):
                paths.append(scan.path)
                count += 1
                if remove:
                    scan.delete()
        pp.pprint(paths)
        s = "s" if count > 1 else ""
        logger.info(f"{source} has {count} missing file{s}")


"""
    Finds duplicate File entries

    source - common source pattern (see params_from_source())
    remove - remove duplicate entries (copy > 1) if set to True
"""


def find_duplicates(source, remove=False):
    show = colorize("find_duplicates()", "green")
    show += "   " + color_name_value("source", source)
    show += "   " + color_name_value("remove", remove)
    logger.info(show)
    params = params_from_source(source)
    date_range = params["date_range"]
    name = params["name"]

    show = colorize("date_range", "orange") + colorize(" = ", "red")
    show += "[" + colorize(date_range[0], "yellow") + ", " + colorize(date_range[1], "yellow") + "]"
    logger.info(show)

    if name:
        entries = Sweep.objects.filter(time__range=date_range, name=name)
    else:
        entries = Sweep.objects.filter(time__range=date_range)
    files = [entry.path for entry in entries]
    if len(files) == 0:
        logger.info("No match")
        return

    indent = " " * logger.indent()

    count = 0
    removed = 0
    for file in tqdm.tqdm(files, desc=f"{indent}Checking duplicates"):
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


"""
    Check for latest entries from each radar
"""


def check_latest(source=[], markdown=False):
    show = colorize("check_latest()", "green")
    logger.info(show)
    if len(source):
        names = [params_from_source(name)["prefix"] for name in source]
    else:
        names = settings.RADARS.keys()
    message = "| Radars | Latest Scan | Age |\n|---|---|---|\n"
    for name in names:
        day = Day.objects.filter(name=name)
        if day.count() == 0:
            continue
        day = day.latest("date")
        last = day.last_hour_range()
        file = File.objects.filter(name__startswith=name, date__range=last).latest("date")
        show = colorize("last", "orange") + colorize(" = ", "red")
        show += "[" + colorize(last[0], "yellow") + ", " + colorize(last[1], "yellow") + "]"
        show += "   " + color_name_value("name", file.name)
        folder = settings.RADARS[name]["pathway"]
        filename = re.sub("-([a-zA-Z]+).nc", "", file.name)
        age = file.get_age()
        ages = ""
        if age.days > 0:
            s = "s" if age.days > 1 else ""
            ages += f"{age.days} day{s} "
        hours = age.seconds // 3600
        if hours > 0:
            s = "s" if hours > 1 else ""
            ages += f"{hours} hour{s} "
        mins = (age.seconds - 3600 * hours) // 60
        s = "s" if mins > 1 else ""
        ages += f"{mins} min{s}"
        message += f"{folder} | {filename} | {ages} |\n"
        logger.info(show)
    if markdown:
        print(message)
    return message


"""
    Show sweep summary

    source - name in either one of the following forms:
              - [PREFIX]-YYYYMMDD-hhmm
              - [PREFIX]

             e.g., 'RAXPOL'
                   'PX-20130520-191000-E2.6'
"""


def show_sweep_summary(source, markdown=False):
    show = colorize("show_sweep_summary()", "green")
    show += "   " + color_name_value("source", source)
    logger.info(show)
    c = source.split("-")
    name = c[0]
    if len(c) >= 2:
        date = datetime.datetime.strptime(c[1] + c[2], r"%Y%m%d%H%M%S").replace(tzinfo=tzinfo)
        o = Sweep.objects.filter(date=date, name=name).last()
    else:
        logger.info(f"Retrieving last entry with name = {name} ...")
        o = Sweep.objects.filter(name=name).last()
    if o:
        logger.debug(o.__repr__())
        o.summary(markdown=markdown)
    else:
        logger.info(f"No entry found for {source}")


"""
    Shows visitor summary, something like:

| IP Address      |      Payload (B) |    Bandwidth (B) |     Count |         OS / Browser | Last Visit | Location                       |
| --------------- |----------------- |----------------- | --------- | -------------------- | ---------- | ------------------------------ |
| 75.111.159.35   |       13,836,684 |        1,361,384 |        42 |       macOS / Chrome | 2022/07/22 | Texas, United States           |
| 186.221.73.23   |    1,380,023,303 |      151,369,900 |     3,797 |       Linux / Chrome | 2022/07/22 | Goiás, Brazil                  |
| 174.109.29.230  |    1,413,313,725 |      281,190,422 |    14,658 |  Windows 10 / Chrome | 2022/07/22 | North Carolina, United States  |
"""


def show_visitor_log(markdown=False, show_city=False, recent=0):
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


"""
    Update Visitor table
"""


def update_visitors(verbose=1):
    show = colorize("update_visitors()", "green")
    show += "   " + color_name_value("verbose", verbose)
    logger.info(show)

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
            {__prog__} -l RAXPOL-
            {__prog__} -l RAXPOL- PX-
            {__prog__} -s
            {__prog__} -s RAXPOL-
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
    parser.add_argument("-f", "--find-duplicates", action="store_true", help="finds duplicate Sweep entries in the database")
    parser.add_argument("--format", default="pretty", choices=["raw", "short", "pretty"], help="sets output format")
    parser.add_argument("-i", dest="insert", action="store_true", help="inserts a folder")
    parser.add_argument("-j", dest="old_insert", action="store_true", help="inserts a folder")
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
    parser.add_argument("--skip", dest="skip", action="store_true", default=None, help="skips folders with Day.county == count")
    parser.add_argument("--no-skip", dest="skip", action="store_false", default=None, help="do no skip folders")
    parser.add_argument("-u", "--update", action="store_true", help="updates visitor table from access log")
    parser.add_argument("-v", dest="verbose", default=1, action="count", help="increases verbosity (default = 1)")
    parser.add_argument("--version", action="version", version="%(prog)s " + settings.VERSION)
    parser.add_argument("-V", "--visitor", action="store_true", help="shows visitor log")
    parser.add_argument("-z", dest="test", action="store_true", help="dev")
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0
        logger.hideLogOnScreen()
    elif args.verbose:
        logger.showLogOnScreen()
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)
            logger.streamHandler.setLevel(dailylog.logging.DEBUG)

    if "*" in args.source:
        logger.info("Expanding asterisk ...")
        args.source = glob.glob(args.source)
        if len(args.source) == 0:
            logger.info("No match")
            return
        logger.info(args.source)

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
        logger.info(f"Finding duplicates ...")
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
    elif args.old_insert:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                -j needs at least a source folder, e.g.,

                { __prog__} -j /mnt/data/PX1000/2022/20220223
            """
                )
            )
            return
        logger.info("Inserting folder(s) with .txz / .tar.xz archives")
        for folder in args.source:
            folder = folder[:-1] if folder[-1] == "/" else folder
            if len(args.source) > 1:
                logger.info("...")
            xz_folder_v1(folder, hour=args.hour, check_db=True, args=args)
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
        logger.info(o.__repr__())
    elif args.latest:
        if args.markdown:
            logger.hideLogOnScreen()
        check_latest(args.source, markdown=args.markdown)
    elif args.prune:
        if len(args.source) == 0:
            print(
                textwrap.dedent(
                    f"""
                --prune needs a source, e.g.,

                { __prog__} --prune RAXPOL-20211006
            """
                )
            )
            return
        check_source(args.source, remove=True)
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
        update_visitors(verbose=args.verbose)
    elif args.visitor:
        if args.markdown:
            logger.hideLogOnScreen()
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
