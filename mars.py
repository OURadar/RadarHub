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
import setproctitle

import common
import dbtool

logger = common.get_logger()
keep_running = True

def signalHandler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')
    global keep_running
    keep_running = False

class RadarHubBot():
    def __init__(self):
        self.messenger = common.get_messenger()

        # channel = "boonleng@ou.edu"
        # topic = "bot-test"
        # self.messenger.post('started', channel, topic)

    def run(self):
        global keep_running
        keep_running = True
        tic = 0
        while keep_running:
            self.messenger.call_on_each_message_nonblock(self.onmessage)
            print(f'tic = {tic}')
            tic += 1
            time.sleep(1)
        channel = "boonleng@ou.edu"
        topic = "bot-test"
        self.messenger.post('ended', channel, topic)



    def onmessage(self, message):
        if self.messenger.is_my_message(message):
            return
        print(message)

        if message['is_me_message']:
            return

        content = message['content']
        sender_email = message['sender_email']

        if 'latest' in content:
            response = dbtool.check_latest()
        elif 'bye' in content.lower():
            response = 'See you later :peace_sign:'

        self.messenger.post(response, channel=sender_email)

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
