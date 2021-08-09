# backhaul/consumers.py
#
#   RadarHub
#   Backend consumers of the channels
#   Consumers that interact with frontend.User and frontend.Radar
#   through redis channels
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
lock = threading.Lock()

with open('frontend/package.json') as fid:
    tmp = json.load(fid)
    __version__ = tmp['version']

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

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

async def _runloop(radar):
    name = f'\033[38;5;214m{radar}\033[m'
    if verbose:
        with lock:
            print(f'_runloop {name} started')
    payloadQueue = radarChannels[radar]['payloads']
    while radarChannels[radar]['channel']:
        try:
            payload = payloadQueue.get(False, 0.01)
        except:
            continue
        if verbose > 1:
            tmp = payload
            if len(payload) > 35:
                tmp = f'{payload[:25]} ... {payload[-5:]}'
            print(f'_runloop {name} \033[38;5;154m{tmp}\033[m ({len(payload)})')
        await channel_layer.group_send(
            radar,
            {
                'type': 'relayToUser',
                'message': payload
            }
        )
        payloadQueue.task_done()
    if verbose:
        with lock:
            print(f'_runloop {name} retired')

def runloop(radar):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_runloop(radar))
    loop.close()

def consolidateStreams():
    allStreams = ''
    for user in userChannels:
        streams = user['streams']
        allStreams += streams
    print(f'allStreams = {allStreams}')
    return allStreams

