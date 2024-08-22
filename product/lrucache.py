import zlib
import threading

from collections import OrderedDict

lock = threading.Lock()


class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: str) -> bytes:
        if key not in self.cache:
            return None
        else:
            with lock:
                # Move the accessed key to the end to mark it as recently used
                self.cache.move_to_end(key)
                return zlib.decompress(self.cache[key])

    def put(self, key: str, value: bytes):
        with lock:
            if key in self.cache:
                # Update the value of the existing key and move it to the end
                self.cache.move_to_end(key)
            self.cache[key] = zlib.compress(value)
            if len(self.cache) > self.capacity:
                # Remove the first item (least recently used) from the cache
                self.cache.popitem(last=False)

    def size(self) -> str:
        total = 0
        for item in self.cache.values():
            total += len(item)
        count = len(self.cache)
        s = "s" if count > 1 else ""
        return f"{count} item{s}, {total:,d} B"
