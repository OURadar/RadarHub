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
import glob
import time
import tarfile
import textwrap
import argparse
import multiprocessing
import numpy as np

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
   
    d = time.time()

    parameters = zip(outfiles, infiles)
    with multiprocessing.Pool(args.count) as pool:
        if not args.run:
            results = pool.map(simwrite, parameters)
        else:
            if args.system:
                results = pool.map(syswrite, parameters)
            else:
                results = pool.map(write, parameters)

    d = time.time() - d

    print(f'{len(results)} {np.mean(results)}')
    print(f'Total elapsed time: {d:.2f}s', flush=True)

def syswrite(params):
    (outfile, infiles) = params

    d = time.time()

    sources = ' '.join(infiles)
    command = f'tar -cJf {outfile} {sources}'
    os.system(command)

    d = time.time() - d

    ii = ' '.join(os.path.basename(m) for m in infiles)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii} :: {d:.2f}s', flush=True)
    return d

def write(params):
    (outfile, infiles) = params

    d = time.time()

    with tarfile.open(outfile, 'w|xz') as out:
        for file in infiles:
            info = tarfile.TarInfo(file)
            info.size = os.path.getsize(file)
            with open(file, 'rb') as fid:
                out.addfile(info, fid)

    d = time.time() - d

    ii = ' '.join(os.path.basename(m) for m in infiles)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii} :: {d:.2f}s', flush=True)
    return d

def simwrite(params):
    (outfile, infiles) = params
    ii = ' '.join(os.path.basename(m) for m in infiles)
    time.sleep(0.01)
    outfile = outfile.replace(os.path.expanduser('~'), '~')
    print(f'{outfile} :: {ii}', flush=True)
    return 0.01

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

def split2(archive, args):
    print(f'Splitting {archive} into .tar.xz files ...')

    folder = os.path.expanduser('~/Downloads/_extracted')
    if os.path.exists(folder):
        print(f'{folder} already exists')
        os.system(f'rm -rf {folder}')
    os.makedirs(folder)

    d = time.time()

    print(f'Extracting archive contents to {folder} ...')
    if args.system:
        v ='v' if args.verbose > 1 else ''
        os.system(f'tar -x{v}f {archive} -C {folder} --strip-components 1')
    else:
        with tarfile.open(archive) as tar:
            members = tar.getmembers()
            for member in members:
                outfile = os.path.join(folder, os.path.basename(member.name))
                if args.verbose > 1:
                    print(f'x {outfile}')
                fid = tar.extractfile(member)
                with open(outfile, 'wb') as out:
                    out.write(fid.read())

    d = time.time() - d

    print(f'Total elapsed time: {d:.2f}s', flush=True)

    compress(folder, args)

    os.system(f'rm -rf {folder}')

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
    parser.add_argument('-e', dest='extracted', default=None,
        help='use existing extracted folder')    
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-s', dest='system', action='store_true', default=False,
        help='use system call tar with --strip-components')
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

    if args.extracted:
        compress(os.path.expanduser('~/Downloads/_extracted'), args)
    else:
        for archive in args.sources:
            split2(archive, args)



if __name__ == '__main__':
    main()
