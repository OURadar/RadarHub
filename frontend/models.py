from django.db import models

# Create your models here.
class File(models.Model):
    name = models.CharField(max_length=32)
    path = models.CharField(max_length=512)
    date = models.DateTimeField('date')
    # archive = models.CharField(max_length=512)

# models.File.objects.filter(date__year=2015)
# models.File.objects.filter(date__lte='2018-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z')
# models.File.objects.filter(date__gte='2017-01-01 00:00Z').filter(date__lte='2018-12-31 23:59Z')
