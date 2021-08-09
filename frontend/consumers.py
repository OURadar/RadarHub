# frontend/consumers.py
#
#   RadarHub
#   Frontend consumers of the websocket
#   User - Interface between a user and channels, and
#   Radar - Interface between a radar and channels
#
#   User - message from radar is always in binary form
#        - message to web UI is always binary form
#        - message to radar is always in text form
#
#   Radar - message from user is always in text form
#         - message to radar is always in text form
#         - message to user is always in binary form
#
#   Created by Boonleng Cheong
#

import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.http.response import Http404

verbose = 0

class Null(AsyncWebsocketConsumer):
    async def connect(self):
        await self.close()


class Radar(AsyncWebsocketConsumer):
    async def connect(self):
        if 'radar' not in self.scope['url_route']['kwargs']:
            print('Keyword "radar" is expected.')
            await self.close()
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
    # Type 4 - Ray binary
    # Type 5 - Scope binary
    # Type 6 - Command response
    #
    async def receive(self, bytes_data=None):
        if verbose > 1:
            tmp = bytes_data
            if len(tmp) > 30:
                tmp = f'{bytes_data[:25]} ... {bytes_data[-5:]}'
            print(f'Radar.receive() {self.radar} \033[38;5;154m{tmp}\033[m ({len(bytes_data)})')
        type = bytes_data[0];

        if type == 1:
            text = bytes_data[1:].decode('utf-8')
            print(f'Type 1 {text}')
            try:
                request = json.loads(text)
            except:
                print(f'Not a valid JSON text = {text}')
                return
            if 'radar' not in request:
                print('Message has no radar')
                return
            if 'command' not in request:
                print('Message has no command')
                return
            if request['radar'] != self.radar:
                print(f'\033[38;5;197mBUG: radar = {request["radar"]} != self.radar = {self.radar}\033[m')
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

    async def relayToRadar(self, event):
        await self.send(event['message'])

    async def disconnectRadar(self, event):
        await self.send(event['message'])
        await self.close()


class User(AsyncWebsocketConsumer):
    async def connect(self):
        self.radar = 'unknown'
        if 'radar' in self.scope['url_route']['kwargs']:
            self.radar = self.scope['url_route']['kwargs']['radar']
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

    # Receive message from frontend, which relays commands from the web app, text_data only
    async def receive(self, text_data=None):
        print(f'User.receive() \033[38;5;154m{text_data}\033[m')
        request = json.loads(text_data)

        if 'radar' not in request:
            print('Message has no radar')
            return
        if 'command' not in request:
            print('Message has no command')
            return
        if request['radar'] != self.radar:
            print(f'\033[38;5;197mBUG: radar = {request["radar"]} != self.radar = {self.radar}\033[m')
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

    # The following are methods are called by backhaul

    # Forward to GUI
    async def relayToUser(self, event):
        await self.send(bytes_data=event['message'])

    async def disconnectUser(self, event):
        await self.close()
