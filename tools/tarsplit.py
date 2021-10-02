#!/usr/bin/env python

#
#  tarsplit.py
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
import time
import tarfile
import textwrap
import argparse

from multiprocessing import Pool

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

def readwrite(params):
    (outfile, infiles, archive) = params
    ii = ', '.join(os.path.basename(m.name) for m in infiles)
    print(f'{outfile} {ii} {archive}')
    with tarfile.open(archive) as source:
        with tarfile.open(outfile, 'w|xz') as out:
            for file in infiles:
                fid = source.extractfile(file)
                info = tarfile.TarInfo(os.path.basename(file.name))
                info.size = file.size
                info.mode = file.mode
                info.type = file.type
                info.mtime = file.mtime
                info.uname = file.uname
                info.gname = file.gname
                info.uid = file.uid
                info.gid = file.gid
                out.addfile(info, fid)

def split(archive, args):
    print(f'Splitting {archive} into .tar.xz files ...')
    (path, name) = os.path.split(archive)
    dest = os.path.join(path, '_original')
    if not os.path.exists(dest):
        print(f'Creating directory {dest} ...')
        os.makedirs(dest)
    with tarfile.open(archive) as tar:
        print(f'Reading archive contents ...')
        members = tar.getmembers()
        members = [m for m in members if os.path.basename(m.name)[:2] != '._']
        print(f'Generating output archives ...')
        files = [m.name for m in members]
        zfiles = sorted([file for file in files if '-Z.nc' in file])
        infiles = []
        outfiles = []
        for file in zfiles:
            parts = os.path.basename(file).split('-')
            prefix = '-'.join(parts[:4])
            friends = [m for m in members if prefix in m.name]
            outfile = os.path.join(path, '_original', f'{prefix}.tar.xz')
            infiles.append(friends)
            outfiles.append(outfile)
    if not args.run:
        for line in zip(outfiles, infiles):
            i = ', '.join(os.path.basename(m.name) for m in line[1])
            print(f'{line[0]} :: {i}')
        return
    with Pool() as pool:
        pool.map(readwrite, zip(outfiles, infiles, [archive] * len(outfiles)))


def main():
    parser = argparse.ArgumentParser(prog='tarsplit.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Tar Archive Split Tool

        Examples:
            tarsplit.py /mnt/data/PX1000/2013/20130520/20130520.tgz
            tarsplit.py -v /mnt/data/PX1000/2013/20130520/20130520.tgz
        '''))
    parser.add_argument('sources', metavar='sources', type=str, nargs='+',
        help='sources to process')
    #parser.add_argument('-d', dest='dirs', action='append', help='insert a folder')
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    for archive in args.sources:
        split(archive, args)

    # if args.dirs:
    #     compress(args.dir, args.verbose, args.run)

if __name__ == '__main__':
    main()
