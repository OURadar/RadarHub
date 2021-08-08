# frontend/routing.py

from django.conf.urls import url

from . import consumers

websocket_urlpatterns = [
    url(r'ws/radar/(?P<radar>\w+)/$', consumers.Radar.as_asgi()),
    url(r'ws/(?P<radar>\w+)/$', consumers.User.as_asgi()),
    url(r'', consumers.Null.as_asgi())
]
