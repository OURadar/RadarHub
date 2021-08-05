# frontend/routing.py

from django.conf.urls import url

from .consumers import NullConsumer, FrontendConsumer, RadarConsumer

websocket_urlpatterns = [
    url(r'ws/radar/(?P<radar>\w+)/$', RadarConsumer.as_asgi()),
    url(r'ws/(?P<radar>\w+)/$', FrontendConsumer.as_asgi()),
    url(r'', NullConsumer.as_asgi())
]
