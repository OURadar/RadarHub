from xml.sax import handler
from django.contrib import admin
from django.urls import include, path

from django.conf import settings

# path('allauth/', include('allauth.urls')),

urlpatterns = [
    path('', include('frontend.urls')),
    path('accounts/', include('reception.urls')),
]

if settings.DEBUG:
    urlpatterns += [path('admin/', admin.site.urls)]

handler403 = "frontend.views.page403"
handler404 = "frontend.views.page404"
