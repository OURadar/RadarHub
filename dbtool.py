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
import glob
import django
import pprint
import tarfile
import argparse
import textwrap

from common import colorize

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

from frontend.models import File

def insert(filename, archive=None, offset=0, offset_data=0, size=0):
    (path, name) = os.path.split(filename)
    s = re.search(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]', name).group(0)
    datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
    if File.objects.filter(name=name):
        print(f'File {name} exists. Updating ...')
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
    print(f'{x.name} :: {x.path} :: {x.date} :: {x.size} :: {x.offset} :: {x.offset_data}')
    x.save()

def retrieve(name):
    x = File.objects.filter(name=name)
    if len(x) == 0:
        return None
    if len(x) > 1:
        print(f'There are more than one match. Choosing the first one.')
    return x[0]

def proc_archive(archive):
    print(f'Processing {archive} ...')
    with tarfile.open(archive) as aid:
        for info in aid.getmembers():
            # print(f'{info.name} {info.offset} {info.size}')
            insert(info.name, archive=archive, size=info.size, offset=info.offset, offset_data=info.offset_data)

def folder(folder):
    if os.path.exists('_original'):
        print('Listing _original ...')
    else:
        basename = os.path.basename(folder)
        print(f'basename = {basename}')
        archive = os.path.join(folder, f'{basename}.tgz')
        if os.path.exists(archive):
            proc_archive(archive)

def xzfolder(folder):
    print(f'xzfolder: {folder}')
    files = sorted(glob.glob(os.path.join(folder, '*.xz')))
    for file in files:
        proc_archive(file)

def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool

        Examples:
            dbtool.py
            dbtool.py -i /data/PX1000/2013/20130520
            dbtool.py -v
        '''))
    parser.add_argument('source', nargs='+', help='sources')
    parser.add_argument('-x', dest='xz', action='store_true', help='insert a folder with xz archives')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()


    # insert('/data/px1000/2021/20210520/_original/PX-20210520-161145-E4.0.tar.xz')

    # files = sorted(glob.glob('/mnt/data/PX1000/2013/20130520/_original/PX*'))
    # for file in files:
    #     print(file)
    #     insert(file)
    # pp.pprint(files[0])

    # print(f'args.insert = {args.insert}')
    # for path in args.insert:
    #     if os.path.isdir(path):
    #         folder(path)
    #     elif 'tgz' in path:
    #         proc_archive(path)
    
    if args.xz:
        print('Processing a folder with .tar.xz archives')
        for folder in args.source:
            xzfolder(folder)

if __name__ == '__main__':
    main()
