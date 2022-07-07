from django.urls import path

from . import views

from allauth.urls import provider_urlpatterns

urlpatterns = [
    path('signin/', views.signin, name='signin'),
    path('signout/', views.signout, name='signout'),
    path('privacy/', views.privacy, name='privacy'),
    path('social/signup/', views.conflict, name='conflict'),
]

# path('login/', allauth_views.login, name='login'),
# import allauth.socialaccount.urls
# urlpatterns += [path("social/", include("allauth.socialaccount.urls"))]

urlpatterns += provider_urlpatterns
