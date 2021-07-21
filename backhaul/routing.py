from .consumers import BackhaulConsumer

channel_urlpatterns = {
    'backhaul': BackhaulConsumer.as_asgi(),
}
