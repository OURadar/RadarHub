#!/usr/bin/env python

#
#  tarsplit.py
#  Archive Migration Tool
#
#  This tool is meant for migrating datasets that were
#  collected prior to 2015 before a permanent data structure
#  was created for reduced storage and suitable for real-time
#  retrieval
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021 Boonleng Cheong.
#

import os
import glob
import time
import shutil
import tarfile
import textwrap
import argparse
import multiprocessing
import numpy as np

# Static debug flag for debugging only
debug = 0

def now():
    return time.strftime('%H:%M:%S', time.localtime())

def compress(dir, args):
    print(f'{now()} : Compressing .nc files in {dir} ...')
    cwd = os.getcwd()

    d = time.time()

    if os.path.exists(args.dest):
        os.rename(args.dest, args.dest.replace("_original", "_original_old"))
    if args.verbose:
        print(f'{now()} : Creating directory {args.dest} ...')
    os.makedirs(args.dest)

    os.chdir(dir)

    files = sorted(glob.glob('[A-Z]*.nc'))
    zfiles = [file for file in files if '-Z.nc' in file]
    infiles = []
    outfiles = []
    for file in zfiles:
        basename = os.path.basename(file)
        parts = basename.split('-')
        prefix = '-'.join(parts[:4])
        friends = [file for file in files if prefix in file]
        outfile = os.path.join(args.dest, f'{prefix}.tar.xz')
        infiles.append(friends)
        outfiles.append(outfile)

    parameters = zip(outfiles, infiles)
    with multiprocessing.Pool(args.count) as pool:
        if not args.run:
            results = pool.map(simwrite, parameters)
        else:
            if args.system:
                results = pool.map(syswrite, parameters)
            else:
                results = pool.map(write, parameters)

    os.chdir(cwd)

    d = time.time() - d

    if args.run:
        m = np.mean(results)
    else:
        m = 0.1

    print(f'{now()} : Compression time: {d:.2f}s   Average: {m:.2f}s   Files: {len(results):,d}', flush=True)

def syswrite(params):
    (outfile, infiles) = params

    d = time.time()

    sources = ' '.join(infiles)
    command = f'tar -cJf {outfile} {sources}'
    os.system(command)

    d = time.time() - d

    if debug:
        ii = ' '.join(os.path.basename(m) for m in infiles)
        outfile = outfile.replace(os.path.expanduser('~'), '~')
        print(f'{now()} : {outfile} :: {ii} :: {d:.2f}s', flush=True)

    return d

def write(params):
    (outfile, infiles) = params

    d = time.time()

    with tarfile.open(outfile, 'w|xz') as out:
        for file in infiles:
            info = tarfile.TarInfo(file)
            # info.mode = int('644', 8)
            info.size = os.path.getsize(file)
            info.mtime = time.mktime(time.strptime('-'.join(file.split('-')[1:3]), r'%Y%m%d-%H%M%S'))
            with open(file, 'rb') as fid:
                out.addfile(info, fid)

    d = time.time() - d

    if debug:
        ii = ' '.join(os.path.basename(m) for m in infiles)
        outfile = outfile.replace(os.path.expanduser('~'), '~')
        print(f'{now()} : {outfile} :: {ii} :: {d:.2f}s', flush=True)

    return d

def simwrite(params):
    (outfile, infiles) = params
    time.sleep(0.01)

    if debug:
        ii = ' '.join(os.path.basename(m) for m in infiles)
        outfile = outfile.replace(os.path.expanduser('~'), '~')
        print(f'{now()} : {outfile} :: {ii}', flush=True)

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

    if debug:
        ii = ' '.join(os.path.basename(m.name) for m in infiles)
        outfile = outfile.replace(os.path.expanduser('~'), '~')
        print(f'{now()} : {outfile} :: {ii} :: {d:.2f}s')

    return d

def simreadwrite(params):
    (outfile, infiles, _) = params

    time.sleep(0.01)

    if debug:
        ii = ' '.join(os.path.basename(m.name) for m in infiles)
        print(f'{now()} : {outfile} :: {ii}', flush=True)

    return 0.01

def splitV1(archive, args):
    print(f'Splitting {archive} into .tar.xz files ...')

    if not os.path.exists(args.dest):
        if args.verbose:
            print(f'{now()} : Creating directory {args.dest} ...')
        os.makedirs(args.dest)

    with tarfile.open(archive) as tar:
        print(f'{now()} : Reading archive contents ...')
        members = tar.getmembers()
        members = [m for m in members if os.path.basename(m.name)[:2] != '._']
        print(f'{now()} : Generating output archives ...')
        files = [m.name for m in members]
        zfiles = sorted([file for file in files if '-Z.nc' in file])
        infiles = []
        outfiles = []
        for file in zfiles:
            parts = os.path.basename(file).split('-')
            prefix = '-'.join(parts[:4])
            friends = [m for m in members if prefix in m.name]
            outfile = os.path.join(args.dest, f'{prefix}.tar.xz')
            infiles.append(friends)
            outfiles.append(outfile)

    with multiprocessing.Pool(args.count) as pool:
        parameters = zip(outfiles, infiles, [archive] * len(outfiles))
        if not args.run:
            return pool.map(simreadwrite, parameters)
        pool.map(readwrite, parameters)

