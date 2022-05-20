#!/usr/bin/env python

#
#  .py
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
import setproctitle

import common
import dbtool

bot = None
logger = common.get_logger()
jpowell = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)

def signalHandler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')
    bot.stop()

class RadarHubBot():
    def __init__(self,
        name='@**BBot**',
        email='boonleng-bot@chat.arrc.ou.edu',
        owner='boonleng@ou.edu',
        notify=True):
        self.name = name
        self.email = email
        self.owner = owner
        self.notify = notify
        self.messenger = common.get_messenger()
        self.want_running = False
        self.running = False
        self.verbose = 0

    def run(self):
        self.want_running = True
        self.running = True
        if self.notify:
            self.messenger.post('started', self.owner)
        while self.want_running:
            self.messenger.call_on_each_message_nonblock(self.onmessage)
            # Lower request availability to prevent DOS attack
            k = 0
            while self.want_running and k < 5:
                time.sleep(0.1)
                k += 1
        self.running = False
        if self.notify:
            self.messenger.post('ended', self.owner)

    def stop(self):
        self.want_running = False
        # Post a message to self to quickly jump out of call_on_each_message_nonblock()
        self.messenger.post(f'{self.name}', self.email)

    def onmessage(self, message):
        if self.verbose > 1:
            jpowell.pprint(message)

        if message['is_me_message']:
            return

        content = message['content'].lower()

        if 'latest' in content:
            response = dbtool.check_latest()
        elif 'help' in content:
            response = '`latest` - show latest files from the radars'
        elif 'hello' in content:
            response = 'Hi there :wave:'
        elif 'bye' in content:
            response = 'See you later :peace_sign:'
        else:
            return

        if message['type'] == 'private':
            self.messenger.post(response, channel=message['sender_email'], subject=message['subject'])
        else:
            self.messenger.post(response, subject=message['subject'])

#

if __name__ == '__main__':
    setproctitle.setproctitle(os.path.basename(sys.argv[0]))

	# Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    # logger.showLogOnScreen()

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    bot = RadarHubBot()
    bot.run()

    logger.info('--- Finished ---')
