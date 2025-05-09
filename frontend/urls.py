from django.urls import path

from . import archives
from . import stats
from . import views

urlpatterns = [
    # path('profile/', views.archive_profile, name='archive'),
    # path('data/header/<str:name>/', archives.header, name='data-header'),
    # path('data/binary/<str:name>/', archives.binary, name='data-binary'),
    path("data/catchup/<str:pathway>/", archives.catchup, name="data-catchup-json"),
    path("data/month/<str:pathway>/<str:day>/", archives.month, name="data-month-json"),
    path("data/count/<str:pathway>/<str:day>/", archives.count, name="data-count-json"),
    path("data/table/<str:pathway>/<str:day_hour>/", archives.table, name="data-table-json"),
    path("data/load/<str:pathway>/<str:locator>/", archives.load, name="data-load-binary"),
    path("data/stat/<str:mode>/", archives.stat, name="stats"),
    path("view/<str:page>/", views.view, name="page-name"),
    path("stat/profile/", stats.profile, name="stat-profile"),
    path("stat/size/", stats.size, name="stat-size"),
    path("stat/relay/", stats.relay, name="relay"),
    path("robots.txt", views.robots_txt),
    path("<str:entry>/<str:pathway>/", views.main, name="main"),
    path("", views.index, name="index"),
]
