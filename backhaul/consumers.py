# backhaul/consumers.py
#
#   RadarHub
#   Backhaul Worker
#
#   Consumers that interact with frontend.User and frontend.Radar
#   through redis channels. There is a run loop for each pathway to
#   monitor the overall data streams.
#
#   Theory of Operations:
#   - Radar incoming connection triggers Radar.connect(), then relay to Backhaul.radarInit()
#     - Backhaul.radarInit() determines if the pathway is available
#       - If the pathway is occupied, Radar.disconnect() the incoming connection
#       - If the pathway is available, launches a runloop for this pathway, then
#         frontend Radar.acceptRadar()
#   - Radar can terminate the connection through Radar.disconnect(), then relay to Backhaul.radarDisconnect()
#       - Pathway registry is reinitilized but keeping the pathway so that the last snapshot of everything is kept
#
#   - User incoming connection triggers User.connect(), then relay to Backhaul.userInit()
#     - Backhaul.userInit() determines if the channel has been occupied
#       - If the channel is occupied, User.disconnect() the incoming connection and remove the channel
#       - If the channel is new, User.acceptUser() and add the channel to the user registry
#       - The user is added to the channel group for the pathway (e.g., px1000)
#   - User can terminate the connection through User.disconnect(), then relay to Backhaul.userDisconnect()
#       - The user is removed from the channel group for the pathway
#       - The user is removed from the user registry
#
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

import asyncio
import json
import logging
import pprint
import queue
import struct
import threading
import time

from django.conf import settings

from channels.layers import get_channel_layer
from channels.consumer import AsyncConsumer

from reporter.enums import RadarHubType
from common import colorize, byte_string, pretty_object_name

logger = logging.getLogger("backhaul")

COMMAND_CAPACITY = 10
PAYLOAD_CAPACITY = 100

userRegistry = {}
pathwayRegistry = {}
payloadDefinition = json.dumps({e.name: e.value for e in RadarHubType})
channelLayer = get_channel_layer()
lock = threading.Lock()
tic = 0

pp = pprint.PrettyPrinter(indent=1, depth=2, width=140, sort_dicts=False)


def updatePathwayRegistry(pathway, channel=None):
    global pathwayRegistry
    with lock:
        welcome = pathwayRegistry.get(pathway, {}).get("welcome", {})
        if channel is None:
            pathwayRegistry[pathway] = {
                "channel": None,
                "payloadQueue": None,
                "commandQueue": None,
                "reponseQueue": None,
                "updated": 0,
                "welcome": welcome,
            }
        else:
            pathwayRegistry[pathway] = {
                "channel": channel,
                "payloadQueue": queue.Queue(maxsize=PAYLOAD_CAPACITY),
                "commandQueue": queue.Queue(maxsize=COMMAND_CAPACITY),
                "reponseQueue": queue.Queue(maxsize=COMMAND_CAPACITY),
                "updated": time.monotonic(),
                "welcome": welcome,
            }
    showRegistriesIfNeeded()


def updateUserRegistry(channel, pathway=None, streams="h"):
    global userRegistry
    with lock:
        if pathway is None:
            userRegistry.pop(channel)
        else:
            userRegistry[channel] = {"pathway": pathway, "streams": streams}
    showRegistriesIfNeeded()


def showRegistriesIfNeeded():
    if settings.DEBUG is False and settings.VERBOSE < 1:
        return
    with lock:
        print("pathwayChannels =")
        pp.pprint(pathwayRegistry)
        print("userChannels =")
        simpleUserRegistry = {k[-32:]: v for k, v in userRegistry.items()}
        pp.pprint(simpleUserRegistry)


def hangup():
    logger.info(colorize("Backhaul.consumers.hangup()", "green"))
    with lock:
        for registry in pathwayRegistry.values():
            registry["hangup"] = True


def reset():
    logger.info(colorize("Backhaul.consumers.reset()", "green"))

    async def _reset():
        await channelLayer.send(
            "backhaul",
            {
                "type": "resetChannels",
                "note": "konichiwa",
            },
        )

    try:
        eventLoop = asyncio.get_event_loop()
        eventLoop.run_until_complete(_reset())
    except:
        asyncio.run(_reset())


