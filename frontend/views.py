import logging

from django.shortcuts import render
from django.conf import settings

from common import colorize, color_name_value
from .archives import location

logger = logging.getLogger('frontend')
if settings.VERBOSE and len(logger.handlers) == 0:
    logger.addHandler(logging.StreamHandler())
    logger.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)

default_radar = list(settings.RADARS.values())[0]['folder'].lower()

# Create your views here.
def index(request):
    return render(request, 'frontend/nothing.html')

#

def control_radar(request, radar):
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    logger.info(show)
    origin = location(radar)
    obj = {'radar': radar, 'origin': origin, 'a': 1, 'b': 2}
    return render(request, 'frontend/index.html', {'params': obj})

def control(request):
    return control_radar(request, "demo")

#

def archive_radar_profile(request, radar, profileGL):
    if radar == 'favicon.ico':
        show = colorize('views.archive()', 'red')
        show += '   ' + color_name_value('radar', radar)
        logger.warning(show)
        return render(request, 'static/images/favicon.ico')

    show = colorize('views.archive()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('profileGL', profileGL)
    logger.info(show)
    origin = location(radar)
    obj = {'radar': radar, 'origin': origin, 'profileGL': profileGL}
    return render(request, 'frontend/archive.html', {'params': obj})

def archive_radar(request, radar):
    return archive_radar_profile(request, radar, False)

def archive_profile(request):
    return archive_radar_profile(request, default_radar, True)

def archive(request):
    return archive_radar_profile(request, default_radar, False)
