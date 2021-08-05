# frontend/routing.py

from django.conf.urls import url

from .consumers import FrontendConsumer, NullConsumer

websocket_urlpatterns = [
    url(r'ws/(?P<radar>\w+)/$', FrontendConsumer.as_asgi()),
    url(r'ws/$', FrontendConsumer.as_asgi()),
    url(r'', NullConsumer.as_asgi())
]
