# RadarHub

This is a [Django]-[Channels] web interface for ARRC radar operations.

**IMPORTANT**: This is a work in progress. I just wanted to start the source control early.

Three main parts:

- [Django] backend
- [React] frontend
- [Python] backhaul

Some design constraints:

- Keep backend-frontend responsive, _only_ async functions
- Output from a radar gets broadcast to all users in a specific group (radar) by worker _backhaul_
- All input gets picked up by backhaul, routed to a the specific radar based on source uri, which contains the radar name
- Radar reporter does not receive anything from the radar itself (different behavior than a chat room)

# (Evolving) Concept of Operations

Currently, the RadarHub is almost like chat program. The main exception is that the messages are not echoed back. The radars do not recieve what they send home and the users do not see the command they issue. Everyone connects through the frontend websocket, either join as a radar or join as a user. When a radar joins, it simply gets a welcome message from the hub. When a user joins, it is assigned to a group, named after the radar name.

When a user issues a request, it is first received by the frontend, which checks for the required fields. If failed, nothing happens. Otherwise, it is routed to the backhaul asynchronously. Frontend immediately regain control, GUI is responsive this way. After the request is processed, backhaul sends the response to the user.

When a radar joins the RadarHub, it reports its name. Backhaul launches a runloop to collect data streams from the radar. This runloop also sends whatever data stream available from the radar to the group. All users in that group receive the same data stream. This will change in the future for a more controlled fashion but kept simple at the moment for moving towards the subsequent milestones.

## Milestones

- [x] 0.1 Can run
- [x] 0.2 Scope + Health working (7/21/2021)
- [x] 0.3 Some button actions to backhaul (7/29/2021)
- [ ] 0.4 Migrate data module to an external websocket client
- [ ] 0.5 PPI / 3D view for radar products
- [ ] 0.6 SQLite / product browser
- [ ] 0.7 General page template + stylesheets
- [ ] 0.8 Authentication + user priviledges
- [ ] 0.9 Landing page, radar selection, etc.
- [ ] 1.0 RadarKit communicates with RadarHub

# Developing

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

Configure through the file `/etc/nginx/sites-available/radarhub` as:

```nginx
upstream channels-backend {
    server localhost:8000;
}

server {
    listen 443;
    server_name radarhub.arrc.ou.edu;
    rewrite ^(.*)? http://$host$1 permanent;
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
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $server_name;
    }
}
```

and enable it using shell command as:

```shell
ln -s /etc/nginx/sites-available/radarhub /etc/nginx/sites-enabled/
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
command=/home/radarhub/.pyenv/shims/python -m daphne -u /run/daphne/daphne%(process_num)d.sock --fd 0 --access-log - --proxy-headers radarhub.asgi:application

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

[channels]: https://channels.readthedocs.io
[django]: https://www.djangoproject.com
[node.js]: https://nodejs.org
[react]: https://reactjs.org
[python]: https://www.python.org
[docker]: https://www.docker.com
[redis]: https://redis.io
[nginx]: https://www.nginx.com
[supervisor]: http://supervisord.org
