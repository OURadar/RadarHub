# frontend/consumers.py

import json
import numpy as np

from django.core.signals import request_finished
from channels.generic.websocket import AsyncWebsocketConsumer

class AsyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.radar = 'unknown'
        if 'radar' in self.scope['url_route']['kwargs']:
            self.radar = self.scope['url_route']['kwargs']['radar']
        self.isUser = False
        await self.accept()

    async def disconnect(self, close_code):
        if self.isUser:
            await self.channel_layer.send(
                'backhaul',
                {
                    'type': 'bye',
                    'radar': self.radar,
                    'channel': self.channel_name
                }
            )
            # Leave the group
            print(f'Leaving group \033[38;5;87m{self.radar}\033[m')
            await self.channel_layer.group_discard(
                self.radar,
                self.channel_name
            )

    # Receive message from frontend, which relays commands from the web app
    async def receive(self, text_data=None):
        print(f'frontend.consumer.receive() - "\033[38;5;154m{text_data}\033[m"')
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
            self.isUser = True
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
                'payload': request['payload'] if 'payload' in request else None
            }
        )

    # The following are methods called by backhaul

    # Welcome a radar
    async def welcomeRadar(self, event):
        await self.send(event['message'])

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


# def hook(sender, **kwargs):
#     print('handleRequestFinished() from {} --> {}'.format(sender, kwargs['signal']))
#
# request_finished.connect(hook)
