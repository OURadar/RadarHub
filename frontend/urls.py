from django.urls import path

from . import archives
from . import stats
from . import views

urlpatterns = [
    # path('profile/', views.archive_profile, name='archive'),
    # path('data/header/<str:name>/', archives.header, name='data-header'),
    # path('data/binary/<str:name>/', archives.binary, name='data-binary'),
    path('control/<str:pathway>/', views.control, name='control'),
    path('archive/<str:pathway>/', views.archive, name='archive'),
    path('data/catchup/<str:pathway>/', archives.catchup, name='data-catchup-json'),
    path('data/month/<str:pathway>/<str:day>/', archives.month, name='data-month-json'),
    path('data/count/<str:pathway>/<str:day>/', archives.count, name='data-count-json'),
    path('data/list/<str:pathway>/<str:day_hour_symbol>/', archives.list, name='data-list-json'),
    path('data/load/<str:pathway>/<str:name>/', archives.load, name='data-load-binary'),
    path('stats/<str:mode>/', archives.stats, name='stats'),
    path('view/<str:page>/', views.view, name='page-name'),
    path('profile/', stats.profile, name='stats-profile'),
    path('robots.txt', views.robots_txt),
    path('dev/<str:pathway>/', views.dev, name='index'),
    path('', views.index, name='index'),
]
