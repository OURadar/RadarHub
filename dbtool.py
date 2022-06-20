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

__prog__ = os.path.basename(sys.argv[0])

pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)
logger = dailylog.Logger(__prog__.split('.')[0] if '.' in __prog__ else __prog__, home=settings.LOG_DIR, dailyfile=settings.DEBUG)

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
    First revision of xzfolder, only kept here for simple illustration
'''
def xzfolder_v1(folder):
    print(f'xzfolder_v1: {folder}')
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
            c = file.split('-')
            prefix = c[0] + '-'
            time_string = c[1] + c[2]
            if day_string != c[1]:
                print(f'Warning. Inconsistent day_string = {day_string} != c[1] = {c[1]} (*)')
                day_string = c[1]
            source_datetime = datetime.datetime.strptime(time_string, r'%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
    elif '/' in source:
        logger.error(f'Error. Folder {source} does not exist')
        day_string = re.search(r'(?<=[-/])20[0-9][0-9][012][0-9][0-3][0-9]', source)
        if day_string:
            day_string = day_string.group(0)
    elif '-' in source:
        prefix, day_string = source.split('-')
        prefix += '-'
    else:
        day_string = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', source)
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
            print('Only day string')
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
            with tarfile.open(archive) as tar:
                for info in tar.getmembers():
                    xx.append([info.name, info.offset, info.offset_data, info.size, archive])
            out.put({'name': os.path.basename(archive), 'xx': xx})
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
def xzfolder(folder, hour=0, check_db=True, use_bulk_update=True, verbose=0):
    if verbose:
        show = colorize('xzfolder()', 'green')
        show += '   ' + color_name_value('folder', folder)
        show += '   ' + color_name_value('hour', hour)
        show += '   ' + color_name_value('check_db', check_db)
        show += '   ' + color_name_value('use_bulk_update', use_bulk_update)
        logger.debug(show)

    use_mp = 'linux' in sys.platform
    basename = os.path.basename(folder)
    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', basename)
    if s:
        s = s[0]
    else:
        logger.info(f'Error searching YYYYMMDD in folder name {basename}')
        return

    raw_archives = list_files(folder)
    if len(raw_archives) == 0:
        logger.info(f'No files in {folder}. Unable to continue.')
        return

    if not check_db:
        name = os.path.basename(raw_archives[0]).split('-')[0] + '-'
        d = check_day(s, name=name)
        if d:
            d = d[0]
            logger.warning(f'WARNING: There are already {d.count:,d} entries.')
            logger.warning(f'WARNING: Quick insert will result in duplicates. Try -i instead.')
            ans = input('Do you still want to continue (y/[n])? ')
            if not ans == 'y':
                logger.info('Whew. Nothing happend.')
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

    # Extracting parameters of the archives
    logger.info('Pass 1 / 2 - Scanning archives ...')

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

        for archive in tqdm.tqdm(archives) if verbose else archives:
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
        for archive in tqdm.tqdm(archives) if verbose else archives:
            xx = []
            with tarfile.open(archive) as tar:
                for info in tar.getmembers():
                    xx.append([info.name, info.offset, info.offset_data, info.size, archive])
            key = os.path.basename(archive)
            keys.append(key)
            output[key] = {'name': key, 'xx': xx}

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

        if use_bulk_update:
            logger.info('Pass 2 / 2 - Gathering entries ...')
            array_of_files = []
            for key in tqdm.tqdm(keys) if verbose else keys:
                xx = output[key]['xx']
                files, cc, cu, ci = __handle_data__(xx)
                array_of_files.append(files)
                count_create += cc;
                count_update += cu;
                count_ignore += ci;
            if count_create > 0 or count_update > 0:
                files = [s for symbols in array_of_files for s in symbols]
                logger.info(f'Updating database ... {len(files)} entries')
                File.objects.bulk_update(files, ['name', 'path', 'date', 'size', 'offset', 'offset_data'], batch_size=1000)
            else:
                logger.info('No new File entries')
            t = time.time() - t
            a = len(files) / t
            logger.info(f'Bulk update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}')
        else:
            logger.info('Pass 2 / 2 - Inserting entries into the database ...')
            for key in tqdm.tqdm(keys) if verbose else keys:
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
        logger.info('Pass 2 / 2 - Creating entries ...')
        if verbose:
            array_of_files = []
            for key in tqdm.tqdm(keys):
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
    build_day(folder)

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
        day = day[0]
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

    tic = time.time() - tic

    if verbose:
        logger.debug(f'{mode} {day.__repr__()}')
        logger.debug(f'Elapsed time: {tic:.2f}s')

    return day, mode

'''
    Check a Day entry from the database

    source - common source pattern (see params_from_source())
'''
def check_day(source):
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
            dd = []
        if len(dd):
            for d in dd:
                ddd.append(d)
                logger.info(f'R {d.__repr__()}')
    if len(ddd) == 0:
        logger.info(f'E {source} does not exist')
    return ddd

'''
    Check File entries and verify existence

    source - common source pattern (see params_from_source())
