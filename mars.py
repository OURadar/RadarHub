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
import threading
import setproctitle

import common
import dbtool

bot = None
logger = common.get_logger()

def signalHandler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')
    bot.stop()

class RadarHubBot():
    def __init__(self):
        self.messenger = common.get_messenger()
        self.want_running = False
        self.running = False
        self.tid = None

    def run(self):
        self.want_running = True
        self.running = True
        tic = 0
        channel = 'boonleng@ou.edu'
        self.messenger.post('started', channel)
        while self.want_running:
            self.messenger.call_on_each_message_nonblock(self.onmessage)
            tic += 1
        self.running = False
        self.messenger.post('ended', channel)

    def stop(self):
        self.want_running = False
        channel = 'boonleng-bot@chat.arrc.ou.edu'
        self.messenger.post('jump', channel)

    def onmessage(self, message):
        if self.messenger.is_my_message(message):
            return
        print(message)

        if message['is_me_message']:
            return

        content = message['content'].lower()
        sender_email = message['sender_email']

        if 'latest' in content:
            response = dbtool.check_latest()
        elif 'hello' in content:
            response = 'Hi there'
        elif 'bye' in content:
            response = 'See you later :peace_sign:'
        else:
            response = None

        if response:
            self.messenger.post(response, channel=sender_email)

#

if __name__ == '__main__':
    setproctitle.setproctitle(os.path.basename(sys.argv[0]))

	# Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    logger.showLogOnScreen()

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    bot = RadarHubBot()
    bot.run()

    logger.info('--- Finished ---')
