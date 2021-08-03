This makes it to joining group

```
GET /ws/px1000/ HTTP/1.1
Host: localhost
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==
Sec-WebSocket-Protocol: chat, superchat
Sec-WebSocket-Version: 13
```


Message from frontend.ingest

```javascript
JSON.stringify({
  radar: radar_name,
  command: command_to_use_in_backhaul,
  payload: optional_payload_of_the_command,
});
```

Message from frontend.consumers.FrontendConsumer to backhaul.consumers.BackhaulConsumer

```python
channel_layer.send({
    'type': command_from_frontend_injest,
    'radar': radar_name,
    'channel': channel_name_of_the_user
    'command': payload_from_frontend_ingest,
})
```

**IMPORTANT**: injest.js only implements 'relay' command for FrontendConsumer
