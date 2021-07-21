from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('<str:radar>/', views.radar, name='radar'),
    path('<str:radar>/<str:receiver>/', views.radar_receiver, name='hope'),
]
