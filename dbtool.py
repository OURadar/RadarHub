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
# import tar
import django
import pprint
import argparse
import textwrap

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

from frontend.models import File

def insert(filename):
    (path, name) = os.path.split(filename)
    print(f'path = {path}   name = {name}')
    s = re.search(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]', name).group(0)
    datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
    x = File(name=name, path=path, date=datestr)
    print(f'X -> {x.name} :: {x.path} :: {x.date}')
    # x.save()

def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Database Tool
        
        Examples:
            dbtool.py
            dbtool.py -v
        '''))
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    # xs = File.objects.all()
    files = File.objects.filter(date__gte='2017-01-01 00:00Z').filter(date__lte='2018-12-31 23:59Z')

    # x = File(name='PX-20210520-160000', path='/Volumes/data/px1000/', date='2021-05-20 16:00:00Z')
    # x.save()

    insert('/data/px1000/2021/20210520/_original/PX-20210520-161145-E4.0.tar.xz')

    # pp.pprint(files[0])

if __name__ == '__main__':
    main()