'''
def check_file(source, remove=False):
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
        showbar = logger.streamHandler.level <= dailylog.logging.INFO
        for file in tqdm.tqdm(files) if showbar else files:
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
        age = file.getAge()
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
    show += '   ' + color_name_value('day', day.__repr__(short=True))
    logger.info(show)

    day_datetime = datetime.datetime(day.date.year, day.date.month, day.date.day).replace(tzinfo=datetime.timezone.utc)
    hourly_count = [int(h) for h in day.hourly_count.split(',')]
    stride = datetime.timedelta(minutes=20)
    hour = datetime.timedelta(hours=1)

    files = File.objects.filter(name__startswith=day.name, name__contains='-E', date__range=day.day_range())
    if files.count() == 0:
        return
    scans = [file.name.split('-')[3] for file in files]
    scans = np.unique(scans)
    scan = 'E4.0' if 'E4.0' in scans else scans[0]

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
        for _ in range(int(hour / stride)):
            e = s + stride
            date_range = [s, e]
            file = File.objects.filter(name__startswith=day.name, name__endswith=f'-{scan}-Z.nc', date__range=date_range)
            if file.exists():
                file = file.first()
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
    b = 1000 * b / total if b else 0
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
| IP Address      |          Usage |      OS / Browser | Last Visited     |
| --------------- | -------------- | ----------------- | ---------------- |
| 98.168.138.9    |      123,367 B |  Windows / Chrome | 2022/06/15 17:42 |
'''

def show_visitor_log(markdown=False):
    if os.path.exists(settings.IP_DATABASE):
        import maxminddb
        fid = maxminddb.open_database(settings.IP_DATABASE)
        def get_location(ip):
            pattern = re.compile(' \(.*\)')
            if ip[:6] in [ '10.203', '10.206', '10.194', '10.197', '10.196' ]:
                return 'OU / VPN'
            else:
                info = fid.get(ip)
                if info:
                    city = pattern.sub('', info['city']['names']['en'])
                    country = info['country']['names']['en']
                    return f'{city}, {country}'
            return '-'
    else:
        def get_location(_):
            return '-'
    print('| IP Address      |          Usage |      OS / Browser | Last Visited     | Origin                         |')
    print('| --------------- | -------------- | ----------------- | ---------------- | ------------------------------ |')
    for visitor in Visitor.objects.all().order_by('-last_visited'):
        agent = f'{visitor.machine()} / {visitor.browser()}'
        time_string = visitor.last_visited_time_string()
        origin = get_location(visitor.ip)
        if markdown:
            print(f'| `{visitor.ip}` | `{visitor.bandwidth:,} B` | {agent} | {time_string} | {origin} |')
        else:
            print(f'| {visitor.ip:15} | {visitor.bandwidth:12,} B | {agent:>17} | {time_string} | {origin:30} |')

#

def dbtool_main():
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
        Database Tool

        Examples:
            {__prog__} -c 20220127
            {__prog__} -c PX-202201*
            {__prog__} -d PX-20220226
            {__prog__} -d RAXPOL-20220225
            {__prog__} -d /mnt/data/PX1000/2022/20220226
            {__prog__} -i /mnt/data/PX1000/2013/20130520
            {__prog__} -i /mnt/data/PX1000/2013/201305*
            {__prog__} -l
            {__prog__} -l RAXPOL-
            {__prog__} -l RAXPOL- PX-
            {__prog__} -s
            {__prog__} -s RAXPOL-
            {__prog__} -s PX-20130520-191000
            {__prog__} -f 20220225
            {__prog__} -f RAXPOL-20220225
            {__prog__} -f --remove 20220127
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
    parser.add_argument('-b', dest='hour', default=0, type=int, help='sets beginning hour of the day to catalog')
    parser.add_argument('-c', dest='check_day', action='store_true', help='checks entries from the Day table')
    parser.add_argument('-C', dest='check_file', action='store_true', help='checks entries from the File table')
    parser.add_argument('-d', dest='build_day', action='store_true', help='builds a Day entry')
    parser.add_argument('-f', dest='find_duplicates', action='store_true', help='finds duplicate File entries in the database')
    parser.add_argument('-i', dest='insert', action='store_true', help='inserts a folder')
    parser.add_argument('-I', dest='quick_insert', action='store_true', help='inserts (without check) a folder')
    parser.add_argument('--last', action='store_true', help='shows the absolute last entry in the database')
    parser.add_argument('-l', '--latest', action='store_true', help='shows the latest entries of each radar')
    parser.add_argument('--markdown', action='store_true', help='generates output in markdown')
    parser.add_argument('--no-bgor', dest='bgor', default=True, action='store_false', help='skips computing bgor')
    parser.add_argument('-q', dest='quiet', action='store_true', help='runs the tool in silent mode (verbose = 0)')
    parser.add_argument('--remove', action='store_true', help='removes entries when combined with --find-duplicates')
    parser.add_argument('-s', dest='sweep', action='store_true', help='shows a sweep summary')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + settings.VERSION)
    parser.add_argument('--visitor', dest='visitor', action='store_true', help='shows visitor log')
    parser.add_argument('-z', dest='test', action='store_true', help='dev')
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0
    elif args.verbose:
        logger.showLogOnScreen()
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)

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
            check_day(day)
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

                { __prog__} -b 20130520
                { __prog__} -b PX-20220224
                { __prog__} -b /mnt/data/PX1000/2022/20220224
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
            logger.info(f'{folder}')
            xzfolder(folder, hour=args.hour, check_db=True, verbose=args.verbose)
    elif args.quick_insert:
        if len(args.source) == 0:
            print(textwrap.dedent(f'''
                -I needs a source folder, e.g.,

                { __prog__} -I /mnt/data/PX1000/2022/20220223
            '''))
            return
        logger.info('Quick inserting folder(s) with .txz / .tar.xz archives')
        for folder in args.source:
            logger.info(f'{folder}')
            xzfolder(folder, hour=args.hour, check_db=False, verbose=args.verbose)
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
    elif args.visitor:
        if args.markdown:
            logger.hideLogOnScreen()
        show_visitor_log(markdown=args.markdown)
    else:
        parser.print_help(sys.stderr)

###

if __name__ == '__main__':
    dbtool_main()
