import json
import uuid
import zlib
import redis
import pickle
import socket
import logging
import threading

from common import colorize, pretty_object_name

from .const import CHANNEL
from .share import send, recv, clamp

logger = None


# Not recommended. Keep here for reference
class ProductClientRedis:
    def __init__(self):
        self.name = "ProductClient"
        self.relay = redis.StrictRedis()
        self.pubsub = self.relay.pubsub()

    def get(self, path, tarinfo=None):
        relay = redis.StrictRedis()
        pubsub = relay.pubsub()
        channel = uuid.uuid4().hex[:16]
        pubsub.subscribe(channel)
        relay.publish(CHANNEL, json.dumps({"path": path, "tarinfo": tarinfo, "channel": channel}))
        for message in pubsub.listen():
            if message["type"] == "message":
                data = pickle.loads(message["data"])
                break
        pubsub.unsubscribe(channel)
        return data

    def stats(self):
        channel = uuid.uuid4().hex[:16]
        self.pubsub.subscribe(channel)
        self.relay.publish(CHANNEL, json.dumps({"stats": True, "channel": channel}))
        for message in self.pubsub.listen():
            if message["type"] == "message":
                info = message["data"].decode("utf-8")
                break
        self.pubsub.unsubscribe(channel)
        return info


class ProductClient:
    def __init__(self, n=1, **kwargs):
        self.name = colorize("ProductClient", "green")
        self.lock = threading.Lock()
        self.n = clamp(n, 1, 16)
        global logger
        logger = kwargs.get("logger", logging.getLogger("product"))
        host = kwargs.get("host", "localhost")
        # Wire things up
        self._i = 0
        self.sockets = []
        for _ in range(self.n):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((host, 6969))
            self.sockets.append(sock)
        self.locks = [threading.Lock() for _ in range(self.n)]

    def get_id(self):
        with self.lock:
            i = self._i
            self._i = (self._i + 1) % self.n
        return i

    def get(self, path, tarinfo=None):
        i = self.get_id()
        lock = self.locks[i]
        sock = self.sockets[i]
        with lock:
            send(sock, json.dumps({"path": path, "tarinfo": tarinfo}).encode())
            data = recv(sock)
            if data is None:
                myname = pretty_object_name("ProductClient.get", i)
                logger.error(f"{myname} No data")
                return None
            # data = zlib.decompress(data)
        return pickle.loads(data)

    def stats(self):
        i = self.get_id()
        lock = self.locks[i]
        sock = self.sockets[i]
        with lock:
            send(sock, json.dumps({"stats": 1}).encode())
            message = recv(sock)
            if message is None:
                myname = colorize("ProductClient.stats()", "green")
                logger.error(f"{myname} No message")
                return None
        return message.decode("utf-8")

    def close(self):
        for sock in self.sockets:
            sock.close()
