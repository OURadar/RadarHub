#!/usr/bin/env python

#
#  bbot.py
#  Some interaction between RadarHub and Zulip
#
#  RadarHub
#
#  Created by Boonleng Cheong
#  Copyright (c) 2022 Boonleng Cheong.
#

import os
import sys
import time
import signal
import pprint
import argparse
import textwrap
import setproctitle

import common
import dbtool

__prog__ = os.path.basename(sys.argv[0])
__version__ = '1.0'

bot = None
logger = common.get_logger()
pretty = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)

def signal_handler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')
    bot.stop()

def check_logins():
    out = os.popen('ssh ldm@bumblebee "~/Developer/revtun/lt.sh" | sed "s,\x1B\[[0-9;]*[a-zA-Z],,g"').read()
    out = out.split('\n')[1:-2]
    message = 'Showing who has established reverse-tunnel connections\n\n'
    message += '| User | Period | IP | Description |\n|---|--:|--:|---|\n'
    for line in out:
        items = line.split()
        if items[1] == 'ldm@notty':
            continue
        name, period, ip = items[1:4]
        info = ' '.join(items[4:])
        message += f'| {name} | {period} | `{ip}` | {info} |\n'
    return message.rstrip()

class BBot():
    def __init__(self,
        name='@**BBot**',
        email='boonleng-bot@chat.arrc.ou.edu',
        owner='boonleng@ou.edu',
        notify=True,
        verbose=0):
        self.name = name
        self.email = email
        self.owner = owner
        self.notify = notify
        self.verbose = verbose
        self.messenger = common.get_messenger()
        self.want_running = False
        self.running = False

    def run(self):
        self.want_running = True
        self.running = True
        if self.notify:
            self.messenger.post('Started', self.owner)
        while self.want_running:
            self.messenger.call_on_each_message_nonblock(self.onmessage)
            # Lower request availability to prevent DOS attack
            k = 0
            while self.want_running and k < 5:
                time.sleep(0.1)
                k += 1
        self.running = False
        if self.notify:
            self.messenger.post('Ended', self.owner)

    def stop(self):
        self.want_running = False
        # Post a message to self to quickly jump out of call_on_each_message_nonblock()
        self.messenger.post(f'{self.name}', self.email)

    def onmessage(self, message):
        if self.verbose > 1:
            pretty.pprint(message)

        if self.messenger.is_my_message(message):
            return

        content = message['content'].lower()

        if 'latest' in content:
            response = dbtool.check_latest()
        elif 'who' in content:
            # self.messager.react(message, 'working_on_it')
            self.messenger.react(message, 'working_on_it')
            response = check_logins()
        elif 'help' in content:
            response = textwrap.dedent(f'''\
                `latest` - shows latest files from the radars
                `who` - shows which radars have phoned home
                ''')
        elif 'hello' in content:
            response = 'Hi there :wave:'
        elif 'bye' in content:
            response = 'See you later :peace_sign:'
        elif 'logoff':
            self.messenger.react(message, '+1')
            return self.stop()
        else:
            return

        if message['type'] == 'private':
            self.messenger.post(response, channel=message['sender_email'], subject=message['subject'])
        else:
            self.messenger.post(response, subject=message['subject'])

#

if __name__ == '__main__':
    parser = argparse.ArgumentParser(prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(f'''\
        BBot

        Examples:
            {__prog__} -v
        '''),
        epilog='Copyright (c) 2022 Boonleng Cheong')
    parser.add_argument('--version', action='version', version=f'{__prog__} {__version__}')
    parser.add_argument('-v', dest='verbose', default=0, action='count', help='increases verbosity')
    args = parser.parse_args()

    setproctitle.setproctitle(os.path.basename(sys.argv[0]))

	# Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    if args.verbose:
        logger.showLogOnScreen()

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    bot = BBot(verbose=args.verbose)
    bot.run()

    logger.info('--- Finished ---')
