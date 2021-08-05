# backhaul/consumers.py
#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

import sys
import asyncio
import threading

from . import data

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

userChannels = []
radarChannels = []
channel_layer = get_channel_layer()

async def _runloop(radar):
    data.start()
    s1 = 0
    h1 = 0
    freq = 20

    print(f'\033[38;5;210m{__name__}._runloop  radar={radar}\033[m')

    # Request data from the radar only if there are clients (from frontend) for the data stream
    while data.count(radar) > 0:
        # Will eventually make this a radar-dependent function
        payload, s0 = data.getSamples()
        if s1 != s0:
            await channel_layer.group_send(
                radar,
                {
                    'type': 'sendSamples',
                    'samples': payload.tobytes()
                }
            )
            s1 = s0
        # Will eventually make this a radar-dependent function
        payload, h0 = data.getHealth()
        if h1 != h0:
            await channel_layer.group_send(
                radar,
                {
                    'type': 'sendHealth',
                    'health': bytearray(payload, 'utf-8')
                }
            )
            h1 = h0
        await asyncio.sleep(1 / freq)
    print(f'No more connections for {radar}. Retiring ...')

def runloop(radar):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_runloop(radar))
    loop.close()

class BackhaulConsumer(AsyncConsumer):
    async def hello(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.hello() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        data.register(radar)
        if data.count(radar) == 1:
            tid = threading.Thread(target=runloop, args=(radar,))
            tid.start()

        global userChannels
        if channel not in userChannels:
            userChannels.append(channel)

        payload, _ = data.getControl()
        await channel_layer.send(
            channel,
            {
                'type': 'sendControl',
                'control': bytearray(payload, 'utf-8'),
            }
        )
        payload, _ = data.getHealth()
        await channel_layer.send(
            channel,
            {
                'type': 'sendHealth',
                'health': bytearray(payload, 'utf-8')
            }
        )

    async def report(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.report() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if channel not in radarChannels:
            radarChannels.append(channel)

        await channel_layer.send(
            channel,
            {
                'type': 'welcomeRadar',
                'message': f'Hello {radar}. Welcome to the ARRC RadarHub'
            }
        )

    async def bye(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.bye() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        data.unregister(radar)

        global userChannels
        if channel in userChannels:
            userChannels.remove(channel)

    async def relay(self, message):
        if message.keys() < {'radar', 'channel', 'command'}:
            print(f'BackhaulConsumer.relay() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']
        command = message['command']

        print(f'BackhaulConsumer.relay() - \033[38;5;154m{command}\033[m')

        # Will be replaced with actual radar communication here
        response = data.relayCommand(radar, command);

        # Target milestone:
        # Lookup radar to see if it is connected to the hub
        # If radar is connected, relay the command. Otherwise, response no radar

        # Relay the response to the user
        await channel_layer.send(
            channel,
            {
                'type': 'sendResponse',
                'response': bytearray(response, 'utf-8'),
            }
        )
