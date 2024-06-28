from django.contrib import admin

# Register your models here.
from .models import Sweep, File, Day

admin.site.register(Sweep)
admin.site.register(File)
admin.site.register(Day)
