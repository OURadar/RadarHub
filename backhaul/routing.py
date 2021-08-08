from . import consumers

channel_urlpatterns = {
    'backhaul': consumers.Backhaul.as_asgi(),
}