class Backhaul(AsyncConsumer):
    # When a user connects from the GUI through User.connect()
    async def userConnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'Backhaul.userConnect() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global userChannels
        if channel in userChannels:
            print(f'User {channel} already exists, channel_name collision')
            await channel_layer.send(
                channel,
                {
                    'type': 'disconnectUser',
                    'message': 'Bye'
                }
            )
            return

        with lock:
            userChannels[channel] = {
                'radar': radar,
                'streams': 'h'
            }
            # Should replace with depending on requested streams.
            # Proposed group name: radar + product, e.g., 
            # - f'radar.{h}' for health
            # - f'radar.{iq}' for iq
            # - f'radar.{z}' for z (reflectivity)
            # - ...
            if verbose:
                print(f'\033[38;5;87m{radar}\033[m + {channel}')
                print('userChannels =')
                pp.pprint(userChannels)

            await channel_layer.group_add(radar, channel)

        # Send the last seen payloads of all types as a welcome message
        if radar in radarChannels:
            for _, payload in radarChannels[radar]['welcome'].items():
                await channel_layer.send(
                    channel,
                    {
                        'type': 'relayToUser',
                        'message': payload
                    }
                )

    # When a user disconnects from the GUI through User.disconnect()
    async def userDisconnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'Backhaul.userDisconnect() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        print(f'\033[38;5;87m{radar}\033[m - {channel}')
        await channel_layer.group_discard(radar, channel)

        global userChannels
        if channel in userChannels:
            with lock:
                userChannels.pop(channel)

                if verbose:
                    print('userChannels =')
                    pp.pprint(userChannels)

                # If there are no users for this radar, request nothing
                # ...
        else:
            print(f'User {channel} no longer exists')

    # When a radar connects through Radar.connect()
    async def radarConnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'Backhaul.radarConnect() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if radar in radarChannels and radarChannels[radar]['channel'] is not None:
            print(f'Radar {radar} already exists')
            await channel_layer.send(
                channel,
                {
                    'type': 'disconnectRadar',
                    'message': f'Someone is connected as {radar}. Bye.'
                }
            )
            return

        with lock:
            radarChannels[radar] = {
                'channel': channel,
                'commands': queue.Queue(),
                'payloads': queue.Queue(),
                'welcome': {}
            }
            if verbose:
                print(f'Added \033[38;5;170m{radar}\033[m, radarChannels =')
                pp.pprint(radarChannels)

            threading.Thread(target=runloop, args=(radar,)).start()

            await channel_layer.send(
                channel,
                {
                    'type': 'relayToRadar',
                    'message': f'Hello {radar}. Welcome to the RadarHub v{__version__}'
                }
            )

    # When a radar diconnects through Radar.disconnect()
    async def radarDisconnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            print(f'Backhaul.radarDisconnect() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']

        global radarChannels
        if radar in radarChannels and channel == radarChannels[radar]['channel']:
            with lock:
                radarChannels[radar]['channel'] = None
                radarChannels[radar]['commands'].join()
                radarChannels[radar]['payloads'].join()
                if verbose:
                    print(f'Demoted \033[38;5;170m{radar}\033[m radarChannels =')
                    pp.pprint(radarChannels)
        elif radar not in radar:
            print(f'Radar {radar} not found')
        else:
            print(f'Channel {channel} no match')
            pp.pprint(radarChannels)


    # When a user interacts on the GUI through User.receive()
    async def userMessage(self, message):
        if message.keys() < {'radar', 'channel', 'command'}:
            print(f'Backhaul.userMessage() incomplete message {message}')
            return
        radar = message['radar']
        channel = message['channel']
        command = message['command']

        if verbose:
            with lock:
                print(f'Backhaul.userMessage() - \033[38;5;154m{command}\033[m')

        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the radar. Everything else gets relayed to the radar and
        # the response is relayed to the user that triggered the Nexus event

        global radarChannels
        if radar not in radarChannels or radarChannels[radar]['channel'] is None:
            print(f'Backhaul.userMessage() - {radar} not connected')
            await channel_layer.send(
                channel,
                {
                    'type': 'relayToUser',
                    'message': b'\x06Radar not connected'
                }
            )
            return

        # Push the user message into a FIFO queue
        radarChannels[radar]['commands'].put(channel)
        await channel_layer.send(
            radarChannels[radar]['channel'],
            {
                'type': 'relayToRadar',
                'message': command
            }
        )

    # When a radar sends home a payload through Radar.receive()
    async def radarMessage(self, message):
        radar = message['radar']
        channel = message['channel']
        payload = message['payload']
        if verbose > 1:
            tmp = payload
            if len(payload) > 35:
                tmp = f'{payload[:25]} ... {payload[-5:]}'
            print(f'Backhaul.radarMessage() \033[38;5;154m{tmp}\033[m ({len(payload)})')

        # Look up the queue of this radar
        global radarChannels
        if radar not in radarChannels or channel != radarChannels[radar]['channel']:
            print(f'Backhaul.radarMessage() inconsistency detected')
            pp.pprint(radarChannels)
            try:
                await channel_layer.send(
                    channel,
                    {
                        'type': 'disconnectRadar',
                        'message': 'Bakhaul reset. Please reconnect.'
                    }
                )
            except:
                pass
            if radar in radarChannels:
                radarChannels[radar]['channal'] = None
            return

        type = payload[0]
        if type == 6:
            if verbose:
                with lock:
                    text = str(payload[1:], 'utf-8')
                    print(f'Backhaul.radarMessage() - \033[38;5;154m{text}\033[m')
            # Relay the response to the user, FIFO
            commandQueue = radarChannels[radar]['commands']
            user = commandQueue.get()
            await channel_layer.send(
                user,
                {
                    'type': 'relayToUser',
                    'message': payload,
                }
            )
            commandQueue.task_done()
            return

        # Queue up the payload, keep this latest copy as welcome message for others
        radarChannels[radar]['payloads'].put(payload)
        radarChannels[radar]['welcome'][type] = payload

    async def reset(self, message):
        global userChannels, radarChannels
        with lock:
            if len(radarChannels):
                print('Resetting radarChannels ...')

                # Say goodbye to all radar run loops ...
                for _, radar in radarChannels.items():
                    if radar['channel']:
                        await channel_layer.send(
                            radar['channel'],
                            {
                                'type': 'disconnectRadar',
                                'message': 'Bye'
                            }
                        )
                        radar['channel'] = None
                        radar['commands'] = None
                        radar['payloads'] = None

                if verbose:
                    print('radarChannels =')
                    pp.pprint(radarChannels)


            if len(userChannels):
                print('Resetting userChannels ...')

                for user in userChannels.keys():
                    await channel_layer.send(
                        user,
                        {
                            'type': 'disconnectUser',
                            'message': 'Bye'
                        }
                    )

                userChannels = {}
