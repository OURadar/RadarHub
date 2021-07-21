from django.shortcuts import render

# Create your views here.
def index(request):
    return render(request, 'frontend/index.html', {'radar': 'horus', 'receiver': 0})

def radar(request, radar):
    return render(request, 'frontend/index.html', {'radar': radar, 'receiver': 0})

def radar_receiver(request, radar, receiver):
    print('radar = {}   receiver = {}'.format(radar, receiver))
    return render(request, 'frontend/index.html', {'radar': radar, 'receiver': receiver})
