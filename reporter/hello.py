import asyncio
import websockets

active = True

async def hello():
    # uri = "ws://localhost:8000/ws/px1000/"
    uri = "wss://radarhub.arrc.ou.edu/ws/px1000/"
    async with websockets.connect(uri) as socket:
        await socket.send('{"radar":"px1000", "command":"report"}')

        greeting = await socket.recv()
        print(f'{greeting}')

asyncio.get_event_loop().run_until_complete(hello())
