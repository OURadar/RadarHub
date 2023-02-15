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
radar_names = dict([(x['folder'].lower(), x['name']) for x in settings.RADARS.values()])
default_radar = radars[0]

if settings.DEBUG:
    show = color_name_value('settings.CSS_HASH', settings.CSS_HASH)
    print(show)

#

def make_vars(request, radar=default_radar):
    if radar not in radar_names:
        logger.warning(f'Pathway {radar} not in radar_names. Not registered.')
        # raise Http404
        radar_names[radar] = radar
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    origin = location(radar)
    return {
        'ip': get_client_ip(request),
        'user': email,
        'css_hash': settings.CSS_HASH,
        'code_hash': settings.CODE_HASH,
        'version': settings.VERSION,
        'origin': origin,
        'radar': radar,
        'name': radar_names[radar]
    }

#

def index(request):
    vars = make_vars(request)
    context = {
        'vars': vars,
        'css': settings.CSS_HASH,
        'version': settings.VERSION
    }
    return render(request, 'frontend/index.html', context)

def dev(request, radar):
    vars = make_vars(request, radar)
    context = {'vars': vars, 'css': settings.CSS_HASH}
    return render(request, 'frontend/dev.html', context)

# Control

def control_radar(request, radar):
    vars = make_vars(request, radar)
    show = colorize('views.control()', 'green')
    show += '   ' + color_name_value('radar', radar)
    show += '   ' + color_name_value('ip', vars['ip'])
    show += '   ' + color_name_value('user', vars['user'])
    logger.info(show)
    context = {
        'vars': vars,
        'css': settings.CSS_HASH
    }
    return render(request, 'frontend/control.html', context)

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
    context = {
        'vars': vars,
        'css': settings.CSS_HASH
    }
    return render(request, 'frontend/archive.html', context)

def archive_radar_profile(request, radar, profileGL):
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
    context = {
        'vars': vars,
        'css': settings.CSS_HASH
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
    context = {'css': settings.CSS_HASH}
    return render(request, f'{page}.html', context, status=200)

def page400(request, exception):
    context = {'css': settings.CSS_HASH}
    return render(request, f'400.html', context, status=400)

def page403(request, exception):
    context = {'css': settings.CSS_HASH}
    return render(request, f'403.html', context, status=403)

def page404(request, exception):
    context = {'css': settings.CSS_HASH}
    return render(request, f'404.html', context, status=404)
