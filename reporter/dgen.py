#!/usr/bin/env python

#
#  dgen.py
#  Data Generator in Python
#
#  RadarHub
#
#  An example client that establishes a (secure) websocket connection to
#  RadarHub, sends in control interface, scope and health data.
#
#  Created by Boonleng Cheong on 8/20/2021.
#  Copyright (c) 2021 Boonleng Cheong. All rights reserved.
#

import os
import sys
import json
import time
import signal
import argparse
import textwrap
import threading
import websocket

import numpy as np

from enums import RadarHubType

sys.path.append('../')
from common import colorize

with open('../frontend/package.json') as fid:
    __version__ = json.load(fid)['version']

class client(websocket.WebSocketApp):
    def __init__(self, url, verbose=0):
        secret = ''
        if os.path.exists('secret'):
            with open('secret') as fid:
                secret = fid.read().strip()
        if len(secret) != 22:
            secret = 'RadarHub123456789abcde'
        super().__init__(url, header={'Sec-WebSocket-Key': f'{secret}=='})
        self.on_open = handleOpen
        self.on_close = handleClose
        self.on_message = handleMessage
        self.want_active = True
        self.verbose = verbose
        if self.verbose > 1:
            websocket.enableTrace(True)

    def start(self):
        while self.want_active:
            self.run_forever(suppress_origin=True)
            s1 = time.time()
            i = 0
            r = 0
            while self.want_active and r < 10:
                s0 = time.time()
                r = int(s0 - s1)
                if i != r and self.verbose:
                    i = r
                    if r > 2:
                        p = 's' if (10 - r) > 1 else ''
                        print(f'\rNo connection. Retry in {10 - r} sec{p} ... ', end='')
                    else:
                        print('\rNo connection.', end='')
                time.sleep(0.2)
            if self.verbose:
                print('\033[1K\r', end='')
        if self.verbose > 1:
            print('WebSocketApp stopped')

    def stop(self):
        if self.verbose:
            print('WebSocketApp closing ...')
        self.want_active = False
        self.close()

    def send(self, payload):
        if not self.sock or not self.sock.connected:
            return
        return super().send(payload, opcode=websocket.ABNF.OPCODE_BINARY)

class Reporter():
    def __init__(self, name, host, verbose=0):
        self.name = name
        self.host = host
        self.verbose = verbose
        self.wantActive = True
        self.connected = False
        self.go = False
        self.rate = 1.0
        self.ws = None

    def start(self):
        self.rt = threading.Thread(target=self.run)
        self.rt.start()
        url = f'ws://{self.host}/ws/radar/{self.name}/'
        self.ws = client(url, verbose=self.verbose)
        self.ws.start()

    def stop(self):
        self.wantActive = False
        if self.ws:
            self.ws.stop()
        self.rt.join()
        print(f'R.wantActive = {R.wantActive}')

    def disconnect(self):
        self.connected = False

    def run(self):
        k = 0
        f = 15
        s = 1 / f
        ht = int(0.5 / s)

        a = 25000     # Amplitude in 16-bit ADU
        N = 1000      # number of samples
        n = 1000      # noise magnitude
        t = np.arange(N, dtype=np.float32) / N
        pulse = np.zeros((2 * N,), dtype=np.int16)

        # Home-made Tukey window here, insteading importing scipy
        def tukeywin(n=100, alpha=0.1):
            w = np.ones(n)
            a = int(alpha * n)
            w[:a] = 0.5 - 0.5 * np.cos(-np.arange(a) / a * np.pi)
            w[-a:] = w[:a][::-1]
            return w
        w = tukeywin(N)
        w *= a

        mask = np.random.randint(0, 32768, size=3*N, dtype=np.int16) % int(1.0 / 0.4) == 0
        noise = np.random.randint(-n, n, size=3*N, dtype=np.int16)
        noise[mask] = np.random.randint(1, 32768, size=np.sum(mask), dtype=np.int16)
        noise[mask] = np.random.randint(0, 32768, size=np.sum(mask), dtype=np.int16) % noise[mask] - noise[mask] / 2

        while not self.connected and self.wantActive:
            time.sleep(0.1)

        if self.verbose:
            print(colorize('Busy run loop', 'red'))

        j = 1
        while self.wantActive:
            # Ascope
            omega = 0.1 * (t + self.rate * 777.0 * t ** 2 - j)
            if self.go:
                pulse = np.concatenate(
                    (
                        np.array(w * np.cos(omega), dtype=np.int16),
                        np.array(w * np.sin(omega), dtype=np.int16)
                    )
                )
            else:
                pulse = np.zeros((2 * N,), dtype=np.int16)
            origin = np.random.randint(0, N)
            pulse += noise[origin:origin + 2 * N]
            payload = RadarHubType.Scope.to_bytes(1, 'little') + bytearray(pulse)
            self.ws.send(payload)

            # Health
            if j % ht == 0:
                k = int(j / ht) % hdepth
                payload = RadarHubType.Health.to_bytes(1, 'little') + bytes(healthStrings[k], 'utf-8')
                self.ws.send(payload)
            time.sleep(s)
            j += 1

        if self.verbose:
            print('Run loop retired')
            
