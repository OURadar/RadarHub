import os
import glob
import logging
from turtle import color

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

def make_vars(request, radar='px1000'):
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    origin = location(radar)

    return {
        'ip': get_client_ip(request),
        'user': email,
        'css_hash': css_hash,
        'version': settings.VERSION,
        'origin': origin,
        'radar': radar
    }

#

def index(request):
    vars = make_vars(request)
    return render(request, 'frontend/index.html', {'vars': vars, 'css': css_hash, 'version': settings.VERSION})

def dev(request):
    vars = make_vars(request)
    return render(request, 'frontend/dev.html', {'vars': vars, 'css': css_hash})

# Control

def control_radar(request, radar):
    vars = make_vars(request, radar)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', vars['ip'])
    show += '   ' + color_name_value('user', vars['user'])
    logger.info(show)
    return render(request, 'frontend/control.html', {'vars': vars, 'css': css_hash})

def control(request):
    return control_radar(request, "demo")

# Archive

def archive_radar_profile(request, radar, profileGL = False):
    vars = make_vars(request, radar)
    show = colorize('views.archive()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', vars['ip'])
    show += '   ' + color_name_value('user', vars['user'])
    if settings.DEBUG and settings.VERBOSE:
        show += '   ' + color_name_value('profileGL', profileGL)
    logger.info(show)
    if radar not in radars:
        raise Http404
    if profileGL:
        vars['profileGL'] = True
    print(vars)
    return render(request, 'frontend/archive.html', {'vars': vars, 'css': css_hash})

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
    return render(request, f'{page}.html', {'css': css_hash}, status=200)
