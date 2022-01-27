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
import multiprocessing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

pp = pprint.PrettyPrinter(indent=1, depth=1, width=90, sort_dicts=False)

from frontend.models import File, Day

debug = False

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

def retrieve(name):
    x = File.objects.filter(name=name)
    if len(x) == 0:
        return None
    if len(x) > 1:
        print(f'There are more than one match. Choosing the first one.')
    return x[0]

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

def list_files(folder):
    files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    if len(files) == 0:
        folder = os.path.join(folder, '_original')
        files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    return files

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

def process_arhives(id, run, lock, queue, out, verbose=0):
    while run.value == 1:
        task = None
        
        lock.acquire()
        if not queue.empty():
            task = queue.get()
        lock.release()

        if task:
            archive = task['archive']
            ramfile = task['ramfile']
            if verbose:
                print(f'{id:02d}: {archive} {ramfile}')
            xx = []
            with tarfile.open(archive) as tar:
                for info in tar.getmembers():
                    xx.append([info.name, info.offset, info.offset_data, info.size, archive])
            out.put({'name': os.path.basename(archive), 'xx': xx})
            os.remove(ramfile)
        else:
            time.sleep(0.1)

    if verbose:
        print(f'{id} done')

    return


def xzfolder(folder, hour=0, check_db=True):
    print(f'xzfolder: {folder}')

    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', os.path.basename(folder)).group(0)
    prefix = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    date_range = [f'{prefix} {hour:02d}:00Z', f'{prefix} 23:59:59.99Z']
    print(f'date_range = {date_range}')

    task_queue = multiprocessing.Queue()
    db_queue = multiprocessing.Queue()
    lock = multiprocessing.Lock()
    run = multiprocessing.Value('i', 1)
    raw_archives = list_files(folder)
    if len(raw_archives) == 0:
        print('No files. Unable to continue.')
        return

    archives = []
    for archive in raw_archives:
        basename = os.path.basename(archive)
        file_hour = int(basename.split('-')[2][0:2])
        if file_hour >= hour:
            archives.append(archive)

    count = multiprocessing.cpu_count()
    e = time.time()

    keys = []
    output = {}
    processes = []
    for n in range(count):
        p = multiprocessing.Process(target=process_arhives, args=(n, run, lock, task_queue, db_queue))
        processes.append(p)
        p.start()

    # Extracting parameters of the archives
    print('Pass 1 / 2 - Scanning archives ...')
    for archive in tqdm.tqdm(archives):
        # Copy to ramdisk first, the queue the work after the file is copied
        basename = os.path.basename(archive)
        ramfile = f'/mnt/ramdisk/{basename}'
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

    print('Pass 2 / 2 - Inserting entries into the database ...')

    entries = File.objects.filter(date__range=date_range)

    pattern = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')

    def handle_data(xx, use_re_pattern=False, check_db=check_db):
        for yy in xx:
            mode = 'N'
            (name, offset, offset_data, size, archive) = yy
            if check_db:
                n = entries.filter(name=name)
            else:
                n = False
            if n:
                x = n[0]
                if x.path != archive or x.size != size or x.offset != offset or x.offset_data != offset_data:
                    mode = 'U'
                    x.path = archive
                    x.size = size
                    x.offset = offset
                    x.offset_data = offset_data
                else:
                    mode = 'I'
            else:
                # print(f'{mode} : {name} {offset} {offset_data} {size} {archive}')
                if use_re_pattern:
                    s = pattern.search(archive).group(0)
                    datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
                else:
                    c = name.split('-')
                    d = c[1]
                    t = c[2]
                    datestr = f'{d[0:4]}-{d[4:6]}-{d[6:8]} {t[0:2]}:{t[2:4]}:{t[4:6]}Z'
                x = File(name=name, path=archive, date=datestr, size=size, offset=offset, offset_data=offset_data)
                # print(x.name)
            # if debug:
            #     print(f' - {mode} : {name} {offset} {offset_data} {size} {archive}')
            if mode == 'N' or mode == 'U':
                x.save()

    # Consolidating results
    for key in tqdm.tqdm(sorted(keys)):
        xx = output[key]['xx']
        handle_data(xx)

    # Make a Day entry
    daycount(folder)

    e = time.time() - e
    a = e / len(archives)
    print(f'Elapsed time = {e:.2f} sec ({a:.2f} s / file)')

