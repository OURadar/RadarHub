import json
import uuid
import redis
import pickle


class ProductClient:
    def __init__(self):
        self.relay = redis.StrictRedis(host="localhost", port=6379, db=0)
        self.pubsub = self.relay.pubsub()
        self.channel = uuid.uuid4().hex[:16]

    def get(self, path):
        self.pubsub.subscribe(self.channel)
        self.relay.publish("ch-request", json.dumps({"path": path, "channel": self.channel}))
        for message in self.pubsub.listen():
            if message["type"] != "message":
                continue
            data = pickle.loads(message["data"])
            self.pubsub.unsubscribe(self.channel)
            return data

    def stats(self):
        self.pubsub.subscribe(self.channel)
        self.relay.publish("ch-request", json.dumps({"stats": True, "channel": self.channel}))
        for message in self.pubsub.listen():
            if message["type"] != "message":
                continue
            info = message["data"].decode("utf-8")
            self.pubsub.unsubscribe(self.channel)
            return info
