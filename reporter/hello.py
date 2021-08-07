import asyncio
import websockets

active = True

async def hello():
    # The URI for a RadarConsumer frontend
    uri = "ws://localhost:8000/ws/radar/px1000/"
    # uri = "wss://radarhub.arrc.ou.edu/ws/radar/px1000/"
    async with websockets.connect(uri) as socket:
        await socket.send(b'\1{"radar":"px1000", "command":"report"}')

        while True:
            greeting = await socket.recv()
            print(f'{greeting}')

asyncio.get_event_loop().run_until_complete(hello())
