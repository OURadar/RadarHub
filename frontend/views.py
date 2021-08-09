from django.shortcuts import render

# Create your views here.
def index(request):
    #return render(request, 'frontend/index.html', {'radar': 'px1000', 'receiver': 0})
    return radar_receiver(request, radar='demo', receiver=0)


def radar(request, radar):
    #return render(request, 'frontend/index.html', {'radar': radar, 'receiver': 0})
    return radar_receiver(request, radar=radar, receiver=0)

def radar_receiver(request, radar, receiver):
    # if radar not in ['horus', 'px1000', 'px10k', 'pair', 'raxpol']:
    #   radar = 'demo'
    print(f'radar = {radar}   receiver = {receiver}')
    return render(request, 'frontend/index.html', {'radar': radar, 'receiver': receiver})
