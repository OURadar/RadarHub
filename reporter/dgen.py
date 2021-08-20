import time
# from io import open_code
import websocket

import numpy as np

from enums import RadarHubType

wantActive = True
verbose = 1

healthString = [
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":0}, "Recorder":{"Value":false,"Enum":1}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"249 Hz","Enum":0}, "rayRate":6.010, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.5degC","Enum":0}, "Core Volt":{"Value":"1.00 V","Enum":0}, "Aux. Volt":{"Value":"2.466 V","Enum":0}, "XMC Volt":{"Value":"12.223 V","Enum":0}, "XMC 3p3":{"Value":"3.222 V","Enum":0}, "Transmit H":{"Value":"57.625 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.237","Enum":1}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369167","Enum":3}, "GPS Longitude":{"Value":"-97.4638233","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.7 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x70", "Enum":2}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"181.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":1}, "Sys Latitude":{"Value":"35.2369467","Enum":0}, "Sys Longitude":{"Value":"-97.4638167","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804516}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"251 Hz","Enum":0}, "rayRate":6.001, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":0}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.464 V","Enum":0}, "XMC Volt":{"Value":"12.225 V","Enum":0}, "XMC 3p3":{"Value":"3.220 V","Enum":0}, "Transmit H":{"Value":"57.511 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"984.3 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":1}, "Sys Heading":{"Value":"180.00 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369461","Enum":0}, "Sys Longitude":{"Value":"-97.4638169","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804517}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":2}, "Recorder":{"Value":false,"Enum":0}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,475 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.02 V","Enum":0}, "Aux. Volt":{"Value":"2.468 V","Enum":0}, "XMC Volt":{"Value":"12.224 V","Enum":0}, "XMC 3p3":{"Value":"3.181 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":0}, "STALO":{"Value":true, "Enum":1}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.50 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369455","Enum":0}, "Sys Longitude":{"Value":"-97.4638165","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804518}',
    '{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Health Relay":{"Value":false,"Enum":2}, "Internet":{"Value":true,"Enum":1}, "Recorder":{"Value":false,"Enum":2}, "Ring Filter":{"Value":false,"Enum":1}, "Processors":{"Value":true,"Enum":0}, "Measured PRF":{"Value":"1,476 Hz","Enum":0}, "Noise":[50.274,33.654], "Position Rate":{"Value":"250 Hz","Enum":0}, "rayRate":6.005, "FFTPlanUsage":{"1":0,"2":0,"4":0,"8":0,"16":0,"32":0,"64":0,"128":0,"256":0,"512":0,"1024":0,"2048":0,"4096":1185588352,"8192":0,"16384":1185588352,"32768":0}, "10-MHz Clock":{"Value":true,"Enum":0}, "DAC PLL":{"Value":true,"Enum":1}, "FPGA Temp":{"Value":"61.4degC","Enum":0}, "Core Volt":{"Value":"1.01 V","Enum":0}, "Aux. Volt":{"Value":"2.463 V","Enum":0}, "XMC Volt":{"Value":"12.222 V","Enum":0}, "XMC 3p3":{"Value":"3.196 V","Enum":0}, "Transmit H":{"Value":"57.326 dBm","Enum":0,"MaxIndex":0,"Max":"4.282 dBm","Min":"3.827 dBm"}, "Transmit V":{"Value":"53.309 dBm","Enum":0,"MaxIndex":1,"Max":"-0.042 dBm","Min":"-0.485 dBm"}, "DAC QI":{"Value":"0.881","Enum":0}, "Waveform":{"Value":"x706","Enum":0}, "UnderOver":[0,233116], "Lags":[-1167035501,-1167035501,-1185559874], "NULL":[1602822], "Pedestal AZ Interlock":{"Value":true,"Enum":0}, "Pedestal EL Interlock":{"Value":true,"Enum":0}, "VCP Active":{"Value":true,"Enum":0}, "Pedestal AZ":{"Value":"337.89 deg","Enum":0}, "Pedestal EL":{"Value":"3.18 deg","Enum":0}, "Pedestal Update":"251.021 Hz", "PedestalHealthEnd":0, "GPS Valid":{"Value":true,"Enum":3}, "GPS Latitude":{"Value":"35.2369165","Enum":3}, "GPS Longitude":{"Value":"-97.4638230","Enum":3}, "T-Box Bearing":{"Value":"-448.9 deg", "Enum":0}, "T-Box Temp":{"Value":"19.6 degC", "Enum":0}, "T-Box Pressure":{"Value":"985.0 hPa", "Enum":0}, "RF TRX Health":{"Value":"0x71", "Enum":0}, "RF Over Temp H":{"Value":true, "Enum":0}, "RF Over Temp V":{"Value":false, "Enum":2}, "RF VSWR H":{"Value":true, "Enum":0}, "RF VSWR V":{"Value":true, "Enum":1}, "STALO":{"Value":true, "Enum":0}, "tic":"31008358", "Heading Override":{"Value":true,"Enum":0}, "Sys Heading":{"Value":"180.75 deg","Enum":0}, "GPS Override":{"Value":true,"Enum":0}, "Sys Latitude":{"Value":"35.2369443","Enum":0}, "Sys Longitude":{"Value":"-97.4638163","Enum":0}, "LocationFromDescriptor":true, "Log Time":1570804519}'
]