def extract(archive, args):
    print(f'{now()} : Splitting {archive} into .tar.xz files ...')

    folder = os.path.expanduser('~/Downloads/_tarsplit_extracted')
    if os.path.exists(folder):
        print(f'{now()} : {folder} already exists')
        if args.run:
            os.system(f'rm -rf {folder}')
    if args.run:
        os.makedirs(folder)

    d = time.time()

    print(f'{now()} : Extracting archive contents to {folder} ...')
    if args.run:
        if args.system:
            v ='v' if args.verbose else ''
            cmd = f'tar -x{v}f {archive} -C {folder} --strip-components 1'
            if args.run:
                os.system(cmd)
            else:
                print(cmd)
        else:
            with tarfile.open(archive) as tar:
                members = tar.getmembers()
                for member in members:
                    outfile = os.path.join(folder, os.path.basename(member.name))
                    if args.verbose:
                        print(f'x {outfile}')
                    fid = tar.extractfile(member)
                    with open(outfile, 'wb') as out:
                        out.write(fid.read())

    d = time.time() - d

    print(f'{now()} : Extraction time: {d:.2f}s', flush=True)

    return folder

def extractdays(args):
    for day in args.sources:
        print(f'{now()} : {day}')
        archives = glob.glob(f'{day}/_original/*.tar.xz')
        destination = f'{day}/_extracted'

        if not os.path.exists(destination):
            os.makedirs(destination)

        d = time.time()

        count = 0
        for archive in archives:
            basename = os.path.basename(archive)
            ramfile = f'/mnt/ramdisk/{basename}'
            outfile = os.path.join(destination, basename.replace('tar.xz', 'tar'))
            shutil.copy(archive, ramfile)
            if args.verbose:
                print(f'{now()} : {archive} -> {ramfile}')
                print(f'{now()} : {outfile}')
            if args.run:
                with tarfile.open(ramfile) as source:
                    with tarfile.open(outfile, 'w') as out:
                        for file in source.getmembers():
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
                            if args.verbose > 1:
                                print(f'{now()} : {file}')
            os.remove(ramfile)
            count += 1

        d = time.time() - d

        print(f'{now()} : Extraction time: {d:.2f}s   count: {count}', flush=True)


def split(archive, args):
    folder = extract(archive, args)
    compress(folder, args)
    os.system(f'rm -rf {folder}')
    os.system(f'mv {archive} {archive}.tarsplit')

def transcode(params):
    (archive, dest) = params
    outfile = os.path.join(dest, os.path.basename(archive).replace('tgz', 'tar.xz'))
    print(f'{archive} -> {outfile}')
    with tarfile.open(archive) as source:
        with tarfile.open(outfile, 'w|xz') as out:
            for file in source.getmembers():
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

def simtranscode(params):
    (archive, dest) = params
    outfile = os.path.join(dest, os.path.basename(archive).replace('tgz', 'tar.xz'))
    print(f'{archive} -> {outfile}')

#

def main():
    parser = argparse.ArgumentParser(prog='tarsplit.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''
        Tar Archive Split Tool

        Examples:
            tarsplit.py /mnt/data/PX1000/2013/20130520/20130520.tgz
            tarsplit.py -v /mnt/data/PX1000/2013/20130520/20130520.tgz
            tarsplit.py -t /mnt/data/RaXPol/2018/20180608
        '''))
    parser.add_argument('sources', metavar='sources', type=str, nargs='+',
        help='sources to process')
    parser.add_argument('-c', dest='count', default=None,
        help='cores to use, in fraction (< 1.0) or explicity count')
    parser.add_argument('-d', dest='dest', default=None,
        help='destination of the split files')
    parser.add_argument('-e', dest='existing', action='store_true', default=False,
        help='use existing extracted folder')
    parser.add_argument('-n', dest='run', action='store_false', default=True,
        help='no true execution, just a dry run')
    parser.add_argument('-s', dest='system', action='store_true', default=False,
        help='use system call tar with --strip-components')
    parser.add_argument('-t', dest='transcode', action='store_true', default=False,
        help='transcode to .tar.xz')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    parser.add_argument('-x', dest='extractonly', action='store_true', default=False,
        help='extract only')
    parser.add_argument('--xdays', action='store_true', default=False,
        help='extract days')
    args = parser.parse_args()

    if args.count:
        f = float(args.count)
        if f < 1.0:
            args.count = int(multiprocessing.cpu_count() * f)
        else:
            args.count = int(f)
        print(f'{now()} : Using {args.count} threads ...')

    dest = args.dest

    if args.existing:
        compress(args.sources[0], args)
    elif args.extractonly:
        for source in args.sources:
            extract(source, args)
    elif args.xdays:
        extractdays(args)
    elif args.transcode:
        for day in args.sources:
            src_folder = os.path.join(day, '_original_tgz')
            dst_folder = os.path.join(day, '_original')
            if os.path.exists(src_folder) and os.path.exists(dst_folder):
                print(f'Folder {day} processed before')
                continue
            if os.path.exists(dst_folder) and not os.path.exists(src_folder):
                os.rename(dst_folder, src_folder)
                os.makedirs(dst_folder)
            archives = glob.glob(os.path.join(src_folder, '*.tgz'))
            if len(archives) == 0:
                print(f'Folder {day} has nothing to transcode')
                continue
            dest = os.path.join(day, '_original')
            if not os.path.exists(dest):
                os.makedirs(dest)
            with multiprocessing.Pool(args.count) as pool:
                parameters = zip(archives, [dest] * len(archives))
                if not args.run:
                    return pool.map(simtranscode, parameters)
                pool.map(transcode, parameters)

    else:
        for archive in args.sources:
            d = time.time()
            if dest is None:
                path = os.path.dirname(archive)
                args.dest = os.path.join(path, '_original')
            print(f'{now()} : {archive} -> {args.dest}')
            split(archive, args)
            d = time.time() - d
            print(f'{now()} : Total elapsed time: {d:,.1f}s')

#

if __name__ == '__main__':
    main()
