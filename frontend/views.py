import logging

from django.shortcuts import render
from django.http import HttpResponse
from django.conf import settings
from django.views.decorators.http import require_GET

from common import colorize, color_name_value, get_client_ip
from .archives import location

logger = logging.getLogger('frontend')

default_radar = list(settings.RADARS.values())[0]['folder'].lower()

# Create your views here.
def index(request):
    return render(request, 'frontend/intro.html')

def dev(request):
    return render(request, 'frontend/dev.html')

# Control

def control_radar(request, radar):
    ip = get_client_ip(request)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', ip)
    logger.info(show)
    origin = location(radar)
    params = {'radar': radar, 'origin': origin, 'a': 1, 'b': 2}
    return render(request, 'frontend/control.html', {'params': params})

def control(request):
    return control_radar(request, "demo")

# Archive

def archive_radar_profile(request, radar, profileGL):
    ip = get_client_ip(request)
    if radar == 'favicon.ico':
        show = colorize('views.archive()', 'red')
        show += '   ' + color_name_value('radar', radar)
        show += '   ' + color_name_value('ip', ip)
        logger.warning(show)
        return render(request, 'static/images/favicon.ico')
    show = colorize('views.archive()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', ip)
    if settings.DEBUG and settings.VERBOSE:
        show += '   ' + color_name_value('profileGL', profileGL)
    logger.info(show)
    origin = location(radar)
    params = {'radar': radar, 'origin': origin, 'profileGL': profileGL}
    return render(request, 'frontend/archive.html', {'params': params})

def archive_radar(request, radar):
    return archive_radar_profile(request, radar, False)

def archive_profile(request):
    return archive_radar_profile(request, default_radar, True)

def archive(request):
    return archive_radar_profile(request, default_radar, False)

#

@require_GET
def robots_txt(request):
    lines = [
        'User-Agent: *',
        'Disallow: /archive/',
        'Disallow: /control/',
        'Disallow: /data/',
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')
