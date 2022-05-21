import os
import sys
import time
import zulip

from typing import Any, Callable, Dict, List, Optional, Text, Tuple

from .dailylog import Logger

__prog__ = os.path.basename(sys.argv[0])

logger = Logger(__prog__.split('.')[0] if '.' in __prog__ else __prog__)

# Modified from https://git.arrc.ou.edu/it/automation

class Messenger(object):
    def __init__(self):
        self.url  = 'https://chat.arrc.ou.edu/api/v1/messages'
        self.client = zulip.Client()
        self.user = self.client.get_profile()['user_id']
        self.queue_id = None
        self.lastmsg = None

    def post(self, message, channel="bots", subject="(no topic)", files=[]):
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
            'subject': subject,
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

    def react(self, message, emoji):
        request = {
            'message_id': message['id'],
            'emoji_name': emoji
        }
        self.client.add_reaction(request)

    def call_on_each_event_nonblock(self,
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
