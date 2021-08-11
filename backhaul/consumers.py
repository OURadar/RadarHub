# backhaul/consumers.py
#
#   RadarHub
#   Backhaul worker
#
#   Consumers that interact with frontend.User and frontend.Radar
#   through redis channels. There is a run loop for each radar to
#   monitor the overall data streams.
# 
#   Created by Boonleng Cheong
#

#
#             binary              binary
#   +--------+      +------------+      +---------+
#   |        | <--- |            | <--- |         |
#   |  User  |      |  Backhaul  |      |  Radar  |
#   |        | ---> |            | ---> |         |
#   +--------+      +------------+      +---------+
#              text                text 
#   

import json
import pprint
import asyncio
import threading
import queue

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

from reporter.cenums import RadarHubType

verbose = 1
user_channels = {}
radar_channels = {}
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
            'message': 'Bye'
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
            print(f'runloop {name} started')
    payload_queue = radar_channels[radar]['payloads']
    while radar_channels[radar]['channel']:
        qsize = payload_queue.qsize()
        if qsize > 50:
            print(f'{name} qsize = {qsize}')
        if not payload_queue.empty():
            payload = payload_queue.get()
            if verbose > 1:
                tmp = payload
                if len(payload) > 30:
                    tmp = f'{payload[:20]} ... {payload[-5:]}'
                print(f'_runloop {qsize} {name} \033[38;5;154m{tmp}\033[m ({len(payload)})')
            await channel_layer.group_send(
                radar,
                {
                    'type': 'relayToUser',
                    'message': payload
                }
            )
            payload_queue.task_done()
        else:
            await asyncio.sleep(0.01)
    if verbose:
        with lock:
            print(f'runloop {name} retired')

def runloop(radar):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_runloop(radar))
    loop.close()

def consolidateStreams():
    allStreams = ''
    for user in user_channels:
        streams = user['streams']
        allStreams += streams
    allStreams = ''.join(set(allStreams))
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

        global user_channels
        if channel in user_channels:
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
            user_channels[channel] = {
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
                print('user_channels =')
                pp.pprint(user_channels)

            await channel_layer.group_add(radar, channel)

        # Send the last seen payloads of all types as a welcome message
        if radar in radar_channels:
            for _, payload in radar_channels[radar]['welcome'].items():
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

        await channel_layer.group_discard(radar, channel)

        global user_channels
        if channel in user_channels:
            with lock:
                user_channels.pop(channel)
                if verbose:
                    print(f'\033[38;5;87m{radar}\033[m - {channel}')
                    print('user_channels =')
                    pp.pprint(user_channels)

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

        global radar_channels
        if radar in radar_channels and radar_channels[radar]['channel'] is not None:
            print(f'Radar {radar} already exists, disconnecting ...')
            await channel_layer.send(
                channel,
                {
                    'type': 'disconnectRadar',
                    'message': f'Someone is connected as {radar}. Bye.'
                }
            )
            return

        with lock:
            radar_channels[radar] = {
                'channel': channel,
                'commands': queue.Queue(maxsize=10),
                'payloads': queue.Queue(maxsize=100),
                'welcome': {}
            }
            if verbose:
                self.name = f'\033[38;5;170m{radar}\033[m'
                print(f'Added {self.name}, radar_channels =')
                pp.pprint(radar_channels)

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

        global radar_channels
        if radar in radar_channels and channel == radar_channels[radar]['channel']:
            with lock:
                radar_channels[radar]['channel'] = None
                radar_channels[radar]['commands'].join()
                radar_channels[radar]['payloads'].join()
                if verbose:
                    print(f'Removed {self.name}, radar_channels =')
                    pp.pprint(radar_channels)
        elif radar not in radar_channels:
            print(f'Radar {radar} not found')
        else:
            with lock:
                print(f'Channel {channel} no match')
                pp.pprint(radar_channels)


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
        global radar_channels
        if radar not in radar_channels or radar_channels[radar]['channel'] is None:
            print(f'Backhaul.userMessage() - {radar} not connected')
            await channel_layer.send(
                channel,
                {
                    'type': 'relayToUser',
                    'message': f'{RadarHubType.Response}Radar not connected'
                }
            )
            return

        # Push the user message into a FIFO queue
        radar_channels[radar]['commands'].put(channel)
        await channel_layer.send(
            radar_channels[radar]['channel'],
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
            if len(payload) > 30:
                tmp = f'{payload[:20]} ... {payload[-5:]}'
            with lock:
                print(f'Backhaul.radarMessage() \033[38;5;154m{tmp}\033[m ({len(payload)})')

        # Look up the queue of this radar
        global radar_channels
        if radar not in radar_channels or channel != radar_channels[radar]['channel']:
            # This is when a radar connects as someone that is already connected,
            # did not wait for a welcome message and starts sending in payloads
            return

        # Payload type 6 is a response, direct to the earliest request, FIFO
        type = payload[0]
        if type == 6:
            if verbose:
                with lock:
                    text = str(payload[1:], 'utf-8')
                    print(f'Backhaul.radarMessage() - \033[38;5;154m{text}\033[m')
            # Relay the response to the user, FIFO
            command_queue = radar_channels[radar]['commands']
            user = command_queue.get()
            await channel_layer.send(
                user,
                {
                    'type': 'relayToUser',
                    'message': payload,
                }
            )
            command_queue.task_done()
            return

        # Queue up the payload, keep this latest copy as welcome message for others
        if not radar_channels[radar]['payloads'].full():
            radar_channels[radar]['payloads'].put(payload)
            radar_channels[radar]['welcome'][type] = payload

    async def reset(self, message):
        global user_channels, radar_channels
        with lock:
            if len(radar_channels):
                print('Resetting radar_channels ...')

                # Say goodbye to all radar run loops ...
                for _, radar in radar_channels.items():
                    if radar['channel']:
                        await channel_layer.send(
                            radar['channel'],
                            {
                                'type': 'disconnectRadar',
                                'message': message
                            }
                        )
                        radar['channel'] = None
                        radar['commands'] = None
                        radar['payloads'] = None

                if verbose:
                    print('radar_channels =')
                    pp.pprint(radar_channels)


            if len(user_channels):
                print('Resetting user_channels ...')

                for user in user_channels.keys():
                    await channel_layer.send(
                        user,
                        {
                            'type': 'disconnectUser',
                            'message': message
                        }
                    )

                user_channels = {}