# Global variables
R = None

healths = [
    {'Python':{'Value':True,'Enum':4}, 'Transceiver':{'Value':True,'Enum':0}, 'Pedestal':{'Value':True,'Enum':0}, 'Health Relay':{'Value':False,'Enum':2}, 'Internet':{'Value':True,'Enum':0}, 'Recorder':{'Value':False,'Enum':1}, 'Ring Filter':{'Value':False,'Enum':1}, 'Processors':{'Value':True,'Enum':0}, 'Measured PRF':{'Value':'1,475 Hz','Enum':0}, 'Noise':[50.274,33.654], 'Position Rate':{'Value':'249 Hz','Enum':0}, 'rayRate':6.010, '10-MHz Clock':{'Value':True,'Enum':0}, 'DAC PLL':{'Value':True,'Enum':0}, 'FPGA Temp':{'Value':'61.5degC','Enum':0}, 'Core Volt':{'Value':'1.00 V','Enum':0}, 'Aux. Volt':{'Value':'2.466 V','Enum':0}, 'XMC Volt':{'Value':'12.223 V','Enum':0}, 'XMC 3p3':{'Value':'3.222 V','Enum':0}, 'Transmit H':{'Value':'57.625 dBm','Enum':0,'MaxIndex':0,'Max':'4.282 dBm','Min':'3.827 dBm'}, 'Transmit V':{'Value':'53.309 dBm','Enum':0,'MaxIndex':1,'Max':'-0.042 dBm','Min':'-0.485 dBm'}, 'DAC QI':{'Value':'0.237','Enum':1}, 'Waveform':{'Value':'x706','Enum':0}, 'UnderOver':[0,233116], 'Lags':[-1167035501,-1167035501,-1185559874], 'NULL':[1602822], 'Pedestal AZ Interlock':{'Value':True,'Enum':0}, 'Pedestal EL Interlock':{'Value':True,'Enum':0}, 'VCP Active':{'Value':True,'Enum':0}, 'Pedestal AZ':{'Value':'337.89 deg','Enum':0}, 'Pedestal EL':{'Value':'3.18 deg','Enum':0}, 'Pedestal Update':'251.021 Hz', 'PedestalHealthEnd':0, 'GPS Valid':{'Value':True,'Enum':3}, 'GPS Latitude':{'Value':'35.2369167','Enum':3}, 'GPS Longitude':{'Value':'-97.4638233','Enum':3}, 'T-Box Bearing':{'Value':'-448.9 deg', 'Enum':0}, 'T-Box Temp':{'Value':'19.6 degC', 'Enum':0}, 'T-Box Pressure':{'Value':'985.7 hPa', 'Enum':0}, 'RF TRX Health':{'Value':'0x70', 'Enum':2}, 'RF Over Temp H':{'Value':True, 'Enum':0}, 'RF Over Temp V':{'Value':False, 'Enum':2}, 'RF VSWR H':{'Value':True, 'Enum':1}, 'RF VSWR V':{'Value':True, 'Enum':0}, 'STALO':{'Value':True, 'Enum':0}, 'tic':'31008358', 'Heading Override':{'Value':True,'Enum':0}, 'Sys Heading':{'Value':'181.00 deg','Enum':0}, 'GPS Override':{'Value':True,'Enum':0}, 'Sys Latitude':{'Value':'35.2369467','Enum':0}, 'Sys Longitude':{'Value':'-97.4638167','Enum':0}, 'Log Time':1570804516},
    {'Python':{'Value':True,'Enum':4}, 'Transceiver':{'Value':True,'Enum':0}, 'Pedestal':{'Value':True,'Enum':0}, 'Health Relay':{'Value':False,'Enum':2}, 'Internet':{'Value':True,'Enum':1}, 'Recorder':{'Value':False,'Enum':2}, 'Ring Filter':{'Value':False,'Enum':1}, 'Processors':{'Value':True,'Enum':0}, 'Measured PRF':{'Value':'1,476 Hz','Enum':0}, 'Noise':[50.274,33.654], 'Position Rate':{'Value':'251 Hz','Enum':0}, 'rayRate':6.001, '10-MHz Clock':{'Value':True,'Enum':0}, 'DAC PLL':{'Value':True,'Enum':0}, 'FPGA Temp':{'Value':'61.4degC','Enum':0}, 'Core Volt':{'Value':'1.01 V','Enum':0}, 'Aux. Volt':{'Value':'2.464 V','Enum':0}, 'XMC Volt':{'Value':'12.225 V','Enum':0}, 'XMC 3p3':{'Value':'3.220 V','Enum':0}, 'Transmit H':{'Value':'57.511 dBm','Enum':0,'MaxIndex':0,'Max':'4.282 dBm','Min':'3.827 dBm'}, 'Transmit V':{'Value':'53.309 dBm','Enum':0,'MaxIndex':1,'Max':'-0.042 dBm','Min':'-0.485 dBm'}, 'DAC QI':{'Value':'0.881','Enum':0}, 'Waveform':{'Value':'x706','Enum':0}, 'UnderOver':[0,233116], 'Lags':[-1167035501,-1167035501,-1185559874], 'NULL':[1602822], 'Pedestal AZ Interlock':{'Value':True,'Enum':0}, 'Pedestal EL Interlock':{'Value':True,'Enum':0}, 'VCP Active':{'Value':True,'Enum':0}, 'Pedestal AZ':{'Value':'337.89 deg','Enum':0}, 'Pedestal EL':{'Value':'3.18 deg','Enum':0}, 'Pedestal Update':'251.021 Hz', 'PedestalHealthEnd':0, 'GPS Valid':{'Value':True,'Enum':3}, 'GPS Latitude':{'Value':'35.2369165','Enum':3}, 'GPS Longitude':{'Value':'-97.4638230','Enum':3}, 'T-Box Bearing':{'Value':'-448.9 deg', 'Enum':0}, 'T-Box Temp':{'Value':'19.6 degC', 'Enum':0}, 'T-Box Pressure':{'Value':'984.3 hPa', 'Enum':0}, 'RF TRX Health':{'Value':'0x71', 'Enum':0}, 'RF Over Temp H':{'Value':True, 'Enum':0}, 'RF Over Temp V':{'Value':False, 'Enum':2}, 'RF VSWR H':{'Value':True, 'Enum':0}, 'RF VSWR V':{'Value':True, 'Enum':0}, 'STALO':{'Value':True, 'Enum':0}, 'tic':'31008358', 'Heading Override':{'Value':True,'Enum':1}, 'Sys Heading':{'Value':'180.00 deg','Enum':0}, 'GPS Override':{'Value':True,'Enum':0}, 'Sys Latitude':{'Value':'35.2369467','Enum':0}, 'Sys Longitude':{'Value':'-97.4638167','Enum':0}, 'Log Time':1570804517},
    {'Python':{'Value':True,'Enum':4}, 'Transceiver':{'Value':True,'Enum':0}, 'Pedestal':{'Value':True,'Enum':0}, 'Health Relay':{'Value':False,'Enum':2}, 'Internet':{'Value':True,'Enum':2}, 'Recorder':{'Value':False,'Enum':0}, 'Ring Filter':{'Value':False,'Enum':1}, 'Processors':{'Value':True,'Enum':0}, 'Measured PRF':{'Value':'1,475 Hz','Enum':0}, 'Noise':[50.274,33.654], 'Position Rate':{'Value':'250 Hz','Enum':0}, 'rayRate':6.005, '10-MHz Clock':{'Value':True,'Enum':0}, 'DAC PLL':{'Value':True,'Enum':1}, 'FPGA Temp':{'Value':'61.4degC','Enum':0}, 'Core Volt':{'Value':'1.02 V','Enum':0}, 'Aux. Volt':{'Value':'2.468 V','Enum':0}, 'XMC Volt':{'Value':'12.224 V','Enum':0}, 'XMC 3p3':{'Value':'3.181 V','Enum':0}, 'Transmit H':{'Value':'57.326 dBm','Enum':0,'MaxIndex':0,'Max':'4.282 dBm','Min':'3.827 dBm'}, 'Transmit V':{'Value':'53.309 dBm','Enum':0,'MaxIndex':1,'Max':'-0.042 dBm','Min':'-0.485 dBm'}, 'DAC QI':{'Value':'0.881','Enum':0}, 'Waveform':{'Value':'x706','Enum':0}, 'UnderOver':[0,233116], 'Lags':[-1167035501,-1167035501,-1185559874], 'NULL':[1602822], 'Pedestal AZ Interlock':{'Value':True,'Enum':0}, 'Pedestal EL Interlock':{'Value':True,'Enum':0}, 'VCP Active':{'Value':True,'Enum':0}, 'Pedestal AZ':{'Value':'337.89 deg','Enum':0}, 'Pedestal EL':{'Value':'3.18 deg','Enum':0}, 'Pedestal Update':'251.021 Hz', 'PedestalHealthEnd':0, 'GPS Valid':{'Value':True,'Enum':3}, 'GPS Latitude':{'Value':'35.2369165','Enum':3}, 'GPS Longitude':{'Value':'-97.4638230','Enum':3}, 'T-Box Bearing':{'Value':'-448.9 deg', 'Enum':0}, 'T-Box Temp':{'Value':'19.6 degC', 'Enum':0}, 'T-Box Pressure':{'Value':'985.0 hPa', 'Enum':0}, 'RF TRX Health':{'Value':'0x71', 'Enum':0}, 'RF Over Temp H':{'Value':True, 'Enum':0}, 'RF Over Temp V':{'Value':False, 'Enum':2}, 'RF VSWR H':{'Value':True, 'Enum':0}, 'RF VSWR V':{'Value':True, 'Enum':0}, 'STALO':{'Value':True, 'Enum':1}, 'tic':'31008358', 'Heading Override':{'Value':True,'Enum':0}, 'Sys Heading':{'Value':'180.50 deg','Enum':0}, 'GPS Override':{'Value':True,'Enum':0}, 'Sys Latitude':{'Value':'35.2369467','Enum':0}, 'Sys Longitude':{'Value':'-97.4638167','Enum':0}, 'Log Time':1570804518},
    {'Python':{'Value':True,'Enum':4}, 'Transceiver':{'Value':True,'Enum':0}, 'Pedestal':{'Value':True,'Enum':0}, 'Health Relay':{'Value':False,'Enum':2}, 'Internet':{'Value':True,'Enum':1}, 'Recorder':{'Value':False,'Enum':2}, 'Ring Filter':{'Value':False,'Enum':1}, 'Processors':{'Value':True,'Enum':0}, 'Measured PRF':{'Value':'1,476 Hz','Enum':0}, 'Noise':[50.274,33.654], 'Position Rate':{'Value':'250 Hz','Enum':0}, 'rayRate':6.005, '10-MHz Clock':{'Value':True,'Enum':0}, 'DAC PLL':{'Value':True,'Enum':1}, 'FPGA Temp':{'Value':'61.4degC','Enum':0}, 'Core Volt':{'Value':'1.01 V','Enum':0}, 'Aux. Volt':{'Value':'2.463 V','Enum':0}, 'XMC Volt':{'Value':'12.222 V','Enum':0}, 'XMC 3p3':{'Value':'3.196 V','Enum':0}, 'Transmit H':{'Value':'57.326 dBm','Enum':0,'MaxIndex':0,'Max':'4.282 dBm','Min':'3.827 dBm'}, 'Transmit V':{'Value':'53.309 dBm','Enum':0,'MaxIndex':1,'Max':'-0.042 dBm','Min':'-0.485 dBm'}, 'DAC QI':{'Value':'0.881','Enum':0}, 'Waveform':{'Value':'x706','Enum':0}, 'UnderOver':[0,233116], 'Lags':[-1167035501,-1167035501,-1185559874], 'NULL':[1602822], 'Pedestal AZ Interlock':{'Value':True,'Enum':0}, 'Pedestal EL Interlock':{'Value':True,'Enum':0}, 'VCP Active':{'Value':True,'Enum':0}, 'Pedestal AZ':{'Value':'337.89 deg','Enum':0}, 'Pedestal EL':{'Value':'3.18 deg','Enum':0}, 'Pedestal Update':'251.021 Hz', 'PedestalHealthEnd':0, 'GPS Valid':{'Value':True,'Enum':3}, 'GPS Latitude':{'Value':'35.2369165','Enum':3}, 'GPS Longitude':{'Value':'-97.4638230','Enum':3}, 'T-Box Bearing':{'Value':'-448.9 deg', 'Enum':0}, 'T-Box Temp':{'Value':'19.6 degC', 'Enum':0}, 'T-Box Pressure':{'Value':'985.0 hPa', 'Enum':0}, 'RF TRX Health':{'Value':'0x71', 'Enum':0}, 'RF Over Temp H':{'Value':True, 'Enum':0}, 'RF Over Temp V':{'Value':False, 'Enum':2}, 'RF VSWR H':{'Value':True, 'Enum':0}, 'RF VSWR V':{'Value':True, 'Enum':1}, 'STALO':{'Value':True, 'Enum':0}, 'tic':'31008358', 'Heading Override':{'Value':True,'Enum':0}, 'Sys Heading':{'Value':'180.75 deg','Enum':0}, 'GPS Override':{'Value':True,'Enum':0}, 'Sys Latitude':{'Value':'35.2369467','Enum':0}, 'Sys Longitude':{'Value':'-97.4638167','Enum':0}, 'Log Time':1570804519}
]
healthStrings = [json.dumps(s) for s in healths]
hdepth = len(healths)

