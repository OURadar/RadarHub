#!/usr/bin/env python

__version__ = '0.1'

import os
import json
import django
import pprint

from pathlib import Path

from common import color_name_value

pp = pprint.PrettyPrinter(indent=1, depth=2, width=80, sort_dicts=False)


def get_cred():
    basedir = Path(__file__).resolve().parent

    config = 'config/db.conf.readwrite'
    if not os.path.exists(config):
        config = 'config/db.conf'

    with open(config) as fid:
        dbconf = json.load(fid)

    show = color_name_value('BASE_DIR', str(basedir))
    show += '   ' + color_name_value('user', dbconf['user'])
    show += '   ' + color_name_value('pass', dbconf['pass'])
    print(show)

    databases = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'radarhub',
            'HOST': dbconf['host'],
            'USER': dbconf['user'],
            'PASSWORD': dbconf['pass'],
            'PORT': '5432',
        },
        'event': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': basedir / 'db.sqlite3',
        }
    }

    return databases

if __name__ == '__main__':
    import radarhub.settings
    from django.conf import global_settings, settings

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

    django.setup()
