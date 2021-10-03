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

import multiprocessing
import os
import glob
import time
import tarfile
import textwrap
import argparse

import multiprocessing

def compress(dir, args):
    print(f'Compressing .nc files in {dir} ...')
    os.chdir(dir)
    if args.dest is None:
        dest = '_original'
    else:
        dest = args.dest

    if not os.path.exists(dest):
        print(f'Creating directory {dest} ...')
        os.makedirs(dest)

    files = sorted(glob.glob('[A-Z]*.nc'))
    zfiles = [file for file in files if '-Z.nc' in file]
    infiles = []
    outfiles = []
    for file in zfiles:
        basename = os.path.basename(file)
        parts = basename.split('-')
        prefix = '-'.join(parts[:4])
        friends = [file for file in files if prefix in file]
        outfile = os.path.join(dest, f'{prefix}.tar.xz')
        infiles.append(friends)
        outfiles.append(outfile)

        # command = f'tar -cJf {prefix}.tar.xz {friends}'
        # print(command)
    
    with multiprocessing.Pool(args.count) as pool:
        parameters = zip(outfiles, infiles)
        if not args.run:
            return pool.map(simwrite, parameters)
        pool.map(write, parameters)

def write(params):
    (outfile, infiles) = params
    d = time.time()
    with tarfile.open(outfile, 'w|xz') as out:
        for file in infiles:
            # fid = open(file, 'rb')
            info = tarfile.TarInfo(file)
            info.size = os.path.getsize(file)
            with open(file, 'rb') as fid:
                out.addfile(info, fid)
    d = time.time() - d
    ii = ' '.join(os.path.basename(m) for m in infiles)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii} :: {d:.2f}s', flush=True)

def simwrite(params):
    (outfile, infiles) = params
    ii = ' '.join(os.path.basename(m) for m in infiles)
    time.sleep(0.01)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii}', flush=True)

def readwrite(params):
    (outfile, infiles, archive) = params
    d = time.time()
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
    d = time.time() - d
    ii = ' '.join(os.path.basename(m.name) for m in infiles)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii} :: {d:.2f}s')

def simreadwrite(params):
    (outfile, infiles, _) = params
    ii = ' '.join(os.path.basename(m.name) for m in infiles)
    time.sleep(0.01)
    print(f'{outfile} :: {ii}', flush=True)

def split(archive, args):
    print(f'Splitting {archive} into .tar.xz files ...')
    if args.dest is None:
        path = os.path.dirname(archive)
        dest = os.path.join(path, '_original')
    else:
        dest = args.dest

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
            outfile = os.path.join(dest, f'{prefix}.tar.xz')
            infiles.append(friends)
            outfiles.append(outfile)

    with multiprocessing.Pool(args.count) as pool:
        parameters = zip(outfiles, infiles, [archive] * len(outfiles))
        if not args.run:
            return pool.map(simreadwrite, parameters)
        pool.map(readwrite, parameters)

#

def main():
    parser = argparse.ArgumentParser(prog='tarsplit.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''
        Tar Archive Split Tool

        Examples:
            tarsplit.py /mnt/data/PX1000/2013/20130520/20130520.tgz
            tarsplit.py -v /mnt/data/PX1000/2013/20130520/20130520.tgz
        '''))
    parser.add_argument('sources', metavar='sources', type=str, nargs='+',
        help='sources to process')
    parser.add_argument('-c', dest='count', default=None,
        help='cores to use, in fraction (< 1.0) or explicity count')
    parser.add_argument('-d', dest='dest', default=None,
        help='destination of the split files')
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    args = parser.parse_args()

    if args.count:
        f = float(args.count)
        if f < 1.0:
            args.count = int(multiprocessing.cpu_count() * f)
        else:
            args.count = int(f)
        print(f'Using {args.count} threads ...')

    # for archive in args.sources:
    #     split(archive, args)

    for dir in args.sources:
        compress(dir, args)

    # if args.dirs:
    #     compress(args.dir, args.verbose, args.run)

if __name__ == '__main__':
    main()
