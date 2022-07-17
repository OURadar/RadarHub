import logging

from django.shortcuts import render
from django.http import Http404, HttpResponse
from django.conf import settings
from django.views.decorators.http import require_GET
from django.contrib.auth import get_user

from common import colorize, color_name_value, get_client_ip
from .archives import location

logger = logging.getLogger('frontend')

radars = [x['folder'].lower() for x in settings.RADARS.values()]
default_radar = radars[0]

#

def get_user_info(request):
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    return {'ip': get_client_ip(request), 'user': email}

# Create your views here.
def index(request):
    params = get_user_info(request)
    return render(request, 'frontend/index.html', {'params': params})

def dev(request):
    return render(request, 'frontend/dev.html')

# Control

def control_radar(request, radar):
    into = get_user_info(request)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', into['ip'])
    show += '   ' + color_name_value('user', into['user'])
    logger.info(show)
    origin = location(radar)
    params = {'radar': radar, 'origin': origin}
    return render(request, 'frontend/control.html', {'params': params})

def control(request):
    return control_radar(request, "demo")

# Archive

def archive_radar_profile(request, radar, profileGL):
    info = get_user_info(request)
    show = colorize('views.archive()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', info['ip'])
    show += '   ' + color_name_value('user', info['user'])
    if settings.DEBUG and settings.VERBOSE:
        show += '   ' + color_name_value('profileGL', profileGL)
    logger.info(show)
    if radar not in radars:
        raise Http404
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

def not_found(request):
    show = colorize('views.not_found()', 'green')
    logger.info(show)
    raise Http404

def template(request, template):
    show = colorize('views.template()', 'green')
    logger.info(show)
    return render(request, f'frontend/{template}')
