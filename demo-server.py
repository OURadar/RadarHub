import time
import logging

from product import Server

if __name__ == "__main__":

    logger = logging.getLogger("demo-server")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    logger.addHandler(handler)

    productServer = Server(logger=logger, cache=200, signal=True)
    productServer.start()

    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("KeyboardInterrupt ...")
        pass

    print("done")
