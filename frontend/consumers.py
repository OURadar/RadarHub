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
import logging

from django.conf import settings

from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncWebsocketConsumer

from reporter.enums import RadarHubType
from common import colorize

logger = logging.getLogger('frontend')

tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)

class Null(AsyncWebsocketConsumer):
    async def connect(self):
        await self.close()


class Radar(AsyncWebsocketConsumer):
    async def connect(self):
        if 'pathway' not in self.scope['url_route']['kwargs']:
            logger.error('Keyword "pathway" is expected.')
            return await self.close()
        self.pathway = self.scope['url_route']['kwargs']['pathway']
        self.client_ip = self.scope['client'][0]
        if 'name' in self.scope['url_route']['kwargs']:
            self.name = self.scope['url_route']['kwargs']['name']
            print(f'Radar provided name as {self.name}')
        else:
            self.name = self.pathway;
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'radarInit',
                'name': self.name,
                'pathway': self.pathway,
                'channel': self.channel_name,
                'client_ip': self.client_ip
            }
        )

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'radarDisconnect',
                'pathway': self.pathway,
                'channel': self.channel_name
            }
        )
        logger.info(f'Radar {self.name} @ /ws/{self.pathway}/ disconnected {code}.')

    # Receive message from a pathway through frontend
    # Type 1 - JSON {"command":"radarConnect", "pathway":"px1000", "name":"PX-1000"}
    # Type 2 - Controls in JSON {"Go":{...}, "Stop":{...}, ...}
    # Type 3 - Health in JSON {"Transceiver":{...}, "Pedestal":{...}, ...}
    # Type 4 -
    # Type 5 - Scope binary
    # Type 6 - Command response
    #
    async def receive(self, bytes_data=None):
        if bytes_data is None or len(bytes_data) == 0:
            return

        if settings.VERBOSE > 1:
            show = bytes_data
            if len(show) > 30:
                show = f'{bytes_data[:25]} ... {bytes_data[-5:]}'
            show = colorize(show, 'green')
            #if bytes_data[0] == 5 and len(bytes_data) != 801:
            logger.debug(f'Radar.receive() {self.pathway} {show} ({len(bytes_data)})')

        type = bytes_data[0]

        if type == RadarHubType.Handshake:
            # Type RadarHubType.Handshake (1) should come in as {"command":"radarConnect", "pathway":"demo", "name":"Demo"}
            text = bytes_data[1:].decode('utf-8')

            try:
                request = json.loads(text)
            except:
                logger.error(f'Radar.receive() invalid JSON = {text}')
                return

            pp.pprint(request)

            if request.keys() < {'command', 'pathway'}:
                text = colorize('ERROR', 'red')
                logger.error(f'{text} Radar.receive() incomplete message {text}')
                return

            if 'name' in request:
                self.name = request['name']
                print(f'Radar provided name as {self.name}')
            else:
                self.name = self.pathway

            logger.info(f'Radar {self.name} @ /ws/{self.pathway}/ connected.')
            if self.name.lower() != self.pathway:
                text = colorize('WARNING', 'red')
                logger.warning(f'{text} name = {self.name} != self.pathway = {self.pathway}')
                # return

            await self.channel_layer.send(
                'backhaul',
                {
                    'type': request['command'],
                    'pathway': self.pathway,
                    'channel': self.channel_name,
                    'command': request['payload'] if 'payload' in request else None
                }
            )
        else:
            await self.channel_layer.send(
                'backhaul',
                {
                    'type': 'radarMessage',
                    'pathway': self.pathway,
                    'channel': self.channel_name,
                    'payload': bytes_data
                }
            )

    # The following methods are for Backhaul consumer

    async def acceptRadar(self, event):
        await self.accept()

    async def disconnectRadar(self, event):
        message = event['message']
        logger.info(f'Radar.disconnectRadar() event.message = {message}')
        await self.send(event['message'])
        await self.close()

    async def messageRadar(self, event):
        await self.send(text_data=event['message'])


class User(AsyncWebsocketConsumer):
    async def connect(self):
        if 'pathway' not in self.scope['url_route']['kwargs']:
            logger.error('Keyword "pathway" is expected.')
            return await self.close()
        self.pathway = self.scope['url_route']['kwargs']['pathway']
        self.client_ip = self.scope['client'][0]
        # await self.accept()
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'userInit',
                'pathway': self.pathway,
                'channel': self.channel_name,
                'client_ip': self.client_ip
            }
        )

    async def disconnect(self, code):
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'userDisconnect',
                'pathway': self.pathway,
                'channel': self.channel_name
            }
        )

        logger.info(f'user for {self.pathway} disconnected {code}.')

    # Receive message from frontend, which relays commands from the web app, serialized JSON data.
    async def receive(self, text_data=None):
        if text_data is None or len(text_data) == 0:
            return

        try:
            request = json.loads(text_data)
        except:
            logger.error(f'User.receive() json.loads() failed.')
            return

        if request.keys() < {'pathway', 'command'}:
            logger.error(f'User.receive() incomplete message {request}')
            return

        pathway = request['pathway']
        if pathway != self.pathway:
            text = colorize('BUG', 'red')
            logger.warning(f'{text}: pathway = {pathway} != self.pathway = {self.pathway}')

        if get_channel_layer() != self.channel_layer:
            logger.warning(colorize('Channel layer changed', 'red'))

        global tic

        text = colorize(text_data, 'green')
        logger.info(f'User.receive() {text} ({tic})')

        tic += 1

        await self.channel_layer.send(
            'backhaul',
            {
                'type': request['command'],
                'pathway': self.pathway,
                'channel': self.channel_name,
                'command': request['payload'] if 'payload' in request else None
            }
        )
        return

    # The following methods are for backhaul

    async def acceptUser(self, event):
        await self.accept()

    async def disconnectUser(self, event):
        await self.send(event['message'])
        await self.close()

    async def messageUser(self, event):
        await self.send(bytes_data=event['message'])
