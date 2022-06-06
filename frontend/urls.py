from django.urls import path

from . import archives
from . import views

urlpatterns = [
    path('profile/', views.archive_profile, name='archive'),
    path('control/', views.control, name='control'),
    path('control/<str:radar>/', views.control_radar, name='control-radar'),
    path('archive/<str:radar>/', views.archive_radar, name='archive-radar'),
    path('data/list/<str:radar>/<str:day_hour_symbol>/', archives.list, name='data-list-json'),
    # path('data/header/<str:name>/', archives.header, name='data-header'),
    # path('data/binary/<str:name>/', archives.binary, name='data-binary'),
    path('data/month/<str:radar>/<str:day>/', archives.month, name='data-month-json'),
    path('data/count/<str:radar>/<str:day>/', archives.count, name='data-count-json'),
    path('data/date/<str:radar>/', archives.date, name='data-date-json'),
    path('data/load/<str:name>/', archives.load, name='data-load-binary'),
    path('data/catchup/<str:radar>/', archives.catchup, name='data-catchup-json'),
    path('archive/', views.archive, name='archive'),
    # path('<str:radar>/', views.archive_radar, name='archive'),
    # path('<str:radar>/', views.radar, name='radar'),
    path('', views.archive, name='archive'),
    # path('', views.index, name='index'),
]
