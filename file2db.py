#!/usr/bin/env python

#
#  file2db.py
#  File to Database
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2022 Boonleng Cheong.
#

__version__ = '1.0'

import os
import re
import sys
import time
import django
import select
import signal
import socket
import tarfile
import argparse
import datetime
import textwrap
import setproctitle

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()

import dbtool
import dailylog

from frontend.models import File, Day
from common import colorize, color_name_value

keepReading = True
radars = {
    'PX-': {
        'folder': 'PX1000',
        'count': 0
    },
    'RAXPOL-': {
        'folder': 'RaXPol',
        'count': 0
    },
    'PX10K-': {
        'folder': 'PX10k',
        'count': 0
    }
}
pattern = re.compile(r'(?<=-)20[0-9][0-9][012][0-9][0-3][0-9]-[012][0-9][0-5][0-9][0-5][0-9]')
logger = dailylog.Logger('file2db')

def signalHandler(sig, frame):
    global keepReading
    keepReading = False
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')

def proper(file, root='/mnt/data'):
    basename = os.path.basename(file)
    c = basename.split('-')
    d = c[1]
    prefix = c[0] + '-'
    if prefix in radars:
        sub = radars[prefix]['folder']
    else:
        logger.warning(f'Radar {prefix} not recognized.')
        return None
    dayTree = f'{d[0:4]}/{d}'
    return f'{root}/{sub}/{dayTree}/_original/{basename}'

def catchup(file, root='/mnt/data'):
    logger.info(colorize('catchup()', 'green'))
    logger.info(color_name_value('file', file))
    basename = os.path.basename(file)
    c = basename.split('-')
    d, t = c[1], c[2]
    prefix = c[0] + '-'
    datestr = f'{d[0:4]}-{d[4:6]}-{d[6:8]} {t[0:2]}:{t[2:4]}:{t[4:6]}Z'
    day = Day.objects.filter(name=prefix).latest('date')
    hour = day.last_hour()
    if prefix in radars:
        sub = radars[prefix]['folder']
        folder = f'{root}/{sub}'
    else:
        logger.warning(f'Radar {prefix} not recognized.')
        return

    date = day.date
    filedate = datetime.date(int(d[0:4]), int(d[4:6]), int(d[6:8]))
    while date <= filedate:
        dayTree = date.strftime('%Y/%Y%m%d')
        dayFolder = f'{folder}/{dayTree}'
        logger.info(color_name_value('folder', dayFolder) + '   ' + color_name_value('hour', hour))
        dbtool.xzfolder(dayFolder, hour, verbose=0)
        date += datetime.timedelta(days=1)
        hour = 0

def process(file):
    global radars
    logger.info(colorize(file, 43))
    basename = os.path.basename(file)
    c = basename.split('-')
    prefix = c[0] + '-'
    if prefix not in radars:
        logger.info(f'{basename} skipped')
        return
    if radars[prefix]['count'] == 0:
        catchup(file)
    radars[prefix]['count'] += 1

    archive = proper(file)
    s = pattern.search(archive).group(0)
    date = f'{s[0:4]}-{s[4:6]}-{s[6:8]}'

    with tarfile.open(archive) as tar:
        for info in tar.getmembers():
            file = File.objects.filter(name=info.name)
            if file:
                logger.debug(file)
            else:
                logger.debug(f'N {info.name}')
                datestr = f'{s[0:4]}-{s[4:6]}-{s[6:8]} {s[9:11]}:{s[11:13]}:{s[13:15]}Z'
                file = File(name=info.name, path=archive, date=datestr, size=info.size, offset=info.offset, offset_data=info.offset_data)
                file.save()

    day, mode = dbtool.build_day(s[:8], name=prefix, verbose=0)
    logger.info(f'{mode} {day.show()}')

def listen(host='10.197.14.59', port=9000):
    global keepReading
    keepReading = True
    while keepReading:
        # Open a socket to connect FIFOShare
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.connect((host, port))
        except:
            logger.info('fifoshare server not available')
            k = 5
            while k > 0:
                # logger.debug('Try again in {} second{} ... '.format(k, 's' if k > 1 else ''), end='\r')
                sornos = 's' if k > 1 else ''
                print(f'Try again in {k} second{sornos} ... ', end='\r')
                time.sleep(1.0)
                k -= 1
            continue
        sock.setblocking(0)
        logger.info('fifoshare connection established')

        # day = time.localtime(time.time()).tm_mday
        localMemory = b''

        while keepReading:
            # Check if the socket is ready to read
            readyToRead, _, selectError = select.select([sock], [], [sock], 0.1)
            if selectError:
                # logger.warning('Error in select() {}'.format(selectError))
                logger.error(f'Error in select() {selectError}')
                break
            elif readyToRead:
                try:
                    r = sock.recv(1024)
                    logger.debug('recv() -> {}'.format(r))
                except:
                    logger.warning('Connection interrupted.')
                    break
                if not r:
                    logger.debug('Connection closed.')
                    break;
            else:
                continue

            # Concatenate the received string into local memory and consume it
            localMemory += r
            files = localMemory.decode('ascii').split('\n')
            localMemory = files[-1].encode('utf')
            logger.debug('files = {}'.format(files))

            for file in files[:-1]:
                # At this point, the filename is considered good
                file = os.path.expanduser(file)

                # Read in the sweep based on the known patterns: .nc, _V06, etc.
                process(file)

        # Out of the second keepReading loop. Maybe there was an error in select(), close and retry
        sock.close()
        print('FIFOShare connection terminated')
        if keepReading:
            k = 50
            while k > 0 and keepReading:
                time.sleep(0.1)
                k -= 1

def file2db():
    parser = argparse.ArgumentParser(prog='file2db.py',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        File to Database

        Examples:
            file2db.py -v
            file2db.py -v 10.197.14.59
        '''))
    parser.add_argument('host', type=str, nargs='?', help='host to connect')
    parser.add_argument('-p', dest='port', default=9000, help='sets the port (default = 9000)')
    parser.add_argument('-v', dest='verbose', default=0, action='count', help='increases verbosity')
    args = parser.parse_args()

    # Populate the default host if not specified
    if args.host is None:
        args.host = '10.197.14.59'
    logger.info(color_name_value('host', args.host))

    if args.verbose:
        if args.verbose > 1:
            logger.setLevel(dailylog.logging.DEBUG)
        logger.showLogOnScreen()

    # Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    listen(args.host, port=args.port)

    logger.info('--- Finished ---')

###

if __name__ == '__main__':
    setproctitle.setproctitle(os.path.basename(sys.argv[0]))
    file2db()