async def _runLoop(pathway):
    global pathwayChannels
    assert pathway in pathwayRegistry, f"{myname} {pathway} not found"
    payloadQueue = pathwayRegistry[pathway]["payloadQueue"]
    commandQueue = pathwayRegistry[pathway]["commandQueue"]
    responseQueue = pathwayRegistry[pathway]["reponseQueue"]
    assert payloadQueue is not None, f"{myname} {pathway} payloadQueue is None"
    assert commandQueue is not None, f"{myname} {pathway} commandQueue is None"
    assert responseQueue is not None, f"{myname} {pathway} responseQueue is None"

    registry = pathwayRegistry[pathway]
    channel = registry.get("channel", None)
    myname = pretty_object_name("Backhaul.runloop", pathway, channel[-8:])
    logger.info(f"{myname} started")

    # Keep sending the group everything so long as pathway & channel continue to exist
    t1 = 0
    s1 = 0
    while channel == pathwayRegistry.get(pathway, {}).get("channel", None):
        rc = 0
        qs = payloadQueue.qsize()
        if qs > 80:
            logger.warning(f"{myname} qs:{qs}, purging ...")
            while payloadQueue.qsize() > 5:
                payloadQueue.get()
                payloadQueue.task_done()
                rc += 1
        elif not payloadQueue.empty():
            payload = payloadQueue.get()
            if settings.VERBOSE > 2:
                show = colorize(byte_string(payload), "orange")
                logger.debug(f"{myname} qs:{qs:02d} {show} ({len(payload)})")
            payloadType = payload[0]
            # Response is directed to the original sender, which is stored in command["channel"]
            if payloadType == RadarHubType.Response:
                response = responseQueue.get()
                age = time.monotonic() - response["timestamp"]
                show = f"{colorize(response['command'], 'green')} -> {colorize(payload[1:], 'green')}"
                logger.info(f"{myname} {show} ({age:.3f} s)")
                if response["channel"] == "backhaul":
                    logger.info(f"{myname} response for backhaul")
                else:
                    await channelLayer.send(
                        response["channel"],
                        {
                            "type": "messageUser",
                            "message": payload,
                        },
                    )
            else:
                await channelLayer.group_send(
                    pathway,
                    {
                        "type": "messageUser",
                        "message": payload,
                    },
                )
            payloadQueue.task_done()
            rc = 1
            # Check the sequence of the radial Z
            if payloadType == RadarHubType.RadialZ and len(payload) > 16:
                tt, ei, ee, ai, ae, rs, rd, n = struct.unpack(f"<bhhHHHHH", payload[1:16])
                t0 = tt & 0b00111111
                s0 = (tt & 0b11000000) >> 6
                d = t0 - t1
                if d < 0:  # 6-bit counter overflow
                    d += 64
                if d != 1 or s0 != s1:
                    ei = ei / 32768.0 * 180.0
                    ee = ee / 32768.0 * 180.0
                    ai = ai / 32768.0 * 180.0
                    ae = ae / 32768.0 * 180.0
                    rs = rs * 0.1
                    rd = rd * 0.1
                    qs = payloadQueue.qsize()
                    logger.info(
                        f"{myname} {s0} d{d} E{ei:.1f}-{ee:.1f} A{ai:.1f}-{ae:.1f} r[{rs:.1f},{rd:.1f}] {n} q{qs}"
                    )
                t1 = t0
                s1 = s0
            # Keep the latest copy of Control, Health, or Scope as welcome message for others
            if payloadType in [RadarHubType.Control, RadarHubType.Health, RadarHubType.Scope, RadarHubType.RadialZ]:
                registry["welcome"][payloadType] = payload
        else:
            age = time.monotonic() - registry["updated"]
            if age >= 10.0:
                logger.info(f"{myname} disconnecting stale channel ... (age = {age:.2f} s)")
                await channelLayer.send(
                    "backhaul",
                    {
                        "type": "radarDisconnect",
                        "pathway": pathway,
                        "channel": channel,
                    },
                )
                await channelLayer.send(
                    channel,
                    {
                        "type": "disconnectRadar",
                        "note": f"You are so quiet. Someone else wants /ws/{pathway}/. Bye.",
                    },
                )

        if registry.get("hangup", False):
            logger.info(f"{myname} Hanging up ...")
            await channelLayer.send(
                channel,
                {
                    "type": "disconnectRadar",
                    "note": f"I gotta hang up. Bye.",
                },
            )
            break

        wc = 0
        if not commandQueue.empty():
            command = commandQueue.get()
            await channelLayer.send(
                channel,
                {
                    "type": "messageRadar",
                    "message": command["command"],
                },
            )
            commandQueue.task_done()
            responseQueue.put(
                {
                    "channel": command["channel"],
                    "command": command["command"],
                    "timestamp": time.monotonic(),
                }
            )
            wc += 1

        if rc == 0 and wc == 0:
            await asyncio.sleep(0.005)

    logger.info(f"{myname} Retired")

    # Remove the channel from the pathway, channel = None for updatePathwayRegistry()
    updatePathwayRegistry(pathway)


