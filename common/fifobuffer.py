from collections import deque


class FIFOBuffer:
    def __init__(self):
        self.queue = deque()

    def enqueue(self, item):
        self.queue.append(item)  # Add to the end of the deque

    def dequeue(self):
        if self.is_empty():
            raise IndexError("Dequeue from an empty queue")
        return self.queue.popleft()  # Remove from the front of the deque

    def is_empty(self):
        return len(self.queue) == 0

    def size(self):
        return len(self.queue)

    def __repr__(self):
        return f"FIFOBuffer({list(self.queue)})"
