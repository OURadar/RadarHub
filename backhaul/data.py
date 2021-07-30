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

healthString = [
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":0}, "Recorder":{"Value":false,"Enum":1}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"249 Hz","Enum":0}, "rayRate":6.010, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.5degC","Enum":0}, "Core Volt":{"Value":"1.00 V","Enum":0}, "Aux. Volt":{"Value":"2.466 V","Enum":0}, "XMC Volt":{"Value":"12.223 V","Enum":0}, "XMC 3p3":{"Value":"3.222 V","Enum":0}, "Transmit H":{"Value":"57.625 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.237","Enum":1}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369167","Enum":3}, "GPS Longitude":{"Value":"-97.4638233","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.7 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x70", "Enum":2}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"181.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":1}, "Sys Latitude":{"Value":"35.2369467","Enum":0}, "Sys Longitude":{"Value":"-97.4638167","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804516}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"251 Hz","Enum":0}, "rayRate":6.001, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.464 V","Enum":0}, "XMC Volt":{"Value":"12.225 V","Enum":0}, "XMC 3p3":{"Value":"3.220 V","Enum":0}, "Transmit H":{"Value":"57.511 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"984.3 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":1}, "Sys Heading":{"Value":"180.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369461","Enum":0}, "Sys Longitude":{"Value":"-97.4638169","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804517}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":2}, "Recorder":{"Value":false,"Enum":0}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.02 V","Enum":0}, "Aux. Volt":{"Value":"2.468 V","Enum":0}, "XMC Volt":{"Value":"12.224 V","Enum":0}, "XMC 3p3":{"Value":"3.181 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":1}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.50 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369455","Enum":0}, "Sys Longitude":{"Value":"-97.4638165","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804518}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.463 V","Enum":0}, "XMC Volt":{"Value":"12.222 V","Enum":0}, "XMC 3p3":{"Value":"3.196 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":1}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.75 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369443","Enum":0}, "Sys Longitude":{"Value":"-97.4638163","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804519}'
]

controlString = '{"name": "px1000", "Controls": [{"Label": "Go", "Command": "t y"}, {"Label": "Stop", "Command": "t z"}, {"Label": "PRF 1,000 Hz (84 km)", "Command": "t prf 1000"}, {"Label": "PRF 1,475 Hz (75 km)", "Command": "t prf 1475"}, {"Label": "PRF 2,000 Hz (65 km)", "Command": "t prf 2000"}, {"Label": "PRF 3,000 Hz (40 km)", "Command": "t prf 3003"}, {"Label": "PRF 4,000 Hz (28 km)", "Command": "t prf 4000"}, {"Label": "PRF 5,000 Hz (17.6 km)", "Command": "t prf 5000"}, {"Label": "Stop Pedestal", "Command": "p stop"}, {"Label": "Park", "Command": "p point 0 90"}, {"Label": "DC PSU On", "Command": "h pow on"}, {"Label": "DC PSU Off", "Command": "h pow off"}, {"Label": "Measure Noise", "Command": "t n"}, {"Label": "Transmit Toggle", "Command": "t tx"}, {"Label": "10us pulse", "Command": "t w s10"}, {"Label": "12us LFM", "Command": "t w q0412"}, {"Label": "20us pulse", "Command": "t w s20"}, {"Label": "50us pulse", "Command": "t w s50"}, {"Label": "TFM + OFM", "Command": "t w ofm"}, {"Label": "OFM", "Command": "t w ofmd"}, {"Label": "1-tilt EL 2.4 deg @ 18 deg/s", "Command": "p vol p 2.4 300 18"}, {"Label": "5-tilt VCP @ 45 deg/s", "Command": "p vol p 2 300 45/p 4 300 45/p 6 300 45/p 8 300 45/p 10 300 45"}, {"Label": "5-tilt VCP @ 25 deg/s", "Command": "p vol p 2 300 25/p 4 300 25/p 6 300 25/p 8 300 25/p 10 300 25"}, {"Label": "5-tilt VCP @ 18 deg/s", "Command": "p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18"}, {"Label": "5-tilt VCP @ 12 deg/s", "Command": "p vol p 2 300 12/p 4 300 12/p 6 300 12/p 8 300 12/p 10 300 12"}, {"Label": "6-tilt VCP @ 18 deg/s", "Command": "p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18/p 12 300 18"}]}'

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
        _shm.buf[:2] = b'{}\x00'

    b = _shm.buf.tobytes().decode('utf-8')
    s = '{}'.format(b[:b.index('\x00')])
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
