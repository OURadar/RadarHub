import json;
from django.shortcuts import render

# Create your views here.
def index(request):
    return radar(request, radar='demo')

def radar(request, radar):
    return render(request, 'frontend/index.html', {'radar': radar})

def archive_radar(request, radar, profileGL):
    json_string = json.dumps({'radar': radar, 'profileGL': profileGL})
    return render(request, 'frontend/archive.html', {'params': json_string})

def archive(request):
    return archive_radar(request, "demo", False)

def archive_profile(request):
    return archive_radar(request, "demo", True)
