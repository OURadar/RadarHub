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

from common import get_user_agent_string, get_ip_location

__prog__ = os.path.basename(sys.argv[0])
__version__ = '1.0'
pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)
re_nginx = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}).+\]'
    + r' "(GET|POST) (?P<url>.+) (?P<protocol>HTTP/[0-9.]+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
    + r' "(?P<user_agent>.+)" "(?P<compression>[0-9.-]+)"'
)
re_radarhub = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5} - -'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2})\]'
    + r' "(GET|POST|WSCONNECTING|WSDISCONNECT) (?P<url>.+)"'
    + r' (?P<status>[\d-]+) (?P<bytes>[\d-]+)'
)
re_agent = re.compile(r'(mozilla|webkit|safari|firefox|android)', flags=re.IGNORECASE)
re_logfile = re.compile(r'(\w+\.log)(?:\.(\d{1,2}))?(?:\.(gz))?', flags=re.IGNORECASE)

#

def get_terminal_width():
    try:
        w = os.get_terminal_size()
        return w.columns
    except:
        w = 140
    return w

class LogParser:
    def __init__(self, line=None, **kwargs):
        self.format = kwargs['format'] if 'format' in kwargs else 'loc'
        self.parser = re_radarhub if 'parser' in kwargs and kwargs['parser'] == 'radarhub' else re_nginx
        if 'width' in kwargs:
            self.width = kwargs['width']
        elif self.format == 'loc':
            self.width = max(25, get_terminal_width() - 88)
        elif self.format == 'all':
            self.width = 200
        else:
            self.width = 75
        self.ws = kwargs['all'] if 'all' in kwargs else False
        self.__blank__()
        if line:
            self.decode(line)

    def __blank__(self):
        self.ip = '127.0.0.1'
        self.datetime = None
        self.compression = 0
        self.user_agent = '-'
        self.os_browser = '-'
        self.location = '-'
        self.status = 0
        self.bytes = 0
        self.url = None

    def decode(self, line):
        line = line.rstrip()
        x = self.parser.search(line)
        if x:
            x = x.groupdict()
            self.ip = x['ip']
            self.datetime = datetime.datetime.strptime(x['time'], r'%d/%b/%Y:%H:%M:%S').replace(tzinfo=datetime.timezone.utc)
            self.compression = float(x['compression']) if 'compression' in x and '-' not in x['compression'] else 0
            self.user_agent = x['user_agent'] if 'user_agent' in x else ''
            self.os_browser = get_user_agent_string(self.user_agent if len(self.user_agent) else '-', width=20)
            self.location = get_ip_location(x['ip']).replace('United States', 'USA')
            self.status = int(x['status']) if x['status'] != '-' else 0
            self.bytes = int(x['bytes']) if x['bytes'] != '-' else 0
            self.url = x['url']
        else:
            self.__blank__()

    def _color_code_status(self):
        if self.status == 200:
            return '\033[38;5;142m'
        if self.status == 302:
            return '\033[38;5;82m'
        if self.status > 400:
            return '\033[38;5;204m'
        if self.status > 300:
            return '\033[38;5;6m'
        if self.status > 200:
            return '\033[38;5;94m'
        return '\033[38;5;82m'

    def _color_code_compression(self):
        if self.compression > 20.0:
            return '\033[38;5;141m'
        if self.compression > 15.0:
            return '\033[38;5;175m'
        if self.compression > 10.0:
            return '\033[38;5;172m'
        if self.compression > 5.0:
            return '\033[38;5;178m'
        if self.compression > 3.0:
            return '\033[38;5;2m'
        return '\033[m'

    def _str_compression(self):
        s = f'{self.compression:5.2f}'[:5] if self.compression > 1.0 else '  -  '
        return self._color_code_compression() + s + '\033[m'

    def _str_status_url(self):
        w = (self.width - 3) // 2
        u = self.url[:w] + '...' + self.url[-w:] if len(self.url) > self.width else self.url
        s = str(self.status) if self.status > 0 else ' - '
        return self._color_code_status() + s + ' ' + u + '\033[m'

    def __str__(self):
        t = self.datetime.strftime(r'%m/%d %H:%M:%S') if self.datetime else '--/-- --:--:--'
        c = self._str_compression()
        u = self._str_status_url()
        b = f'{self.bytes:10,d}' if self.bytes else '         -'
        if self.format == 'loc':
            if self.parser == re_nginx:
                return f'{t} | {self.ip:>15} | {self.location:>25} | {b} | {c} | {u}'
            else:
                return f'{t} | {self.ip:>15} | {self.location:>25} | {b} | {u}'
        if self.format == 'url':
            return f'{t} | {self.ip:>15} | {self.bytes:>10,d} | {c} | {u}'
        if self.format == 'agent':
            return f'{t} | {self.ip:>15} | {self.os_browser:>20} | {u}'
        return f'{t} | {self.ip:>15} | {self.location:>25} | {b} | {c} | {self.os_browser:>20} | {u}'

    def show(self, line=None):
        if line:
            self.decode(line)
        if self.status or self.ws:
            print(self)

def readlines(source):
    if not os.path.exists(source):
        print(f'ERROR. File {source} does not exist')
        return None
    with gzip.open(source, 'rt') if '.gz' == source[:-3] else open(source, 'rt') as fid:
        lines = fid.readlines()
    return lines

def find_previous_log(file):
    folder, basename = os.path.split(file)
    parts = re_logfile.search(basename).groups()
    count = int(parts[1]) if parts[1] else 0
    parts = [parts[0], str(count + 1)]
    previous = os.path.join(folder, '.'.join(parts))
    if os.path.exists(previous):
        return previous
    previous += '.gz'
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
            {__prog__} -a -f loc
            {__prog__} -af all
        '''),
        epilog='Copyright (c) 2022 Boonleng Cheong')
    parser.add_argument('source', type=str, nargs='*', help='source(s) to process')
    parser.add_argument('-a', dest='access', action='store_true', help='checks nginx access log')
    parser.add_argument('-f', dest='format', choices={'all', 'url', 'loc', 'agent'}, default='loc', help='sets output format (default = loc)')
    parser.add_argument('-p', dest='parser', choices={'radarhub', 'nginx'}, help='sets the log parser (default = nginx)')
    parser.add_argument('-q', dest='quiet', action='store_true', help='operates in quiet mode (verbosity = 0')
    parser.add_argument('-v', dest='verbose', default=1, action='count', help='increases verbosity (default = 1)')
    parser.add_argument('--all', action='store_true', help='shows all entries, including WSCONNECTING and WSDISCONNECT (default = False)')
    parser.add_argument('--version', action='version', version='%(prog)s ' + __version__)
    args = parser.parse_args()

    if args.quiet:
        args.verbose = 0

    if len(args.source) and args.parser is None:
        parser = 'radarhub' if 'radarhub' in args.source[0] else 'nginx'
    else:
        parser = args.parser
    hope = LogParser(parser=parser, format=args.format, all=args.all)

    if select.select([sys.stdin, ], [], [], 0.0)[0]:
        # There is something piped through the stdin
        for line in sys.stdin:
            hope.show(line)
    elif len(args.source):
        for source in args.source:
            if not os.path.exists(source):
                print(f'ERROR. File {source} does not exist')
                sys.exit()
            for line in readlines(source):
                hope.show(line)
    else:
        source = '/var/log/nginx/access.log'
        if not os.path.exists(source):
            print(f'ERROR. File {source} does not exist')
            sys.exit()
        for line in readlines(source):
            hope.show(line)
