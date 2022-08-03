import glob

from django.shortcuts import render
from django.http import HttpResponse

from allauth.account import views as allauth_views

lines = []
for file in glob.glob('frontend/static/css/*.css'):
    with open(file) as fid:
        lines = [*lines, *fid.readlines()]
css_hash = hash('\n'.join(lines))
css_hash = f'{css_hash:08x}'[-8:]

# Create your views here.

def signin(request):
    return render(request, 'reception/signin.html', {'css': css_hash})

def signout(request):
    return allauth_views.logout(request)

def conflict(request):
    return render(request, 'reception/conflict.html', {'css': css_hash})

def privacy(request):
    lines = [
        'Privacy Statement',
        'More information will be provided'
    ]
    return HttpResponse('\n'.join(lines), content_type='text/plain')
