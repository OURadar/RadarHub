# RadarHub

This is a [Django]-[Channels] for web interface to the radar operations.

IMPORTANT: This is a work in progress. I just wanted to start the source control early.

Three main parts:

- [Django] backend
- [React] frontend
- Backhaul for general radar communication

## Milestones

- v0.1 - Can run
- v0.2 - Scope + Health working
- v0.3 - Some button actions to backhaul
- v0.4 - Get an external websocket client
- v0.5 - PPI / 3D view
- v0.6 - SQLite / product browser
- v0.7 - General page template + stylesheets
- v0.8 - Authentication
- v0.9 - Landing page
- v1.0 - RadarKit communicates with RadarHub

[channels]: https://channels.readthedocs.io
[django]: https://www.djangoproject.com
[node.js]: https://nodejs.org
[react]: https://reactjs.org

## Help Me Remember

To restart the app on the production server:

```shell
sudo supervisorctl restart all
```

## Server Setup

On a production server, I use Ubuntu the nginx-supervisor recommendation in [channels]

### nginx

Configure through the file `/etc/nginx/sites-enabled/radarhub` as:

```
upstream channels-backend {
    server localhost:8000;
}

server {
    listen 443;
    server_name radarhub.arrc.ou.edu;
    rewrite ^(.*) http://$host$1 permanent;
}

server {
    listen 80;
    listen [::]:80;

    server_name radarhub.arrc.ou.edu;

    location /static/ {
        root /home/radarhub/app/frontend;
    }
    location /favicon.ico {
        root /home/radarhub/app/frontend/static/images/favicon.ico;
    }

   location / {
        try_files $uri @proxy_to_app;
    }

    location @proxy_to_app {
        proxy_pass http://channels-backend;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_redirect off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $server_name;
    }
}
```

### supervisor

Configure through the file `/etc/supervisor/conf.d/radarhub.conf` as:

```
[fcgi-program:asgi]
# TCP socket used by Nginx backend upstream
socket=tcp://localhost:8000

# Directory where your site's project files are located
directory=/home/radarhub/app

# Each process needs to have a separate socket file, so we use process_num
# Make sure to update "mysite.asgi" to match your project name
command=/home/radarhub/.pyenv/shims/python -m daphne  -u /run/daphne/daphne%(process_num)d.sock --fd 0 --access-log - --proxy-headers radarhub.asgi:application

# Number of processes to startup, roughly the number of CPUs you have
numprocs=4

# Give each process a unique name so they can be told apart
process_name=asgi%(process_num)d

# Automatically start and recover processes
autostart=true
autorestart=true

# Choose where you want your log to go
stdout_logfile=/home/radarhub/log/asgi.log
redirect_stderr=true
```

### Docker

The websocket component depends on redis version 5 through docker:

```shell
sudo docker run -d --restart unless-stopped -p 6379:6379 redis:5
```
