#!/usr/bin/env python

#
# fixnas.py
# Fix NAS Data Path
#
#  Created by Boonleng Cheong
#  Copyright (c) 2022 Boonleng Cheong.
#

import os
import sys
import glob
import argparse
import textwrap

from pathlib import Path

__prog__ = os.path.basename(sys.argv[0])

def fix_path(source, verbose=0):
    day_folder = Path(source)
    original = day_folder / '_original'
    if os.path.exists(original):
        archives = glob.glob(f'{original}/*.tar.xz')
        if len(archives):
            print(f'{original} is okay')
            return
        archives = glob.glob(f'{original}/*.tgz')
        if len(archives):
            print(f'{original} contains .tgz files')
        else:
            files = glob.glob(f'{original}/*.*')
            if len(files):
                print(f'{original} contains something else')
            else:
                print(f'{original} is empty')
    else:
        archives = glob.glob(f'{day_folder}/*.tgz')
        if len(archives):
            print(f'{day_folder} needs _original')
        else:
            print(f'{day_folder} unexpected')


#

if __name__ == '__main__':
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
        Fix data folder structure on NAS

        Examples:
            {__prog__} /mnt/data/PX1000/2013/201305*
        '''),
        epilog='Copyright (c) 2022 Boonleng Cheong')
    parser.add_argument('source', type=str, nargs='*', help='source(s) to process')
    parser.add_argument('-q', dest='quiet', action='store_true', help='runs the tool in silent mode (verbose = 0)')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + '1.0')
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0

    for source in args.source:
        fix_path(source, verbose=args.verbose)
