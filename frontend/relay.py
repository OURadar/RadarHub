import json
import redis
import logging
import threading

from django.conf import settings
from django_eventstream import send_event

from common import color_name_value, pretty_object_name

logger = None

class Relay:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", "-")
        self.name = pretty_object_name("Relay", self.id)
        self.relay = redis.StrictRedis()
        self.pubsub = self.relay.pubsub()
        self.channel = "sse-relay"
        global logger
        logger = kwargs.get("logger", logging.getLogger("frontend"))

    def _runloop(self):
        logger.info(f"{self.name} Started")
        self.pubsub.subscribe(self.channel)
        for message in self.pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            logger.debug(f"{self.name} {color_name_value('items', data['items'])}")
            pathway = data.pop("pathway")
            send_event("sse", pathway, data)

    def start(self):
        self.thread = threading.Thread(target=self._runloop)
        self.thread.daemon = True
        self.thread.start()
