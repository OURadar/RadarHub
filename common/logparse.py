#!/usr/bin/env python

#
#  Parse the nginx access log at /var/log/nginx/access.log when the suggested custom
#  format is used, which was recorded in the README.md
#
#  /etc/nginx/nginx.conf
#
#  ##
#  # Logging Settings
#  ##
#
#  log_format custom '$http_x_forwarded_for [$time_local] "$request" $status $body_bytes_sent '
#      '"$http_user_agent" "$gzip_ratio"';
#
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021-2022 Boonleng Cheong.

import os
import re
import sys
import gzip
import pprint
import select
import datetime
import argparse
import textwrap

__prog__ = os.path.basename(sys.argv[0])
__version__ = '1.0'

pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)

ng = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}).+\]'
    + r' "(GET|POST) (?P<url>.+) (?P<protocol>HTTP/[0-9.]+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
    + r' "(?P<browser>.+)" "(?P<compression>[0-9.-]+)"'
)

rh = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):0 - -'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2})\]'
    + r' "(GET|POST) (?P<url>.+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
)

def decode(line):
    x = ng.search(line)
    if x:
        x = x.groupdict()
        for key in ["bytes", "status"]:
            x[key] = int(x[key])
        x['datetime'] = datetime.datetime.strptime(x['time'], r'%d/%b/%Y:%H:%M:%S')
        x['compression'] = float(x['compression']) if '-' not in x['compression'] else 0
        return x
    return None

def show(x, verbose=1):
    if verbose > 1:
        pp.pprint(x)
    t = x['datetime'].strftime(r'%m/%d %H:%M:%S')

    status = x['status']
    if status == 200:
        c = '\033[38;5;142m'
    elif status == 302:
        c = '\033[38;5;82m'
    elif status > 400:
        c = '\033[38;5;204m'
    elif status > 300:
        c = '\033[38;5;6m'
    elif status > 200:
        c = '\033[38;5;94m'
    else:
        c = '\033[38;5;82m'
    url = x["url"]
    if len(url) > 70:
        url = url[:52] + '...' + url[-15:]
    #pro = f'{x["protocol"]} ' if "protocol" in x else ""
    b = '\033[38;5;171m' if x['compression'] > 25.0 else ''
    com = f'{x["compression"]:5.2f}'[:5] if x['compression'] else '  -  '
    print(f'{t} | {x["ip"]:>15} | {x["bytes"]:10,d} | {b}{com}\033[m | {c}{status:3d} {url}\033[m')

def showline(line):
    x = decode(line)
    if x is None:
        return
    show(x)

def readlines(source):
    with gzip.open(source, 'rt') if '.gz' in source else open(source, 'rt') as fid:
        lines = fid.readlines()
    return lines

#

if __name__ == '__main__':
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
        Access Log Parse Tool

        Examples:
            {__prog__} /var/log/nginx/access.log
            cat /var/log/nginx/access.log | {__prog__}
        '''),
        epilog='Copyright (c) 2022 Boonleng Cheong')
    parser.add_argument('source', type=str, nargs='*', help='source(s) to process')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + __version__)
    args = parser.parse_args()

    if len(args.source):
        for source in args.source:
            for line in readlines(source):
                showline(line)
    elif select.select([sys.stdin, ], [], [], 0.0)[0]:
        # There is something piped through the stdin
        for line in sys.stdin:
            showline(line)
    else:
        parser.print_help()