controlString = '{"name": "demo", "Controls": [{"Label": "Go", "Command": "t y"}, {"Label": "Stop", "Command": "t z"}, {"Label": "PRF 1,000 Hz (84 km)", "Command": "t prf 1000"}, {"Label": "PRF 1,475 Hz (75 km)", "Command": "t prf 1475"}, {"Label": "PRF 2,000 Hz (65 km)", "Command": "t prf 2000"}, {"Label": "PRF 3,000 Hz (40 km)", "Command": "t prf 3003"}, {"Label": "PRF 4,000 Hz (28 km)", "Command": "t prf 4000"}, {"Label": "PRF 5,000 Hz (17.6 km)", "Command": "t prf 5000"}, {"Label": "Stop Pedestal", "Command": "p stop"}, {"Label": "Park", "Command": "p point 0 90"}, {"Label": "DC PSU On", "Command": "h pow on"}, {"Label": "DC PSU Off", "Command": "h pow off"}, {"Label": "Measure Noise", "Command": "t n"}, {"Label": "Transmit Toggle", "Command": "t tx"}, {"Label": "10us pulse", "Command": "t w s10"}, {"Label": "12us LFM", "Command": "t w q0412"}, {"Label": "20us pulse", "Command": "t w s20"}, {"Label": "50us pulse", "Command": "t w s50"}, {"Label": "TFM + OFM", "Command": "t w ofm"}, {"Label": "OFM", "Command": "t w ofmd"}, {"Label": "1-tilt EL 2.4 deg @ 18 deg/s", "Command": "p vol p 2.4 300 18"}, {"Label": "5-tilt VCP @ 45 deg/s", "Command": "p vol p 2 300 45/p 4 300 45/p 6 300 45/p 8 300 45/p 10 300 45"}, {"Label": "5-tilt VCP @ 25 deg/s", "Command": "p vol p 2 300 25/p 4 300 25/p 6 300 25/p 8 300 25/p 10 300 25"}, {"Label": "5-tilt VCP @ 18 deg/s", "Command": "p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18"}, {"Label": "5-tilt VCP @ 12 deg/s", "Command": "p vol p 2 300 12/p 4 300 12/p 6 300 12/p 8 300 12/p 10 300 12"}, {"Label": "6-tilt VCP @ 18 deg/s", "Command": "p vol p 2 300 18/p 4 300 18/p 6 300 18/p 8 300 18/p 10 300 18/p 12 300 18"}]}'

# def run():
#     print('\033[38;5;15;48;5;63mData interface\033[m started.')
#     # The URI for a Radar frontend
#     uri = "ws://localhost:8000/ws/radar/demo/"
#     # uri = "wss://radarhub.arrc.ou.edu/ws/radar/demo/"

