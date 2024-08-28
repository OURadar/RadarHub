# backhaul/consumers.py
#
#   RadarHub
#   Backhaul Worker
#
#   Consumers that interact with frontend.User and frontend.Radar
#   through redis channels. There is a run loop for each pathway to
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
import time
import queue
import pprint
import asyncio
import logging
import threading

from django.conf import settings

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

from reporter.enums import RadarHubType
from common import colorize, color_name_value, byte_string, pretty_object_name

logger = logging.getLogger("backhaul")

user_channels = {}
pathway_channels = {}
channel_layer = get_channel_layer()
payload_types = json.dumps({e.name: e.value for e in RadarHubType})
lock = threading.Lock()
tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)


def pathway_channel_init(pathway, channel=None):
    global pathway_channels
    with lock:
        if pathway in pathway_channels:
            if pathway_channels[pathway]["commands"] is not None:
                pathway_channels[pathway]["commands"].join()
                pathway_channels[pathway]["payloads"].join()
            welcome = pathway_channels[pathway]["welcome"]
        else:
            welcome = {}
        if channel is None:
            pathway_channels[pathway] = {"channel": None, "commands": None, "payloads": None, "updated": 0, "welcome": welcome}
        else:
            pathway_channels[pathway] = {
                "channel": channel,
                "commands": queue.Queue(maxsize=10),
                "payloads": queue.Queue(maxsize=100),
                "updated": time.monotonic(),
                "welcome": welcome,
            }


async def _reset():
    await channel_layer.send("backhaul", {"type": "reset", "message": "Bye"})


def reset():
    asyncio.get_event_loop().run_until_complete(_reset())
    logger.debug(colorize("Backhaul.consumers.reset()", "green"))


async def _runloop(pathway):
    global pathway_channels
    myname = pretty_object_name("Backhaul._runloop", pathway)
    with lock:
        logger.info(f"{myname} started")

    payload_queue = pathway_channels[pathway]["payloads"]

    # Now we just keep sending the group everything from the pathway
    while pathway_channels[pathway]["channel"]:
        qs = payload_queue.qsize()
        if qs > 80:
            logger.warning(f"{myname} qs:{qs}, purging ...")
            while payload_queue.qsize() > 5:
                payload_queue.get()
                payload_queue.task_done()
        if not payload_queue.empty():
            payload = payload_queue.get()
            if settings.DEBUG and settings.VERBOSE > 2:
                show = byte_string(payload)
                show = colorize(show, "orange")
                logger.debug(f"{myname} qs:{qs:02d} {show} ({len(payload)})")
            await channel_layer.group_send(pathway, {"type": "messageUser", "message": payload})
            payload_queue.task_done()
        else:
            age = time.monotonic() - pathway_channels[pathway]["updated"]
            if age >= 30.0:
                channel = pathway_channels[pathway]["channel"]
                with lock:
                    logger.info(f"{myname} Retiring (age = {age:.2f} s) ...")
                    logger.info(f"{myname} Channel {channel}")
                await channel_layer.send(
                    pathway_channels[pathway]["channel"],
                    {"type": "disconnectRadar", "message": f"You are so quiet. Someone else wants /ws/{pathway}/. Bye."},
                )
                await channel_layer.send(
                    "backhaul",
                    {
                        "type": "radarDisconnect",
                        "pathway": pathway,
                        "channel": channel,
                    },
                )
            await asyncio.sleep(0.02)

    with lock:
        logger.info(f"{myname} retired")


def runloop(pathway):
    asyncio.new_event_loop().run_until_complete(_runloop(pathway))


def consolidateStreams():
    allStreams = ""
    for user in user_channels:
        streams = user["streams"]
        allStreams += streams
    allStreams = "".join(set(allStreams))
    logger.info(f"allStreams = {allStreams}")
    return allStreams


