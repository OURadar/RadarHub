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
import zulip
# import django
import signal
import setproctitle
from typing import Any, Callable, Dict, List, Optional, Text, Tuple

# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
# django.setup()

import dailylog

# from django.conf import settings
from common import colorize, color_name_value

__prog__ = os.path.basename(sys.argv[0])

logger = dailylog.Logger(__prog__.split('.')[0] if '.' in __prog__ else __prog__)


def signalHandler(sig, frame):
    # Print a return line for cosmetic
    print('\r')
    logger.info('SIGINT received, finishing up ...')

# Modified from https://git.arrc.ou.edu/it/automation

class Zulip(object):
    def __init__(self):
        self.url  = 'https://chat.arrc.ou.edu/api/v1/messages'
        self.client = zulip.Client(config_file=os.path.expanduser("~/.zuliprc"))
        self.user = self.client.get_profile()['user_id']
        self.queue_id = None
        self.lastmsg = None

    def post(self, message, channel="bots", topic="(no topic)", files=[]):
        if self.url is None:
            return 1

        if message is None:
            return 0

        # Upload each file
        fileuris = []
        for fname in files:
            with open(fname, 'rb') as fp:
                result = self.client.call_endpoint(
                    'user_uploads',
                    method='POST',
                    files=[fp],
                )
                fileuris.append(result['uri'])

        request = {
            'to': channel,
            'subject': topic,
            'content': message.format(*fileuris) if files else message
        }
        chtype = "private" if '@' in channel else "stream"
        request['type'] = chtype
        try:
            res = self.client.send_message(request)
        except Exception as e:
            logger.error(f'An error occurred when trying to deliver the message:\n  {e.message}')
            return 2

        if res['result'] != "success":
            response = res['msg']
            logger.error(f'Could not deliver the message to channel {channel}. Server says:\n  {response}')

        return res

    def is_my_message(self, msg):
        return msg.get('sender_id', '') == self.user

    def reply(self, origmsg, msg):
        req = {}
        req['type'] = origmsg['type']
        req['topic'] = origmsg['subject']
        if req['type'] == 'stream':
            req['to'] = origmsg['display_recipient']
        else:
            req['to'] = [person['email'] for person in origmsg['display_recipient']]
        if type(msg) == dict:
            req.update(msg)
        else:
            req['content'] = msg
        return self.client.send_message(req)


    def call_on_each_event_nonblock(
        self,
        callback: Callable[[Dict[str, Any]], None],
        event_types: Optional[List[str]] = None,
        narrow: Optional[List[List[str]]] = None
    ):
        if narrow is None:
            narrow = []

        def do_register() -> Tuple[str, int]:
            while True:
                if event_types is None:
                    res = self.client.register()
                else:
                    res = self.client.register(event_types=event_types, narrow=narrow)

                if 'error' in res['result']:
                    if self.client.verbose or True:
                        print("Server returned error:\n%s" % res['msg'])
                    time.sleep(1)
                else:
                    return (res['queue_id'], res['last_event_id'])

        if self.queue_id is None:
            (self.queue_id, self.last_event_id) = do_register()

        res = self.client.get_events(queue_id=self.queue_id, last_event_id=self.last_event_id)
        if 'error' in res['result']:
            print("Got some event errors", str(res))
            if res["result"] == "http-error":
                if self.client.verbose:
                    print("HTTP error fetching events -- probably a server restart")
            elif res["result"] == "connection-error":
                if self.client.verbose:
                    print("Connection error fetching events -- probably server is temporarily down?")
            else:
                if self.client.verbose:
                    print("Server returned error:\n%s" % res["msg"])
                if res["msg"].startswith("Bad event queue id:"):
                    # Reset queue_id to register a new event queue.
                    self.queue_id = None
            # Add a pause here to cover against potential bugs in this library
            # causing a DoS attack against a server when getting errors.
            time.sleep(1)
            return

        for event in res['events']:
            self.last_event_id = max(self.last_event_id, int(event['id']))
            callback(event)

    def call_on_each_message_nonblock(self, callback: Callable[[Dict[str, Any]], None]) -> None:
        def event_callback(event: Dict[str, Any]) -> None:
            if event['type'] == 'message':
                self.lastmsg = event['message']
                callback(event['message'])
        self.call_on_each_event_nonblock(event_callback, ['message'])

if __name__ == '__main__':
    setproctitle.setproctitle(os.path.basename(sys.argv[0]))

	# Catch kill signals to exit gracefully
    signal.signal(signal.SIGINT, signalHandler)
    signal.signal(signal.SIGTERM, signalHandler)

    logger.info('--- Started ---')
    logger.info(f'Using timezone {time.tzname}')

    messenger = Zulip()

    channel = "boonleng@ou.edu"
    topic = "bot-test"

    now = time.strftime('%Y/%m/%d %H:%M:%S', time.gmtime())
    messenger.post(f'Hello, the time is {now}',
        channel=channel, topic=topic)

    logger.info('--- Finished ---')
