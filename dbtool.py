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
from common import colorize, show_variable

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


def xzfolder(folder, hour=0, check_db=True, verbose=0):
    if verbose:
        show = colorize('xzfolder()', 'green')
        show += '   ' + show_variable('folder', folder)
        show += '   ' + show_variable('hour', hour)
        show += '   ' + show_variable('check_db', check_db)
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
                shutil.copy(archive, ramfile)
                task_queue.put({'archive': archive, 'ramfile': ramfile})
            else:
                task_queue.put({'archive': archive, 'ramfile': archive})
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

    print('Pass 2 / 2 - Inserting entries into the database ...')

    # Consolidating results
    keys = sorted(keys)

    if check_db:
        entries = File.objects.filter(date__range=date_range)
        pattern = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')

        def handle_data(xx, use_re_pattern=False):
            files = []
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
                    else:
                        mode = 'I'
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
                files.append(x)
            return files
        
        # for key in tqdm.tqdm(keys):
        #     xx = output[key]['xx']
        #     handle_data(xx)

        # Wish there is a bulk update-create in one
        t = time.time()
        array_of_files = [handle_data(output[key]['xx']) for key in keys]
        files = [s for symbols in array_of_files for s in symbols]
        File.objects.bulk_update(files, ['name', 'path', 'date', 'size', 'offset', 'offset_data'])
        t = time.time() - t
        a = len(files) / t
        print(f'Bulk update {t:.2f} sec ({a:,.0f} files / sec)')

    else:
        def sweep_files(xx):
            files = []
            for yy in xx:
                (name, offset, offset_data, size, archive) = yy
                c = name.split('-')
                d = c[1]
                t = c[2]
                datestr = f'{d[0:4]}-{d[4:6]}-{d[6:8]} {t[0:2]}:{t[2:4]}:{t[4:6]}Z'
                x = File.objects.File(name=name, path=archive, date=datestr, size=size, offset=offset, offset_data=offset_data)
                files.append(x)
            return files

        t = time.time()
        array_of_files = [sweep_files(output[key]['xx']) for key in keys]
        files = [s for symbols in array_of_files for s in symbols]
        File.objects.bulk_create(files)
        t = time.time() - t
        a = len(files) / t
        print(f'Bulk create {t:.2f} sec ({a:,.0f} files / sec)')

    # Make a Day entry
    build_day(folder)

    e = time.time() - e
    a = len(archives) / e
    show = colorize(f'{e:.2f}', 'teal')
    print(f'Total elapsed time = {show} sec ({a:,.0f} files / sec)')

'''
    day - could either be a day string YYYYMMDD or a folder with the last
          part as day, e.g., /mnt/data/.../YYYYMMDD
'''
def build_day(day, name='PX-', verbose=0):
    if verbose:
        show = colorize('build_day()', 'green')
        show += '   ' + show_variable('name', name)
        print(show)

    if name is None:
        print('Name cannot be None')
        return

    if '/' in day:
        s = re.search(r'(?<=/)20[0-9][0-9][012][0-9][0-3][0-9]', day)
        file = os.path.basename(list_files(day)[0])
        name = file.split('-')[0] + '-'
    else:
        s = re.search(r'20[0-9][0-9][012][0-9][0-3][0-9]', day)
    if s:
        s = s.group(0)
    else:
        print(f'Error. Unble to determine the date from {day}')
        return

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
        date_range = [f'{date} {k:02d}:00Z', f'{date} {k:02d}:59Z']
        matches = File.objects.filter(name__startswith=name, name__endswith='-Z.nc', date__range=date_range)
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

    print(f'{mode} {d.show()}')

def check_day(day, name=None, verbose=0):
    if verbose:
        show = colorize('check_day()', 'green')
        show += '   ' + show_variable('day', day)
        show += '   ' + show_variable('name', name)
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

def show_sweep_summary(timestr):
    show = colorize('show_sweep_summary()', 'green')
    show += '   ' + show_variable('timestr', timestr)
    print(show)
    t = time.strptime(timestr, '%Y%m%d-%H%M%S')
    t = time.strftime('%Y-%m-%d %H:%M:%SZ', t)
    o = File.objects.filter(date=t).filter(name__endswith='-Z.nc')
    if o:
        o = o[0]
    else:
        print('Time stamp not found')
        return
    print(o.__repr__())
    sweep = o.getData()
    pp.pprint(sweep)

def find_duplicates(folder, prefix=None, remove=False, verbose=0):
    if verbose:
        show = colorize('find_duplicates()', 'green')
        show += '   ' + show_variable('folder', folder)
        show += '   ' + show_variable('remove', remove)
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
            dbtool.py -s 20130520-191000
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
    parser.add_argument('--last', action='store_true', help='shows the last entry to the database')
    parser.add_argument('--latest', action='store_true', help='shows the latest entry, requires --prefix')
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
        show = show_variable('prefix', args.prefix)
        print(f'Retrieving the latest entry ... {show} ...')
        if args.prefix is None:
            o = File.objects.latest('date')
        else:
            o = File.objects.filter(name__startswith=args.prefix).latest('date')
        print(o.__repr__())
        return

    if args.last:
        print('Retrieving the last entry ...')
        o = File.objects.last()
        print(o.__repr__())
        return

    if args.sweep:
        e = time.time()
        for timestr in args.source:
            show_sweep_summary(timestr)

    if args.insert:
        print('Inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            print('===')
            xzfolder(folder, hour=args.hour, check_db=True, verbose=args.verbose)
    elif args.quick_insert:
        print('Quick inserting folder(s) with .tar.xz archives')
        for folder in args.source:
            print('===')
            xzfolder(folder, hour=args.hour, check_db=False, verbose=args.verbose)

    if args.find_duplicates:
        print(f'Finding duplicates ...')
        for folder in args.source:
            find_duplicates(folder, prefix=args.prefix, remove=args.remove, verbose=args.verbose)

    # The rest of the functions use args.prefix = 'PX-' if not specified

    if args.prefix is None:
        args.prefix = 'PX-'

    if args.day:
        for day in args.source:
            build_day(day, name=args.prefix, verbose=args.verbose)

    if args.check_day:
        for day in args.source:
            d = check_day(day, name=args.prefix, verbose=args.verbose)
            if d is None:
                print(f'Nothing for {day}')

if __name__ == '__main__':
    dbtool_main()
