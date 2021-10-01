#!/usr/bin/env python

#
#  migrate.py
#  Archive Migration Tool
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021 Boonleng Cheong.
#

import os
import re
import glob
import textwrap
import argparse

def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Archive Migration Tool

        Examples:
            migrate.py
            migrate.py -d PX1000/2013/20130520
            migrate.py -v
        '''))
    parser.add_argument('-d', dest='dir', action='append', help='insert a folder')
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    timeSearch = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')
    for dir in args.dir:
        if args.verbose:
            print(f'Processing {dir} ...')
        os.chdir(dir)
        files = sorted(glob.glob(os.path.join('*Z.nc')))
        for file in files:
            basename = os.path.basename(file)
            elements = basename.split('-')
            radar = elements[0]
            scan = elements[3]
            timestr = timeSearch.search(basename).group(0)
            pattern = f'{radar}-{timestr}-{scan}-*.nc'
            files = sorted(glob.glob(pattern))
            # files = [os.path.basename(file) for file in files]
            # print(f'{pattern}  {files}')
            members = ' '.join(files)
            command = f'tar -cJf {radar}-{timestr}-{scan}.tar.xz {members}'
            print(command)
            if args.run:
                # os.system(command)
                print('run')

if __name__ == '__main__':
    main()
