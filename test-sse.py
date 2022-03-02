#!/usr/bin/env python

__version__ = '1.0'

import os
import sys
import django

__prog__ = os.path.basename(sys.argv[0])

from django_eventstream import send_event

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'radarhub.settings')
django.setup()


print('Sending sse ...')
send_event('test', 'message', {'text': 'hello world'})
