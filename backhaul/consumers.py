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
import queue
import pprint
import asyncio
import logging
import threading

from django.conf import settings

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

from reporter.enums import RadarHubType
from common import colorize, color_name_value

logger = logging.getLogger('backhaul')

user_channels = {}
radar_channels = {}
channel_layer = get_channel_layer()
payload_types = json.dumps({e.name: e.value for e in RadarHubType})
lock = threading.Lock()
tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=3, width=60, sort_dicts=False)

async def _reset():
    await channel_layer.send(
        'backhaul',
        {
            'type': 'reset',
            'message': 'Bye'
        }
    )

def reset():
    asyncio.get_event_loop().run_until_complete(_reset())

async def _runloop(radar):
    global radar_channels
    name = colorize(radar, 'pink')
    with lock:
        logger.info(f'runloop {name} started')

    payload_queue = radar_channels[radar]['payloads']

    # Now we just keep sending the group everything from the radar
    while radar_channels[radar]['channel']:
        qsize = payload_queue.qsize()
        if qsize > 80:
            logger.warning(f'{name} qsize = {qsize}, purging ...')
            while payload_queue.qsize() > 5:
                payload_queue.get()
                payload_queue.task_done()
        if not payload_queue.empty():
            payload = payload_queue.get()
            if settings.VERBOSE > 1:
                show = payload
                if len(payload) > 30:
                    show = f'{payload[:20]} ... {payload[-5:]}'
                show = colorize(show, 'green')
                logger.debug(f'_runloop {qsize} {name} {show} ({len(payload)})')
            await channel_layer.group_send(
                radar,
                {
                    'type': 'messageUser',
                    'message': payload
                }
            )
            payload_queue.task_done()
        else:
            await asyncio.sleep(0.01)

    with lock:
        logger.info(f'runloop {name} retired')

def runloop(radar):
    asyncio.new_event_loop().run_until_complete(_runloop(radar))

def consolidateStreams():
    allStreams = ''
    for user in user_channels:
        streams = user['streams']
        allStreams += streams
    allStreams = ''.join(set(allStreams))
    logger.info(f'allStreams = {allStreams}')
    return allStreams

