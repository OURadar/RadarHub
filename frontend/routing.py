# frontend/routing.py

from django.conf.urls import url

from . import consumers

websocket_urlpatterns = [
    url(r'ws/radar/(?P<radar>\w+)/$', consumers.RadarConsumer.as_asgi()),
    url(r'ws/(?P<radar>\w+)/$', consumers.FrontendConsumer.as_asgi()),
    url(r'', consumers.NullConsumer.as_asgi())
]
