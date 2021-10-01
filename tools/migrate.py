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
import tarfile
import textwrap
import argparse

def compress(dirs, verbose=0, run=False):
    timeSearch = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')
    for dir in dirs:
        if verbose:
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
            if run:
                # os.system(command)
                print('run')

def split(archive, verbose=0):
    print(f'Splitting {archive} into .tar.xz files ...')
    (path, name) = os.path.split(archive)
    dest = os.path.join(path, '_original')
    if not os.path.exists(dest):
        print(f'Creating directory {dest} ...')
        os.makedirs(dest)
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        files = sorted([m.name for m in members])
        zfiles = sorted([file for file in files if '-Z.nc' in file])
        for file in zfiles[:2]:
            parts = os.path.basename(file).split('-')
            prefix = '-'.join(parts[:4])
            friends = [m for m in members if prefix in m.name]
            outfile = os.path.join(path, '_original', f'{prefix}.tar.xz')
            # print(f'{outfile} :: {friends}')
            if verbose:
                print(f'outfile = {outfile} {[os.path.basename(f.name) for f in friends]}')
            with tarfile.open(outfile, 'w|xz') as out:
                for friend in friends:
                    fid = tar.extractfile(friend)
                    info = tarfile.TarInfo(os.path.basename(friend.name))
                    info.size = friend.size
                    info.mode = friend.mode
                    info.type = friend.type
                    info.mtime = friend.mtime
                    info.uname = friend.uname
                    info.gname = friend.gname
                    info.uid = friend.uid
                    info.gid = friend.gid
                    out.addfile(info, fid)


def main():
    parser = argparse.ArgumentParser(prog='dbtool.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Archive Migration Tool

        Examples:
            migrate.py
            migrate.py -o /mnt/data/PX1000/2013/20130520/20130520.tgz
            migrate.py -v
        '''))
    parser.add_argument('sources', metavar='sources', type=str, nargs='+',
        help='sources to process')
    parser.add_argument('-s', dest='split', action='store_true', default=False,
        help='splits a large archive into smaller .tar.xz files')
    parser.add_argument('-d', dest='dirs', action='append', help='insert a folder')
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    if args.split:
        print('Split mode')
        for dir in args.sources:
            split(dir, args.verbose)

    if args.dirs:
        compress(args.dir, args.verbose, args.run)

if __name__ == '__main__':
    main()
