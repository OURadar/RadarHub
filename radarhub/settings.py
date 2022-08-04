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

# SECURITY WARNING    SECURITY WARNING    SECURITY WARNING    SECURITY WARNING
# SECURITY WARNING
# SECURITY WARNING    Don't run with debug turned on in production!
# SECURITY WARNING
# SECURITY WARNING    SECURITY WARNING    SECURITY WARNING    SECURITY WARNING

DEBUG = bool(os.getenv('DJANGO_DEBUG'))

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BASE_DIR / 'config'
FRONTEND_DIR = BASE_DIR / 'frontend'
RECEPTION_DIR = BASE_DIR / 'reception'
DATABASE_DIR = BASE_DIR / 'database'
LOG_DIR = os.path.expanduser('~/logs') if DEBUG else '/var/log/radarhub'

if VERBOSE > 1:
    show = color_name_value('BASE_DIR', str(BASE_DIR)) + '\n'
    show += color_name_value('CONFIG_DIR', str(CONFIG_DIR)) + '\n'
    show += color_name_value('FRONTEND_DIR', str(FRONTEND_DIR)) + '\n'
    show += color_name_value('LOG_DIR', LOG_DIR)
    print(show)

if not os.path.isdir(LOG_DIR):
    print(f'Creating directory {LOG_DIR} ...')
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
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.apple',
    'allauth.socialaccount.providers.facebook',
    'reception',
    'webpack_loader'
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
        'DIRS': [FRONTEND_DIR / 'templates/allauth'],
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

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DATABASE_DIR / 'db.sqlite3',
    }
}

if 'database' in settings:
    if VERBOSE > 1:
        show = color_name_value('user', settings['database']['user'])
        show += '   ' + color_name_value('pass', settings['database']['pass'])
        print(show)
    DATABASES['data'] = {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'radarhub',
        'HOST': settings['database']['host'],
        'USER': settings['database']['user'],
        'PASSWORD': settings['database']['pass'],
        'PORT': '5432',
    }
else:
    DATABASES['data'] = DATABASES['default']

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

# STATIC_URL = '/'

# STATIC_ROOT = "/var/www/radarhub/static/"

# STATICFILES_DIRS = [
#     FRONTEND_DIR / "static",
#     FRONTEND_DIR / "static/images"
# ]

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
if os.path.exists(file):
    with open(file, 'r') as fid:
        s = json.load(fid)
    VERSION = s['version'] if 'version' in s else '0.0.0'
else:
    VERSION = '0.0.0'

# FIFO source to list for new files
# FIFO = { 'tcp': '_IP_ADDRESS_:_PORT_' }
# FIFO = { 'pipe': '/tmp/radarhub.fifo' }
if 'fifo' in settings:
    FIFO = settings['fifo']
else:
    FIFO = {
        'pipe': '/tmp/radarhub.fifo'
    }

# Prevent HttpResponse 301 for permanent forwards
APPEND_SLASH = False

# # LDAP stuff
# import ldap
# from django_auth_ldap.config import LDAPSearch, GroupOfNamesType

# AUTH_LDAP_SERVER_URI = 'ldap://dcv01.arrc.ou.edu'

# # AUTH_LDAP_BIND_DN = "cn=django-agent,dc=arrc,dc=ou,dc=edu"
# # AUTH_LDAP_BIND_PASSWORD = "phlebotinum"
# # AUTH_LDAP_USER_SEARCH = LDAPSearch(
# #     "ou=people,dc=arrc,dc=ou,dc=edu", ldap.SCOPE_SUBTREE, "(uid=%(user)s)"
# # )
# # Or:
# AUTH_LDAP_USER_DN_TEMPLATE = 'uid=%(user)s,ou=peole,dc=arrc,dc=ou,dc=edu'

# # Set up the basic group parameters.
# AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
#     "ou=django,ou=groups,dc=ou,dc=arrc,dc=edu",
#     ldap.SCOPE_SUBTREE,
#     "(objectClass=groupOfNames)",
# )
# AUTH_LDAP_GROUP_TYPE = GroupOfNamesType(name_attr="cn")

