"""
Django settings for radarhub project.

Generated by 'django-admin startproject' using Django 3.2.4.

For more information on this file, see
https://docs.djangoproject.com/en/3.2/topics/settings/

For the full list of settings and their values, see
https://docs.djangoproject.com/en/3.2/ref/settings/
"""

import os
import json

from pathlib import Path

from common import color_name_value

# My additional parameters
VERBOSE = 1
SIMULATE = False

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = bool(os.getenv('DJANGO_DEBUG'))

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / 'config'
FRONTEND_DIR = BASE_DIR / 'frontend'
LOG_DIR = os.path.expanduser('~/logs') if DEBUG else '/var/log/radarhub'

if VERBOSE > 1:
    show = color_name_value('BASE_DIR', str(BASE_DIR)) + '\n'
    show += color_name_value('CONFIG_DIR', str(CONFIG_DIR)) + '\n'
    show += color_name_value('FRONTEND_DIR', str(FRONTEND_DIR)) + '\n'
    show += color_name_value('LOG_DIR', LOG_DIR)
    print(show)
if not os.path.isdir(LOG_DIR):
    show += f'Creating directory {LOG_DIR} ...'
    print(show)
    os.makedirs(LOG_DIR)

# User settings
file = CONFIG_DIR / 'settings.json'
if os.path.exists(file):
    with open(file) as fid:
        settings = json.load(fid)
else:
    settings = {}

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/3.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
if 'secret' in settings:
    SECRET_KEY = settings['secret']
else:
    file = CONFIG_DIR / 'secret.key'
    if os.path.exists(file):
        with open(file) as fid:
            SECRET_KEY = fid.read().strip()
    else:
        SECRET_KEY = 'django-insecure-5zk9_rg=98@@h+e6*iw63l9h*v_bo9+_xum)'

ALLOWED_HOSTS = ['*']

# Application definition

INSTALLED_APPS = [
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django_eventstream',
    'frontend',
    'backhaul',
]

MIDDLEWARE = [
    'django_grip.GripMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'radarhub.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'radarhub.wsgi.application'

# Database
# https://docs.djangoproject.com/en/3.2/ref/settings/#databases
#
# Migrated 'default' to PostgreSQL
# https://medium.com/djangotube/django-sqlite-to-postgresql-database-migration-e3c1f76711e1
#
# Django_stream requires a table in the database. Using 'event' and a dbrouter for this
# https://docs.djangoproject.com/en/4.0/topics/db/multi-db/

if 'database' in settings:
    if VERBOSE > 1:
        show = color_name_value('user', settings['database']['user'])
        show += '   ' + color_name_value('pass', settings['database']['pass'])
        print(show)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'radarhub',
            'HOST': settings['database']['host'],
            'USER': settings['database']['user'],
            'PASSWORD': settings['database']['pass'],
            'PORT': '5432',
            }
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

DATABASES['event'] = {
    'ENGINE': 'django.db.backends.sqlite3',
    'NAME': BASE_DIR / 'db.sqlite3',
}

DATABASE_ROUTERS = ['radarhub.dbrouter.DbRouter']

# Password validation
# https://docs.djangoproject.com/en/3.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/3.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_L10N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/3.2/howto/static-files/

STATIC_URL = '/static/'

# Default primary key field type
# https://docs.djangoproject.com/en/3.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Channels
ASGI_APPLICATION = 'radarhub.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [('localhost', 6379)],
            'capacity': 1000,
            'channel_capacity': {
                'http.request': 200,
                'websocket.send*': 50,
            }
        }
    }
}

# Radar
# RADARS = { '_PREFIX_': {'folder': '_RADAR_NAME_', 'summary': '_SCAN_' } }
if 'radars' in settings:
    RADARS = settings['radars']
else:
    RADARS = {
        'PX-': {
            'folder': 'PX1000',
            'summary': 'E4.0',
        },
        'RAXPOL-': {
            'folder': 'RaXPol',
            'summary': 'E4.0',
        }
    }


# frontend/package.json
file = FRONTEND_DIR / 'package.json'
with open(file, 'r') as fid:
    s = json.load(fid)
VERSION = s['version']


# FIFO source to list for new files
# FIFO = { 'tcp': '_IP_ADDRESS_:_PORT_' }
# FIFO = { 'pipe': '/tmp/radarhub.fifo' }
if 'fifo' in settings:
    FIFO = settings['fifo']
else:
    FIFO = {
        'pipe': '/tmp/radarhub.fifo'
    }

APPEND_SLASH = False
