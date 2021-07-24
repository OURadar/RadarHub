# RadarHub

This is a [Django]-[Channels] for web interface to the radar operations.

**IMPORTANT**: This is a work in progress. I just wanted to start the source control early.

Three main parts:

- [Django] backend
- [React] frontend
- [Python] backhaul

Some design constraints:

- Keep backend-frontend responsive, mostly async functions
- Input from clients gets routed to a specific group (radar)
- Output from a radar gets broadcast to all users in a specific group (radar)
- All input gets picked up by backhaul, routed to a the specific radar based on group source
- Radar reporter does not receive anything from the radar itself (different behavior than a chat room)

## Milestones

- [x] 0.1 Can run
- [x] 0.2 Scope + Health working
- [ ] 0.3 Some button actions to backhaul
- [ ] 0.4 Get an external websocket client
- [ ] 0.5 PPI / 3D view
- [ ] 0.6 SQLite / product browser
- [ ] 0.7 General page template + stylesheets
- [ ] 0.8 Authentication
- [ ] 0.9 Landing page
- [ ] 1.0 RadarKit communicates with RadarHub

# Development

I recommend VSCode and the plugin Prettier (of course, use what you prefer). The very first thing to do right after cloning the repository is to indstall the Python requirements and node dependencies, which can be accomplished as:

```shell
python install -r requirements.txt

cd frontend
npm install
```

Be sure to have [redis] going for the [channels] module.

```shell
docker run -p 6379:6379 -d redis:6
```

Run three terminals:

1. webpack

```shell
cd frontend
npm run dev
```

2. main django server

```shell
python manage.py runserver 0:8000
```

3. background worker

```shell
python manage.py runworker backhaul
```

Off you go, you should be able to view the RadarHub interface through a web browser at http://localhost:8000


# Deploying

On a production server, I use the Ubuntu nginx-supervisor recommendation in [channels].

### Nginx

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

### Supervisor

Configure through the file `/etc/supervisor/conf.d/radarhub.conf` as:

```
[fcgi-program:asgi]
# TCP socket used by Nginx backend upstream
socket=tcp://localhost:8000

# Directory where your site's project files are located
directory=/home/radarhub/app

# Each process needs to have a separate socket file, so we use process_num
# Make sure to update "mysite.asgi" to match your project name
command=/home/radarhub/.pyenv/shims/python -m daphne \
    -u /run/daphne/daphne%(process_num)d.sock \
    --fd 0 --access-log - \
    --proxy-headers radarhub.asgi:application

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

[channels]: https://channels.readthedocs.io
[django]: https://www.djangoproject.com
[node.js]: https://nodejs.org
[react]: https://reactjs.org
[python]: https://www.python.org
[docker]: https://www.docker.com
[redis]: https://redis.io
[nginx]: https://www.nginx.com
[supervisor]: http://supervisord.org
