# frontend/consumers.py
#
#   RadarHub
#   Frontend consumers of the websocket
#   User - Interface between a user and channels, and
#   Radar - Interface between a radar and channels
#
#   User - message from web UI is always in text form (JSON)
#        - message to web UI is always in binary form (bytearray)
#
#   Radar - message from radar is always in binary form ([type][payload])
#         - message to radar is always in text form (plain text)
#
#   Created by Boonleng Cheong
#

import json
import pprint

from channels.generic.websocket import AsyncWebsocketConsumer

from reporter.enums import RadarHubType
from common import colorize

verbose = 0

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

class Null(AsyncWebsocketConsumer):
    async def connect(self):
        await self.close()


class Radar(AsyncWebsocketConsumer):
    async def connect(self):
        if 'radar' not in self.scope['url_route']['kwargs']:
            print('Keyword "radar" is expected.')
            return await self.close()
        self.radar = self.scope['url_route']['kwargs']['radar']
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'radarDisconnect',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )
        if verbose:
            print(f'radar {self.radar} disconnected {code}.')

    # Receive message from a radar through frontend
    # Type 1 - JSON {"radar":"px1000","command":"radarConnect"}
    # Type 2 - Controls in JSON {"Go":{...},"Stop":{...},...}
    # Type 3 - Health in JSON {"Transceiver":{...},"Pedestal":{...},...}
    # Type 4 -
    # Type 5 - Scope binary
    # Type 6 - Command response
    #
    async def receive(self, bytes_data=None):
        if bytes_data is None or len(bytes_data) == 0:
            return

        if verbose > 1:
            show = bytes_data
            if len(show) > 30:
                show = f'{bytes_data[:25]} ... {bytes_data[-5:]}'
            show = colorize(show, 'green')
            print(f'Radar.receive() {self.radar} {show} ({len(bytes_data)})')

        type = bytes_data[0]

        if type == RadarHubType.Handshake:
            # Type RadarHubType.Handshake (1) should come in as {"radar":"demo", "command":"radarConnect"}
            text = bytes_data[1:].decode('utf-8')

            try:
                request = json.loads(text)
            except:
                print(f'Radar.receive() invalid JSON = {text}')
                return

            if request.keys() < {'radar', 'command'}:
                print('Radar.receive() incomplete message {text}')
                return

            radar = request['radar']
            if radar != self.radar:
                text = colorize('BUG', 'red')
                print(f'{text} radar = {radar} != self.radar = {self.radar}')
                return

            await self.channel_layer.send(
                'backhaul',
                {
                    'type': request['command'],
                    'radar': self.radar,
                    'channel': self.channel_name,
                    'command': request['payload'] if 'payload' in request else None
                }
            )
        else:
            await self.channel_layer.send(
                'backhaul',
                {
                    'type': 'radarMessage',
                    'radar': self.radar,
                    'channel': self.channel_name,
                    'payload': bytes_data
                }
            )

    # The following methods are for backhaul

    async def relayToRadar(self, event):
        await self.send(text_data=event['message'])

    async def disconnectRadar(self, event):
        await self.send(event['message'])
        await self.close()


class User(AsyncWebsocketConsumer):
    async def connect(self):
        if 'radar' not in self.scope['url_route']['kwargs']:
            print('Keyword "radar" is expected.')
            return await self.close()
        self.radar = self.scope['url_route']['kwargs']['radar']
        self.client_ip = self.scope['client'][0]
        print(f'User.connect() {self.client_ip}')
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'userDisconnect',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )

        if verbose:
            print(f'user for {self.radar} disconnected {code}.')

    # Receive message from frontend, which relays commands from the web app, serialized JSON data.
    async def receive(self, text_data=None):
        if text_data is None or len(text_data) == 0:
            return

        if verbose:
            text = colorize(text_data, 'green')
            print(f'User.receive() {text}')

        try:
            request = json.loads(text_data)
        except:
            print(f'User.receive() json.loads() failed.')
            return

        if request.keys() < {'radar', 'command'}:
            print('User.receive() incomplete message {request}')
            return

        radar = request['radar']
        if radar != self.radar:
            text = colorize('BUG', 'red')
            print(f'{text}: radar = {radar} != self.radar = {self.radar}')

        await self.channel_layer.send(
            'backhaul',
            {
                'type': request['command'],
                'radar': self.radar,
                'channel': self.channel_name,
                'command': request['payload'] if 'payload' in request else None
            }
        )
        return

    # The following methods are for backhaul

    async def relayToUser(self, event):
        await self.send(bytes_data=event['message'])

    async def disconnectUser(self, event):
        await self.close()
