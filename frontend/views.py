from django.shortcuts import render

from common import colorize
from .archives import location


# Create your views here.
def index(request):
    return render(request, 'frontend/nothing.html')

#

def control_radar(request, radar):
    obj = {'radar': radar, 'a': 1, 'b': 2}
    return render(request, 'frontend/index.html', {'params': obj})

def control(request):
    return control_radar(request, "demo")

#

def archive_radar_profile(request, radar, profileGL):
    if radar == 'favicon.ico':
        show = colorize('archive_radar_profile()', 'red')
        show += ' ' + colorize('radar', 'orange') + ' = ' + colorize(radar, 'yellow')
        print(show)
        return render(request, 'static/images/favicon.ico')

    show = colorize('archive_radar_profile()', 'green')
    show += ' ' + colorize('radar', 'orange') + ' = ' + colorize(radar, 'yellow')
    print(show)
    origin = location(radar)
    obj = {'radar': radar, 'profileGL': profileGL, 'origin': origin}
    return render(request, 'frontend/archive.html', {'params': obj})

def archive_radar(request, radar):
    return archive_radar_profile(request, radar, False)

def archive_profile(request):
    return archive_radar_profile(request, "px1000", True)

def archive(request):
    return archive_radar_profile(request, "px1000", False)
