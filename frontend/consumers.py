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
import threading

from django.conf import settings

from channels.layers import get_channel_layer
from channels.generic.websocket import AsyncWebsocketConsumer

from reporter.enums import RadarHubType
from common import colorize, color_name_value, byte_string, pretty_object_name

logger = logging.getLogger("frontend")

lock = threading.Lock()
tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=2, width=60, sort_dicts=False)
bugRed = colorize("BUG", "red")


class Null(AsyncWebsocketConsumer):
    async def connect(self):
        await self.close()


class Radar(AsyncWebsocketConsumer):
    async def connect(self):
        global tic
        myname = colorize("Radar.connect()", "green")
        if "pathway" not in self.scope["url_route"]["kwargs"]:
            logger.error("Keyword 'pathway' is expected.")
            return await self.close()
        self.pathway = self.scope["url_route"]["kwargs"]["pathway"]
        self.address = self.scope["client"][0]
        self.name = self.pathway
        self.prettyName = pretty_object_name("Radar", self.pathway, self.address)
        myname = self.prettyName + colorize(".connect()", "green")
        info = color_name_value("capacity", self.channel_layer.get_capacity("backhaul"))
        info += "   " + color_name_value("tic", tic)
        logger.debug(f"{myname}   {info}")
        if tic == 0:
            await self.channel_layer.send("backhaul", {"type": "resetChannels"})
        with lock:
            tic += 1
        await self.channel_layer.send(
            "backhaul",
            {
                "type": "radarInit",
                "name": self.name,
                "pathway": self.pathway,
                "channel": self.channel_name,
            },
        )

    async def disconnect(self, code):
        myname = self.prettyName + colorize(".disconnect()", "green")
        logger.info(f"{myname} {color_name_value('code', code)}")
        await self.channel_layer.send(
            "backhaul",
            {
                "type": "radarDisconnect",
                "pathway": self.pathway,
                "channel": self.channel_name,
            },
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
        myname = self.prettyName + colorize(".receive()", "green")
        if bytes_data is None or len(bytes_data) == 0:
            logger.info(f"{myname} nothing")
            return
        payload_type = bytes_data[0]
        if payload_type == RadarHubType.Handshake:
            # Type RadarHubType.Handshake (1) should come in as {"command":"radarConnect", "pathway":"demo", "name":"Demo"}
            text_data = bytes_data[1:].decode("utf-8")
            try:
                request = json.loads(text_data)
            except:
                logger.error(f"{myname} invalid JSON = {text_data}")
                return
            if request.keys() < {"pathway", "command"}:
                logger.error(f"{myname} incomplete message {request}")
                return
            pathway = request["pathway"]
            if pathway != self.pathway:
                logger.warning(f"{myname} {bugRed} pathway = {pathway} != self.pathway")
            self.name = request.get("name", self.pathway)
            global tic
            logger.info(f"{myname} {colorize(text_data, 'yellow')}   {color_name_value('tic', tic)}")
            if tic == 0:
                await self.channel_layer.send("backhaul", {"type": "resetChannels"})
            with lock:
                tic += 1
            await self.channel_layer.send(
                "backhaul",
                {
                    "type": request["command"],
                    "pathway": self.pathway,
                    "channel": self.channel_name,
                    "command": request["payload"] if "payload" in request else None,
                },
            )
            return
        elif payload_type == RadarHubType.Response:
            text = bytes_data[1:].decode("utf-8")
            logger.info(f"{myname} '{colorize(text, 'yellow')}' ({color_name_value('len', len(text))})")
        elif settings.VERBOSE > 2:
            logger.debug(f"{myname} {byte_string(bytes_data)} ({len(bytes_data)})")
        await self.channel_layer.send(
            "backhaul",
            {
                "type": "radarMessage",
                "pathway": self.pathway,
                "channel": self.channel_name,
                "payload": bytes_data,
            },
        )

    # The following methods are for Backhaul consumer

    async def acceptRadar(self, event):
        myname = self.prettyName + colorize(".acceptRadar()", "green")
        if event["pathway"] != self.pathway:
            logger.warning(f"{myname} {bugRed} {event['pathway']} != {self.pathway}")
        logger.info(myname)
        await self.accept()

    async def rejectRadar(self, event):
        myname = self.prettyName + colorize(".rejectRadar()", "green")
        logger.info(myname)
        await self.accept()
        note = event.get("note", None)
        if note is not None:
            await self.send(text_data=note)
        await self.close()

    async def messageRadar(self, event):
        myname = self.prettyName + colorize(".messageRadar()", "green")
        logger.info(f"{myname} '{colorize(event['message'], 'yellow')}'")
        await self.send(text_data=event["message"])

    async def disconnectRadar(self, event):
        myname = self.prettyName + colorize(".disconnectRadar()", "green")
        note = event.get("note", None)
        logger.info(f"{myname} {color_name_value('note', note)}")
        if note is not None:
            await self.send(text_data=note)
        await self.close()


# def makePrettyName(classname, name):
#     return colorize(classname, "green") + "." + colorize(functionname, "yellow")
class User(AsyncWebsocketConsumer):
    async def connect(self):
        global tic
        myname = colorize("User.connect()", "green")
        if "pathway" not in self.scope["url_route"]["kwargs"]:
            logger.error(f"{myname} Keyword 'pathway' is expected.")
            return await self.close()
        self.pathway = self.scope["url_route"]["kwargs"]["pathway"]
        self.address = self.scope["client"][0]
        self.prettyName = pretty_object_name("User", self.pathway, self.address)
        myname = self.prettyName + colorize(".connect()", "green")
        info = color_name_value("tic", tic)
        logger.debug(f"{myname}   {info}")
        if tic == 0:
            await self.channel_layer.send("backhaul", {"type": "resetChannels"})
        with lock:
            tic += 1
        await self.channel_layer.send(
            "backhaul",
            {
                "type": "userInit",
                "pathway": self.pathway,
                "channel": self.channel_name,
            },
        )

    async def disconnect(self, code):
        myname = self.prettyName + colorize(".disconnect()", "green")
        logger.info(f"{myname} {color_name_value('code', code)}")
        await self.channel_layer.send(
            "backhaul",
            {
                "type": "userDisconnect",
                "pathway": self.pathway,
                "channel": self.channel_name,
            },
        )
        return await super().disconnect(code)

    # Receive message from frontend, which relays commands from the web app, serialized JSON data.
    async def receive(self, text_data=None):
        myname = self.prettyName + colorize(".receive()", "green")
        if text_data is None or len(text_data) == 0:
            logger.warning(f"{myname} empty text_data")
            return
        try:
            request = json.loads(text_data)
        except:
            logger.error(f"{myname} invalid JSON = {text_data}")
            return
        if request.keys() < {"pathway", "command"}:
            logger.error(f"{myname} incomplete message {request}")
            return

        pathway = request["pathway"]
        if pathway != self.pathway:
            logger.warning(f"{myname} {bugRed} {pathway} inconsistent")

        if get_channel_layer() != self.channel_layer:
            logger.warning(f"{myname} {bugRed} channel_layer changed")

        logger.info(f"{myname} {colorize(text_data, 'yellow')}")

        await self.channel_layer.send(
            "backhaul",
            {
                "type": request["command"],
                "pathway": self.pathway,
                "channel": self.channel_name,
                "command": request["payload"] if "payload" in request else None,
            },
        )
        return

    # The following methods are for Backhaul consumer

    async def acceptUser(self, event):
        myname = self.prettyName + colorize(".acceptUser()", "green")
        logger.info(myname)
        await self.accept()

    async def messageUser(self, event):
        myname = self.prettyName + colorize(".messageUser()", "green")
        if settings.VERBOSE > 2 and settings.DEBUG:
            logger.debug(f"{myname} {color_name_value('message', event['message'])}")
        await self.send(bytes_data=event["message"])

    async def disconnectUser(self, event):
        myname = self.prettyName + colorize(".disconnectUser()", "green")
        note = event.get("note", None)
        logger.info(f"{myname} {color_name_value('note', note)}")
        if note is not None:
            await self.send(bytes_data=note)
        await self.close()
