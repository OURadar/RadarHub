from django.shortcuts import render
from django.http import HttpResponse
from django.conf import settings

from allauth.account import views as allauth_views

# Create your views here.

def signin(request):
    return render(request, 'reception/signin.html', {'css': settings.CSS_HASH})

def signout(request):
    return allauth_views.logout(request)

def conflict(request):
    return render(request, 'reception/conflict.html', {'css': settings.CSS_HASH})

def privacy(request):
    lines = [
        'Privacy Statement',
        'More information will be provided'
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')