def handleSignals(sig, frame):
    print(f'\nCaught {sig}')
    if R:
        R.stop()

def handleOpen(ws):
    if R.verbose:
        print(f'ONOPEN')
    if R.verbose < 3:
        websocket.enableTrace(False)
    message = json.dumps({'radar':R.name, 'command':'radarConnect'})
    payload = RadarHubType.Handshake.to_bytes(1, 'little') + bytes(message, 'utf-8')
    ws.send(payload)
    controls = {
        'name':R.name,
        'Controls':[
            {'Label':'Go','Command':'t y'},
            {'Label':'Stop','Command':'t z'},
            {'Label':'Try Me 1','Command':'t w 1'},
            {'Label':'Try Me 2','Command':'t w 2'},
            {'Label':'PRF 1,000 Hz (84 km)','Command':'t prf 1000'},
            {'Label':'PRF 1,475 Hz (75 km)','Command':'t prf 1475'},
            {'Label':'PRF 2,000 Hz (65 km)','Command':'t prf 2000'},
            {'Label':'PRF 3,000 Hz (40 km)','Command':'t prf 3003'},
            {'Label':'PRF 4,000 Hz (28 km)','Command':'t prf 4000'},
            {'Label':'PRF 5,000 Hz (17.6 km)','Command':'t prf 5000'},
            {'Label':'Stop Pedestal','Command':'p stop'},
            {'Label':'Park','Command':'p point 0 90'},
            {'Label':'DC PSU On','Command':'h pow on'},
            {'Label':'DC PSU Off','Command':'h pow off'},
            {'Label':'Measure Noise','Command':'t n'},
            {'Label':'Transmit Toggle','Command':'t tx'},
            {'Label':'10us pulse','Command':'t w s10'},
            {'Label':'12us LFM','Command':'t w q0412'},
            {'Label':'20us pulse','Command':'t w s20'},
            {'Label':'50us pulse','Command':'t w s50'},
            {'Label':'TFM + OFM','Command':'t w ofm'},
            {'Label':'OFM','Command':'t w ofmd'},
            {'Label':'1-tilt EL 2.4 deg @ 18 deg/s','Command':'p vol p 2.4 300 18'},
            {'Label':'5-tilt VCP @ 45 deg/s','Command':'p vol p 2 300 45/p 4 300 45/p 6 300 45/p 8 300 45/p 10 300 45'},
            {'Label':'5-tilt VCP @ 25 deg/s','Command':'p vol p 2 300 25/p 4 300 25/p 6 300 25/p 8 300 25/p 10 300 25'},
            {'Label':'5-tilt VCP @ 18 deg/s','Command':'p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18'},
            {'Label':'5-tilt VCP @ 12 deg/s','Command':'p vol p 2 300 12/p 4 300 12/p 6 300 12/p 8 300 12/p 10 300 12'},
            {'Label':'6-tilt VCP @ 18 deg/s','Command':'p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18/p 12 300 18'}
        ]
    }
    controlString = json.dumps(controls)
    payload = RadarHubType.Control.to_bytes(1, 'little') + bytes(controlString, 'utf-8')
    ws.send(payload)

