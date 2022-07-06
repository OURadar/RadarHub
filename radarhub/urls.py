from django.contrib import admin
from django.urls import include, path

from django.conf import settings

urlpatterns = [
    path('', include('frontend.urls')),
    path('accounts/', include('reception.urls')),
]

if settings.DEBUG:
    urlpatterns += [path('admin/', admin.site.urls)]
