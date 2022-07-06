import logging

from django.shortcuts import render
from django.http import HttpResponse
from django.conf import settings
from django.views.decorators.http import require_GET
from django.contrib.auth import get_user

from common import colorize, color_name_value, get_client_ip
from .archives import location

logger = logging.getLogger('frontend')

default_radar = list(settings.RADARS.values())[0]['folder'].lower()

#

def get_params(request):
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    return {'ip': get_client_ip(request), 'user': email}

# Create your views here.
def index(request):
    params = get_params(request)
    return render(request, 'frontend/intro.html', {'params': params})

def dev(request):
    return render(request, 'frontend/dev.html')

# Control

def control_radar(request, radar):
    params = get_params(request)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', params['ip'])
    show += '   ' + color_name_value('user', params['user'])
    logger.info(show)
    origin = location(radar)
    params = {*params, *{'radar': radar, 'origin': origin}}
    return render(request, 'frontend/control.html', {'params': params})

def control(request):
    return control_radar(request, "demo")

# Archive

def archive_radar_profile(request, radar, profileGL):
    params = get_params(request)
    show = colorize('views.archive()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', params['ip'])
    show += '   ' + color_name_value('user', params['user'])
    if settings.DEBUG and settings.VERBOSE:
        show += '   ' + color_name_value('profileGL', profileGL)
    logger.info(show)
    origin = location(radar)
    # params = {*params, *{'radar': radar, 'origin': origin, 'profileGL': profileGL}}
    params['radar'] = radar
    params['origin'] = origin
    params['profileGL'] = profileGL
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
