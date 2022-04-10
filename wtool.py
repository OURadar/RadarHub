#!/usr/bin/env python

__version__ = '0.1'

import os
import json
import django
import pprint

from django.conf import global_settings, settings

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
    # os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
    import radarhub.settings

    dbs = get_cred()
    settings.configure(radarhub.settings,
        DATABASES=dbs, DEBUG=True,
        ABSOLUTE_URL_OVERRIDES=global_settings.ABSOLUTE_URL_OVERRIDES,
        AUTH_USER_MODEL=global_settings.AUTH_USER_MODEL,
        DEFAULT_EXCEPTION_REPORTER=global_settings.DEFAULT_EXCEPTION_REPORTER,
        DEFAULT_INDEX_TABLESPACE=global_settings.DEFAULT_INDEX_TABLESPACE,
        DEFAULT_HASHING_ALGORITHM=global_settings.DEFAULT_HASHING_ALGORITHM,
        DEFAULT_TABLESPACE=global_settings.DEFAULT_TABLESPACE,
        FORCE_SCRIPT_NAME=global_settings.FORCE_SCRIPT_NAME,
        LOCALE_PATHS=global_settings.LOCALE_PATHS,
        LOGGING=global_settings.LOGGING,
        LOGGING_CONFIG=global_settings.LOGGING_CONFIG)

    show = color_name_value('DEBUG', settings.DEBUG)
    pp.pprint(settings.DATABASES)
    print(show)

    # pp.pprint(dbs)
    # settings.DATABASES = dbs
    pp.pprint(settings.DATABASES)

    django.setup()
