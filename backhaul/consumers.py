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

verbose = 1
userChannels = {}
radarChannels = {}
channel_layer = get_channel_layer()

with open('frontend/package.json') as fid:
    tmp = json.load(fid)
    __version__ = tmp['version']

pp = pprint.PrettyPrinter(indent=4, depth=2)

async def _reset():
    await channel_layer.send(
        'backhaul',
        {
            'type': 'reset',
            'message': 'forget everything'
        }
    )

def reset():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_reset())
    # loop.close()

async def _runloop(radar):
    print(f'_runloop \033[38;5;214m{radar}\033[m started')
    payloadQueue = radarChannels[radar]['payloads']
    while radarChannels[radar]['channel']:
        try:
            payload = payloadQueue.get(False, 0.01)
        except:
            continue
        if verbose > 1:
            if len(payload) > 35:
                print(f'_runloop \033[38;5;87m{radar}\033[m \033[38;5;154m{payload[:25]} ... {payload[-5:]}\033[m ({len(payload)})')
            else:
                print(f'_runloop \033[38;5;87m{radar}\033[m \033[38;5;154m{payload}\033[m ({len(payload)})')
        await channel_layer.group_send(
            radar,
            {
                'type': 'relayToUser',
                'payload': payload
            }
        )
        payloadQueue.task_done()
    print(f'_runloop \033[38;5;214m{radar}\033[m retired')

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
                'stream': 'h'
            }
            print(f'\033[38;5;87m{radar}\033[m + {channel}')
            await channel_layer.group_add(radar, channel)

            # Send the last seen payloads of all types
            if radar in radarChannels:
                for _, payload in radarChannels[radar]['last'].items():
                    await channel_layer.send(
                        channel,
                        {
                            'type': 'relayToUser',
                            'payload': payload
                        }
                    )

        print('userChannels =')
        pp.pprint(userChannels)

    # When a user disconnects from the GUI through FrontendConsumer.disconnect()
    async def bye(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.bye() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        print(f'\033[38;5;87m{radar}\033[m - {channel}')
        await channel_layer.group_discard(radar, channel)

        global userChannels
        if channel in userChannels:
            userChannels.pop(channel)

        print('userChannels =')
        pp.pprint(userChannels)

        # If there are no users for this radar, request nothing
        # ...


    # When a user interacts on the GUI through FrontendConsumer.receive()
    async def relay(self, message):
        if message.keys() < {'radar', 'channel', 'command'}:
            print(f'BackhaulConsumer.relay() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']
        command = message['command']

        print(f'BackhaulConsumer.relay() - \033[38;5;154m{command}\033[m')

        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the radar. Everything else gets relayed to the radar and
        # the response is relayed to the user that triggered the Nexus event
        
        radarChannels[radar]['commands'].put(channel)
        await channel_layer.send(
            radarChannels[radar]['channel'],
            {
                'type': 'relayToRadar',
                'command': command
            }
        )

    # When a radar connects through RadarConsumer.connect()
    async def report(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'BackhaulConsumer.report() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if radar in radarChannels and radarChannels[radar]['channel'] is not None:
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
            'payloads': queue.Queue(),
            'commands': queue.Queue(),
            'last': {}
        }
        print(f'Added \033[38;5;170m{radar}\033[m, radarChannels =')
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
            radarChannels[radar]['channel'] = None
            radarChannels[radar]['commands'].join()
            radarChannels[radar]['payloads'].join()
        elif radar not in radar:
            print(f'Radar {radar} not found')
        else:
            print(f'Channel {channel} no match')

        print(f'Removed \033[38;5;170m{radar}\033[m radarChannels =')
        pp.pprint(radarChannels)

    # When a radar sends home a payload through RadarConsumer.receive()
    async def collect(self, message):
        radar = message['radar']
        channel = message['channel']
        payload = message['payload']
        if verbose > 1:
            if len(payload) > 35:
                print(f'BackhaulConsumer.collect() \033[38;5;154m{payload[:25]} ... {payload[-5:]}\033[m ({len(payload)})')
            else:
                print(f'BackhaulConsumer.collect() \033[38;5;154m{payload}\033[m ({len(payload)})')
        # Look up the queue of this radar
        if radar in radarChannels and channel == radarChannels[radar]['channel']:
            type = payload[0]
            if type == 6:
                # Relay the response to the user
                commandQueue = radarChannels[radar]['commands']
                user = commandQueue.get()
                await channel_layer.send(
                    user,
                    {
                        'type': 'relayToUser',
                        'payload': payload,
                    }
                )
                commandQueue.task_done()
            else:
                radarChannels[radar]['payloads'].put(payload)
                radarChannels[radar]['last'][type] = payload

    async def reset(self, message):
        global userChannels, radarChannels
        print('Resetting radarChannels ...')
        # Say goodbye to all radar run loops ...
        for _, radar in radarChannels.items():
            if radar['channel']:
                await channel_layer.send(
                    radar['channel'],
                    {
                        'type': 'rejectRadar',
                        'message': 'Bye'
                    }
                )
                radar['channel'] = None
                radar['commands'].join()
                radar['payloads'].join()

        print('radarChannels =')
        pp.pprint(radarChannels)

        # userChannels = {}
        for user in userChannels.keys():
            await channel_layer.send(
                user,
                {
                    'type': 'disconnectUser',
                    'message': 'Bye'
                }
            )

