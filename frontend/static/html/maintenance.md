Copy the font files to the `nginx` root content folder, typically at `/var/www/html` so that the tree structure is like:

```text
/var/www/html/
├── 503.html -> /home/radarhub/app/frontend/static/html/503.html
├── index.nginx-debian.html
└── static -> /home/radarhub/app/frontend/static/

```

Add these `/etc/nginx/sites-available/default` as:

```conf
server {
    listen 80 default_server;
	listen [::]:80 default_server;

    ...

    location /favicon.ico {
        root /home/radarhub/app/frontend/static/images;
    }

    location ~* \.(ttf|jpg|png) {
        try_files $uri =404;
    }

    ...
}
```

Then, restart `nginx` as:

```shell
sudo systemctl reload nginx && sudo systemctl restart nginx
```
