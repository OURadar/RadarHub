from django.urls import include, path

from . import views

from allauth.urls import provider_urlpatterns
from allauth.account import views as allauth_views

urlpatterns = [
    path('signin/', views.signin, name='signin'),
    path('signout/', allauth_views.logout, name='logout'),
]

# path('login/', allauth_views.login, name='login'),
# import allauth.socialaccount.urls
urlpatterns += [path("social/", include("allauth.socialaccount.urls"))]

urlpatterns += provider_urlpatterns
