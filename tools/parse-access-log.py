#!/usr/bin/env python

#
#  Parse nginx access log, typically at /var/log/nginx/access.log
#
#  Created by Boonleng Cheong
#  Copyright (c) 2021-2022 Boonleng Cheong.

import re
import sys
import datetime

import pprint
pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)

ng = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}).+\]'
    + r' "(GET|POST) (?P<url>.+) (?P<protocol>HTTP/[0-9.]+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
    + r' "(?P<useragent>.+)" "(?P<compression>[0-9.-]+)"'
)

rh = re.compile(
    r'(?P<ip>\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):0 - -'
    + r' \[(?P<time>\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2})\]'
    + r' "(GET|POST) (?P<url>.+)"'
    + r' (?P<status>\d{3}) (?P<bytes>\d+)'
)

verbose = 1
method = None

for line in sys.stdin:
    if method is None:
        x = rh.search(line)
        method = 'r' if x else 'n'
    x = ng.search(line) if method == 'n' else rh.search(line)
    if x:
        x = x.groupdict()
        if verbose > 1:
            pp.pprint(x)
        for key in ["bytes", "status"]:
            x[key] = int(x[key])
        t = x["time"]
        t = datetime.datetime.strptime(t, r'%d/%b/%Y:%H:%M:%S').strftime(r'%m/%d %H:%M:%S')

        status = x["status"]
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
        com = f'{x["compression"]:>5}'[:5] + ' | ' if "compression" in x else ""
        print(f'{t} | {x["ip"]:>15} | {x["bytes"]:10,d} | {com}{c}{status:3d} {url}\033[m')
