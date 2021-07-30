# RadarHub

This is a [Django]-[Channels] web interface for ARRC radar operations.

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
- [x] 0.2 Scope + Health working (7/21/2021)
- [x] 0.3 Some button actions to backhaul (7/29/2021)
- [ ] 0.4 Get an external websocket client
- [ ] 0.5 PPI / 3D view
- [ ] 0.6 SQLite / product browser
- [ ] 0.7 General page template + stylesheets
- [ ] 0.8 Authentication
- [ ] 0.9 Landing page
- [ ] 1.0 RadarKit communicates with RadarHub

# Development

Visual Studio Code and the plugin Prettier are recommended but, of course, use whatever you prefer. The very first thing to do right after cloning the repository is to install the Python requirements and node dependencies, which can be accomplished as:

```shell
python install -r requirements.txt

cd frontend
npm install
```

Be sure to have [redis] going for the [channels] module every you rebooted the machine.

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

Off you go, you should be able to view the RadarHub interface through a web browser at http://localhost:8000 and tinker with the source codes and see the changes when you reload the page. Happy coding.

# Deploying

On a production server, the Ubuntu nginx-supervisor was recommended in [channels].

## Docker

The websocket component depends on [redis] through docker:

```shell
sudo docker run -d --restart unless-stopped -p 6379:6379 redis:5
```

## Nginx

Configure through the file `/etc/nginx/sites-enabled/radarhub` as:

```nginx
upstream channels-backend {
    server localhost:8000;
}

server {
    listen 443;
    server_name radarhub.arrc.ou.edu 10.197.14.38;
    rewrite ^(.*) http://$host$1 permanent;
}

server {
    listen 80;
    listen [::]:80;

    server_name radarhub.arrc.ou.edu 10.197.14.38;

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
        proxy_redirect off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $server_name;
    }
}
```

## Supervisor

Configure through the file `/etc/supervisor/conf.d/radarhub.conf` as:

```conf
[fcgi-program:asgi]
# TCP socket used by Nginx backend upstream
socket=tcp://localhost:8000

# Directory where your site's project files are located
directory=/home/radarhub/app

# Each process needs to have a separate socket file, so we use process_num
# Make sure to update "mysite.asgi" to match your project name
command=/home/radarhub/.pyenv/shims/daphne -u /run/daphne/daphne%(process_num)d.sock --fd 0 --access-log - --proxy-headers radarhub.asgi:application

# Number of processes to startup, roughly the number of CPUs you have
numprocs=2

# Give each process a unique name so they can be told apart
process_name=radarhub%(process_num)d

# Automatically start and recover processes
autostart=true
autorestart=true

# Choose where you want your log to go
stdout_logfile=/home/radarhub/log/backhaul.log
redirect_stderr=true
```

## Systemctl

Configure through the file `/etc/systemd/system/backhaul.service` as:

```conf
[Unit]
Description=backhaul
After=network.target

[Service]
WorkingDirectory=/home/radarhub/app
ExecStart=/home/radarhub/.pyenv/shims/python /home/radarhub/app/manage.py runworker backhaul
Restart=always

[Install]
WantedBy=multi-user.target
```

# Concept of Operations

Currently, the RadarHub is almost like chat program. Each radar is considered a group (chat room), named after tha radar name. There is a special group named 'backhaul', which all radar commands will be routed to. The backhaul then routes the command to the designated radar, only if the radar has succesfully connected to the RadarHub. The backhaul sends whatever data stream available from each radar to the radar group so that all users in that group receive the same data stream. All users receive all data stream even it is not requested. This may change in the future but for simplicity to move towards subsequent milestones.

# Pending Decisions

| One Channel Per Radar                           | Multiple Channels Per Radar                      |
| ----------------------------------------------- | ------------------------------------------------ |
| Use less channels                               | Use more channels                                |
| Need to track channels based on user priviledge | Simple broadcast, each stream per channel        |
| A user joins one group only                     | A user joins multiple groups based on priviledge |

[channels]: https://channels.readthedocs.io
[django]: https://www.djangoproject.com
[node.js]: https://nodejs.org
[react]: https://reactjs.org
[python]: https://www.python.org
[docker]: https://www.docker.com
[redis]: https://redis.io
[nginx]: https://www.nginx.com
[supervisor]: http://supervisord.org
