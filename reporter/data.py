#  backhaul/data.py
#
#   RadarHub
#
#   A stepping stone from 0.2 to 0.4
#
#   Created by Boonleng Cheong
#

# Make something simple to generate data

import json
import time
import pprint
import threading
import numpy as np

from multiprocessing import shared_memory

# Work around the unwated resource tracker behavior
from multiprocessing import resource_tracker


def remove_shm_from_resource_tracker():
    """Monkey-patch multiprocessing.resource_tracker so SharedMemory won't be tracked

    More details at: https://bugs.python.org/issue38119
    """

    def fix_register(name, rtype):
        if rtype == "shared_memory":
            return
        return resource_tracker._resource_tracker.register(None, name, rtype)
    resource_tracker.register = fix_register

    def fix_unregister(name, rtype):
        if rtype == "shared_memory":
            return
        return resource_tracker._resource_tracker.unregister(None, name, rtype)
    resource_tracker.unregister = fix_unregister

    if "shared_memory" in resource_tracker._CLEANUP_FUNCS:
        del resource_tracker._CLEANUP_FUNCS["shared_memory"]

# ---

N = 1000         # number of samples
nm = 1000        # noise magnitude
verbose = 1      # printing something

# state
active = False
tid = None
tic = 0

# shared memory stuff
_shm = None
_key = 'backhaul-data'
_lock = threading.Lock()
_radar_set = {}

# An array to hold split I/Q. This is more efficient for plotting later
y = np.zeros((2 * N,), dtype=np.int16)

#
# radar = {
#   'px1000': {'clients': 0, 'relay': 0},
#   'pair': {'clients': 0, 'relay': 0},
#   ...
# }
#
blank = {'clients': 0, 'relay': 0}

pp = pprint.PrettyPrinter(indent=4)

def attach():
    remove_shm_from_resource_tracker()
    global _shm
    global _radar_set
    try:
        _shm = shared_memory.SharedMemory(_key)
    except:
        _shm = None
    if _shm is None:
        if verbose:
            print('Creating shared memory ...')
        _shm = shared_memory.SharedMemory(_key, create=True, size=4096)
        _shm.buf[:3] = b'{}\x00'

    b = _shm.buf.tobytes().decode('utf-8')
    s = str(b[:b.index('\x00')])
    try:
        _radar_set = json.loads(s)
    except:
        print('Bad JSON, reset to empty')
        _radar_set = {}
        detach()
    if verbose > 1:
        print(f'attach: {_radar_set} ({len(_radar_set)})')

def detach():
    global _shm
    global _radar_set
    if _shm is None:
        print('not sync')
        return
    blob = bytes(json.dumps(_radar_set), 'utf-8') + b'\x00'
    if verbose > 1:
        print(f'detach: {blob} ({len(blob)})')
    if _shm.buf is None:
        print('ERROR. Unexpected.')
        return
    _shm.buf[:len(blob)] = blob
    _shm.close()

def destroy():
    global _shm
    if _shm is None:
        print('not sync')
        return
    with _lock:
        _shm.unlink()

def register(name):
    with _lock:
        attach()
        if name in _radar_set:
            _radar_set[name]['clients'] += 1
        else:
            _radar_set[name] = blank
            _radar_set[name]['clients'] = 1
        if verbose:
            print(f'register: \033[38;5;87m{name}\033[m\nradar_set =')
            pp.pprint(_radar_set)
        detach()

def unregister(name):
    with _lock:
        attach()
        if name in _radar_set:
            _radar_set[name]['clients'] -= 1
            if _radar_set[name]['clients'] < 0:
                print('Unexpected client count. Resetting ...')
                _radar_set[name] = blank
        else:
            _radar_set[name] = blank
        if verbose:
            print(f'unregister: \033[38;5;87m{name}\033[m\nradar_set =')
            pp.pprint(_radar_set)
        detach()

def reset():
    global _radar_set
    with _lock:
        attach()
        if verbose > 1:
            print('reset: radar_set =')
            pp.pprint(_radar_set)
        for (k, _) in _radar_set.items():
            _radar_set[k] = blank
        if verbose > 1:
            print('-->')
            pp.pprint(_radar_set)
        detach()

def count(name):
    with _lock:
        attach()
        detach()
    if name not in _radar_set:
        return 0
    return _radar_set[name]['clients']


# This will eventually become requestor to the radar API
def _generator():
    print('\033[38;5;15;48;5;63mData interface\033[m started.')
    global tic, y
    a = 25000
    t = np.arange(N, dtype=np.float32)
    # Home-made Tukey window here, insteading importing scipy
    def tukeywin(n=100, alpha=0.1):
        w = np.ones(n)
        a = int(alpha * n)
        w[:a] = 0.5 - 0.5 * np.cos(-np.arange(a) / a * np.pi)
        w[-a:] = w[:a][::-1]
        return w
    w = tukeywin(N)
    while active:
        omega = 0.1 * (t / N + 777 * (t / N) ** 2) + 0.1 * tic
        tmp = np.concatenate((np.array(a * w * np.cos(omega), dtype=np.int16),
                np.array(a * w * np.sin(omega), dtype=np.int16)))
        tmp += np.random.randint(-nm, nm, size=len(y), dtype=np.int16)
        y[:] = tmp
        time.sleep(1 / 30);
        tic += 1

def start():
    with _lock:
        global active, tid
        if tid is None and not active:
            active = True
            tid = threading.Thread(target=_generator)
            tid.start()
        else:
            print('There is already an instance running.')

def stop():
    global active, tid
    active = False
    if (tid):
        tid.join()
        print('\033[38;5;15;48;5;196mData interface\033[m stopped')
    tid = None

# Methods for backhaul.consumers

def getSamples():
    return (y, tic)

def getHealth():
    k = int(tic / 15) % len(healthString)
    return (healthString[k], k)

def getControl():
    return (controlString, 0)

def relayCommand(name, command):
    global _radar_set
    print(f'data.relayCommand() - {name} - "\033[38;5;82m{command}\033[m"')
    time.sleep(0.8)
    with _lock:
        attach()
        _radar_set[name]['relay'] += 1
        pp.pprint(_radar_set)
        detach()
    message = f'"{command}"'
    return message;