'''
    day - could either be a day string YYYYMMDD or a folder with the last
          part as day, e.g., /mnt/data/.../YYYYMMDD
'''
def daycount(day, name='PX-'):
    if '/' in day:
        s = re.search(r'(?<=/)20[0-9][0-9][012][0-9][0-3][0-9]', day)
        file = os.path.basename(list_files(day)[0])
        name = file.split('-')[0] + '-'
    else:
        s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', day)
    if s:
        s = s.group(0)
    else:
        print('Unble to determine the date')
        return
    date = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'

    print(f'Building Day table for {date} / {name} ...')

    mode = 'N'
    d = Day.objects.filter(date=date, name=name)
    if d:
        mode = 'U'
        d = d[0]
    else:
        d = Day(date=date, name=name)

    total = 0
    counts = [0] * 24
    for k in range(24):
        dateRange = [f'{date} {k:02d}:00Z', f'{date} {k:02d}:59Z']
        matches = File.objects.filter(name__contains='-Z.nc', date__range=dateRange)
        matches = matches.filter(name__contains=name)
        counts[k] = len(matches)
        total += counts[k]

    if total > 0:
        d.count = total
        d.duration = d.count * 20
        d.hourly_count = ','.join([str(c) for c in counts])
        d.save()
    elif mode == 'U' and total == 0:
        mode = 'D'
        d.delete()
    else:
        mode = 'I'

    print(f'{mode} {d.date} :: {d.duration:,d} :: {d.hourly_count}')

def show_sweep_summary(timestr):
    print(f'timestr = {timestr}')
    t = time.strptime(timestr, '%Y%m%d-%H%M%S')
    t = time.strftime('%Y-%m-%d %H:%M:%SZ', t)
    o = File.objects.filter(date=t).filter(name__contains='-Z.nc')
    if o:
        o = o[0]
    else:
        print('Time stamp not found')
    print(o.__repr__())
    sweep = o.getData()
    pp.pprint(sweep)

def remove_duplicates(folder, verbose=0):
    print(f'remove_duplicates: {folder}')
    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', os.path.basename(folder)).group(0)
    e = time.localtime(time.mktime(time.strptime(s[:8], '%Y%m%d')) + 86400)
    day0 = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    day1 = time.strftime('%Y-%m-%d', e)
    date_range = [f'{day0} 00:00Z', f'{day1} 00:00Z']
    print(f'date_range = {date_range}')

    entries = File.objects.filter(date__range=date_range)

    for entry in tqdm.tqdm(entries):
        x = entries.filter(name=entry.name)
        if len(x) > 1:
            print(f'{entry.name} has {len(x)} entries')
            for o in x:
                if verbose:
                    print(o.__repr__())
                o.delete()

#

def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool

        Examples:
            dbtool.py
            dbtool.py -i /data/PX1000/2013/20130520
            dbtool.py -i /data/PX1000/2013/201305*
            dbtool.py -d 20130520
            dbtool.py -s 20130520-191000
            dbtool.py -v
            dbtool.py --prefix PX- --latest
        '''))
    parser.add_argument('sources', type=str, nargs='*',
        help='sources to process')
    parser.add_argument('-b', dest='hour', default=0, type=int, help='sets beginning hour of the day to catalog')
    parser.add_argument('-d', dest='day', action='store_true', help='builds a Day table of the day')
    parser.add_argument('-i', dest='insert', action='store_true', help='inserts a folder')
    parser.add_argument('-j', dest='quick_insert', action='store_true', help='inserts (without check) a folder')
    parser.add_argument('--last', action='store_true', help='shows the last entry to the database')
    parser.add_argument('--latest', action='store_true', help='shows the latest entry to the database, requires --prefix')
    parser.add_argument('--remove-duplicates', action='store_true', help='finds and removes duplicate entries in the database')
    parser.add_argument('--prefix', help='specify the radar prefix to process')
    parser.add_argument('-s', dest='sweep', action='store_true', help='reads a sweep shows a summary')
    parser.add_argument('--skip-check-db', dest='check_db', action='store_false', default=True, help='skips checking database')

    parser.add_argument('-v', dest='verbose', default=0, action='count', help='increases verbosity')
    args = parser.parse_args()

    global debug
    debug = args.verbose > 1

    if '*' in args.sources:
        print('Expanding asterisk ...')
        args.sources = glob.glob(args.sources)
        if len(args.sources) == 0:
            print('No match')
            return
        print(args.sources)

    if args.latest:
        if not args.prefix:
            print('This method requires --prefix')
            return
        print(f'Retrieving the latest entry with prefix {args.prefix} ...')
        o = File.objects.filter(name__contains=args.prefix).latest('date')
        print(o.__repr__())
        return

    if args.last:
        print('Retrieving the last entry ...')
        o = File.objects.last()
        print(o.__repr__())
        return

    if args.sweep:
        e = time.time()
        for timestr in args.sources:
            show_sweep_summary(timestr)

    if args.insert:
        print('Inserting folder(s) with .tar.xz archives')
        for folder in args.sources:
            xzfolder(folder, hour=args.hour, check_db=True)
    elif args.quick_insert:
        print('Inserting folder(s) with .tar.xz archives without check')
        for folder in args.sources:
            xzfolder(folder, hour=args.hour, check_db=False)

    if args.day:
        for day in args.sources:
            daycount(day, name=args.prefix)

    if args.remove_duplicates:
        print('Checking for duplicates ...')
        for folder in args.sources:
            remove_duplicates(folder)

if __name__ == '__main__':
    main()
