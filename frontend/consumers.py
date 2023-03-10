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
from common import colorize, color_name_value, byte_string

logger = logging.getLogger('frontend')

tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)
bug_red = colorize('BUG', 'red')

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
        show = colorize('Radar.disconnect()', 'green')
        show += ' ' + colorize(self.name, 'yellow')
        show += ' @ /ws/radar/' + colorize(self.pathway, 'pink') + '/'
        show += '  ' + color_name_value('code', code)
        logger.info(show)
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'radarDisconnect',
                'pathway': self.pathway,
                'channel': self.channel_name
            }
        )
        return await super().disconnect(code)

    # Receive message from a pathway through frontend
    # Type 1 - JSON {"command":"radarConnect", "pathway":"px1000", "name":"PX-1000"}
    # Type 2 - Controls in JSON {"Go":{...}, "Stop":{...}, ...}
    # Type 3 - Health in JSON {"Transceiver":{...}, "Pedestal":{...}, ...}
    # Type 4 -
    # Type 5 - Scope binary
    # Type 6 - Command response
    #
    async def receive(self, bytes_data=None):
        func_name = colorize('Radar.receive()', 'green')
        if bytes_data is None or len(bytes_data) == 0:
            logger.info(f'{func_name} nothing')
            return

        if settings.VERBOSE > 2:
            show = func_name
            show += ' ' + colorize(self.pathway, 'pink')
            show += ' ' + byte_string(bytes_data)
            show += f' ({len(bytes_data)})'
            logger.debug(show)

        payload_type = bytes_data[0]

        if payload_type == RadarHubType.Handshake:
            # Type RadarHubType.Handshake (1) should come in as {"command":"radarConnect", "pathway":"demo", "name":"Demo"}
            text_data = bytes_data[1:].decode('utf-8')

            try:
                request = json.loads(text_data)
            except:
                logger.error(f'{func_name} invalid JSON = {text_data}')
                return

            if request.keys() < {'pathway', 'command'}:
                logger.error(f'{func_name} incomplete message {request}')
                return

            pathway = request['pathway']
            if pathway != self.pathway:
                logger.warning(f'{func_name} {bug_red} pathway = {pathway} != self.pathway = {self.pathway}')

            show = func_name
            show += ' ' + colorize(text_data, 'yellow')
            logger.info(show)

            if 'name' in request:
                self.name = request['name']
            else:
                self.name = self.pathway

            show = func_name
            show += ' ' + colorize(self.name, 'yellow')
            show += ' @ /ws/radar/' + colorize(self.pathway, 'pink') + '/'
            show += ' connected'
            logger.info(show)

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
        func_name = colorize('Radar.disconnectRadar()', 'green')
        m = color_name_value('event.message', message)
        logger.info(f'{func_name} {m}')
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
        show = colorize('User.connect()', 'green')
        show += ' @ /ws/' + colorize(self.pathway, 'pink') + '/'
        logger.info(show)
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
        show = colorize('User.disconnect()', 'green')
        show += ' @ /ws/' + colorize(self.pathway, 'pink') + '/'
        show += '  ' + color_name_value('code', code)
        logger.info(show)
        await self.channel_layer.send(
            'backhaul',
            {
                'type': 'userDisconnect',
                'pathway': self.pathway,
                'channel': self.channel_name
            }
        )
        return await super().disconnect(code)

    # Receive message from frontend, which relays commands from the web app, serialized JSON data.
    async def receive(self, text_data=None):
        func_name = colorize('User.receive()', 'green')
        if text_data is None or len(text_data) == 0:
            logger.warning(f'{func_name} empty text_data')
            return

        try:
            request = json.loads(text_data)
        except:
            logger.error(f'{func_name} invalid JSON = {text_data}')
            return

        if request.keys() < {'pathway', 'command'}:
            logger.error(f'{func_name} incomplete message {request}')
            return

        pathway = request['pathway']
        if pathway != self.pathway:
            logger.warning(f'{func_name} {bug_red} pathway = {pathway} != self.pathway = {self.pathway}')

        if get_channel_layer() != self.channel_layer:
            logger.warning(f'{func_name} {bug_red} channel_layer changed')

        global tic

        show = func_name
        show += ' ' + colorize(text_data, 'yellow')
        show += '   ' + color_name_value('tic', tic)
        logger.info(show)

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

    # The following methods are for Backhaul consumer

    async def acceptUser(self, event):
        await self.accept()

    async def disconnectUser(self, event):
        message = event['message']
        func_name = colorize('Radar.disconnectUser()', 'green')
        m = color_name_value('event.message', message)
        logger.info(f'{func_name} {m}')
        await self.send(message)
        await self.close()

    async def messageUser(self, event):
        await self.send(bytes_data=event['message'])
