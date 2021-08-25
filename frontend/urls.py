from django.urls import path
from . import views

urlpatterns = [
    path('archive/', views.archive, name='archive'),
    path('archive/<str:radar>/', views.archive_radar, name='archive'),
    path('', views.archive, name='archive'),
    # path('', views.index, name='index'),
    path('<str:radar>/', views.radar, name='radar'),
]
