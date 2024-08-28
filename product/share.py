import struct


def send(socket, data):
    payload = struct.pack(">I", len(data)) + data
    socket.sendall(payload)


def recv(socket):
    head = socket.recv(4)
    if not head:
        return None
    size = struct.unpack(">I", head)[0]
    data = bytearray()
    while len(data) < size:
        blob = socket.recv(size - len(data))
        if not blob:
            break
        data.extend(blob)
    return data


def clamp(x, lo, hi):
    return max(lo, min(x, hi))
