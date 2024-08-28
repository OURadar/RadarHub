import zlib
import threading

from collections import OrderedDict

lock = threading.Lock()


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: str, decompress=True) -> bytes:
        if key not in self.cache:
            return None
        else:
            with lock:
                # Move the accessed key to the end to mark it as recently used
                self.cache.move_to_end(key)
                if decompress:
                    return zlib.decompress(self.cache[key])
                return self.cache[key]

    def put(self, key: str, value: bytes, compress=True):
        with lock:
            if key in self.cache:
                # Update the value of the existing key and move it to the end
                self.cache.move_to_end(key)
            if compress:
                self.cache[key] = zlib.compress(value)
            else:
                self.cache[key] = value
            if len(self.cache) > self.capacity:
                # Remove the first item (least recently used) from the cache
                self.cache.popitem(last=False)

    def size(self) -> str:
        total = 0
        for item in self.cache.values():
            total += len(item)
        count = len(self.cache)
        s = "s" if count > 1 else ""
        return f"{count} item{s}   {total:,d} B"
