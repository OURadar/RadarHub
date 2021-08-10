from django.shortcuts import render

# Create your views here.
def index(request):
    return radar(request, radar='demo')

def radar(request, radar):
    return render(request, 'frontend/index.html', {'radar': radar})
