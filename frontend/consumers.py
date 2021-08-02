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
        packet = json.loads(text_data)
        if 'radar' not in packet:
            print('Message has no radar')
            return
        if 'route' not in packet:
            print('Message has no route')
            return
        if packet['radar'] != self.radar:
            print(f'\033[38;5;197mBUG: radar = {packet["radar"]} != self.radar = {self.radar}\033[m')
        if packet['route'] == 'home':
            if packet['value'] == 'hello':
                print(f'Joining group \033[38;5;87m{self.radar}\033[m')
                self.isUser = True
                await self.channel_layer.group_add(
                    self.radar,
                    self.channel_name
                )
                await self.channel_layer.send(
                    'backhaul',
                    {
                        'type': 'hello',
                        'radar': self.radar,
                        'channel': self.channel_name
                    }
                )
            elif packet['value'] == 'report':
                print(f'Radar {self.radar} is reporting')
                await self.channel_layer.send(
                    'backhaul',
                    {
                        'type': 'report',
                        'radar': self.radar,
                        'channel': self.channel_name
                    }
                )
            else:
                print(f'Expected value = {packet["value"]}')
        elif packet['route'] == 'away':
            await self.channel_layer.send(
                'backhaul',
                {
                    'type': 'relay',
                    'radar': self.radar,
                    'channel': self.channel_name,
                    'command': packet['value']
                }
            )
        else:
            print(f'Unexpected message = {text_data}')
    # The following are methods called by backhaul

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
