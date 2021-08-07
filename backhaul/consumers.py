# backhaul/consumers.py
#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

import json
import pprint
import asyncio
import threading
import queue

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

userChannels = {'backhaul': {
    'radar': 'demo',
    'stream': '',
}}
radarChannels = {'backhaul': {
    'channel': 'backhaul',
    'queue': queue.Queue()
}}
channel_layer = get_channel_layer()

with open('frontend/package.json') as fid:
    tmp = json.load(fid)
    __version__ = tmp['version']

pp = pprint.PrettyPrinter(indent=4)

async def _runloop(radar):
    queue = radarChannels[radar]['queue']
    while radar in radarChannels:
        payload = queue.get()
        # print(f'_runloop \033[38;5;87m{radar}\033[m \033[38;5;154m{payload[:25]} ... {payload[-5:]}\033[m ({len(payload)})')
        queue.task_done()
        await channel_layer.group_send(
            radar,
            {
                'type': 'sendBytes',
                'payload': payload
            }
        )

def runloop(radar):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_runloop(radar))
    loop.close()

class BackhaulConsumer(AsyncConsumer):
    # When a user connects from the GUI through FrontendConsumer.connect()
    async def hello(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.hello() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global userChannels
        if channel not in userChannels:
            userChannels[channel] = {
                'radar': radar,
                'stream': ''
            }
            print(f'Joining group \033[38;5;87m{radar}\033[m')
            await channel_layer.group_add(radar, channel)

        print('radarChannels =')
        pp.pprint(radarChannels)

    # When a user disconnects from the GUI through FrontendConsumer.disconnect()
    async def bye(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.bye() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        # data.unregister(radar)
        print(f'Leaving group \033[38;5;87m{radar}\033[m')
        await channel_layer.group_discard(radar, channel)

        global userChannels
        if channel in userChannels:
            userChannels.pop(channel)

        print('radarChannels =')
        pp.pprint(radarChannels)

    # When a user interacts on the GUI through FrontendConsumer.receive()
    async def relay(self, message):
        if message.keys() < {'radar', 'channel', 'command'}:
            print(f'BackhaulConsumer.relay() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']
        command = message['command']

        print(f'BackhaulConsumer.relay() - \033[38;5;154m{command}\033[m')

        # Will be replaced with actual radar communication here
        # response = data.relayCommand(radar, command);

        # Target milestone:
        # Lookup radar to see if it is connected to the hub
        # If radar is connected, relay the command. Otherwise, response no radar

        # Relay the response to the user
        # await channel_layer.send(
        #     channel,
        #     {
        #         'type': 'sendResponse',
        #         'response': bytearray(response, 'utf-8'),
        #     }
        # )

        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the radar. Everything else gets relayed to the radar and
        # the response is relayed to the user that triggered the Nexus event

    # When a radar connects through RadarConsumer.connect()
    async def report(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.report() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if radar in radarChannels:
            print(f'Radar {radar} already exists')
            await channel_layer.send(
                channel,
                {
                    'type': 'rejectRadar',
                    'message': f'Someone is reporting as {radar}. Bye.'
                }
            )
            return

        radarChannels[radar] = {
            'channel': channel,
            'queue': queue.Queue()
        }
        print(f'Added {radar}:{channel}')
        print('radarChannels =')
        pp.pprint(radarChannels)

        threading.Thread(target=runloop, args=(radar,)).start()

        await channel_layer.send(
            channel,
            {
                'type': 'welcomeRadar',
                'message': f'Hello {radar}. Welcome to the RadarHub v{__version__}'
            }
        )

    # When a radar diconnects through RadarConsumer.disconnect()
    async def retire(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.retire() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if radar in radarChannels and channel == radarChannels[radar]['channel']:
            queue = radarChannels[radar]['queue']
            queue.join()
            radarChannels.pop(radar)
            print(f'Popped {radar}:{channel}')
        elif radar not in radar:
            print(f'Radar {radar} not found')
        else:
            print(f'Channel {channel} no match')
        print('radarChannels =')
        pp.pprint(radarChannels)

    # When a radar sends home a payload through RadarConsumer.receive()
    async def collect(self, message):
        radar = message['radar']
        channel = message['channel']
        payload = message['payload']
        # print(f'channel {channel}')
        # print(f'BackhaulConsumer.collect() \033[38;5;154m{payload[:25]} ... {payload[-5:]}\033[m ({len(payload)})')

        # Look up the queue of this radar
        if radar in radarChannels:
            queue = radarChannels[radar]['queue']
            queue.put(payload)
