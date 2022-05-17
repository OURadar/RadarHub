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
# import django
import signal
import setproctitle

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
# django.setup()

# from django.conf import settings
# from common import colorize, color_name_value, getLogger, getMessenger
import common

logger = common.get_logger()


def signalHandler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')

if __name__ == '__main__':
    setproctitle.setproctitle(os.path.basename(sys.argv[0]))

	# Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    messenger = common.get_messenger()

    channel = "boonleng@ou.edu"
    topic = "bot-test"

    now = time.strftime('%Y/%m/%d %H:%M:%S', time.gmtime())
    message = f'Hello, the time is {now}'
    messenger.post(message, channel=channel, topic=topic)

    logger.info('--- Finished ---')
