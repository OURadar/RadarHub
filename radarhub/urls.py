from django.contrib import admin
from django.urls import include, path

# path("accounts/", include("django.contrib.auth.urls")),
# import allauth.urls

urlpatterns = [
    path('manage/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('reception/', include('reception.urls')),
    path('', include('frontend.urls'))
]
