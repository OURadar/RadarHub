#!/usr/bin/env python

#
#  dbtool.py
#  Database Tool
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021 Boonleng Cheong.
#

__version__ = '1.0'

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

import dailylog

from frontend.models import File, Day
from common import colorize, color_name_value

pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)
logger = dailylog.Logger('dbtool')

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
    Process an archive from the queue
'''
def process_arhives(id, run, lock, queue, out):
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
    List .xz files in a folder

    folder - path to list, e.g., /mnt/data/PX1000/2022/20220128
'''
def list_files(folder):
    files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    if len(files) == 0:
        folder = os.path.join(folder, '_original')
        files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    return files

'''
    Insert a folder with .tar.xz archives to the database

             folder - path to insert, e.g., /mnt/data/PX1000/2022/20220128
               hour - start hour to examine
           check_db - check the database for existence (update or create)
    use_bulk_update - use django's bulk update/create functions
            verbose - verbosity level, e.g., 0, 1, or 2
'''
def xzfolder(folder, hour=0, check_db=True, use_bulk_update=True, verbose=0):
    show = colorize('xzfolder()', 'green')
    show += '   ' + color_name_value('folder', folder)
    show += '   ' + color_name_value('hour', hour)
    show += '   ' + color_name_value('check_db', check_db)
    show += '   ' + color_name_value('use_bulk_update', use_bulk_update)
    logger.info(show)

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
    logger.info(show)

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
            p = multiprocessing.Process(target=process_arhives, args=(n, run, lock, task_queue, db_queue))
            processes.append(p)
            p.start()

        for archive in tqdm.tqdm(archives) if verbose else archives:
            # Copy to ramdisk first, the queue the work after the file is copied
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
                        date = datetime.datetime.strptime(c[1] + c[2], '%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
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
                date = datetime.datetime.strptime(c[1] + c[2], '%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
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

    source - could either be a day string YYYYMMDD or a folder with the last
             part as day, e.g., /mnt/data/PX1000/2022/20220128
    prefix - prefix of datafiles, e.g., PX-, RAXPOL-, and PX10K-
    bgor - compute the bgor values of the day
'''
def build_day(source, prefix=None, bgor=False):
    show = colorize('build_day()', 'green')
    show += '   ' + color_name_value('source', source)
    show += '   ' + color_name_value('name', prefix)
    logger.info(show)

    if prefix is None and '/' not in source and '-' not in source:
        logger.error('Unable to determine name')
        return None

    def _prefix_date_from_source(source):
        c = source.split('-')
        return c[0] + '-', c[1]

    s = None
    if '/' in source:
        if source[-1] == '/':
            source = source[:-1]
        s = os.path.basename(source)
        files = list_files(source)
        if len(files) == 0:
            logger.error(f'No files in {source}')
            return None
        file = os.path.basename(files[0])
        if prefix is None:
            prefix, _ = _prefix_date_from_source(file)
    elif '-' in source and prefix is None:
        prefix, s = _prefix_date_from_source(source)
    else:
        s = source

    if prefix is None or s is None:
        logger.error(f'Error. Unble to determine the name/date from {source}')
        return None

    tic = time.time()

    day_string = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'

    mode = 'N'
    day = Day.objects.filter(date=day_string, name=prefix)
    if day:
        mode = 'U'
        day = day[0]
    else:
        day = Day(date=day_string, name=prefix)

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

    logger.info(f'{mode} {day.__repr__()}')
    logger.info(f'Elapsed time: {tic:.2f}s')

    return day, mode

'''
    Check a Day entry from the database

    day - could either be a day string YYYYMMDD or a folder with the last
          part as day, e.g., /mnt/data/PX1000/2022/20220128
'''
def check_day(source):
    show = colorize('check_day()', 'green')
    show += '   ' + color_name_value('source', source)
    logger.info(show)
    params = params_from_source(source)
    if params['prefix'] is None:
        prefixes = ['PX-', 'PX10K-', 'RAXPOL-']
    elif isinstance(params['prefix'], str):
        prefixes = [params['prefix']]
    else:
        logger.error('Unable to continue')
        pp.pprint(params)
    date = params['date']
    for name in prefixes:
        dd = Day.objects.filter(name=name, date=date)
        if len(dd):
            for d in dd:
                logger.info(f'R {d.__repr__()}')
        else:
            logger.info(f'E {name}{source} does not exist')
    return dd

'''
    Check File entries that no longer exists

    source - could either be:
              - a string with day only, e.g., YYYYMMDD
              - a string with prefix and day string, e.g., PX-20220127,
              - a path to the data, e.g., /mnt/data/PX1000/2022/20220127

'''
def check_file(source, remove=False):
    show = colorize('check_file()', 'green')
    show += '   ' + color_name_value('source', source)
    show += '   ' + color_name_value('remove', remove)
    logger.info(show)
    params = params_from_source(source, dig=True)
    if params['prefix'] is None:
        prefixes = ['PX-', 'PX10K-', 'RAXPOL-']
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
        for file in tqdm.tqdm(files):
            if not os.path.exists(file.path):
                file.show()
                if remove:
                    file.delete()

'''
    Poor function, don't use

    source - name in either one of the following forms:
              - [PREFIX]-YYYYMMDD-hhmm-Z
              - [PREFIX]-YYYYMMDD-hhmm
              - [PREFIX]-

             e.g., 'RAXPOL-'
                   'PX-20130520-191000-E2.6-Z'
'''
def show_sweep_summary(source):
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
        date = datetime.datetime.strptime(c[1] + c[2], '%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
        o = File.objects.filter(date=date).filter(name__startswith=p).filter(name__endswith=f'-{s}.nc')
        if o:
            o = o[0]
        else:
            logger.info(f'Source {source} not found')
            return
    else:
        logger.info(f'Retrieving last entry with prefix = {p} ...')
        o = File.objects.filter(name__startswith=p).last()
    logger.info(o.__repr__())
    sweep = o.read()
    pp.pprint(sweep)

'''
    Finds duplicate entries

     folder - path with YYYYMMDD, e.g., '/mnt/data/PX1000/2022/20220117', '20220127
     prefix - prefix of the file names, e.g., 'PX10K-', 'PX-', 'RAXPOL-'
     remove - remove entries > 1 if set to True
'''
def find_duplicates(folder, prefix=None, remove=False):
    show = colorize('find_duplicates()', 'green')
    show += '   ' + color_name_value('folder', folder)
    show += '   ' + color_name_value('prefix', prefix)
    show += '   ' + color_name_value('remove', remove)
    logger.info(show)

    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', os.path.basename(folder)).group(0)
    e = time.localtime(time.mktime(time.strptime(s[:8], '%Y%m%d')) + 86400)
    day0 = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    day1 = time.strftime('%Y-%m-%d', e)
    date_range = [f'{day0} 00:00Z', f'{day1} 00:00Z']

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
def check_latest():
    show = colorize('check_latest()', 'green')
    logger.info(show)
    for name in ['PX-', 'PX10K-', 'RAXPOL-']:
        day = Day.objects.filter(name=name).latest('date')
        last = day.last_hour_range()
        file = File.objects.filter(name__startswith=name, date__range=last).latest('date')
        show = colorize('last', 'orange') + colorize(' = ', 'red')
        show += '[' + colorize(last[0], 'yellow') + ', ' + colorize(last[1], 'yellow') + ']'
        show += '   ' + color_name_value('name', file.name)
        logger.info(show)

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
    Parse prefix, date, datetime, etc. from a source string
'''
def params_from_source(source, dig=False):
    file = None
    prefix = None
    source_date = None
    source_datetime = None
    if os.path.exists(source):
        if os.path.isdir(source):
            if source[-1] == '/':
                source = source[:-1]
            folder, day_string = os.path.split(source)
            if dig:
                files = glob.glob(f'{source}/_original/*.tar.xz')
                if len(files):
                    file = os.path.basename(files[0])
        else:
            folder, file = os.path.split(source)
            day_string = os.path.basename(folder)
        if file:
            logger.debug(f'params_from_source() file[0] = {file}')
            c = file.split('-')
            prefix = c[0] + '-'
            time_string = c[1] + c[2]
            if day_string != c[1]:
                print(f'Warning. Inconsistent day_string = {day_string} != c[1] = {c[1]}')
                day_string = c[1]
            source_datetime = datetime.datetime.strptime(time_string, '%Y%m%d%H%M%S').replace(tzinfo=datetime.timezone.utc)
    elif '-' in source:
        prefix, day_string = source.split('-')
        prefix += '-'
    else:
        day_string = source
    if day_string:
        source_date = datetime.datetime.strptime(day_string, '%Y%m%d').date()
    start = datetime.datetime(source_date.year, source_date.month, source_date.day).replace(tzinfo=datetime.timezone.utc)
    date_range = [start, start + datetime.timedelta(days=1)]
    return {
        'file': file,
        'prefix': prefix,
        'date': source_date,
        'datetime': source_datetime,
        'date_range': date_range
    }

#

def dbtool_main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool

        Examples:
            dbtool.py -c 20220127
            dbtool.py -d PX-20220226
            dbtool.py -d --prefix=PX- 20220226
            dbtool.py -d /data/PX1000/2022/20220226
            dbtool.py -i /data/PX1000/2013/20130520
            dbtool.py -i /data/PX1000/2013/201305*
            dbtool.py -l
            dbtool.py -s
            dbtool.py -s RAXPOL-
            dbtool.py -s PX-20130520-191000
            dbtool.py -v --find-duplicates 20220127
            dbtool.py -v --find-duplicates --remove 20220127
        '''))
    parser.add_argument('source', type=str, nargs='*',
         help=textwrap.dedent('''\
             source(s) to process, which can be one of the following:
              - file entry (e.g., PX-20220223-192249-E16.0) for --show-sweep
              - path (e.g., /mnt/data/PX1000/2022/20220223) for -c, -i, -I, or -f
              - prefix + day (e.g., PX-20220127)
              - day (e.g., 20220223) for -c, -d
             '''))
    parser.add_argument('-b', dest='hour', default=0, type=int, help='sets beginning hour of the day to catalog')
    parser.add_argument('-c', dest='check_day', action='store_true', help='checks entries from the Day table')
    parser.add_argument('-C', dest='check_file', action='store_true', help='checks entries from the File table')
    parser.add_argument('-d', dest='build_day', action='store_true', help='builds a Day table')
    parser.add_argument('-f', '--find-duplicates', action='store_true', help='finds duplicate entries in the database')
    parser.add_argument('-i', dest='insert', action='store_true', help='inserts a folder')
    parser.add_argument('-I', dest='quick_insert', action='store_true', help='inserts (without check) a folder')
    parser.add_argument('--last', action='store_true', help='shows the last entry to the database')
    parser.add_argument('-l', '--latest', action='store_true', help='shows the latest entries of each radar')
    parser.add_argument('--no-bgor', dest='bgor', default=True, action='store_false', help='skips computing bgor')
    parser.add_argument('-p', '--prefix', help='sets the radar prefix to process')
    parser.add_argument('-q', dest='quiet', action='store_true', help='runs the tool in silent mode (verbose = 0)')
    parser.add_argument('--remove', action='store_true', help='removes entries when combined with --find-duplicates')
    parser.add_argument('-s', '--show-sweep', action='store_true', help='shows a sweep summary')
    parser.add_argument('--version', action='version', version='%(prog)s ' + __version__)
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('-z', dest='test', action='store_true', help='dev')
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0
    elif args.verbose:
        logger.showLogOnScreen()
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)

    if args.prefix and args.prefix[-1] != '-':
        args.prefix += '-'
        print(color_name_value('args.prefix', args.prefix))

    if '*' in args.source:
        logger.info('Expanding asterisk ...')
        args.source = glob.glob(args.source)
        if len(args.source) == 0:
            logger.info('No match')
            return
        logger.info(args.source)

    if args.check_day:
        if len(args.source) == 0:
            print('-c needs a source, e.g.,')
            print('  dbtool.py -c 20220223')
            return
        for day in args.source:
            check_day(day)
    elif args.check_file:
        if len(args.source) == 0:
            print('-C needs a source, e.g.,')
            print('  dbtool.py -C RAXPOL-20211006')
            return
        for source in args.source:
            check_file(source, remove=args.remove)
    elif args.build_day:
        if len(args.source) == 0:
            print('-b needs a source, e.g.,')
            print('  dbtool.py -b 20130520')
            print('  dbtool.py --prefix PX- -b 20220224')
            print('  dbtool.py -b /mnt/data/PX1000/2013/20130520')
            return
        logger.info('Building a Day table ...')
        for day in args.source:
            build_day(day, prefix=args.prefix, bgor=args.bgor)
    elif args.find_duplicates:
        if len(args.source) == 0:
            print('-f needs a source with prefix, e.g.,')
            print('  dbtool.py -f 20220223 --prefix PX-')
            print('  dbtool.py -f PX-20220223')
            print('  dbtool.py -f /mnt/data/PX1000/2021/20220223')
            return
        logger.info(f'Finding duplicates ...')
        for folder in args.source:
            find_duplicates(folder, prefix=args.prefix, remove=args.remove)
    elif args.insert:
        if len(args.source) == 0:
            print('-i needs a source, e.g.,')
            print('  dbtool.py -i /data/PX1000/2013/20130520')
            return
        logger.info('Inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            logger.info(f'{folder}')
            xzfolder(folder, hour=args.hour, check_db=True, verbose=args.verbose)
    elif args.quick_insert:
        if len(args.source) == 0:
            print('-I needs a source, e.g.,')
            print('  dbtool.py -i /data/PX1000/2013/20130520')
            return
        logger.info('Quick inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            logger.info(f'{folder}')
            xzfolder(folder, hour=args.hour, check_db=False, verbose=args.verbose)
    elif args.last:
        logger.info('Retrieving the last entry ...')
        if args.prefix:
            print('This function ignores the --prefix argument.')
            print('Perhaps you wanted -l')
        o = File.objects.last()
        logger.info(o.__repr__())
    elif args.latest:
        logger.info('Retrieving the latest entries of each radar ...')
        check_latest()
    elif args.show_sweep:
        if len(args.source) == 0:
            if args.prefix is None:
                logger.info(f'Retrieving latest sweep ...')
                o = File.objects.last()
            else:
                show = color_name_value('prefix', args.prefix)
                logger.info(f'Retrieving latest sweep w/ {show} ...')
                o = File.objects.filter(name__startswith=args.prefix).last()
            logger.info(o.show())
            sweep = o.read()
            pp.pprint(sweep)
        else:
            for source in args.source:
                show_sweep_summary(source)
    elif args.test:
        print('A placeholder for test routines')
    else:
        parser.print_help(sys.stderr)

###

if __name__ == '__main__':
    dbtool_main()
