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

pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)

from frontend.models import File, Day
from common import colorize, color_name_value

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
    if verbose:
        show = colorize('xzfolder()', 'green')
        show += '   ' + color_name_value('folder', folder)
        show += '   ' + color_name_value('hour', hour)
        show += '   ' + color_name_value('check_db', check_db)
        show += '   ' + color_name_value('use_bulk_update', use_bulk_update)
        print(show)

    use_mp = 'linux' in sys.platform
    basename = os.path.basename(folder)
    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', basename)
    if s:
        s = s[0]
    else:
        print(f'Error searching YYYYMMDD in folder name {basename}')
        return

    raw_archives = list_files(folder)
    if len(raw_archives) == 0:
        print(f'No files in {folder}. Unable to continue.')
        return

    if not check_db:
        name = os.path.basename(raw_archives[0]).split('-')[0] + '-'
        d = check_day(s, name=name, verbose=0)
        if d:
            d = d[0]
            print(f'WARNING: There are already {d.count:,d} entries.')
            print(f'WARNING: Quick insert will result in duplicates. Try -i instead.')
            ans = input('Do you still want to continue (y/[n])? ')
            if not ans == 'y':
                print('Whew. Nothing happend.')
                return

    prefix = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    date_range = [f'{prefix} {hour:02d}:00Z', f'{prefix} 23:59:59.99Z']
    if verbose:
        show = colorize('date_range', 'orange') + colorize(' = ', 'red')
        show += '[' + colorize(date_range[0], 'yellow') + ', ' + colorize(date_range[1], 'yellow') + ']'
        print(show)

    archives = []
    for archive in raw_archives:
        basename = os.path.basename(archive)
        file_hour = int(basename.split('-')[2][0:2])
        if file_hour >= hour:
            archives.append(archive)

    keys = []
    output = {}

    # Extracting parameters of the archives
    print('Pass 1 / 2 - Scanning archives ...')

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

        for archive in tqdm.tqdm(archives):
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
        for archive in tqdm.tqdm(archives):
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
                        datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
                    else:
                        c = name.split('-')
                        d = c[1]
                        t = c[2]
                        datestr = f'{d[0:4]}-{d[4:6]}-{d[6:8]} {t[0:2]}:{t[2:4]}:{t[4:6]}Z'
                    x = File.objects.create(name=name, path=archive, date=datestr, size=size, offset=offset, offset_data=offset_data)
                if verbose > 1:
                    print(f'{mode} : {name} {offset} {offset_data} {size} {archive}')
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
            print('Pass 2 / 2 - Gathering entries ...')
            array_of_files = []
            for key in tqdm.tqdm(keys):
                xx = output[key]['xx']
                files, cc, cu, ci = __handle_data__(xx)
                array_of_files.append(files)
                count_create += cc;
                count_update += cu;
                count_ignore += ci;
            if count_create > 0 or count_update > 0:
                files = [s for symbols in array_of_files for s in symbols]
                print(f'Updating database ... {len(files)} entries')
                File.objects.bulk_update(files, ['name', 'path', 'date', 'size', 'offset', 'offset_data'], batch_size=1000)
            else:
                print('No new File entries')
            t = time.time() - t
            a = len(files) / t
            print(f'Bulk update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}')
        else:
            print('Pass 2 / 2 - Inserting entries into the database ...')
            for key in tqdm.tqdm(keys):
                xx = output[key]['xx']
                _, cc, cu, ci = __handle_data__(xx, save=True)
                count_create += cc;
                count_update += cu;
                count_ignore += ci;
            t = time.time() - t
            a = len((count_create + count_update)) / t
            print(f'Individual update {t:.2f} sec ({a:,.0f} files / sec)   c: {count_create}  u: {count_update}  i: {count_ignore}')
    else:
        def __sweep_files__(xx):
            files = []
            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                c = name.split('-')
                d = c[1]
                t = c[2]
                datestr = f'{d[0:4]}-{d[4:6]}-{d[6:8]} {t[0:2]}:{t[2:4]}:{t[4:6]}Z'
                x = File(name=name, path=archive, date=datestr, size=size, offset=offset, offset_data=offset_data)
                files.append(x)
            return files

        t = time.time()
        print('Pass 2 / 2 - Creating entries ...')
        # array_of_files = [__sweep_files__(output[key]['xx']) for key in keys]
        array_of_files = []
        for key in tqdm.tqdm(keys):
            xx = output[key]['xx']
            files = __sweep_files__(xx)
            array_of_files.append(files)
        files = [s for symbols in array_of_files for s in symbols]
        File.objects.bulk_create(files)
        t = time.time() - t
        a = len(files) / t
        print(f'Bulk create {t:.2f} sec ({a:,.0f} files / sec)')

    # Make a Day entry
    build_day(folder, verbose=verbose)

    e = time.time() - e
    a = len(archives) / e
    show = colorize(f'{e:.2f}', 'teal')
    print(f'Total elapsed time = {show} sec ({a:,.0f} files / sec)')

