from django.contrib import admin
from django.urls import include, path
from django.conf import settings

import django_eventstream

urlpatterns = [
    path("", include("frontend.urls")),
    path("events/", include(django_eventstream.urls), {"channels": ["sse"]}),
    path("accounts/", include("reception.urls")),
    path("accounts/", include("allauth.urls")),
]

if settings.DEBUG:
    urlpatterns += [path("admin/", admin.site.urls)]

handler400 = "frontend.views.page400"
handler403 = "frontend.views.page403"
handler404 = "frontend.views.page404"
# handler500
