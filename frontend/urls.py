from django.urls import path

from . import archives
from . import views

urlpatterns = [
    path('profile/', views.archive_profile, name='archive'),
    path('control/<str:radar>/', views.archive_radar, name='archive'),
    path('data/header/<str:name>/', archives.header, name='data-json'),
    path('data/binary/<str:name>/', archives.binary, name='data-binary'),
    path('data/month/<str:day>/', archives.month, name='data-json'),
    path('data/count/<str:day>/', archives.count, name='data-json'),
    path('data/list/<str:hour>/', archives.list, name='data-json'),
    path('data/load/<str:name>/', archives.load, name='data-binary'),
    path('archive/', views.archive, name='archive'),
    path('<str:radar>/', views.radar, name='radar'),
    path('', views.archive, name='archive'),
    # path('', views.index, name='index'),
]