'''
    Build an entry to the Day table

    day - could either be a day string YYYYMMDD or a folder with the last
          part as day, e.g., /mnt/data/PX1000/2022/20220128
'''
def build_day(day, name=None, verbose=0):
    if verbose:
        show = colorize('build_day()', 'green')
        show += '   ' + color_name_value('name', name)
        print(show)

    if name is None and '/' not in day:
        print('Unable to determine name')
        return None

    if '/' in day:
        s = re.search(r'(?<=/)20[0-9][0-9][012][0-9][0-3][0-9]', day)
        files = list_files(day)
        if len(files) == 0:
            print(f'No files in {day}')
            return None
        file = os.path.basename(files[0])
        name = file.split('-')[0] + '-'
    else:
        s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', day)
    if s:
        s = s.group(0)
    else:
        print(f'Error. Unble to determine the date from {day}')
        return None

    date = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'

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
        date_range = [f'{date} {k:02d}:00:00Z', f'{date} {k:02d}:59:59.9Z']
        matches = File.objects.filter(name__startswith=name, name__endswith='-Z.nc', date__range=date_range)
        counts[k] = matches.count()
        total += counts[k]

    if total > 0:
        d.count = total
        d.duration = d.count * 20
        d.hourly_count = ','.join([str(c) for c in counts])
        d.save()
    elif mode == 'U' and total == 0:
        mode = 'D'
        d.delete()
        d = None
    else:
        mode = 'I'

    if verbose:
        if mode == 'N':
            d = Day.objects.filter(date=date, name=name).first()
        print(f'{mode} {d.show()}')

    return d, mode

'''
    Check an entry from the Day table

    day - could either be a day string YYYYMMDD or a folder with the last
          part as day, e.g., /mnt/data/PX1000/2022/20220128
'''
def check_day(day, name=None, verbose=0):
    if verbose:
        show = colorize('check_day()', 'green')
        show += '   ' + color_name_value('day', day)
        show += '   ' + color_name_value('name', name)
        print(show)
    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', os.path.basename(day))
    if s:
        s = s.group(0)
    else:
        print(f'Unable to parse date string from input = {day}')
        return None
    date = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    if name:
        dd = Day.objects.filter(name=name, date=date)
    else:
        dd = Day.objects.filter(date=date)
    if len(dd):
        for d in dd:
            print(f'R {d.show()}')
    else:
        return None
    return dd

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
    print(show)
    c = source.split('-')
    p = c[0] + '-'
    if len(c) > 2:
        timestr = '-'.join(c[1:3])
        if len(c) > 4:
            s = c[4]
        else:
            s = 'Z'
        t = time.strptime(timestr, '%Y%m%d-%H%M%S')
        t = time.strftime('%Y-%m-%d %H:%M:%SZ', t)
        o = File.objects.filter(date=t).filter(name__startswith=p).filter(name__endswith=f'-{s}.nc')
        if o:
            o = o[0]
        else:
            print(f'Source {source} not found')
            return
    else:
        print(f'Retrieving last entry with prefix = {p} ...')
        o = File.objects.filter(name__startswith=p).last()
    print(o.__repr__())
    sweep = o.read()
    pp.pprint(sweep)

'''
    Finds duplicate entries

     folder - path with YYYYMMDD, e.g., '/mnt/data/PX1000/2022/20220117', '20220127
     prefix - prefix of the file names, e.g., 'PX10K-', 'PX-', 'RAXPOL-'
     remove - remove entries > 1 if set to True
    verbose - verbosity level, e.g., 0, 1, or 2
'''
def find_duplicates(folder, prefix=None, remove=False, verbose=0):
    if verbose:
        show = colorize('find_duplicates()', 'green')
        show += '   ' + color_name_value('folder', folder)
        show += '   ' + color_name_value('remove', remove)
        print(show)

    s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', os.path.basename(folder)).group(0)
    e = time.localtime(time.mktime(time.strptime(s[:8], '%Y%m%d')) + 86400)
    day0 = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'
    day1 = time.strftime('%Y-%m-%d', e)
    date_range = [f'{day0} 00:00Z', f'{day1} 00:00Z']

    if verbose:
        show = colorize('date_range', 'orange') + colorize(' = ', 'red')
        show += '[' + colorize(date_range[0], 'yellow') + ', ' + colorize(date_range[1], 'yellow') + ']'
        print(show)

    if prefix:
        entries = File.objects.filter(date__range=date_range, name__startswith=prefix)
    else:
        entries = File.objects.filter(date__range=date_range)

    names = [file.name for file in entries]

    if len(names) == 0:
        print('No match')
        return

    count = 0;
    for name in tqdm.tqdm(names):
        if names.count(name) == 1:
            continue
        x = entries.filter(name=name)
        print(f'{name} has {len(x)} entries')
        for o in x[1:]:
            if verbose > 1:
                print(o.__repr__())
            if remove:
                count += 1
                o.delete()

    if count:
        print(f'Removed {count} files')