def handleClose(ws, code, message):
    R.disconnect()
    if R.verbose:
        print(f'ONCLOSE code={code}   message={message}')

def handleMessage(ws, message):
    global R
    if R.verbose:
        show = colorize(message, 'yellow')
        print(f'ONMESSAGE {show}')
    if 'Welcome' in message:
        R.connected = True
        return
    if message == 't y':
        R.go = True
        R.rate = 1.0
        reply = f'ACK {message}'
    elif message == 't z':
        R.go = False
        reply = f'ACK {message}'
    elif message == 't w 1':
        R.go = True
        R.rate = -2.5
        reply = f'ACK {message}'
    elif message == 't w 2':
        R.go = True
        R.rate = 5.0
        reply = f'ACK {message}'
    else:
        reply = f'NAK {message}'
    payload = RadarHubType.Response.to_bytes(1, 'little') + bytes(reply, 'utf-8')
    if R.verbose:
        show = colorize(reply, 'green')
        print(f'REPLY {show} ({len(payload)})')
    ws.send(payload)


def main():
    parser = argparse.ArgumentParser(prog='dgen',
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent('''\
        Data Generator in Python
        
        Examples:
            dgen -n nancy radarhub.arrc.ou.edu:443
            dgen -v -n bumblebee radarhub.arrc.ou.edu:443
        '''))
    parser.add_argument('-n', dest='name', default='demo',
        help='sets the radar name reporting to NAME.\n'
        'If not specified, the default name is "demo".')
    parser.add_argument('-s', dest='ssl',
        help='foces SSL to be on. Otherwise, it is inferred from\n'
        'the port number, i.e., 443 on, else off')
    parser.add_argument('-v', dest='verbose', default=0, action='count',
        help='increases verbosity')
    parser.add_argument('host', nargs='?', default='localhost:8000',
        help='host with or without port number')
    args = parser.parse_args()

    signal.signal(signal.SIGINT, handleSignals)

    global R
    R = Reporter(args.name, args.host, verbose=args.verbose)
    R.start()

if __name__ == '__main__':
    main()
