# frontend/routing.py

from django.conf.urls import url

from .consumers import AsyncConsumer

websocket_urlpatterns = [
    url(r'ws/(?P<radar>\w+)/$', AsyncConsumer.as_asgi()),
    url(r'ws/$', AsyncConsumer.as_asgi())
]
