from django.shortcuts import render

# Create your views here.
def index(request):
    return radar(request, radar='demo')

def radar(request, radar):
    return render(request, 'frontend/index.html', {'radar': radar})

def archive(request):
    return archive_radar(request, "demo")

def archive_radar(request, radar):
    return render(request, 'frontend/archive.html', {'radar': radar})
