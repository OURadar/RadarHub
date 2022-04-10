#!/usr/bin/env python

__version__ = '0.1'

import os
import json
import django
import pprint

from django.conf import settings

from pathlib import Path

from common import color_name_value

pp = pprint.PrettyPrinter(indent=1, depth=2, width=120, sort_dicts=False)


def get_cred():
    BASE_DIR = Path(__file__).resolve().parent

    with open('config/db.conf.readwrite') as fid:
        PostgreSQL = json.load(fid)

    show = color_name_value('BASE_DIR', str(BASE_DIR))
    show += '   ' + color_name_value('user', PostgreSQL['user'])
    show += '   ' + color_name_value('pass', PostgreSQL['pass'])
    print(show)

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'radarhub',
            'HOST': PostgreSQL['host'],
            'USER': PostgreSQL['user'],
            'PASSWORD': PostgreSQL['pass'],
            'PORT': '5432',
        },
        'event': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

    return DATABASES

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')

    show = color_name_value('DEBUG', settings.DEBUG)
    pp.pprint(settings.DATABASES)
    print(show)

    dbs = get_cred()

    pp.pprint(dbs)

    settings.DATABASES = dbs

    django.setup()