# # Simple group restrictions
# AUTH_LDAP_REQUIRE_GROUP = "cn=enabled,ou=django,ou=groups,dc=arrc,dc=ou,dc=edu"
# AUTH_LDAP_DENY_GROUP = "cn=disabled,ou=django,ou=groups,dc=arrc,dc=ou,dc=edu"

# # Populate the Django user from the LDAP directory.
# AUTH_LDAP_USER_ATTR_MAP = {
#     "first_name": "givenName",
#     "last_name": "sn",
#     "email": "mail",
# }

# AUTH_LDAP_USER_FLAGS_BY_GROUP = {
#     "is_active": "cn=active,ou=django,ou=groups,dc=arrc,dc=ou,dc=edu",
#     "is_staff": "cn=staff,ou=django,ou=groups,dc=arrc,dc=ou,dc=edu",
#     "is_superuser": "cn=superuser,ou=django,ou=groups,dc=arrc,dc=ou,dc=edu",
# }

# # This is the default, but I like to be explicit.
# AUTH_LDAP_ALWAYS_UPDATE_USER = True

# # Use LDAP group membership to calculate group permissions.
# AUTH_LDAP_FIND_GROUP_PERMS = True

# # Cache distinguished names and group memberships for an hour to minimize
# # LDAP traffic.
# AUTH_LDAP_CACHE_TIMEOUT = 3600

# # Keep ModelBackend around for per-user permissions and maybe a local
# # superuser.
# AUTHENTICATION_BACKENDS = (
#     'django_auth_ldap.backend.LDAPBackend',
#     'django.contrib.auth.backends.ModelBackend',
# )

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'django.channels.server': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        }
    },
    'loggers': {
        'django.channels.server': {
            'handlers': ['django.channels.server'],
            'level': 'INFO',
            'propagate': False,
        },
    }
}

# Miscellaneous Small Databases
# https://db-ip.com/db/download/ip-to-city-lite
#
# User Agent Strings
# http://www.useragentstring.com

IP_DATABASE = BASE_DIR / 'dbip-city-lite-2022-07.mmdb'

USER_AGENT_TABLE = BASE_DIR / 'user-agent-strings.json'

#

CSRF_TRUSTED_ORIGINS = ['https://radarhub.arrc.ou.edu']

LOGIN_REDIRECT_URL = '/'

# Allauth
# https://django-allauth.readthedocs.io/en/latest/index.html

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
]

SITE_ID = 1

ACCOUNT_UNIQUE_EMAIL = True

ACCOUNT_EMAIL_REQUIRED = True

ACCOUNT_USERNAME_REQUIRED = False

ACCOUNT_AUTHENTICATION_METHOD = 'email'

ACCOUNT_USER_MODEL_USERNAME_FIELD = 'username'

SOCIALACCOUNT_QUERY_EMAIL = True

if 'socialaccounts' in settings:
    SOCIALACCOUNT_PROVIDERS = settings['socialaccounts']
else:
    SOCIALACCOUNT_PROVIDERS = {
        'google': {
            'SCOPE': ['profile', 'email'],
            'AUTH_PARAMS': { 'access_type': 'online' }
        }
    }

if 'facebook' in SOCIALACCOUNT_PROVIDERS:
    for key in ['EXCHANGE_TOKEN', 'VERIFIED_EMAIL']:
        SOCIALACCOUNT_PROVIDERS['facebook'][key] = bool(SOCIALACCOUNT_PROVIDERS['facebook'][key])
    SOCIALACCOUNT_PROVIDERS['facebook']['INIT_PARAMS'] = {'cookie': True }

if DEBUG is not True:
    ACCOUNT_DEFAULT_HTTP_PROTOCOL = 'https'

# Webpack Loader
# https://django-webpack-loader.readthedocs.io/en/latest/

WEBPACK_LOADER = {
    'DEFAULT': {
        'BUNDLE_DIR_NAME': '/frontend/',
        'STATS_FILE': str(FRONTEND_DIR / 'webpack-output.json'),
    },
}
