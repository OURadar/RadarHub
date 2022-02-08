from django.apps import AppConfig
# from django.conf import settings

# from common import colorize, color_name_value

# show = colorize('frontend.apps.py', 'mint')
# show += '  ' + color_name_value('DATABASES.ENGINE', settings.DATABASES['default']['ENGINE'])
# print(show)

class FrontendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'frontend'
