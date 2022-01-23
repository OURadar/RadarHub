from django.shortcuts import render

# Create your views here.
def index(request):
    return radar(request, radar='demo')

def radar(request, radar):
    obj = {'radar': radar, 'a': 1, 'b': 2}
    return render(request, 'frontend/index.html', {'params': obj})

def archive_radar_profile(request, radar, profileGL):
    obj = {'radar': radar, 'profileGL': profileGL}
    return render(request, 'frontend/dev.html', {'params': obj})

def archive_radar(request, radar):
    return archive_radar_profile(request, radar, False)

def archive_profile(request):
    return archive_radar_profile(request, "px1000", True)

def archive(request):
    return archive_radar_profile(request, "px1000", False)
