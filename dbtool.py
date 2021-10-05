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
import django
import pprint
import tarfile
import argparse
import textwrap

from multiprocessing import Pool

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

from frontend.models import File, Day

verbose = 1

def insert(filename, archive=None, offset=0, offset_data=0, size=0, verbose=0):
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
    if verbose > 1:
        print(f'{mode} {x.name} :: {x.path} :: {x.date} :: {x.size} :: {x.offset} :: {x.offset_data}')
        sys.stdout.flush()
    x.save()

def retrieve(name):
    x = File.objects.filter(name=name)
    if len(x) == 0:
        return None
    if len(x) > 1:
        print(f'There are more than one match. Choosing the first one.')
    return x[0]

def proc_archive(archive):
    if verbose:
        print(f'Processing {archive} ...')
    with tarfile.open(archive) as aid:
        for info in aid.getmembers():
            insert(info.name, archive=archive, offset=info.offset, offset_data=info.offset_data, size=info.size)

def listfiles(folder):
    files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    if len(files) == 0:
        folder = os.path.join(folder, '_original')
        files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    return files

def xzfolder(folder):
    print(f'xzfolder: {folder}')
    files = listfiles(folder)
    if len(files) == 0:
        print('Unable to continue.')
        return
    with Pool() as pool:
        pool.map(proc_archive, files)

def daycount(folder):
    print(f'daycount: {folder}')
    files = listfiles(folder)
    if len(files) == 0:
        print('Unable to continue.')
        return
    s = re.search(r'(?<=/)20[0-9][0-9][012][0-9][0-3][0-9]', folder).group(0)
    date = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'

    mode = 'N'
    if Day.objects.filter(date=date):
        mode = 'U'
        d = Day.objects.filter(date=date)[0]
    else:
        d = Day(date=date)

    total = 0
    counts = [0] * 24
    for k in range(24):
        dateRange = [f'{date} {k:02d}:00Z', f'{date} {k:02d}:59Z']
        counts[k] = len(File.objects.filter(name__contains='-Z.nc', date__range=dateRange))
        total += counts[k]

    d.count = total
    d.duration = d.count * 20
    d.hourly_count = ','.join([str(c) for c in counts])
    d.save()

    if verbose > 1:
        print(f'{mode} {d.date} :: {d.duration:,d} :: {d.hourly_count}')
        sys.stdout.flush()

#

def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool

        Examples:
            dbtool.py
            dbtool.py -x /data/PX1000/2013/20130520/_original
            dbtool.py -v
        '''))
    parser.add_argument('sources', type=str, nargs='+',
        help='sources to process')
    parser.add_argument('-d', dest='day', action='store_true', help='builds Day table')
    parser.add_argument('-x', dest='xz', action='store_true', help='inserts a folder with xz archives')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    global verbose
    verbose = args.verbose

    if args.xz:
        print('Processing a folder with .tar.xz archives')
        for folder in args.sources:
            xzfolder(folder)

    if args.day:
        print('Building Day table ...')
        for folder in args.sources:
            daycount(folder)

if __name__ == '__main__':
    main()