#     a = 25000     # Amplitude in 16-bit ADU
#     N = 1000      # number of samples
#     n = 1000      # noise magnitude
#     t = np.arange(N, dtype=np.float32)
#     pulse = np.zeros((2 * N,), dtype=np.int16)
#     tic = 0
    
#     # Home-made Tukey window here, insteading importing scipy
#     def tukeywin(n=100, alpha=0.1):
#         w = np.ones(n)
#         a = int(alpha * n)
#         w[:a] = 0.5 - 0.5 * np.cos(-np.arange(a) / a * np.pi)
#         w[-a:] = w[:a][::-1]
#         return w
#     w = tukeywin(N)
#     w *= a

#     while wantActive:
#         try:
#             if verbose:
#                 print(f'Connecting {uri} ...')
#             socket = await websockets.connect(uri)
#             if socket is None:
#                 continue

#             print('Sending greeting ...')
#             payload = '{"radar":"demo", "command":"radarConnect"}'
#             payload = RadarHubType.Handshake.to_bytes(1, 'little') + bytes(payload, 'utf-8')
#             await socket.send(payload)

#             greeting = await socket.recv()
#             if verbose:
#                 print(f'{greeting}')

#             payload = RadarHubType.Control.to_bytes(1, 'little') + bytes(controlString, 'utf-8')
#             await socket.send(payload)

#             while wantActive:
#                 #
#                 # Write
#                 #
#                 omega = 0.1 * (t / N + 777 * (t / N) ** 2 + tic)
#                 pulse = np.concatenate(
#                     (
#                         np.array(w * np.cos(omega), dtype=np.int16),
#                         np.array(w * np.sin(omega), dtype=np.int16)
#                     )
#                 )
#                 pulse += np.random.randint(-n, n, size=len(pulse), dtype=np.int16)                
#                 payload = RadarHubType.Scope.to_bytes(1, 'little') + bytearray(pulse)
#                 await socket.send(payload)

#                 if tic % 15 == 0:
#                     k = int(tic / 15) % len(healthString)
#                     payload = RadarHubType.Health.to_bytes(1, 'little') + bytes(healthString[k], 'utf-8')
#                     await socket.send(payload)
#                 #
#                 # Read
#                 #
#                 # try:
#                 #     payload = await asyncio.recv(timeout=0.01)
#                 # except:
#                 #     print('...')
#                 #     pass
#                 # print('---')
#                 #
#                 # There is no non-blocking recv() in websockets? Boo...
#                 #
#                 await asyncio.sleep(0.05)
#                 tic += 1
#         except:
#             if verbose:
#                 print('No Connection.')
#             k = 5
#             while k > 0 and wantActive:
#                 await asyncio.sleep(1)
#                 if verbose:
#                     s = 's' if k > 1 else ''
#                     print(f'\rConnect in {k} second{s} ... ', end='')
#                 k -= 1
#             if verbose:
#                 print('')


def onOpen(ws):
    print('ONOPEN')
    ws.send(RadarHubType.Handshake.to_bytes(1, 'little') + 
        bytes('{"radar":"demo","command":"radarConnect"}', 'utf-8'))

def onClose(ws, code, message):
    print(f'code = {code}   message = {message}')
    ws.close()

def onMessage(ws, message):
    print(message)

def run(ws):
    while True:
        print('...')
        time.sleep(0.1)

class client(websocket.WebSocketApp):
    def __init__(self, url):
        super().__init__(url)
        # 
        self.on_open = onOpen
        self.on_close = onClose
        self.on_message = onMessage

    def send(self, payload):
        return super().send(payload, opcode=websocket.ABNF.OPCODE_BINARY)

    # ws.send_binary(RadarHubType.Response.to_bytes(1, 'little') + bytes(f'NAK {message}', 'utf-8'))

def main(radar='demo', verbose=0):
    if verbose > 1:
        websocket.enableTrace(True)
    url = f'ws://localhost:8000/ws/radar/{radar}/'
    ws = client(url)
    ws.run_forever(suppress_origin=True)

if __name__ == '__main__':
    main()
