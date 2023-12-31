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
import time
import tqdm
import django
import pprint
import shutil
import tarfile
import argparse
import textwrap
import datetime
import multiprocessing

import numpy as np

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

from django.conf import settings

from frontend.models import File, Day, Visitor

from common import colorize, color_name_value, dailylog

import logparse

__prog__ = os.path.basename(sys.argv[0])

pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)
logger = dailylog.Logger(__prog__.split('.')[0] if '.' in __prog__ else __prog__, home=settings.LOG_DIR, dailyfile=settings.DEBUG)
pattern_yyyy = re.compile(r'20[0-9][0-9]')
pattern_yyyymmdd = re.compile(r'20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])')
pattern_x_yyyymmdd = re.compile(r'(?<=[-/])20[0-9][0-9](0[0-9]|1[012])([0-2][0-9]|3[01])')

radar_prefix = {}
for prefix, item in settings.RADARS.items():
    radar = item['folder']
    radar_prefix[radar] = prefix

'''
    (Deprecated)
'''
def entry(filename, archive=None, offset=0, offset_data=0, size=0, verbose=0):
    (path, name) = os.path.split(filename)
    s = re.search(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]', name).group(0)
    datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
    mode = 'N'
    if File.objects.filter(name=name):
        #print(f'File {name} exists. Updating ...')
        mode = 'U'
        x = File.objects.filter(name=name)[0]
        x.path = archive
        x.size = size
        x.offset = offset
        x.offset_data = offset_data
    elif archive:
        # File is stored inside a tgz archive
        x = File(name=name, path=archive, date=datestr, size=size, offset=offset, offset_data=offset_data)
    else:
        # File is stored in plain sight
        x = File(name=name, path=path, date=datestr)
    if verbose:
        print(f'{mode} {x.name} :: {x.path} :: {x.date} :: {x.size} :: {x.offset} :: {x.offset_data}')
        sys.stdout.flush()
    return x, mode

'''
    (Deprecated)
'''
def proc_archive(archive, ramfile=None):
    file = ramfile if ramfile else archive
    # print(f'Processing {archive} {file} ...')
    with tarfile.open(file) as aid:
        xx = []
        mm = []
        for info in aid.getmembers():
            x, m = entry(info.name,
                archive=archive,
                offset=info.offset,
                offset_data=info.offset_data,
                size=info.size)
            xx.append(x)
            mm.append(m)
    return xx, mm

'''
    (Deprecated)
    First revision of xz_folder, only kept here for simple illustration
'''
def xz_folder_v1(folder):
    print(f'xz_folder_v1: {folder}')
    archives = list_files(folder)
    if len(archives) == 0:
        print('Unable to continue.')
        return
    with multiprocessing.Pool() as pool:
        results = pool.map(proc_archive, archives)
    for result in results:
        (xx, mm) = result
        print(xx[0].name)
        for k in range(len(xx)):
            x = xx[k]
            m = mm[k]
            # print(f'{m} {x.name} :: {x.path} :: {x.date} :: {x.size} :: {x.offset} :: {x.offset_data}')
            x.save()