'''
    Check for latest entries from each radar
'''
def check_latest():
    show = colorize('check_latest()', 'green')
    print(show)
    for name in ['PX-', 'PX10K-', 'RAXPOL-']:
        day = Day.objects.filter(name=name).latest('date')
        last = day.last_date_range()
        file = File.objects.filter(name__startswith=name, date__range=last).latest('date')
        show = color_name_value('last[0]', last[0])
        show += '   ' + color_name_value('name', file.name)
        print(show)

#

def dbtool_main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool

        Examples:
            dbtool.py
            dbtool.py -i /data/PX1000/2013/20130520
            dbtool.py -i /data/PX1000/2013/201305*
            dbtool.py -d 20130520
            dbtool.py -s
            dbtool.py -s RAXPOL-
            dbtool.py -s PX-20130520-191000
            dbtool.py --last
            dbtool.py --prefix PX- --latest
            dbtool.py -c 20220127
            dbtool.py -v --find-duplicates 20220127
            dbtool.py -v --find-duplicates --remove 20220127
        '''))
    parser.add_argument('source', type=str, nargs='*', help='source(s) to process')
    parser.add_argument('-b', dest='hour', default=0, type=int, help='sets beginning hour of the day to catalog')
    parser.add_argument('-c', dest='check_day', action='store_true', help='checks a Day table of the day')
    parser.add_argument('-d', dest='day', action='store_true', help='builds a Day table of the day')
    parser.add_argument('-f', '--find-duplicates', action='store_true', help='finds duplicate entries in the database')
    parser.add_argument('-i', dest='insert', action='store_true', help='inserts a folder')
    parser.add_argument('-I', dest='quick_insert', action='store_true', help='inserts (without check) a folder')
    parser.add_argument('-l', '--latest', action='store_true', help='shows the latest entries of each radar')
    parser.add_argument('--last', action='store_true', help='shows the last entry to the database')
    parser.add_argument('--prefix', help='sets the radar prefix to process')
    parser.add_argument('--remove', action='store_true', help='removes entries when combined with --find-duplicates')
    parser.add_argument('-s', dest='sweep', action='store_true', help='reads a sweep shows a summary')
    parser.add_argument('-v', dest='verbose', default=0, action='count', help='increases verbosity')
    args = parser.parse_args()

    if '*' in args.source:
        print('Expanding asterisk ...')
        args.source = glob.glob(args.source)
        if len(args.source) == 0:
            print('No match')
            return
        print(args.source)

    if args.latest:
        check_latest()
        return

    if args.last:
        print('Retrieving the last entry ...')
        o = File.objects.last()
        print(o.__repr__())
        return

    if args.sweep:
        if len(args.source) == 0:
            if args.prefix is None:
                print(f'Retrieving latest sweep ...')
                o = File.objects.last()
            else:
                print(f'Retrieving latest sweep with prefix={args.prefix} ...')
                o = File.objects.filter(name__startswith=args.prefix).last()
            print(o.__repr__())
            sweep = o.read()
            pp.pprint(sweep)
        else:
            for source in args.source:
                show_sweep_summary(source)
        return

    if args.insert:
        print('Inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            print(f'===\n{folder}')
            xzfolder(folder, hour=args.hour, check_db=True, verbose=args.verbose)
        return
    elif args.quick_insert:
        print('Quick inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            print(f'===\n{folder}')
            xzfolder(folder, hour=args.hour, check_db=False, verbose=args.verbose)
        return

    if args.find_duplicates:
        print(f'Finding duplicates ...')
        for folder in args.source:
            find_duplicates(folder, prefix=args.prefix, remove=args.remove, verbose=args.verbose)
        return

    if args.day:
        for day in args.source:
            build_day(day, name=args.prefix, verbose=args.verbose)
        return

    # The rest of the functions use args.prefix = 'PX-' if not specified

    if args.prefix is None:
        args.prefix = 'PX-'

    if args.check_day:
        for day in args.source:
            d = check_day(day, name=args.prefix, verbose=args.verbose)
            if d is None:
                print(f'Nothing for {day}')
        return

    print("Don't want anything?")

###

if __name__ == '__main__':
    dbtool_main()
