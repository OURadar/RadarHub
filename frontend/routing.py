# frontend/routing.py

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/radar/(?P<pathway>\w+)/$', consumers.Radar.as_asgi()),
    re_path(r'ws/(?P<pathway>\w+)/$', consumers.User.as_asgi()),
    re_path(r'', consumers.Null.as_asgi())
]
