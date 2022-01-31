from django.contrib import admin

# Register your models here.
from .models import File, Day

admin.site.register(File)
admin.site.register(Day)
