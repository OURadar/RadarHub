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

from common import colorize, get_user_agent_string, get_ip_location

__prog__ = os.path.basename(sys.argv[0])
__version__ = '1.0'
pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)
re_ngnix = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}).+\]'
    + r' "(GET|POST) (?P<url>.+) (?P<protocol>HTTP/[0-9.]+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
    + r' "(?P<user_agent>.+)" "(?P<compression>[0-9.-]+)"'
)
re_radarhub = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):0 - -'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2})\]'
    + r' "(GET|POST) (?P<url>.+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
)
re_agent = re.compile(r'(mozilla|webkit|safari|firefox|android)', flags=re.IGNORECASE)
re_logfile = re.compile(r'(\w+\.log)(?:\.(\d{1,2}))?(?:\.(gz))?', flags=re.IGNORECASE)

#

def decode(line, format=None):
    line = line.rstrip()
    if format == 'nginx':
        x = re_ngnix.search(line)
    elif format == 'radarhub':
        x = re_radarhub.search(line)
    else:
        x = re_ngnix.search(line) if line[-1] == '"' else re_radarhub.search(line)
    if x:
        x = x.groupdict()
        for key in ["bytes", "status"]:
            x[key] = int(x[key])
        x['datetime'] = datetime.datetime.strptime(x['time'], r'%d/%b/%Y:%H:%M:%S').replace(tzinfo=datetime.timezone.utc)
        x['compression'] = float(x['compression']) if 'compression' in x and '-' not in x['compression'] else 0
        x['os_browser'] = get_user_agent_string(x['user_agent'], width=20)
        x['location'] = get_ip_location(x['ip'])
        return x
    return None

def color_code(status):
    if status == 200:
        return '\033[38;5;142m'
    elif status == 302:
        return '\033[38;5;82m'
    elif status > 400:
        return '\033[38;5;204m'
    elif status > 300:
        return '\033[38;5;6m'
    elif status > 200:
        return '\033[38;5;94m'
    else:
        return '\033[38;5;82m'

def compression(x):
    c = '\033[38;5;141m' if x['compression'] > 20.0 else ''
    n = f'{x["compression"]:5.2f}'[:5] if x['compression'] else '  -  '
    return f'{c}{n}\033[m'

def status_url(x, width=75):
    c = color_code(x['status'])
    url = x["url"][:width-25] + ' ... ' + x["url"][-20:] if len(x["url"]) > width else x["url"]
    return f'{c}{x["status"]:3d} {url}\033[m'

def show_url(x):
    t = x['datetime'].strftime(r'%m/%d %H:%M:%S')
    c = compression(x)
    u = status_url(x)
    print(f'{t} | {x["ip"]:>15} | {x["bytes"]:10,d} | {c} | {u}')

def show_loc(x):
    t = x['datetime'].strftime(r'%m/%d %H:%M:%S')
    u = status_url(x, 45)
    print(f'{t} | {x["ip"]:>15} | {x["os_browser"]:>20} | {x["location"]:>30} | {u}')

def show_agent(x):
    t = x['datetime'].strftime(r'%m/%d %H:%M:%S')
    u = status_url(x)
    print(f'{t} | {x["ip"]:>15} | {x["os_browser"]:>20} | {u}')

def showline(line, show_func=show_url, verbose=0, **kwargs):
    if verbose > 1:
        print(line)
    x = decode(line)
    if x is None:
        return
    if verbose > 1:
        pp.pprint(x)
    show_func(x)
    user_agent = x['user_agent'] if 'user_agent' in x else ''
    if re_agent.search(user_agent) is None and len(user_agent) > 160:
        ip = colorize(x['ip'], 'yellow')
        tm = x['datetime'].strftime(r'%Y/%m/%d %H:%M:%S')
        msg = colorize(x['user_agent'], 'mint')
        print(f'=== Special Message on {tm} from {ip}: {msg} ===')

def readlines(source):
    with gzip.open(source, 'rt') if '.gz' in source else open(source, 'rt') as fid:
        lines = fid.readlines()
    return lines

def showfile(file, show_func, verbose=0):
    for line in readlines(file):
        showline(line, show_func=show_func, verbose=verbose)

def find_previous_log(file):
    folder, basename = os.path.split(file)
    parts = re_logfile.search(basename).groups()
    count = int(parts[1]) if parts[1] else 0
    parts = [parts[0], str(count + 1)]
    previous = os.path.join(folder, '.'.join(parts))
    print(parts, previous)
    if os.path.exists(previous):
        return previous
    previous += '.gz'
    print(previous)
    if os.path.exists(previous):
        return previous
    return None

#

if __name__ == '__main__':
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
        Access Log Parse Tool

        Examples:
            {__prog__} /var/log/nginx/access.log
            cat /var/log/nginx/access.log | {__prog__}
            tail -f /var/log/nginx/access.log | {__prog__}
        '''),
        epilog='Copyright (c) 2022 Boonleng Cheong')
    parser.add_argument('source', type=str, nargs='*', help='source(s) to process')
    parser.add_argument('-a', dest='access', action='store_true', help='checks nginx access log')
    parser.add_argument('-f', dest='format', choices=['url', 'loc', 'agent'], default='url', help='sets output format')
    parser.add_argument('-q', dest='quiet', action='store_true', help='operates in quiet mode (verbosity = 0')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + __version__)
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0

    show_options = {
        'url': show_url,
        'loc': show_loc,
        'agent': show_agent
    }
    show_func = show_options[args.format]

    if args.access:
        source = '/var/log/nginx/access.log'
        if not os.path.exists(source):
            print(f'ERROR. File {source} does not exist')
            sys.exit()
        showfile(source, show_func=show_func, verbose=args.verbose)
    elif len(args.source):
        for source in args.source:
            showfile(source, show_func=show_func, verbose=args.verbose)
    elif select.select([sys.stdin, ], [], [], 0.0)[0]:
        # There is something piped through the stdin
        for line in sys.stdin:
            showline(line, show_func=show_func)
    else:
        parser.print_help()
