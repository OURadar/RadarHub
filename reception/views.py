from django.shortcuts import render
from django.http import HttpResponse

# Create your views here.

def signin(request):
    return render(request, 'reception/signin.html')

def signup(request):
    return render(request, 'reception/signup.html')

def privacy(request):
    lines = [
        'Privacy Statement',
        'More information will be provided'
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')
