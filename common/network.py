import re
import json
import maxminddb
import urllib.request

user_agent_strings_db = 'user-agent-strings.json'
user_agent_strings = {}

ip_location_db = 'dbip-city-lite-2022-07.mmdb'
ip_location_db_fid = None

re_space = re.compile(' \(.*\)')

# From https://stackoverflow.com/questions/4581789/how-do-i-get-user-ip-address-in-django
def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def get_user_agent_string(user_agent, reload=False):
    def _replace_os_string(key):
        oses = {'OS X': 'macOS', 'iPhone OS': 'iOS'}
        return oses[key] if key in oses else key
    # API reference: http://www.useragentstring.com/pages/api.php
    global user_agent_strings
    if len(user_agent_strings) == 0:
        with open(user_agent_strings_db) as fid:
            user_agent_strings = json.load(fid)
    if user_agent in user_agent_strings and not reload:
        agent = user_agent_strings[user_agent]
        machine = _replace_os_string(agent['os_name'])
        browser = agent['agent_name']
        return f'{machine} / {browser}'
    else:
        s = user_agent.replace(' ', r'%20')
        try:
            url = f'http://www.useragentstring.com/?uas={s}&getJSON=agent_type-agent_name-agent_version-os_name'
            response = urllib.request.urlopen(url)
            if response.status == 200:
                agent = json.loads(response.readline())
                user_agent_strings[user_agent] = agent
                try:
                    with open(user_agent_strings_db, 'w') as fid:
                        json.dump(user_agent_strings, fid)
                except:
                    print(f'ERROR. Unable to write to {user_agent_strings_db}')
                return get_user_agent_string()
            else:
                print('Not found from useragentstring.com')
                print(response)
        except:
            pass
    return 'Unknown / Unknown'

def get_ip_location(ip, show_city=False):
    if ip[:3] == '10.':
        return 'Internal / VPN'
    global ip_location_db_fid
    if ip_location_db_fid is None:
        ip_location_db_fid = maxminddb.open_database(ip_location_db)
    info = ip_location_db_fid.get(ip)
    if info is None:
        return '-'
    country = info['country']['names']['en']
    state = info['subdivisions'][0]['names']['en']
    origin = f'{state}, {country}'
    if show_city:
        city = re_space.sub('', info['city']['names']['en'])
        origin = f'{city}, ' + origin
    return origin
