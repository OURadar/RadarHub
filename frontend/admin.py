from django.contrib import admin

# Register your models here.
from .models import Sweep, Day

admin.site.register(Sweep)
admin.site.register(Day)
