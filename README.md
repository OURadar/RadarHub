[![Latest Release](https://git.arrc.ou.edu/radar/radarhub/-/badges/release.svg)](https://git.arrc.ou.edu/radar/radarhub/-/releases) [![pipeline status](https://git.arrc.ou.edu/radar/radarhub/badges/master/pipeline.svg)](https://git.arrc.ou.edu/radar/radarhub/-/commits/master)

# RadarHub

This is mainly a [Django] web app for ARRC radar archive. There is also a [Django]-[Channels] interface for live radar operations.

Three main parts:

- [Django] backend
- [React] frontend
- [Python] backhaul

Some design constraints:

- Keep backend-frontend responsive, _only_ async functions
- All input/output gets picked up by backhaul
- Backhaul serves as the middle party to facilitate one-to-one or one-to-many messaging
- Payloads from a radar get broadcast to all users in a specific group by worker _backhaul_
- A radar reporter does not receive anything from the radar itself (different behavior than a chat room)

# (Evolving) Concept of Operations

Currently, the RadarHub is almost like a chat program with an exception that the messages are not echoed back. The radars do not recieve the payload they send home and the users do not see the command they issue. Everyone connects through the frontend websocket, either join as a radar (`frontend.consumers.Radar`) or join as a user (`frontend.consumers.User`). When a radar joins and sends in proper greeting, it receives a welcome message from the hub. When a user joins through a web browser, the frontend javascript main script ensures the connection is properly made, the user is assigned to a group, named after the radar name.

When a user request is issued, it is first received by the frontend, which checks for the required fields. If failed, nothing happens. Otherwise, it is routed to the backhaul asynchronously. Frontend immediately regain control, GUI should always be responsive. Backhaul decides which radar to send the request to, awaits for the radar response, and then routes it to the user.

When a radar joins the RadarHub, it reports its name. Backhaul launches a runloop to collect data streams from the radar. This runloop also sends whatever data stream available from the radar to the group. All users in that group receive the same data stream. This will change in the future for a more controlled fashion but kept simple at the moment for progressing towards the subsequent milestones.

## Frontend Block Diagram

![Figure](blob/appX.svg)

## Backend Block Diagram

![Figure](blob/backhaul.svg)

# A Few Important Things

Here are some assumptions that developers should be aware of.

## Data Types

Currently defined in `reporter/types.h`, which is arguably sub-optimal. Perhaps the project root folder is better. Will revisit.

In the C space, obviously you just include the header and you are done.

In the Python space, a parser is made to retrieve everythin in the C header to a Python enums through `reporter/enums.py`. All the types will be in the convention of

- `RadarHubType.Handshake`
- `RadarHubType.Control`
- `RadarHubType.Health`
- `RadarHubType.Scope`
- ...

In the Javascript space, the definition is passed to the frontend upon a successful connection, the data ingest `frontend/src/components/ingest.js` expects keys like `Control`, `Health`, `Scope`, etc., which nicely maps to the enum names in the C and Python spaces.

## Sequence of Events

`frontend.consumers.User`

- message from web UI is always in text form (JSON)
- message to web UI is always in binary form (bytearray)

`frontend.consumers.Radar`

- message from radar is always in binary form ([type][payload])
- message to radar is always in text form (plain text)

![Figure](blob/events.svg)

# Software Requirements

[Visual Studio Code](https://code.visualstudio.com) and the plugin Prettier are recommended but, of course, use whatever you prefer. Before setting the [Django] project, install some of the software.

## Node.js, npm, and PostgreSQL

PostgreSQL is optional if you do not wish to use [PostgreSQL] as your database backend. The repository is setup to look for the [PostgreSQL] configuration under `config/db.json`. If this file does not exist, RadarHub falls back to using SQLite3. In that case, you may ommit `libpq` and `postgresql` in the following commands, and the section Configure PostgreSQL.

On Ubuntu, run the following commands:

```shell
sudo apt update
sudo apt install nodejs npm libpq-dev postgresql postgresql-contrib
```

On macOS, run the following commands:

```shell
brew update
brew install nodejs npm libpq postgresql
```

Install the [Python] requirements as:

```shell
python -m pip install -r requirements.txt
```

Install [Node.js] and [npm] from NodeSource using the following commands:

```shell
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install -y nodejs
```

## Get the Project

Now you should be ready to clone the repository:

```shell
git clone https://git.arrc.ou.edu/radar/radarhub.git
```

Install the [Node.js] dependencies using [npm], which can be accomplished as:

```shell
cd frontend
npm install
```

## Configure PostgreSQL (Optional)

You can skip this section if you do not wish to use [PostgreSQL] as the database backend.

Switch to user `postgres` and run `psql` using the following commands:

```shell
sudo -i -u postgres
psql
```

Create a database `radarhub`, and users `radarhub` and `guest` on [PostgreSQL]:

```text
postgres-# CREATE DATABASE radarhub;
postgres=#
postgres=# CREATE USER radarhub;
postgres-# ALTER ROLE radarhub WITH PASSWORD '_radarhub_password_';
postgres-# GRANT ALL PRIVILEGES ON DATABASE radarhub TO radarhub;
postgres-# ALTER ROLE radarhub SUPERUSER CREATEROLE CREATEDB;
postgres-# ALTER DATABASE radarhub OWNER TO radarhub;
postgres=#
postgres=# CREATE USER guest;
postgres-# ALTER ROLE guest WITH PASSWORD '_guest_password_';
postgres-# GRANT CONNECT ON DATABASE radarhub TO guest;
postgres-# GRANT SELECT ON radarhub TO guest;
```

Also, configure [PostgreSQL] to be accessible through network by adding/modifying the following lines in the configuration file `/etc/postgresql/12/main/postgresql.conf`:

```conf
listen_addresses = '*'
```

Some servers may require a new configuration file `/etc/postgresql/12/main/pg_hba.conf` to have the following:

```conf
# TYPE DATABASE USER CIDR-ADDRESS  METHOD
host  all  all 0.0.0.0/0 md5
```

Back to the [Django] project, create a plain text file named `db.json` under the folder `config`, and put the following contents in there. Replace the `_radarhub_password_` you used in setting up the [PostgreSQL] database in the text.

```json
{ "host": "localhost", "user": "radarhub", "pass": "_radarhub_password_" }
```

The root folder of the radarhub project should look like this:

```shell
drwxrwxr-x 4 boonleng users 4.0K Oct  3 09:17 backhaul/
drwxrwxr-x 2 boonleng users 4.0K Feb  7 18:27 blob/
drwxrwxr-x 3 boonleng users 4.0K Feb  4 10:09 common/
drwxrwxr-x 2 boonleng users 4.0K Feb  8 11:03 config/
drwxrwxr-x 8 boonleng users 4.0K Feb  8 11:25 frontend/
drwxrwxr-x 3 boonleng users 4.0K Feb  8 11:18 radarhub/
drwxrwxr-x 4 boonleng users 4.0K Jan 23 10:19 reporter/
drwxrwxr-x 2 boonleng users 4.0K Jan  6 19:53 tools/
-rwxrwxr-x 1 boonleng users  23K Feb  8 11:18 dbtool.py*
-rwxrwxr-x 1 boonleng users 8.0K Feb  8 11:25 file2db.py*
-rwxrwxr-x 1 boonleng users  703 Oct  2 14:23 manage.py*
-rw-rw-r-- 1 boonleng users   87 Jan  7 17:36 package-lock.json
-rw-rw-r-- 1 boonleng users  12K Feb  8 11:19 README.md
-rw-rw-r-- 1 boonleng users  114 Feb  4 10:09 requirements.txt
-rwxrwxr-x 1 boonleng users  211 Oct  2 14:23 restart.sh*
-rwxrwxr-x 1 boonleng users  679 Oct  2 14:23 summary.sh*
-rwxrwxr-x 1 boonleng users  100 Oct  2 14:23 update.sh*
```

## Creating Database

Now, you are ready to create the RadarHub default database

```shell
python manage.py makemigrations frontend --database=data
python manage.py makemigrations
python manage.py migrate
```

You may check the staged migrations as

```shell
manage.py showmigrations frontend --database=data
manage.py showmigrations
```

That's it, the project should be ready to go for more development or deployment.

## Useful SQL Commands

To login remotely, use:

```shell
psql -h localhost -U radarhub -W
psql -h dcv01 -U radarhub -W
psql -h dcv01 -U radarhub -d radarhub -W
```

Once in the `psql` terminal, some of these could be useful:

```sql
\d
\du
\dt
SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'frontend_sweep';
SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'frontend_day';
SELECT grantee, table_name, privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public';

```

## Migrate PostgreSQL to Another Machine:

On the source machine, edit `/etc/postgresql/12/main/pg_hba.conf` by adding the following line:

```conf
host    replication     postgres        10.197.14.0/24          trust
```

```shell
sudo systemctl stop postgresql
rm -rf /var/lib/postgresql/12/main/*
sudo -u postgres pg_basebackup -h dwv05 -U postgres -D /var/lib/postgresql/12/main/
```

## Potential OS Limitations

If webpack display a message like this:

```text
Watchpack Error (watcher): Error: ENOSPC: System limit for number of file watchers reached
```

Add the following line to `/etc/sysctl.conf`

```conf
fs.inotify.max_user_watches=16384
```

Then, run

```shell
sudo sysctl -p
```

# Redis

Be sure to have [redis] going for the [Channels] module every time you reboot the machine. Also, it is necessary to have `DEBUG = True` when using `python manage.py runserver 0:8000` for a local server. Otherwise, static assets cannot be fetched correctly. The [Django] configuration (`radarhub/settings.py`) is programmed to look for the environmental variable `DJANGO_DEBUG=true` and set `DEBUG = True`. I recommend adding the environmental variable `DJANGO_DEBUG=true` to your shell profile (e.g., `.bash_profile`). Otherwise, you could hardcode it but be sure to restore it to `False` in deployment.

In short, add the following line to `.bash_profile`:

```shell
export DJANGO_DEBUG=true
```

## Redis Using Systemd (Recommended)

Running [Redis] through `systemd` allows you to configure the `supervisor.service`, which starts the RadarHub components, to start after the [Redis] service is active.

Refer to [install-redis.md](https://gist.github.com/hackedunit/a53f0b5376b3772d278078f686b04d38) for instructions to install [Redis] from source.

Use the recommended setting, included here for quick reference

Configure through `/etc/systemd/system/redis.service` as:

```conf
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/local/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/local/bin/redis-cli shutdown
Restart=always

[Install]
WantedBy=multi-user.target
```

## Redis Using Docker

For running [redis] using [Docker]:

```shell
docker run -p 6379:6379 -d redis:6
```

# Develop RadarHub

Be sure to have [redis] going for the [Channels] module every time you reboot the machine.

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

4. demo radar

```shell
cd reporter
dgen -v localhost:8000
```

Off you go, you should be able to view the RadarHub interface through a web browser at http://localhost:8000 and tinker with the source codes and see the changes when you reload the page. Happy coding.

# Deploy RadarHub

On a production server, the Ubuntu [Nginx]-[Supervisor] setup was recommended in the [Channels] documentation. A special account `radarhub` has been created to house the production codes. The instructions here is based on the assumption that everything is stored under `/home/radarhub/app`. To make an optimized `main.js`, compile the components as:

```shell
cd frontend
npm run build
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

	location ~ /(favicon.ico|apple-touch-icon.png|apple-touch-icon-precomposed.png) {
		root /home/radarhub/app/frontend/static/images;
	}

	location /static/ {
		root /home/radarhub/app/frontend;
	}

	location / {
		try_files $uri @proxy_to_app;
	}

	location @proxy_to_app {
		proxy_pass http://channels_backend;

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Host $server_name;
		proxy_set_header X-Accel-Buffering no;
		proxy_buffering off;
		proxy_cache off;
	}
}
```

and enable it using shell command as:

```shell
ln -s /etc/nginx/sites-available/radarhub /etc/nginx/sites-enabled/
```

To use the maintenance page, copy the file `frontend/templates/frontend/maintenance.html` to [nginx] root document folder, as:

```shell
cp frontend/templates/frontend/maintenance.html /var/www/html/
```

Then, modify the section `location /` of `/etc/nginx/sites-available/default` as:

```nginx
	location /favicon.ico {
		root /home/radarhub/app/frontend/static/images;
	}

	location / {
		if (-f $document_root/maintenance.html) {
			return 503;
		}
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}

	error_page 503 @maintenance;
	location @maintenance {
		rewrite ^(.*)$ /maintenance.html break;
	}
```

To enable data compression, which could save bandwidth and improve performance, add these lines to `/etc/nginx/nginx.conf` under the `http` section as:

```nginx
http {
	###

	##
	# Gzip Settings
	##

	gzip on;
	gzip_vary on;
	gzip_proxied any;
	gzip_comp_level 6;
	gzip_buffers 16 8k;
	gzip_http_version 1.1;
	gzip_min_length 256;
    gzip_types
        application/json
        application/javascript
        application/octet-stream
        text/plain
        text/html
        text/css
        text/xml;

	###
}
```

## Supervisor Using Systemd

If you configured [Redis] through `systemd`, you can set up [supervisor] to start after [redis] is available.

Configure through the file `/lib/systemd/system/supervisor.service` as:

```conf
[Unit]
Description=Supervisor process control system for UNIX
Documentation=http://supervisord.org
After=redis.service
Requires=redis.service
ReloadPropagatedFrom=redis.service

[Service]
ExecStart=/usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
ExecStop=/usr/bin/supervisorctl $OPTIONS shutdown
ExecReload=/usr/bin/supervisorctl -c /etc/supervisor/supervisord.conf $OPTIONS reload
KillMode=process
Restart=on-failure
RestartSec=50s
Environment=PYTHONHASHSEED=0

[Install]
WantedBy=multi-user.target
```

## Configure Supervisor

Configure through the file `/etc/supervisor/conf.d/radarhub.conf` as:

```conf
[fcgi-program:radarhub.frontend]
user = radarhub
directory = /home/radarhub/app
environment = PYTHONUNBUFFERED=1
socket = tcp://localhost:8000
command = /home/radarhub/.pyenv/shims/python -m daphne -u /run/daphne/daphne%(process_num)d.sock --fd 0 --access-log /var/log/radarhub/access.log --proxy-headers radarhub.asgi:application
numprocs = 2
process_name = radarhub_%(process_num)d
autostart = true
autorestart = true
redirect_stderr = true
stdout_logfile = /var/log/radarhub/frontend.log
stopwaitsecs = 5
priority = 1

[program:radarhub.backhaul]
user = radarhub
directory = /home/radarhub/app
environment = PYTHONUNBUFFERED=1
command = /home/radarhub/.pyenv/shims/python manage.py runworker backhaul
autostart = true
autorestart = true
redirect_stderr = true
stdout_logfile = /var/log/radarhub/backhaul.log
stopwaitsecs = 5
priority = 2

[program:radarhub.dgen]
user = radarhub
command = /home/radarhub/app/reporter/dgen
autostart = true
autorestart = true
redirect_stderr = true
stdout_logfile = /var/log/radarhub/dgen.log
stopwaitsecs = 5
priority = 3
```

Create the run directory for socket

```shell
sudo mkdir /run/daphne
sudo chown radarhub.radarhub /run/daphne/
```

Configure the file to be created at each boot through `/usr/lib/tmpfiles.d/daphne.conf` as:

```conf
d /run/daphne 0775 radarhub radarhub
```

Start the service as:

```shell
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

A convenient script `restart.sh` is included to restart all services in a proper sequence in order to prevent channels getting full.

```shell
sudo restart.sh
```

Optionally, you can avoid using `sudo` by changing the ownership and permission of the file `/var/run/supervisor.sock` as:

```shell
chown radarhub.radarhub /var/run/supervisor.sock
chmod g+rwx /var/run/supervisor.sock
```

## Django EventStream

The migrations of [django_eventstream] is stored in where the package is installed. If you are using [pyenv] to manage your [Python] versions, the migration history can be removed using the following commands

```shell
folder=$(python -c "import django_eventstream; print(django_eventstream.__path__[0])")
rm ${folder}/migrations/0*.py
rm ${folder}/migrations/__pycache__/*.pyc
```

Useful command to test of the eventstream is working properly when setting `SIMULATE = True` in `radarhub.settings.py`:

```shell
curl -N http://localhost:8000/events/
```

## Logrotate

Configure the `logrotate` utility to compress and rotate out old logs automatically through `/etc/logrotate.d/radarhub` as:

```conf
/var/log/radarhub/*.log {
	daily
	rotate 30
	copytruncate
	compress
	missingok
	notifempty
}
```

Congratulations! You made it to the very end. Cheers!

[channels]: https://channels.readthedocs.io
[django]: https://www.djangoproject.com
[django_eventstream]: https://github.com/fanout/django-eventstream
[docker]: https://www.docker.com
[nginx]: https://www.nginx.com
[node.js]: https://nodejs.org
[npm]: https://www.npmjs.com
[python]: https://www.python.org
[postgresql]: https://www.postgresql.org
[pyenv]: https://github.com/pyenv/pyenv
[react]: https://reactjs.org
[redis]: https://redis.io
[supervisor]: http://supervisord.org
