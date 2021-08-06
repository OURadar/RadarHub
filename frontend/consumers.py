# frontend/consumers.py
#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.http.response import Http404

class NullConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.close()


class RadarConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if 'radar' in self.scope['url_route']['kwargs']:
            self.radar = self.scope['url_route']['kwargs']['radar']
        print(f'radar = {self.radar}')
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'retire',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )
        print(f'radar = {self.radar} disconnected {code}.')

    # Receive message from frontend, which relays the payload to buffer
    async def receive(self, bytes_data=None):
        if len(bytes_data) < 64:
            print(f'RadarConsumer.receive() \033[38;5;154m{bytes_data}\033[m ({len(bytes_data)})')
        else:
            print(f'RadarConsumer.receive() \033[38;5;154m{bytes_data[:25]} ... {bytes_data[-5:]}\033[m ({len(bytes_data)})')
        type = bytes_data[0];

        if type == 1:
            text = bytes_data[1:].decode('utf-8')
            print(f'text = {text}')
            request = json.loads(text)
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
                })
        else:
            await self.channel_layer.send(
                'backhaul',
                {
                    'type': 'collect',
                    'data': bytes_data
                }
            )

    # Welcome a radar
    async def welcomeRadar(self, event):
        await self.send(event['message'])
        # s = 1024 * 256
        # print(f'size {s}')
        # await self.send('x' * s);

    async def rejectRadar(self, event):
        await self.send(event['message'])
        await self.close()


class FrontendConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.radar = 'unknown'
        if 'radar' in self.scope['url_route']['kwargs']:
            self.radar = self.scope['url_route']['kwargs']['radar']
        print(f'radar = {self.radar}')
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'bye',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )
        print(f'Leaving group \033[38;5;87m{self.radar}\033[m with code {code}')
        await self.channel_layer.group_discard(
            self.radar,
            self.channel_name
        )

    # Receive message from frontend, which relays commands from the web app, text_data only
    async def receive(self, text_data=None):
        print(f'FrontendConsumer.receive() - text_data = "\033[38;5;154m{text_data}\033[m"')
        request = json.loads(text_data)

        if 'radar' not in request:
            print('Message has no radar')
            return
        if 'command' not in request:
            print('Message has no command')
            return
        if request['radar'] != self.radar:
            print(f'\033[38;5;197mBUG: radar = {request["radar"]} != self.radar = {self.radar}\033[m')
        if request['command'] == 'hello':
            print(f'Joining group \033[38;5;87m{self.radar}\033[m')
            await self.channel_layer.group_add(
                self.radar,
                self.channel_name
            )
        await self.channel_layer.send(
            'backhaul',
            {
                'type': request['command'],
                'radar': self.radar,
                'channel': self.channel_name,
                'command': request['payload'] if 'payload' in request else None
            }
        )

    # The following are methods called by backhaul

    # Pulse samples
    async def sendSamples(self, event):
        bytes = b'\x01' + event['samples']
        await self.send(bytes_data=bytes)

    # Health status
    async def sendHealth(self, event):
        bytes = b'\x02' + event['health']
        await self.send(bytes_data=bytes)

    # Control buttons
    async def sendControl(self, event):
        bytes = b'\x03' + event['control']
        await self.send(bytes_data=bytes)

    # Send response
    async def sendResponse(self, event):
        bytes = b'\x04' + event['response']
        await self.send(bytes_data=bytes)

    # Rays, etc.
