import os
import glob
import time
import pprint
import threading

from common import FIFOBuffer
from product import ProductClient

pp = pprint.PrettyPrinter(indent=1, depth=1, width=120, sort_dicts=False)


def request(client, file):
    print(f"Req: {file} ...")
    data = client.get(file)
    unixTime = data["time"]
    timeString = time.strftime(r"%Y%m%d-%H%M%S", time.localtime(unixTime))
    basename = os.path.basename(file)
    parts = basename.split("-")
    fileTime = f"{parts[1]}-{parts[2]}"
    print(f"Out: {basename} / {timeString} / {fileTime == timeString} ...")
    return data


if __name__ == "__main__":

    # files = sorted(glob.glob("/mnt/ramdisk/*xz"))
    files = sorted(glob.glob("/mnt/data/PX1000/2024/20240820/_original/*xz"))
    # files = sorted(glob.glob(os.path.expanduser("~/Downloads/data/moment/20240711/*xz")))

    client = ProductClient(n=6)

    tic = time.time()
    fifo = FIFOBuffer()
    for file in files[-200:-100]:
        # file = file.replace("/mnt/data", "/Volumes/Data")
        req = threading.Thread(target=request, args=(client, file))
        req.start()
        fifo.enqueue(req)
        while fifo.size() >= client.n * 2:
            req = fifo.dequeue()
            req.join()
    for req in fifo.queue:
        req.join()
    toc = time.time()

    print(f"Elapsed: {toc - tic:.3f} s")

    print("Getting stats ...")
    stats = client.stats()
    print(f"stats: {stats}")

    client.close()
