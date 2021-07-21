"""
ASGI config for radarhub project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter, ChannelNameRouter
import frontend.routing
import backhaul.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')

# application = get_asgi_application()

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            *frontend.routing.websocket_urlpatterns,
        ]),
    ),
    "channel": ChannelNameRouter({
        **backhaul.routing.channel_urlpatterns,
    }),
})