class Backhaul(AsyncConsumer):
    # When a new user connects from the GUI through User.connect()
    async def userInit(self, message):
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.userInit()', 'green')
            show += f' incomplete message {message}'
            logger.info(show)
            return
        radar = message['radar']
        channel = message['channel']
        client_ip = message['client_ip']
        if settings.VERBOSE:
            show = colorize('Backhaul.userInit()', 'green')
            show += ' accepting ' + colorize(client_ip, 'yellow')
            show += ' for ' + colorize(radar, 'pink')
            show += ' ...'
            logger.info(show)
        await channel_layer.send(
            channel,
            {
                'type': 'acceptUser',
                'radar': radar
            }
        )

    # When a user requests to connect through User.receive()
    async def userConnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.userConnect()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return
        radar = message['radar']
        channel = message['channel']

        global user_channels
        if channel in user_channels:
            logger.warning(f'User {channel} already exists, channel_name collision')
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
            # Should replace with something that depends on requested streams.
            # Proposed group name: radar + product, e.g.,
            # - f'{radar}-h' for health
            # - f'{radar}-i' for scope iq (latest pulse)
            # - f'{radar}-z' for z (reflectivity)
            # - f'{radar}-v' for v (velocity)
            # - ...
            show = colorize(radar, 'pink')
            show += colorize(f' + {channel}', 'mint')
            logger.info(show)
            if settings.DEBUG and settings.VERBOSE:
                print('user_channels =')
                pp.pprint(user_channels)

            await channel_layer.group_add(radar, channel)

        if radar in radar_channels:
            # Always send the type definition first
            await channel_layer.send(
                channel,
                {
                    'type': 'messageUser',
                    'message': b'\1' + bytearray(payload_types, 'utf-8')
                }
            )
            # Send the last seen payloads of all types as a welcome message
            for _, payload in radar_channels[radar]['welcome'].items():
                await channel_layer.send(
                    channel,
                    {
                        'type': 'messageUser',
                        'message': payload
                    }
                )

    # When a user disconnects from the GUI through User.disconnect()
    async def userDisconnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.userDisconnect()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return
        radar = message['radar']
        channel = message['channel']

        await channel_layer.group_discard(radar, channel)

        global user_channels
        if channel in user_channels:
            with lock:
                user_channels.pop(channel)
                show = colorize(radar, 'pink')
                show += colorize(f' - {channel}', 'orange')
                logger.info(show)
                if settings.DEBUG and settings.VERBOSE:
                    print('user_channels =')
                    pp.pprint(user_channels)

                # If there are no users for this radar, request nothing
                # ...
        else:
            logger.warning(f'User {channel} no longer exists')

    async def radarInit(self, message):
        # When a new radar connects from the websocket through Radar.connect()
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.radarInit()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return
        radar = message['radar']
        channel = message['channel']
        client_ip = message['client_ip']
        show = colorize('Backhaul.radarInit()', 'green')
        show += ' accepting ' + colorize(radar, 'pink')
        show += ' from ' + colorize(client_ip, 'yellow')
        show += ' ...'
        logger.info(show)
        await channel_layer.send(
            channel,
            {
                'type': 'acceptRadar',
                'radar': radar
            }
        )

    # When a radar requests to connect through Radar.receive()
    async def radarConnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.radarConnect()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
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
            name = colorize(radar, 'pink')
            logger.info(f'Radar {name} added to radar_channels')
            if settings.DEBUG and settings.VERBOSE:
                print('radar_channels =')
                pp.pprint(radar_channels)

        threading.Thread(target=runloop, args=(radar,)).start()

        await channel_layer.send(
            channel,
            {
                'type': 'messageRadar',
                'message': f'Hello {radar}. Welcome to the RadarHub v{settings.VERSION}'
            }
        )

    # When a radar diconnects through Radar.disconnect()
    async def radarDisconnect(self, message):
        if message.keys() < {'radar', 'channel'}:
            show = colorize('Backhaul.radarDisconnect()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return
        radar = message['radar']
        channel = message['channel']

        global radar_channels
        if radar in radar_channels and channel == radar_channels[radar]['channel']:
            with lock:
                radar_channels[radar]['channel'] = None
                radar_channels[radar]['commands'].join()
                radar_channels[radar]['payloads'].join()
                name = colorize(radar, 'pink')
                logger.info(f'Radar {name} removed from radar_channels')
                if settings.DEBUG and settings.VERBOSE:
                    print('radar_channels =')
                    pp.pprint(radar_channels)
        elif radar not in radar_channels:
            show = colorize('Backhaul.radarDisconnect()', 'green')
            show += f' Radar {radar} not found'
            logger.warning(show)
        else:
            with lock:
                logger.info(f'Channel {channel} no match')
                pp.pprint(radar_channels)

    # When a user interacts on the GUI through User.receive()
    async def userMessage(self, message):
        if message.keys() < {'radar', 'channel', 'command'}:
            show = colorize('Backhaul.userMessage()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return
        radar = message['radar']
        channel = message['channel']
        command = message['command']

        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the radar. Everything else gets relayed to the radar and
        # the response is relayed to the user that triggered the Nexus event
        global radar_channels
        if radar not in radar_channels or radar_channels[radar]['channel'] is None:
            show = colorize('Backhaul.userMessage()', 'green')
            show += ' ' + colorize(radar, 'pink')
            show += ' not connected'
            logger.info(show)
            await channel_layer.send(
                channel,
                {
                    'type': 'messageUser',
                    'message': f'{RadarHubType.Response:c}Radar not connected'
                }
            )
            return

        command_queue = radar_channels[radar]['commands']
        if command_queue.full():
            logger.warning(f'Command queue has {command_queue.qsize()} items')
            return

        global tic

        if settings.VERBOSE:
            # with lock:
            name = colorize(radar, 'pink')
            text = colorize(command, 'green')
            logger.info(f'Backhaul.userMessage() {name} {text} ({command_queue.qsize()}) ({tic})')

        tic += 1

        # Push the user message into a FIFO queue
        command_queue.put(channel)
        await channel_layer.send(
            radar_channels[radar]['channel'],
            {
                'type': 'messageRadar',
                'message': command
            }
        )

    # When a radar sends home a payload through Radar.receive()
    async def radarMessage(self, message):
        if message.keys() < {'radar', 'channel', 'payload'}:
            show = colorize('Backhaul.radarMessage()', 'green')
            show += f' incomplete message {message}'
            logger.warning(show)
            return

        radar = message['radar']
        channel = message['channel']
        payload = message['payload']

        if settings.VERBOSE > 1:
            show = payload
            if len(payload) > 30:
                show = f'{payload[:20]} ... {payload[-5:]}'
            show = colorize(show, 'green')
            with lock:
                logger.debug(f'Backhaul.radarMessage() {show} ({len(payload)})')

        # Look up the queue of this radar
        global radar_channels
        if radar not in radar_channels or channel != radar_channels[radar]['channel']:
            # This is when a radar connects as someone that is already connected,
            # did not wait for a welcome message and starts sending in payloads
            return

        # Payload type Response, direct to the earliest request, assumes FIFO
        type = payload[0]
        if type == RadarHubType.Response:
            with lock:
                name = colorize(radar, 'pink')
                show = colorize(payload[1:].decode('utf-8'), 'green')
                logger.info(f'Backhaul.radarMessage() {name} {show}')
            # Relay the response to the user, FIFO style
            command_queue = radar_channels[radar]['commands']
            user = command_queue.get()
            await channel_layer.send(
                user,
                {
                    'type': 'messageUser',
                    'message': payload,
                }
            )
            command_queue.task_done()
            return

        # Queue up the payload, keep this latest copy as welcome message for others
        if not radar_channels[radar]['payloads'].full():
            radar_channels[radar]['payloads'].put(payload)
            radar_channels[radar]['welcome'][type] = payload

    async def reset(self, message='Reset'):
        global user_channels, radar_channels
        with lock:
            if len(radar_channels):
                logger.info('Resetting radar_channels ...')

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

                if settings.DEBUG and settings.VERBOSE:
                    print('radar_channels =')
                    pp.pprint(radar_channels)


            if len(user_channels):
                logger.info('Resetting user_channels ...')

                for user in user_channels.keys():
                    await channel_layer.send(
                        user,
                        {
                            'type': 'disconnectUser',
                            'message': message
                        }
                    )

                user_channels = {}
