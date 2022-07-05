from django.contrib import admin
from django.urls import include, path

from django.conf import settings

urlpatterns = [
    path('', include('frontend.urls')),
    path('accounts/', include('reception.urls')),
    path('allauth/', include('allauth.urls')),
]

if settings.DEBUG:
    urlpatterns += [path('manage/', admin.site.urls)]
