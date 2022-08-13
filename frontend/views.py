import os
import glob
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

lines = []
for file in glob.glob('frontend/static/css/*.css'):
    with open(file) as fid:
        lines = [*lines, *fid.readlines()]
css_hash = hash('\n'.join(lines))
css_hash = f'{css_hash:08x}'[-8:]

if settings.DEBUG:
    show = color_name_value('css_hash', css_hash)
    print(show)

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
    context = {
        'vars': params,
        'css': css_hash,
        'version': settings.VERSION
    }
    return render(request, 'frontend/index.html', context)

def dev(request):
    return render(request, 'frontend/dev.html', {'css': css_hash})

# Control

def control_radar(request, radar):
    into = get_user_info(request)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', into['ip'])
    show += '   ' + color_name_value('user', into['user'])
    logger.info(show)
    origin = location(radar)
    context = {
        'vars': {
            'radar': radar,
            'origin': origin
        },
        'css': css_hash
    }
    return render(request, 'frontend/control.html', context)

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
    context = {
        'vars': {
            'radar': radar,
            'origin': origin,
            'profileGL': profileGL
        },
        'css': css_hash
    }
    return render(request, 'frontend/archive.html', context)

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

def view(request, page):
    context = {'css': css_hash}
    return render(request, f'{page}.html', context, status=200)

def page400(request, exception):
    context = {'css': css_hash}
    return render(request, f'400.html', context, status=400)

def page403(request, exception):
    context = {'css': css_hash}
    return render(request, f'403.html', context, status=403)

def page404(request, exception):
    context = {'css': css_hash}
    return render(request, f'404.html', context, status=404)
