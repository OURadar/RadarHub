"""
ASGI config for radarhub project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/3.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from django.conf.urls import url

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter, ChannelNameRouter
import frontend.routing
import backhaul.routing

import django_eventstream

application = ProtocolTypeRouter({
    # Django's ASGI application to handle traditional HTTP requests
    # 'http': django_asgi_app,
    'http': URLRouter([
        url(r'^events/', AuthMiddlewareStack(
            URLRouter(django_eventstream.routing.urlpatterns)
        ), {'channels': ['test']}),
        url(r'', django_asgi_app),
    ]),

    # WebSocket interface
    'websocket': AuthMiddlewareStack(
        URLRouter([
            *frontend.routing.websocket_urlpatterns,
        ]),
    ),

    # Channel backend
    'channel': ChannelNameRouter({
        **backhaul.routing.channel_urlpatterns,
    }),
})
