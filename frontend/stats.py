import json

from django.contrib.auth import get_user
from django.http import HttpResponse, Http404

from common import colorize, color_name_value, get_client_ip

# Stats

def profile(request):
    show = colorize('archive.month()', 'green')
    show += '   ' + color_name_value('request', request)
    user = get_user(request)
    try:
        email = user.email
    except:
        email = None
    data = {
        'ip': get_client_ip(request),
        'user': email or "None",
        'emoji': 'shrimp' if email else 'spider',
        'message': 'There is no message at this moment'
    }
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    response['Cache-Control'] = 'max-age=60'
    return response
