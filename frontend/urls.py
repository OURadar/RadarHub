from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.archive_profile, name='archive'),
    path('control/<str:radar>/', views.archive_radar, name='archive'),
    path('data/header/<str:name>/', views.header, name='binary'),
    path('data/binary/<str:name>/', views.binary, name='binary'),
    path('', views.archive, name='archive'),
    # path('', views.index, name='index'),
    path('<str:radar>/', views.radar, name='radar'),
]