'''
    Parse prefix, date, datetime, etc. from a source string

    source - could either be:
              - a string with day only, e.g., YYYYMMDD
              - a string with prefix and day, e.g., PX-20220127,
              - a path to the data, e.g., /mnt/data/PX1000/2022/20220127
    dig - dig deeper for the prefix if the source is a folder
'''
def params_from_source(source, dig=False):
    file = None
    prefix = None
    day_string = None
    date_range = None
    source_date = None
    source_datetime = None
    if '*' == source[-1]:
        if '-' in source:
            prefix, query = source.split('-')
            prefix += '-'
        else:
            query = source
        logger.debug(f'prefix = {prefix}   query = {query}')
        if len(query) == 5:
            y = int(query[0:4])
            start = datetime.datetime(y, 1, 1).replace(tzinfo=datetime.timezone.utc)
            end = datetime.datetime(y, 12, 31).replace(tzinfo=datetime.timezone.utc)
            date_range = [start, end]
        elif len(query) == 7:
            y = int(query[0:4])
            m = int(query[4:6])
            start = datetime.datetime(y, m, 1).replace(tzinfo=datetime.timezone.utc)
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1
            end = datetime.datetime(y, m, 1).replace(tzinfo=datetime.timezone.utc)
            end -= datetime.timedelta(days=1)
            date_range = [start, end]
    elif os.path.exists(source):
        if os.path.isdir(source):
            if source[-1] == '/':
                source = source[:-1]
            folder, day_string = os.path.split(source)
            if dig:
                files = list_files(source)
                file = os.path.basename(files[0]) if len(files) else None
        else:
            folder, file = os.path.split(source)
            if '_original' in folder:
                folder, _ = os.path.split(folder)
            else:
                logger.warning(f'Expected "_original" in source folder {folder}')
            day_string = os.path.basename(folder)
        if file:
            logger.debug(f'params_from_source() file[0] = {file}')
            c = os.path.splitext(file)[0].split('-')
            prefix = c[0] + '-'
            time_string = c[1] + c[2]
            if day_string != c[1]:
                logger.warning(f'Warning. Inconsistent day_string = {day_string} != c[1] = {c[1]} (*)')
                day_string = c[1]
            source_datetime = datetime.datetime.strptime(time_string, r'%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
        else:
            logger.debug(f'Parent year folder = {folder}')
            elements = folder.split('/')
            name, year = elements[-2], elements[-1]
            if pattern_yyyy.match(year) and name in radar_prefix:
                prefix = radar_prefix[name]
    elif '/' in source:
        logger.error(f'Error. Folder {source} does not exist')
        day_string = pattern_x_yyyymmdd.search(source)
        if day_string:
            day_string = day_string.group(0)
    elif '-' in source:
        prefix, day_string = source.split('-')
        prefix += '-'
    else:
        day_string = pattern_yyyymmdd.search(source)
        if day_string:
            day_string = day_string.group(0)
        else:
            day_string = None
            prefix = source + '-'
    if day_string:
        source_date = datetime.datetime.strptime(day_string, r'%Y%m%d').date()
        start = datetime.datetime(source_date.year, source_date.month, source_date.day).replace(tzinfo=datetime.timezone.utc)
        date_range = [start, start + datetime.timedelta(days=1)]
        if prefix is None:
            show = colorize('params_from_source()', 'green')
            logger.debug(f'{show} Only day string from {source}')
    return {
        'file': file,
        'prefix': prefix,
        'date': source_date,
        'datetime': source_datetime,
        'date_range': date_range
    }

'''
    Process archives from the queue
'''
def process_archives(id, run, lock, queue, out):
    while run.value == 1:
        task = None

        lock.acquire()
        if not queue.empty():
            task = queue.get()
        lock.release()

        if task:
            archive = task['archive']
            ramfile = task['ramfile']
            logger.debug(f'{id:02d}: {archive} {ramfile}')
            xx = []
            try:
                with tarfile.open(archive) as tar:
                    for info in tar.getmembers():
                        xx.append([info.name, info.offset, info.offset_data, info.size, archive])
                    out.put({'name': os.path.basename(archive), 'xx': xx})
            except tarfile.ReadError:
                logger.warning(f'Failed to open {archive}')
                os.system(f'rm -f {archive}')
            except EOFError:
                logger.warning(f'Truncated file {archive}')
                os.system(f'rm -f {archive}')
            os.remove(ramfile)
        else:
            time.sleep(0.1)

    logger.debug(f'{id} done')

    return

'''
    List .txz or .tar.xz files in a folder

    folder - path to list, e.g., /mnt/data/PX1000/2022/20220128
'''
def list_files(folder):
    files = sorted(glob.glob(os.path.join(folder, '*.tar.xz')))
    if len(files) == 0:
        files = sorted(glob.glob(os.path.join(folder, '*.txz')))
    if len(files) == 0:
        folder = os.path.join(folder, '_original')
        files = sorted(glob.glob(os.path.join(folder, '*.tar.xz')))
        if len(files) == 0:
            files = sorted(glob.glob(os.path.join(folder, '*.txz')))
    return files

'''
    Insert a folder with .tar.xz / .txz archives to the database

             folder - path to insert, e.g., /mnt/data/PX1000/2022/20220128
               hour - start hour to examine
           check_db - check the database for existence (update or create)
    use_bulk_update - use django's bulk update/create functions
            verbose - verbosity level
'''
def xz_folder(folder, hour=0, check_db=True, bulk_update=True, args=None):
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
    show = colorize('xz_folder()', 'green')
    show += '   ' + color_name_value('folder', folder)
    show += '   ' + color_name_value('check_db', check_db)
    show += '   ' + color_name_value('bulk_update', bulk_update)
    show += '   ' + color_name_value('skip', skip)
    logger.info(show)

    use_mp = 'linux' in sys.platform
    basename = os.path.basename(folder)
    s = pattern_yyyymmdd.search(basename)
    if s:
        s = s.group(0)
    else:
        logger.info(f'Error searching YYYYMMDD in folder name {basename}')
        return

    raw_archives = list_files(folder)
    if len(raw_archives) == 0:
        logger.info(f'No files in {folder}. Unable to continue.')
        return

    d = check_day(folder)
    if d:
        d = d[0]

    if not check_db and d:
        show = colorize(' WARNING ', 'warning')
        logger.warning(f'{show} There are {d.count:,d} existing entries.')
        logger.warning(f'{show} Quick insert will result in duplicates. Try -i instead.')
        ans = input('Do you still want to continue (y/[n])? ')
        if not ans == 'y':
            logger.info('Whew. Nothing happend.')
            return

    if d.count == len(raw_archives):
        logger.warning(f'Number of files == Day({basename}).count = {d.count:,}')
        if skip is None:
            ans = input('Do you still want to continue (y/[n])? ')
            if not ans == 'y':
                logger.info(f'Folder {folder} skipped')
                return
        elif skip == True:
            logger.info(f'Folder {folder} skipped')
            return

    day_string = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    date_range = [f'{day_string} {hour:02d}:00Z', f'{day_string} 23:59:59.99Z']
    show = colorize('date_range', 'orange') + colorize(' = ', 'red')
    show += '[' + colorize(date_range[0], 'yellow') + ', ' + colorize(date_range[1], 'yellow') + ']'
    logger.debug(show)

    archives = []
    for archive in raw_archives:
        basename = os.path.basename(archive)
        file_hour = int(basename.split('-')[2][0:2])
        if file_hour >= hour:
            archives.append(archive)

    keys = []
    output = {}
    indent = ' ' * logger.indent()

    # Extracting parameters of the archives
    desc = 'Pass 1 / 2 - Scanning archives'
    logger.info(f'{desc} ...')

    e = time.time()

    if use_mp:
        task_queue = multiprocessing.Queue()
        db_queue = multiprocessing.Queue()
        lock = multiprocessing.Lock()
        run = multiprocessing.Value('i', 1)

        count = multiprocessing.cpu_count()

        processes = []
        for n in range(count):
            p = multiprocessing.Process(target=process_archives, args=(n, run, lock, task_queue, db_queue))
            processes.append(p)
            p.start()

        for archive in tqdm.tqdm(archives, desc=f'{indent}{desc}') if progress else archives:
            # Copy the file to ramdisk and queue the work after the file is copied
            basename = os.path.basename(archive)
            if os.path.exists('/mnt/ramdisk'):
                ramfile = f'/mnt/ramdisk/{basename}'
            else:
                ramfile = f'{basename}'
            shutil.copy(archive, ramfile)
            task_queue.put({'archive': archive, 'ramfile': ramfile})
            while task_queue.qsize() > 2 * count:
                time.sleep(0.1)
            while not db_queue.empty():
                out = db_queue.get()
                key = out['name']
                keys.append(key)
                output[key] = out

        while task_queue.qsize() > 0:
            time.sleep(0.1)
        run.value = 0;
        for p in processes:
            p.join()

        while not db_queue.empty():
            out = db_queue.get()
            key = out['name']
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
                output[key] = {'name': key, 'xx': xx}
            except:
                logger.warning(f'Archive {archive} failed.')
                pass

    # Consolidating results
    keys = sorted(keys)

    if check_db:
        entries = File.objects.filter(date__range=date_range)
        pattern = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')

        def __handle_data__(xx, use_re_pattern=False, save=False):
            files = []
            count_create = 0;
            count_update = 0;
            count_ignore = 0;

            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                n = entries.filter(name=name)
                if n:
                    x = n[0]
                    if x.path != archive or x.size != size or x.offset != offset or x.offset_data != offset_data:
                        mode = 'U'
                        x.path = archive
                        x.size = size
                        x.offset = offset
                        x.offset_data = offset_data
                        count_update += 1
                    else:
                        mode = 'I'
                        count_ignore += 1
                else:
                    mode = 'N'
                    if use_re_pattern:
                        s = pattern.search(archive).group(0)
                        date = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
                    else:
                        c = name.split('-')
                        date = datetime.datetime.strptime(c[1] + c[2], r'%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
                    x = File.objects.create(name=name, path=archive, date=date, size=size, offset=offset, offset_data=offset_data)
                    count_create += 1
                logger.debug(f'{mode} : {name} {offset} {offset_data} {size} {archive}')
                if mode != 'I':
                    if save:
                        x.save()
                    files.append(x)
            return files, count_create, count_update, count_ignore

        t = time.time()
        count_create = 0;
        count_update = 0;
        count_ignore = 0;

        if bulk_update:
            desc = 'Pass 2 / 2 - Gathering entries'
            logger.info(f'{desc} ...')
            array_of_files = []
            for key in tqdm.tqdm(keys, desc=f'{indent}{desc}') if progress else keys:
                xx = output[key]['xx']
                files, cc, cu, ci = __handle_data__(xx)
                array_of_files.append(files)
                count_create += cc;
                count_update += cu;
                count_ignore += ci;
            if count_create > 0 or count_update > 0:
                files = [s for symbols in array_of_files for s in symbols]
                logger.info(f'Updating database ... {len(files):,d} entries')
                File.objects.bulk_update(files, ['name', 'path', 'date', 'size', 'offset', 'offset_data'], batch_size=1000)
            else:
                logger.info('No new File entries')
            t = time.time() - t
            a = len(files) / t
            logger.info(f'Bulk update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}')
        else:
            for key in tqdm.tqdm(keys,  desc=f'{indent}{desc}') if progress else keys:
                xx = output[key]['xx']
                _, cc, cu, ci = __handle_data__(xx, save=True)
                count_create += cc;
                count_update += cu;
                count_ignore += ci;
            t = time.time() - t
            a = len((count_create + count_update)) / t
            logger.info(f'Individual update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}')
    else:
        def __sweep_files__(xx):
            files = []
            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                c = name.split('-')
                date = datetime.datetime.strptime(c[1] + c[2], r'%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
                x = File(name=name, path=archive, date=date, size=size, offset=offset, offset_data=offset_data)
                files.append(x)
            return files

        t = time.time()
        desc = 'Pass 2 / 2 - Creating entries'
        logger.info(f'{desc} ...')
        if verbose:
            array_of_files = []
            for key in tqdm.tqdm(keys, desc=desc) if progress else keys:
                xx = output[key]['xx']
                files = __sweep_files__(xx)
                array_of_files.append(files)
        else:
            array_of_files = [__sweep_files__(output[key]['xx']) for key in keys]
        files = [s for symbols in array_of_files for s in symbols]
        File.objects.bulk_create(files)
        t = time.time() - t
        a = len(files) / t
        logger.info(f'Bulk create {t:.2f} sec ({a:,.0f} files / sec)')

    # Make a Day entry
    build_day(folder, bgor=True)

    e = time.time() - e
    a = len(archives) / e
    show = colorize(f'{e:.2f}', 'teal')
    logger.info(f'Total elapsed time = {show} sec ({a:,.0f} files / sec)')

'''
    Build an entry to the Day table

    source - common source pattern (see params_from_source())
    bgor - compute the bgor values of the day
'''
def build_day(source, bgor=False, verbose=0):
    if verbose:
        show = colorize('build_day()', 'green')
        show += '   ' + color_name_value('source', source)
        logger.debug(show)

    params = params_from_source(source, dig=True)
    prefix = params['prefix']
    date = params['date']

    if prefix is None:
        logger.error(f'Error. Unble to determine prefix from {source}')
        return None

    if date is None:
        logger.error(f'Error. build_day() needs an exact date.')
        return None

    date_range = params['date_range']
    if date_range:
        files = File.objects.filter(name__startswith=prefix, date__range=date_range)
        if files.count() == 0:
            logger.error(f'Error. No File entries for {date}')
            return None

    day_string = date.strftime(r'%Y-%m-%d')

    tic = time.time()

    mode = 'N'
    day = Day.objects.filter(date=date, name=prefix)
    if day:
        mode = 'U'
        day = day.first()
    else:
        day = Day(date=date, name=prefix)

    total = 0
    counts = [0] * 24
    for k in range(24):
        date_range = [f'{day_string} {k:02d}:00:00Z', f'{day_string} {k:02d}:59:59.9Z']
        matches = File.objects.filter(name__startswith=prefix, name__endswith='-Z.nc', date__range=date_range)
        counts[k] = matches.count()
        total += counts[k]

    if total > 0:
        day.count = total
        day.duration = day.count * 20
        day.hourly_count = ','.join([str(c) for c in counts])
        day.save()
    elif mode == 'U' and total == 0:
        mode = 'D'
        day.delete()
        day = None
    else:
        mode = 'I'

    if mode == 'N':
        day = Day.objects.filter(date=day_string, name=prefix).first()

    if bgor:
        compute_bgor(day)
        logger.info(f'{mode} {day.__repr__()}')

    tic = time.time() - tic

    if verbose:
        logger.debug(f'Elapsed time: {tic:.2f}s')

    return day, mode

'''
    Check a Day entry from the database

    source - common source pattern (see params_from_source())
'''
def check_day(source, format=''):
    show = colorize('check_day()', 'green')
    show += '   ' + color_name_value('source', source)
    logger.info(show)
    params = params_from_source(source)
    if params['prefix'] is None:
        prefixes = list(settings.RADARS.keys())
    elif isinstance(params['prefix'], str):
        prefixes = [params['prefix']]
    else:
        logger.error('Unable to continue')
        pp.pprint(params)
    date = params['date']
    date_range = params['date_range']
    ddd = []
    for name in prefixes:
        if date:
            dd = Day.objects.filter(name=name, date=date).order_by('date')
        elif date_range:
            dd = Day.objects.filter(name=name, date__range=date_range).order_by('date')
        else:
            dd = Day.objects.filter(name=name).order_by('date')
        if len(dd):
            if len(prefixes) > 1:
                show = color_name_value('prefix', name)
                logger.info(show)
            for d in dd:
                ddd.append(d)
                show = d.__repr__(format=format)
                logger.info(f'R {show}')
    if len(ddd) == 0:
        logger.info(f'Day entry of {source} does not exist')
    return ddd

'''
    Check File entries and verify existence

    source - common source pattern (see params_from_source())
'''
def check_file(source, progress=True, remove=False):
    show = colorize('check_file()', 'green')
    show += '   ' + color_name_value('source', source)
    show += '   ' + color_name_value('remove', remove)
    logger.info(show)
    params = params_from_source(source, dig=True)
    if params['prefix'] is None:
        prefixes = list(settings.RADARS.keys())
    elif isinstance(params['prefix'], str):
        prefixes = [params['prefix']]
    else:
        logger.error('Unable to continue')
        pp.pprint(params)
    for prefix in prefixes:
        files = File.objects.filter(name__startswith=prefix, date__range=params['date_range'])
        count = files.count()
        show = color_name_value('prefix', prefix)
        show += '  ' + color_name_value('count', count)
        logger.info(show)
        if count == 0:
            continue
        count = 0
        for file in tqdm.tqdm(files) if progress else files:
            if not os.path.exists(file.path):
                file.show()
                count += 1
                if remove:
                    file.delete()
        s = 's' if count > 1 else ''
        logger.info(f'{source} has {count} missing file{s}')

'''
    Finds duplicate File entries

    source - common source pattern (see params_from_source())
    remove - remove duplicate entries (copy > 1) if set to True
'''
def find_duplicates(source, remove=False):
    show = colorize('find_duplicates()', 'green')
    show += '   ' + color_name_value('source', source)
    show += '   ' + color_name_value('remove', remove)
    logger.info(show)
    params = params_from_source(source)
    prefix = params['prefix']
    date_range = params['date_range']

    show = colorize('date_range', 'orange') + colorize(' = ', 'red')
    show += '[' + colorize(date_range[0], 'yellow') + ', ' + colorize(date_range[1], 'yellow') + ']'
    logger.info(show)

    if prefix:
        entries = File.objects.filter(date__range=date_range, name__startswith=prefix)
    else:
        entries = File.objects.filter(date__range=date_range)

    names = [file.name for file in entries]

    if len(names) == 0:
        logger.info('No match')
        return

    count = 0;
    for name in tqdm.tqdm(names):
        if names.count(name) == 1:
            continue
        x = entries.filter(name=name)
        logger.info(f'{name} has {len(x)} entries')
        for o in x[1:]:
            logger.debug(o.__repr__())
            if remove:
                count += 1
                o.delete()

    if count:
        logger.info(f'Removed {count} files')
    else:
        logger.info('No duplicates found.')

'''
    Check for latest entries from each radar
'''
def check_latest(source=[], markdown=False):
    show = colorize('check_latest()', 'green')
    logger.info(show)
    if len(source):
        names = [params_from_source(name)['prefix'] for name in source]
    else:
        names = settings.RADARS.keys()
    message = '| Radars | Latest Scan | Age |\n|---|---|---|\n'
    for name in names:
        day = Day.objects.filter(name=name)
        if day.count() == 0:
            continue
        day = day.latest('date')
        last = day.last_hour_range()
        file = File.objects.filter(name__startswith=name, date__range=last).latest('date')
        show = colorize('last', 'orange') + colorize(' = ', 'red')
        show += '[' + colorize(last[0], 'yellow') + ', ' + colorize(last[1], 'yellow') + ']'
        show += '   ' + color_name_value('name', file.name)
        radar = settings.RADARS[name]['folder']
        filename = re.sub('-([a-zA-Z]+).nc', '', file.name)
        age = file.get_age()
        ages = ''
        if age.days > 0:
            s = 's' if age.days > 1 else ''
            ages += f'{age.days} day{s} '
        hours = age.seconds // 3600
        if hours > 0:
            s = 's' if hours > 1 else ''
            ages += f'{hours} hour{s} '
        mins = (age.seconds - 3600 * hours) // 60
        s = 's' if mins > 1 else ''
        ages += f'{mins} min{s}'
        message += f'{radar} | {filename} | {ages} |\n'
        logger.info(show)
    if markdown:
        print(message)
    return message

'''
    Compute BGOR (blue, green, orange, red) ratios
'''
def compute_bgor(day):
    show = colorize('compute_bgor()', 'green')
    show += '   ' + color_name_value('day', day.__repr__(format='short'))
    logger.info(show)

    day_datetime = datetime.datetime(day.date.year, day.date.month, day.date.day).replace(tzinfo=datetime.timezone.utc)
    hourly_count = [int(h) for h in day.hourly_count.split(',')]
    stride = datetime.timedelta(minutes=20)
    hour = datetime.timedelta(hours=1)

    files = File.objects.filter(name__startswith=day.name, date__range=day.day_range())
    if files.count() == 0:
        return

    def scans_from_files(files):
        scans = [file.name.split('-')[3] for file in files]
        scans = list(np.unique(scans))
        if len(scans) > 1 and 'E0.0' in scans:
            scans.remove('E0.0')
        return scans

    b = 0
    g = 0
    o = 0
    r = 0
    total = 0
    for k, count in enumerate(hourly_count):
        if count == 0:
            continue
        logger.debug(f'{k} {count}')
        s = day_datetime + k * hour
        e = s + hour
        date_range = [s, e]
        files = File.objects.filter(name__startswith=day.name, name__endswith=f'-Z.nc', date__range=date_range)
        scans = scans_from_files(files)
        for j, scan in enumerate(scans):
            files = File.objects.filter(name__startswith=day.name, name__endswith=f'-{scan}-Z.nc', date__range=date_range)
            if files.exists():
                select = j * len(files) // len(scans)
                file = files[select] if select < len(files) else files.first()
                logger.debug(file.__repr__())
                sweep = file.read(finite=True)
                z = sweep['values']
                # Zero out the first few kilometers
                ng = int(5000.0 / sweep['gatewidth'])
                z[:, :ng] = -100.0
                b += np.sum(z >= 5.0)
                g += np.sum(z >= 20.0)
                o += np.sum(z >= 35.0)
                r += np.sum(z >= 50.0)
                total += z.size
            s += stride
    # print(f'total = {total}  b = {b}  g = {g}  o = {o}  r = {r}')
    r = 1000 * r / o if r else 0
    o = 1000 * o / g if o else 0
    g = 1000 * g / b if g else 0
    b = 10000 * b / total if b else 0
    # print(f'total = {total}  b = {b}  g = {g}  o = {o}  r = {r}')
    day.blue = int(b)
    day.green = int(g)
    day.orange = int(o)
    day.red = int(r)
    day.save()


'''
    Show sweep summary

    source - name in either one of the following forms:
              - [PREFIX]-YYYYMMDD-hhmm-Z
              - [PREFIX]-YYYYMMDD-hhmm
              - [PREFIX]-

             e.g., 'RAXPOL-'
                   'PX-20130520-191000-E2.6-Z'
'''
def show_sweep_summary(source, markdown=False):
    show = colorize('show_sweep_summary()', 'green')
    show += '   ' + color_name_value('source', source)
    logger.info(show)
    c = source.split('-')
    p = c[0] + '-'
    if len(c) > 2:
        if len(c) > 4:
            s = c[4].split('.')[0]
        else:
            s = 'Z'
        date = datetime.datetime.strptime(c[1] + c[2], r'%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
        o = File.objects.filter(date=date).filter(name__startswith=p).filter(name__endswith=f'-{s}.nc')
        if o:
            o = o[0]
        else:
            logger.info(f'Source {source} not found')
            return
    else:
        logger.info(f'Retrieving last entry with prefix = {p} ...')
        o = File.objects.filter(name__startswith=p).filter(name__endswith='-Z.nc').last()
    logger.debug(o.__repr__())
    sweep = o.read()
    shape = sweep['values'].shape
    size = 56 + 2 * shape[0] * 4 + shape[0] * shape[1]
    if markdown:
        np.set_printoptions(formatter={'float': '{:.1f}'.format})
        message = f'Sweep Summary of `{o.name}`\n\n'
        message += '| Key | Values |\n'
        message += '|---|---|\n'
        for k, v in sweep.items():
            if k == 'values':
                continue
            message += f'| `{k}` | {v} |\n'
        message += f'| shape | {shape} |\n'
        message += f'| size | {size:,d} B |\n'
        print(message)
    else:
        print('Sweep =')
        pp.pprint(sweep)
        print(f'Data shape = {shape}\nRaw size = {size:,d} B')

'''
    Shows visitor summary, something like:

| IP Address      |      Payload (B) |    Bandwidth (B) |     Count |         OS / Browser | Last Visit | Location                       |
| --------------- |----------------- |----------------- | --------- | -------------------- | ---------- | ------------------------------ |
| 75.111.159.35   |       13,836,684 |        1,361,384 |        42 |       macOS / Chrome | 2022/07/22 | Texas, United States           |
| 186.221.73.23   |    1,380,023,303 |      151,369,900 |     3,797 |       Linux / Chrome | 2022/07/22 | Goiás, Brazil                  |
| 174.109.29.230  |    1,413,313,725 |      281,190,422 |    14,658 |  Windows 10 / Chrome | 2022/07/22 | North Carolina, United States  |
'''
def show_visitor_log(markdown=False, show_city=False, recent=0):
    print('| IP Address      |      Payload (B) |    Bandwidth (B) |     Count |         OS / Browser | Last Visit | Location                       |')
    print('| --------------- | ---------------- | ---------------- | --------- | -------------------- | ---------- | ------------------------------ |')
    def show_visitor(visitor, markdown):
        agent = logparse.get_user_agent_string(visitor.user_agent, width=20)
        date_string = visitor.last_visited_date_string()
        origin = logparse.get_ip_location(visitor.ip, show_city=show_city)
        if markdown:
            print(f'| `{visitor.ip}` | `{visitor.payload:,}` | `{visitor.bandwidth:,}` | `{visitor.count:,}` | {agent} | {date_string} | {origin} |')
        else:
            print(f'| {visitor.ip:15} | {visitor.payload:16,} | {visitor.bandwidth:16,} | {visitor.count:9,} | {agent:>20} | {date_string} | {origin:30} |')

    visitors = Visitor.objects.order_by('-last_visited')
    if recent:
        day = datetime.datetime.today().replace(tzinfo=datetime.timezone.utc) - datetime.timedelta(days=recent)
        visitors = visitors.filter(last_visited__gte=day)
    for visitor in visitors.exclude(ip__startswith='10.'):
        show_visitor(visitor, markdown=markdown)
    for visitor in visitors.filter(ip__startswith='10.'):
        show_visitor(visitor, markdown=markdown)

'''
    Update Visitor table
'''
def update_visitors(verbose=1):
    show = colorize('update_visitors()', 'green')
    show += '   ' + color_name_value('verbose', verbose)
    logger.info(show)

    visitors = {}
    uu = re.compile(r'(/data/load|/data/list)')

    file = '/var/log/nginx/access.log'
    lines = logparse.readlines(file)
    if lines is None:
        print('ERROR. Unable to continue.')
    while file and len(lines) == 0:
        logger.info(f'File {file} is empty')
        file = logparse.find_previous_log(file)
        if file is None:
            logger.error('ERROR. Unable to continue.')
            return
        lines = logparse.readlines(file)

    logger.info(f'Processing {file} ... total lines = {len(lines):,d}')

    parser = logparse.LogParser(parser='nginx')

    if Visitor.objects.count():
        last = Visitor.objects.latest('last_visited')

        parser.decode(lines[-1])
        if last.last_visited >= parser.datetime:
            o = parser.datetime.strftime(r'%m/%d %H:%M:%S')
            t = last.last_visited.strftime(r'%m/%d %H:%M:%S')
            logger.info(f'Seen it all: last_visited {t} >= last log entry {o}.')
            return

        parser.decode(lines[0])
        if last.last_visited <= parser.datetime:
            delta = parser.datetime - last.last_visited
            logger.warning(f'Potential data gap: {delta}')
            file = logparse.find_previous_log(file)
            if file is None:
                logger.warning('No previous logs that provide continuity.')
                ans = input('Do you really want to continue (y/[n])? ')
                if not ans == 'y':
                    logger.info('Whew. Nothing happend.')
                    return
            while file:
                front = logparse.readlines(file)
                lines = [*front, *lines]
                logger.info(f'Rolling back to {file} ... total lines -> {len(lines):,d}')
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
                visitor = Visitor.objects.create(ip=parser.ip,
                    last_visited=parser.datetime)
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
        s = 's' if count > 1 else ''
        logger.info(f'Updated {count} visitor{s}')
    else:
        logger.info('No updates')

    if verbose:
        show_visitor_log(recent=7)

def check_path(folder, args):
    original = os.path.join(folder, '_original')
    original_tgz = os.path.join(folder, '_original_tgz')
    if os.path.exists(original) and os.path.exists(original_tgz):
        archives = glob.glob(f'{original}/*.tar.xz')
        if len(archives):
            # print(f'{original_tgz} is safe to remove')
            cmd = f'rm -rf {original_tgz}'
            if args.verbose:
                print(cmd)
            # os.system(cmd)
    elif os.path.exists(original):
        archives = glob.glob(f'{original}/[A-Z]*.tar.xz')
        if len(archives):
            print(f'{original} ' + colorize('ok', 'green'))
            return
        archives = glob.glob(f'{original}/[A-Z]*.tgz')
        if len(archives):
            print(f'{original} ' + colorize('contains .tgz files', 'orange'))
        else:
            files = glob.glob(f'{original}/*.*')
            if len(files):
                print(f'{original} ' + colorize('ontains something else', 'orange'))
            else:
                print(f'{original} ' + colorize('empty', 'orange'))
    else:
        archives = glob.glob(f'{folder}/[A-Z]*.tgz')
        if len(archives):
            cmd = f'mkdir {original}'
            print(cmd)
            # os.system(cmd)
            cmd = f'mv {folder}/[A-Z]*.tgz {original}'
            print(cmd)
            # os.system(cmd)
        else:
            print(f'{folder} structure unexpected')
#

def dbtool_main():
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
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
        '''),
        epilog='Copyright (c) 2021-2022 Boonleng Cheong')
    parser.add_argument('source', type=str, nargs='*',
         help=textwrap.dedent('''\
             source(s) to process, which can be one of the following:
              - file entry (e.g., PX-20220223-192249-E16.0) for --show-sweep
              - path (e.g., /mnt/data/PX1000/2022/20220223) for -c, -i, -I, or -f
              - prefix + day (e.g., RAXPOL-20220225)
              - day (e.g., 20220223) for -c, -d
             '''))
    parser.add_argument('--all', action='store_true', help='sets to use all for --visitor')
    parser.add_argument('-b', dest='hour', default=0, type=int, help='sets beginning hour of the day to catalog')
    parser.add_argument('-c', '--check-day', action='store_true', help='checks entries from the Day table')
    parser.add_argument('-C', '--check-file', action='store_true', help='checks entries from the File table')
    parser.add_argument('-d', dest='build_day', action='store_true', help='builds a Day entry')
    parser.add_argument('-f', dest='find_duplicates', action='store_true', help='finds duplicate File entries in the database')
    parser.add_argument('--format', default='pretty', choices=['raw', 'short', 'pretty'], help='sets output format (default=pretty)')
    parser.add_argument('-i', dest='insert', action='store_true', help='inserts a folder')
    parser.add_argument('-I', dest='quick_insert', action='store_true', help='inserts (without check) a folder')
    parser.add_argument('--last', action='store_true', help='shows the absolute last entry in the database')
    parser.add_argument('-l', '--latest', action='store_true', help='shows the latest entries of each radar')
    parser.add_argument('--markdown', action='store_true', help='generates output in markdown')
    parser.add_argument('--no-bgor', dest='bgor', default=True, action='store_false', help='skips computing bgor')
    parser.add_argument('-p', '--check-path', action='store_true', help='checks the storage path')
    parser.add_argument('--progress', action='store_true', help='shows progress bar')
    parser.add_argument('-q', dest='quiet', action='store_true', help='runs the tool in silent mode (verbose = 0)')
    parser.add_argument('--recent', default=7, type=int, help='shows recent N days of entries')
    parser.add_argument('--remove', action='store_true', help='removes entries when combined with --find-duplicates')
    parser.add_argument('-s', dest='sweep', action='store_true', help='shows a sweep summary')
    parser.add_argument('--show-city', action='store_true', help='shows city of IP location')
    parser.add_argument('--no-skip', dest='skip', default=True, action='store_false', help='do no skip folders with Day.count == count')
    parser.add_argument('--skip', action='store_true', default=True, help='skips folders with Day.county == count')
    parser.add_argument('-u', '--update', action='store_true', help='updates visitor table from access log')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + settings.VERSION)
    parser.add_argument('-V', '--visitor', action='store_true', help='shows visitor log')
    parser.add_argument('-z', dest='test', action='store_true', help='dev')
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0
        logger.hideLogOnScreen()
    elif args.verbose:
        logger.showLogOnScreen()
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)
            logger.streamHandler.setLevel(dailylog.logging.DEBUG)

    if '*' in args.source:
        logger.info('Expanding asterisk ...')
        args.source = glob.glob(args.source)
        if len(args.source) == 0:
            logger.info('No match')
            return
        logger.info(args.source)

    if args.check_day:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -c needs a source, e.g.,

                { __prog__} -c 20220223
            '''))
            return
        for day in args.source:
            if args.build_day:
                build_day(day, bgor=args.bgor)
            check_day(day, format=args.format)
    elif args.check_file:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -C needs a source, e.g.,

                { __prog__} -C RAXPOL-20211006
            '''))
            return
        for source in args.source:
            check_file(source, remove=args.remove)
    elif args.build_day:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -d needs a source, e.g.,

                { __prog__} -d 20130520
                { __prog__} -d PX-20220224
                { __prog__} -d /mnt/data/PX1000/2022/20220224
            '''))
            return
        for day in args.source:
            build_day(day, bgor=args.bgor)
    elif args.find_duplicates:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -f needs a source with prefix, e.g.,

                { __prog__} -f PX-20220223
                { __prog__} -b /mnt/data/PX1000/2022/20220223
            '''))
            return
        logger.info(f'Finding duplicates ...')
        for folder in args.source:
            find_duplicates(folder, remove=args.remove)
    elif args.insert:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -i needs at least a source folder, e.g.,

                { __prog__} -i /mnt/data/PX1000/2022/20220223
            '''))
            return
        logger.info('Inserting folder(s) with .txz / .tar.xz archives')
        for folder in args.source:
            folder = folder[:-1] if folder[-1] == '/' else folder
            if len(args.source) > 1:
                logger.info('...')
            xz_folder(folder, hour=args.hour, check_db=True, args=args)
    elif args.quick_insert:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -I needs a source folder, e.g.,

                { __prog__} -I /mnt/data/PX1000/2022/20220223
            '''))
            return
        logger.info('Quick inserting folder(s) with .txz / .tar.xz archives')
        for folder in args.source:
            if len(args.source) > 1:
                logger.info('...')
            folder = folder[:-1] if folder[-1] == '/' else folder
            xz_folder(folder, hour=args.hour, check_db=False, args=args)
    elif args.last:
        logger.info('Retrieving the absolute last entry ...')
        o = File.objects.last()
        logger.info(o.__repr__())
    elif args.latest:
        if args.markdown:
            logger.hideLogOnScreen()
        check_latest(args.source, markdown=args.markdown)
    elif args.sweep:
        if args.markdown:
            logger.hideLogOnScreen()
        if len(args.source) == 0:
            o = File.objects.filter(name__endswith='Z.nc').last()
            show_sweep_summary(o.name, markdown=args.markdown)
        else:
            for source in args.source:
                show_sweep_summary(source, markdown=args.markdown)
    elif args.test:
        print('A placeholder for test routines')
        params = params_from_source('RAXPOL-202202*')
        pp.pprint(params)
    elif args.update:
        update_visitors(verbose=args.verbose)
    elif args.visitor:
        if args.markdown:
            logger.hideLogOnScreen()
        show_visitor_log(markdown=args.markdown, show_city=args.show_city, recent=0 if args.all else args.recent)
    elif args.check_path:
        for folder in args.source:
            folder = folder[:-1] if folder[-1] == '/' else folder
            check_path(folder, args=args)
    else:
        parser.print_help(sys.stderr)

###

if __name__ == '__main__':
    dbtool_main()
