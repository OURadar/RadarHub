# Make something simple to generate data

import json
import time
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
        return resource_tracker._resource_tracker.register(self, name, rtype)
    resource_tracker.register = fix_register

    def fix_unregister(name, rtype):
        if rtype == "shared_memory":
            return
        return resource_tracker._resource_tracker.unregister(self, name, rtype)
    resource_tracker.unregister = fix_unregister

    if "shared_memory" in resource_tracker._CLEANUP_FUNCS:
        del resource_tracker._CLEANUP_FUNCS["shared_memory"]

# ---

N = 1000         # number of samples
nm = 1000        # noise magnitude
verbose = 2      # printing something

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

healthString = [
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":0}, "Recorder":{"Value":false,"Enum":1}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"249 Hz","Enum":0}, "rayRate":6.010, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.5degC","Enum":0}, "Core Volt":{"Value":"1.00 V","Enum":0}, "Aux. Volt":{"Value":"2.466 V","Enum":0}, "XMC Volt":{"Value":"12.223 V","Enum":0}, "XMC 3p3":{"Value":"3.222 V","Enum":0}, "Transmit H":{"Value":"57.625 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.237","Enum":1}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369167","Enum":3}, "GPS Longitude":{"Value":"-97.4638233","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.7 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x70", "Enum":2}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"181.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":1}, "Sys Latitude":{"Value":"35.2369467","Enum":0}, "Sys Longitude":{"Value":"-97.4638167","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804516}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"251 Hz","Enum":0}, "rayRate":6.001, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.464 V","Enum":0}, "XMC Volt":{"Value":"12.225 V","Enum":0}, "XMC 3p3":{"Value":"3.220 V","Enum":0}, "Transmit H":{"Value":"57.511 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"984.3 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":1}, "Sys Heading":{"Value":"180.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369461","Enum":0}, "Sys Longitude":{"Value":"-97.4638169","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804517}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":2}, "Recorder":{"Value":false,"Enum":0}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.02 V","Enum":0}, "Aux. Volt":{"Value":"2.468 V","Enum":0}, "XMC Volt":{"Value":"12.224 V","Enum":0}, "XMC 3p3":{"Value":"3.181 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":1}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.50 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369455","Enum":0}, "Sys Longitude":{"Value":"-97.4638165","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804518}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.463 V","Enum":0}, "XMC Volt":{"Value":"12.222 V","Enum":0}, "XMC 3p3":{"Value":"3.196 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":1}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.75 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369443","Enum":0}, "Sys Longitude":{"Value":"-97.4638163","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804519}'
]


def attach():
    remove_shm_from_resource_tracker()
    global _shm
    try:
        _shm = shared_memory.SharedMemory(_key)
    except:
        if verbose:
            print('Creating shared memory ...')
        _shm = shared_memory.SharedMemory(_key, create=True, size=4096)
        _shm.buf[:2] = b'{}'

    b = _shm.buf.tobytes().decode('utf-8')
    s = '{}'.format(b[:b.index('\x00')])
    global _radar_set
    _radar_set = json.loads(s)
    #print('attach() --> "{}" ({}) --> {}'.format(s, len(s), _radar_set))

def detach():
    global _shm
    if _shm is None:
        print('not sync')
        return
    blob = bytes(json.dumps(_radar_set), 'utf-8') + b'\x00'
    _shm.buf[:len(blob)] = blob
    _shm.close()

def destroy():
    global _shm
    if _shm is None:
        print('not sync')
        return
    _shm.unlink()

def register(name):
    attach()
    with _lock:
        if name in _radar_set:
            _radar_set[name] += 1
        else:
            _radar_set[name] = 1
    if verbose > 1:
        print('register: radar_set = {}'.format(_radar_set))
    detach()

def unregister(name):
    attach()
    with _lock:
        if name in _radar_set:
            _radar_set[name] -= 1
            if _radar_set[name] < 0:
                print('Unexpected count. Backhaul worker probably restarted with active clients.')
                _radar_set[name] = 0
        else:
            _radar_set[name] = 0
    if verbose >  1:
        print('unregister: radar_set = {}'.format(_radar_set))
    detach()

def reset():
    attach()
    global _radar_set
    print('radar_set --> {}'.format(_radar_set))
    for (k, _) in _radar_set.items():
        _radar_set[k] = 0
    print('          --> {}'.format(_radar_set))
    detach()

def count(name):
    attach()
    detach()
    if name not in _radar_set:
        return 0
    return _radar_set[name]


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

def getSamples():
    return (y, tic)

def getHealth():
    k = int(tic / 15) % len(healthString)
    return (healthString[k], k)
