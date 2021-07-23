# backhaul/consumers.py

import base64
import asyncio
import threading

from . import data

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

channel_layer = None

async def _runloop(radar):
    data.start()
    s1 = 0
    h1 = 0
    freq = 20

    global channel_layer
    if channel_layer is None:
        channel_layer = get_channel_layer()

    print('\033[38;5;296m{} - {} {}\033[m'.format(__name__, radar, channel_layer.ring_size))
    print('{}'.format(channel_layer.hosts))

    # Request data from the radar only if there are clients (from frontend) for the data stream
    while data.count(radar) > 0:
        # Will eventually make this a radar-dependent function
        s, s0 = data.getSamples()
        if s1 != s0:
            await channel_layer.group_send(
                radar,
                {
                    'type': 'sendSamples',
                    'samples': base64.b64encode(s.tobytes())
                }
            )
            s1 = s0
        # Will eventually make this a radar-dependent function
        h, h0 = data.getHealth()
        if h1 != h0:
            await channel_layer.group_send(
                radar,
                {
                    'type': 'sendHealth',
                    'health': h
                }
            )
            h1 = h0
        await asyncio.sleep(1 / freq)
    print('No more connections for radar = {} (len = {}). Retiring ...'.format(radar, len(channel_layer.hosts)))

def runloop(radar):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_runloop(radar))
    loop.close()

class BackhaulConsumer(AsyncConsumer):
    async def hello(self, message):
        radar = message['radar'] if 'radar' in message else 'horus'
        data.register(radar)
        if data.count(radar) == 1:
            tid = threading.Thread(target=runloop, args=(radar,))
            tid.start()
        channel_layer = get_channel_layer()
        print('{} {}'.format(radar, channel_layer.ring_size))

    async def bye(self, message):
        radar = message['radar'] if 'radar' in message else 'horus'
        data.unregister(radar)

    async def handle(self, body):
        print('handle() not implemented.')
