import os
import json
import time
import radar
import redis
import pickle
import signal
import logging
import threading
import multiprocessing

from setproctitle import setproctitle, getproctitle

from common import pretty_object_name, colorize
from .lrucache import LRUCache

cache = None
logger = None


def reader(id, taskQueue, dataQueue, run):
    myname = pretty_object_name("ProductServer.reader", id)
    setproctitle(f"{getproctitle()} # ProductServer.reader[{id}]")
    logger.info(f"{myname} Started")
    while run.value:
        try:
            request = taskQueue.get(False)
            channel = request["channel"]
            path = request["path"]
            data = radar.read(path)
            logger.debug(f"{myname} {path}")
            dataQueue.put({"channel": channel, "path": path, "data": data})
            request.task_done()
        except KeyboardInterrupt:
            break
        except:
            time.sleep(0.02)
    logger.info(f"{myname} Stopped")


class ProductServer:
    def __init__(self, n=4, **kwargs):
        self.name = colorize("ProductServer", "green")
        self.relay = redis.StrictRedis(host="localhost", port=6379, db=0)
        self.pubsub = self.relay.pubsub()
        self.taskQueue = multiprocessing.Queue()
        self.dataQueue = multiprocessing.Queue()
        self.run = multiprocessing.Value("i", 1)
        self.n = n
        global cache, logger
        cache = LRUCache(kwargs.get("cache", 1000))
        logger = kwargs.get("logger", logging.getLogger("product"))
        # Wire things up
        self.workers = []
        for k in range(self.n):
            worker = multiprocessing.Process(target=reader, args=(k, self.taskQueue, self.dataQueue, self.run))
            worker.daemon = True
            self.workers.append(worker)
        self.listener = threading.Thread(target=self._listen)
        self.listener.daemon = True
        self.collector = threading.Thread(target=self._collect)
        self.collector.daemon = True
        signal.signal(signal.SIGTERM, self._signalHandler)

    def _listen(self):
        self.pubsub.subscribe("ch-request")
        tag = colorize("Cache", "orange")
        while self.run.value:
            logger.info(f"{self.name} Listening ...")
            for post in self.pubsub.listen():
                if post["type"] != "message":
                    continue
                info = json.loads(post["data"])
                if "path" in info:
                    name = os.path.basename(info["path"])
                    logger.debug(f"{self.name} Request: {name}")
                    message = cache.get(name)
                    if message is None:
                        # Queue it up for reader, _collect() will respond
                        self.taskQueue.put(info)
                    else:
                        # Respond immediately from cache
                        logger.info(f"{self.name} {tag}: {name}")
                        self.relay.publish(info["channel"], message)
                elif "stats" in info:
                    self.relay.publish(info["channel"], cache.size())

    def _collect(self):
        logger.info(f"{self.name} Collecting ...")
        tag = colorize("Drive", "skyblue")
        while self.run.value:
            try:
                result = self.dataQueue.get(False)
                channel = result["channel"]
                message = pickle.dumps(result["data"])
                name = os.path.basename(result["path"])
                cache.put(name, message)
                logger.info(f"{self.name} {tag}: {name}")
                self.relay.publish(channel, message)
                result.task_done()
            except KeyboardInterrupt:
                break
            except:
                time.sleep(0.05)

    def _delayStart(self):
        time.sleep(1)
        for worker in self.workers:
            worker.start()
        self.listener.start()
        self.collector.start()

    def _signalHandler(self, signum, frame):
        logger.debug(f"{self.name} signalHandler {signum} / {frame}")
        self.stop()

    def start(self):
        threading.Thread(target=self._delayStart).start()

    def stop(self):
        logger.info(f"{self.name} Stopping ...")
        self.run.value = 0
        self.listener.join()
        self.collector.join()
        self.pubsub.close()