class Backhaul(AsyncConsumer):
    # When a new user connects from the GUI through User.connect()
    async def userInit(self, message):
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.userInit()", "green")
            show += f" incomplete message {message}"
            logger.info(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]
        client_ip = message["client_ip"]

        pathway_colored = colorize(pathway, "pink")
        client_ip_colored = colorize(client_ip, "yellow")

        if settings.VERBOSE:
            show = colorize("Backhaul.userInit()", "green")
            show += f" accepting {client_ip_colored} for {pathway_colored} ..."
            logger.info(show)
        await channel_layer.send(channel, {"type": "acceptUser", "pathway": pathway})

    # When a user requests to connect through User.receive()
    async def userConnect(self, message):
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.userConnect()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]

        pathway_colored = colorize(pathway, "pink")

        global user_channels
        if channel in user_channels:
            logger.warning(f"User {channel} already exists, channel_name collision")
            await channel_layer.send(channel, {"type": "disconnectUser", "message": "Bye"})
            return

        with lock:
            user_channels[channel] = {"pathway": pathway, "streams": "h"}
            # Should replace with something that depends on requested streams.
            # Proposed group name: pathway + product, e.g.,
            # - f'{pathway}-h' for health
            # - f'{pathway}-i' for scope iq (latest pulse)
            # - f'{pathway}-z' for z (reflectivity)
            # - f'{pathway}-v' for v (velocity)
            # - ...
            show = pathway_colored + colorize(f" + {channel}", "mint")
            logger.info(show)
            if settings.DEBUG and settings.VERBOSE:
                print("user_channels =")
                pp.pprint(user_channels)
                print("pathway_channels = ")
                pp.pprint(pathway_channels)

            await channel_layer.group_add(pathway, channel)

            # Always send the type definition first
            await channel_layer.send(channel, {"type": "messageUser", "message": b"\1" + bytearray(payload_types, "utf-8")})

        if pathway in pathway_channels:
            # Send the last seen payloads of all types as a welcome message
            for _, payload in pathway_channels[pathway]["welcome"].items():
                await channel_layer.send(channel, {"type": "messageUser", "message": payload})

    # When a user disconnects from the GUI through User.disconnect()
    async def userDisconnect(self, message):
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.userDisconnect()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]

        await channel_layer.group_discard(pathway, channel)

        global user_channels
        if channel in user_channels:
            with lock:
                user_channels.pop(channel)
                show = colorize(pathway, "pink")
                show += colorize(f" - {channel}", "orange")
                logger.info(show)
                if settings.DEBUG and settings.VERBOSE:
                    print("user_channels =")
                    pp.pprint(user_channels)

                # If there are no users for this pathway, request nothing
                # ...
        else:
            logger.warning(f"User {channel} no longer exists")

    async def radarInit(self, message):
        # When a new radar connects from the websocket through Radar.connect()
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.radarInit()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]
        client_ip = message["client_ip"]

        pathway_colored = colorize(pathway, "pink")
        client_ip_colored = colorize(client_ip, "yellow")

        show = colorize("Backhaul.radarInit()", "green")
        show += f" accepting {pathway_colored} from {client_ip_colored} ..."
        logger.info(show)
        await channel_layer.send(channel, {"type": "acceptRadar", "pathway": pathway})

    # When a radar requests to connect through Radar.receive()
    async def radarConnect(self, message):
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.radarConnect()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]

        pathway_colored = colorize(pathway, "pink")

        if pathway in pathway_channels and pathway_channels[pathway]["channel"] is not None:
            age = time.monotonic() - pathway_channels[pathway]["updated"]
            if age < 5.0:
                logger.info(f"Pathway {pathway_colored} is currently being used (age = {age}), disconnecting conflict ...")
                await channel_layer.send(
                    channel, {"type": "disconnectRadar", "message": f"Someone is using /ws/radar/{pathway}/. Bye."}
                )
                return

            logger.info(f"Overriding {pathway_colored} (age = {age:.2f} s), allowing the new connection ...")
            await channel_layer.send(
                pathway_channels[pathway]["channel"],
                {"type": "disconnectRadar", "message": f"You're so quiet. Someone wants /ws/radar/{pathway}/. Bye."},
            )
            await channel_layer.send(
                "backhaul",
                {
                    "type": "radarDisconnect",
                    "pathway": pathway,
                    "channel": channel,
                },
            )

        pathway_channel_init(pathway, channel)
        logger.info(f"Pathway {pathway_colored} added to pathway_channels")

        with lock:
            if settings.DEBUG and settings.VERBOSE:
                print("pathway_channels =")
                pp.pprint(pathway_channels)
                print("user_channels = ")
                pp.pprint(user_channels)
            for user_channel in user_channels.keys():
                print(f"Subscribe {user_channel} to {pathway}")
                await channel_layer.group_add(pathway, user_channel)

        threading.Thread(target=runloop, args=(pathway,)).start()

        await channel_layer.send(
            channel, {"type": "messageRadar", "message": f"Hello {pathway}. Welcome to the RadarHub v{settings.VERSION}"}
        )

    # When a radar diconnects through Radar.disconnect()
    async def radarDisconnect(self, message):
        if message.keys() < {"pathway", "channel"}:
            show = colorize("Backhaul.radarDisconnect()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]

        pathway_colored = colorize(pathway, "pink")

        # global pathway_channels
        if pathway not in pathway_channels:
            show = colorize("Backhaul.radarDisconnect()", "green")
            show += f" {pathway_colored} not found"
            logger.warning(show)
            return
        if channel == pathway_channels[pathway]["channel"]:
            pathway_channel_init(pathway)
            logger.info(f"Pathway {pathway_colored} removed from pathway_channels")
            if settings.DEBUG and settings.VERBOSE:
                with lock:
                    print("pathway_channels =")
                    pp.pprint(pathway_channels)
        elif pathway not in pathway_channels:
            show = colorize("Backhaul.radarDisconnect()", "green")
            show += f" Pathway {pathway_colored} not found"
            logger.warning(show)
        else:
            with lock:
                logger.info(f"Channel {channel} no match")
                pp.pprint(pathway_channels)

    # When a user interacts on the GUI through User.receive()
    async def userMessage(self, message):
        if message.keys() < {"pathway", "channel", "command"}:
            show = colorize("Backhaul.userMessage()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return
        pathway = message["pathway"]
        channel = message["channel"]
        command = message["command"]

        pathway_colored = colorize(pathway, "pink")

        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the pathway. Everything else gets relayed to the pathway and
        # the response is relayed to the user that triggered the Nexus event
        global pathway_channels
        if pathway not in pathway_channels or pathway_channels[pathway]["channel"] is None:
            show = colorize("Backhaul.userMessage()", "green")
            show += f" {pathway_colored} not connected"
            logger.info(show)
            await channel_layer.send(channel, {"type": "messageUser", "message": f"{RadarHubType.Response:c}Radar not connected"})
            return

        command_queue = pathway_channels[pathway]["commands"]
        if command_queue.full():
            logger.warning(f"Command queue has {command_queue.qsize()} items")
            return

        global tic

        if settings.VERBOSE:
            # with lock:
            text = colorize(command, "green")
            logger.info(f"Backhaul.userMessage() {pathway_colored} {text} ({command_queue.qsize()}) ({tic})")

        tic += 1

        # Push the user message into a FIFO queue
        command_queue.put(channel)
        await channel_layer.send(pathway_channels[pathway]["channel"], {"type": "messageRadar", "message": command})

    # When a radar sends home a payload through Radar.receive()
    async def radarMessage(self, message):
        if message.keys() < {"pathway", "channel", "payload"}:
            show = colorize("Backhaul.radarMessage()", "green")
            show += f" incomplete message {message}"
            logger.warning(show)
            return

        pathway = message["pathway"]
        channel = message["channel"]
        payload = message["payload"]

        pathway_colored = colorize(pathway, "pink")

        if settings.DEBUG and settings.VERBOSE > 2:
            show = byte_string(payload)
            show = colorize(show, "mint")
            with lock:
                logger.debug(f"Backhaul.radarMessage() {pathway_colored} {show} ({len(payload)})")

        # Look up the queue of this pathway
        global pathway_channels
        if pathway not in pathway_channels or channel != pathway_channels[pathway]["channel"]:
            # This is when a radar connects using pathway that is already occupied,
            # did not wait for a welcome message and starts sending in payloads
            # logger.warning(f"Pathway {pathway} does not exist. Early return.")
            # return
            logger.info(f"Adding {pathway} to pathway_channels ...")
            pathway_channel_init(pathway, channel)

        # Payload type Response, direct to the earliest request, assumes FIFO
        type_name = payload[0]
        if type_name == RadarHubType.Response:
            with lock:
                show = colorize(payload[1:].decode("utf-8"), "green")
                logger.info(f"Backhaul.radarMessage() {pathway_colored} {show}")
            # Relay the response to the user, FIFO style
            command_queue = pathway_channels[pathway]["commands"]
            user = command_queue.get()
            await channel_layer.send(
                user,
                {
                    "type": "messageUser",
                    "message": payload,
                },
            )
            command_queue.task_done()
            return

        # Queue up the payload. Keep the latest copy of Control, Health, or Scope as welcome message for others
        if not pathway_channels[pathway]["payloads"].full():
            pathway_channels[pathway]["payloads"].put(payload)
            pathway_channels[pathway]["updated"] = time.monotonic()
            if type_name in [RadarHubType.Control, RadarHubType.Health, RadarHubType.Scope]:
                pathway_channels[pathway]["welcome"][type_name] = payload

    async def reset(self, message="Reset"):
        global user_channels, pathway_channels
        with lock:
            if len(pathway_channels):
                logger.info("Resetting pathway_channels ...")

                # Say goodbye to all pathway run loops ...
                for _, pathway in pathway_channels.items():
                    if pathway["channel"]:
                        await channel_layer.send(pathway["channel"], {"type": "disconnectRadar", "message": message})
                        pathway_channel_init(pathway)
                        # pathway = pathway_channel_init(None)
                        # pathway['channel'] = None
                        # pathway['commands'] = None
                        # pathway['payloads'] = None
                        # pathway['updated'] = 0
                        # pathway['welcome'] = {}

                if settings.DEBUG and settings.VERBOSE:
                    print("pathway_channels =")
                    pp.pprint(pathway_channels)

            if len(user_channels):
                logger.info("Resetting user_channels ...")

                for user in user_channels.keys():
                    await channel_layer.send(user, {"type": "disconnectUser", "message": message})

                user_channels = {}
