# frontend/consumers.py

import base64
import numpy as np

from django.core.signals import request_finished
from channels.generic.websocket import AsyncWebsocketConsumer

class AsyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.radar = 'unknown'
        if 'radar' in self.scope['url_route']['kwargs']:
            self.radar = self.scope['url_route']['kwargs']['radar']
        self.meta = np.array([0, 0], dtype=np.uint32)

        print('Joining group \033[38;5;82m{}\033[m'.format(self.radar))

        # Join radar
        await self.channel_layer.group_add(
            self.radar,
            self.channel_name
        )
        await self.accept()
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'hello',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )

    # Receive message from frontend
    async def receive(self, text_data=None, bytes_data=None):
        print('receive()')

    async def disconnect(self, close_code):
        print('Leaving group \033[38;5;82m{}\033[m'.format(self.radar))
        self.is_connected = False
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'bye',
                'radar': self.radar,
                'channel': self.channel_name
            }
        )
        # Leave the group
        await self.channel_layer.group_discard(
            self.radar,
            self.channel_name
        )

    async def sendSamples(self, event):
        y = b'\x01' + base64.b64decode(event['samples'])
        await self.send(bytes_data=y)

    async def sendHealth(self, event):
        h = b'\x02' + bytearray(event['health'], 'utf-8')
        await self.send(bytes_data=h)

def hook(sender, **kwargs):
    print('handleRequestFinished() from {} --> {}'.format(sender, kwargs['signal']))

# request_finished.connect(hook)
