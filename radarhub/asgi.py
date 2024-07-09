import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter, ChannelNameRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "radarhub.settings")

django_asgi_app = get_asgi_application()

import frontend.routing
import backhaul.routing

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AuthMiddlewareStack(URLRouter(frontend.routing.websocket_urlpatterns)),
        "channel": ChannelNameRouter(backhaul.routing.channel_urlpatterns),
    }
)