def runLoop(pathway):
    asyncio.new_event_loop().run_until_complete(_runLoop(pathway))


def consolidateStreams():
    streams = ""
    for user in userRegistry.values():
        streams += user["streams"]
    streams = "".join(set(streams))
    return streams


class Backhaul(AsyncConsumer):
    # Reset everything, disconnect everyone, empty all registries
    async def resetChannels(self, event):
        myname = colorize("Backhaul.resetChannels()", "green")
        logger.info(f"{myname} resetting ... {event}")
        note = event.get("note", "bye")
        global userRegistry, pathwayRegistry
        with lock:
            if len(pathwayRegistry):
                logger.info(f"{myname} resetting pathwayChannels ...")
                for pathway in pathwayRegistry.values():
                    if pathway["channel"] is None:
                        continue
                    await channelLayer.send(
                        pathway["channel"],
                        {
                            "type": "disconnectRadar",
                            "note": note,
                        },
                    )
                pathwayRegistry = {}
            if len(userRegistry):
                logger.info(f"{myname} resetting userChannels ...")
                for user in userRegistry.keys():
                    await channelLayer.send(
                        user,
                        {
                            "type": "disconnectUser",
                            "note": bytes(f"{RadarHubType.Response:c}{note}", "utf-8"),
                        },
                    )
                userRegistry = {}

    # When a new user connects from the GUI through User.connect()
    async def userInit(self, message):
        myname = colorize("Backhaul.userInit()", "green")
        assert message.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {message}"
        pathway = message["pathway"]
        channel = message["channel"]
        # Check if the channel is already in use, if so, disconnect the old user
        global userRegistry
        if channel in userRegistry:
            logger.warning(f"{myname} user {channel} collision, disconnecting ...")
            await channelLayer.send(
                channel,
                {
                    "type": "disconnectUser",
                    "note": f"{RadarHubType.Response:c}Bye",
                },
            )
            userRegistry.pop(channel)
            return
        logger.info(f"{myname} accepting {pretty_object_name('', pathway, channel[-8:])} ...")
        await channelLayer.send(
            channel,
            {
                "type": "acceptUser",
                "pathway": pathway,
            },
        )
        updateUserRegistry(channel, pathway)
        await channelLayer.group_add(pathway, channel)

        # IDEA: Could replace with something that depends on requested streams.
        # Proposed group name: pathway + product, e.g.,
        # - f'{pathway}-h' for health
        # - f'{pathway}-i' for scope iq (latest pulse)
        # - f'{pathway}-z' for z (reflectivity)
        # - f'{pathway}-v' for v (velocity)
        # - ...

    # When a user requests to connect through User.receive()
    async def userGreet(self, message):
        myname = colorize("Backhaul.userGreet()", "green")
        assert message.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {message}"
        pathway = message["pathway"]
        channel = message["channel"]
        # Always send the type definition first
        await channelLayer.send(
            channel,
            {
                "type": "messageUser",
                "message": bytes([RadarHubType.Handshake]) + bytearray(payloadDefinition, "utf-8"),
            },
        )
        # Send the last seen payloads of all types as a welcome message
        for payload in pathwayRegistry.get(pathway, {}).get("welcome", {}).values():
            await channelLayer.send(
                channel,
                {
                    "type": "messageUser",
                    "message": payload,
                },
            )
        # TODO: greeting message may contain stream request
        streams = consolidateStreams()
        logger.info(f"{myname} streams = '{colorize(streams, 210)}'")

    # When a user interacts on the GUI through User.receive()
    async def userMessage(self, event):
        myname = colorize("Backhaul.userMessage()", "green") + " " + colorize(event["pathway"], "pink")
        assert event.keys() >= {"pathway", "channel", "command"}, f"{myname} incomplete input {event}"
        pathway = event["pathway"]
        channel = event["channel"]
        command = event["command"]
        # Intercept the 's' commands, consolidate the data stream the update the
        # request from the pathway. Everything else gets relayed to the pathway and
        # the response is relayed to the user that triggered the Nexus event
        global pathwayRegistry
        if pathway not in pathwayRegistry or pathwayRegistry[pathway]["channel"] is None:
            logger.info(f"{myname} not connected")
            await channelLayer.send(
                channel,
                {
                    "type": "messageUser",
                    "message": f"{RadarHubType.Response:c}Radar not connected",
                },
            )
            return
        # Always queue up the command, let the runloop handle it
        commandQueue = pathwayRegistry[pathway]["commandQueue"]
        if commandQueue.full():
            logger.warning(f"Command queue has {commandQueue.qsize()} items")
            return
        global tic
        if settings.VERBOSE:
            logger.info(f"{myname} {colorize(command, 'green')} ({commandQueue.qsize()}) ({tic})")
        with lock:
            tic += 1
        commandQueue.put(
            {
                "channel": channel,
                "command": command,
            }
        )

    # When a user disconnects from the GUI through User.disconnect()
    async def userDisconnect(self, message):
        myname = colorize("Backhaul.userDisconnect()", "green")
        assert message.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {message}"
        pathway = message["pathway"]
        channel = message["channel"]
        if channel not in userRegistry:
            logger.warning(f"{myname} {channel} not found")
            return
        if pathway != userRegistry.get(channel, {}).get("pathway", None):
            logger.warning(f"{myname} {channel} pathway has changed")
        # Remove the user from the pathway group
        updateUserRegistry(channel)
        await channelLayer.group_discard(pathway, channel)
        logger.info(f"{myname} {pretty_object_name('', pathway, channel[-8:])} removed from userChannels")
        # If there are no users for this pathway, request nothing
        # ...
        streams = consolidateStreams()
        logger.info(f"{myname} streams = '{colorize(streams, 210)}'")

    # When a new radar connects from the websocket through Radar.connect()
    async def radarInit(self, message):
        myname = colorize("Backhaul.radarInit()", "green")
        assert message.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {message}"
        pathway = message["pathway"]
        channel = message["channel"]

        print(f"{myname} {pathway} {channel}")

        if pathway in pathwayRegistry and pathwayRegistry[pathway]["channel"] is not None:
            last = time.monotonic() - pathwayRegistry[pathway]["updated"]
            if last < 5.0:
                logger.info(
                    f"{myname} {colorize(pathway, 'pink')} is occupied (last = {last:.2f} s), rejecting new connection ..."
                )
                await channelLayer.send(
                    channel,
                    {
                        "type": "rejectRadar",
                        "note": f"Pathway /ws/radar/{pathway}/ occupied.",
                    },
                )
                return
            # If the pathway is stale, disconnect the old radar
            logger.info(
                f"{myname} {colorize(pathway, 'pink')} is stale (last = {last:.2f} s), allowing the new connection ..."
            )
            await channelLayer.send(
                pathwayRegistry[pathway]["channel"],
                {
                    "type": "disconnectRadar",
                    "note": f"Someone wants /ws/radar/{pathway}/. Bye.",
                },
            )
            # Disconnect the old radar, this will also set the channel of the pathway to None
            await channelLayer.send(
                "backhaul",
                {
                    "type": "radarDisconnect",
                    "pathway": pathway,
                    "channel": channel,
                },
            )
        # Add the channel to the pathway
        updatePathwayRegistry(pathway, channel)
        logger.info(f"{myname} added to pathwayChannels ...")
        logger.info(f"{myname} accepting {pretty_object_name('', pathway, channel[-8:])} ...")
        await channelLayer.send(
            channel,
            {
                "type": "acceptRadar",
                "pathway": pathway,
            },
        )
        for userChannel in userRegistry.keys():
            logger.info(f"Subscribing user {userChannel[-8:]} to {pathway}")
            await channelLayer.group_add(pathway, userChannel)

    # When a radar requests to connect through Radar.receive()
    async def radarGreet(self, event):
        myname = colorize("Backhaul.radarGreet()", "green")
        assert event.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {event}"
        pathway = event["pathway"]
        channel = event["channel"]
        myname = "Backhaul.radarGreet" + pretty_object_name("_", pathway, channel[-8:])
        # A message can still come through during rejectRadar, so check again
        if pathway not in pathwayRegistry or channel != pathwayRegistry[pathway]["channel"]:
            existing = pretty_object_name("_", pathway, pathwayRegistry.get(pathway, {}).get("channel", "-")[-8:])
            logger.debug(f"{myname} expected {existing}, discarding ...")
            return
        # Launch a run loop for this pathway
        threading.Thread(target=runLoop, args=(pathway,)).start()
        # Greet back
        await channelLayer.send(
            channel,
            {
                "type": "messageRadar",
                "message": f"Hello {pathway}. Welcome to RadarHub v{settings.VERSION}",
            },
        )
        # Go through all the users and generate a consolidated stream
        streams = consolidateStreams()
        logger.info(f"{myname} streams = '{colorize(streams, 205)}'")
        commandQueue = pathwayRegistry[pathway]["commandQueue"]
        commandQueue.put(
            {
                "channel": "backhaul",
                "command": f"s {streams}",
            }
        )

    # When a radar sends home a payload through Radar.receive()
    async def radarMessage(self, event):
        myname = colorize("Backhaul.radarMessage()", "green")
        assert event.keys() >= {"pathway", "channel", "payload"}, f"{myname} incomplete input {event}"
        pathway = event["pathway"]
        channel = event["channel"]
        payload = event["payload"]
        myname += " " + pretty_object_name("", pathway, channel[-8:])
        # This is when a radar connects using pathway that is already occupied, and starts sending in payloads
        if pathway not in pathwayRegistry or channel != pathwayRegistry[pathway]["channel"]:
            if settings.DEBUG and settings.VERBOSE > 2:
                existing = pretty_object_name("", pathway, pathwayRegistry.get(pathway, {}).get("channel", "-")[-8:])
                logger.debug(f"{myname} expected {existing}, discarding ...")
            return
        # Queue up the payload.
        payloadQueue = pathwayRegistry[pathway]["payloadQueue"]
        payloadQueue.put(payload)
        if settings.DEBUG and settings.VERBOSE > 2:
            show = colorize(byte_string(payload), "orange")
            logger.debug(f"{myname} {show} ({len(payload)})")
        pathwayRegistry[pathway]["updated"] = time.monotonic()

    # When a radar diconnects through Radar.disconnect()
    async def radarDisconnect(self, event):
        myname = colorize("Backhaul.radarDisconnect()", "green")
        assert event.keys() >= {"pathway", "channel"}, f"{myname} incomplete input {event}"
        pathway = event["pathway"]
        channel = event["channel"]
        myname += " " + pretty_object_name("", pathway, channel[-8:])
        # A radarDisconnect can still come through during rejectRadar, so check again
        if pathway not in pathwayRegistry or channel != pathwayRegistry[pathway]["channel"]:
            channel = pathwayRegistry.get(pathway, {}).get("channel", None)
            existing = pretty_object_name("", pathway, channel[-8:] if channel else "-")
            logger.debug(f"{myname} expected {existing}, discarding ...")
            return
        # Remove the channel from the pathway, channel = None for updatePathwayRegistry()
        updatePathwayRegistry(pathway)
        logger.info(f"{myname} {pretty_object_name('', pathway, channel[-8:])} removed from pathwayChannels")
