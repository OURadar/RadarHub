Copy the font files to the `nginx` root content folder, typically at `/var/www/html` so that the tree structure is like:

```text
/var/www/html/
├── fonts
│   ├── HelveticaNeue.ttf
│   ├── HelveticaNeueBd.ttf
│   ├── HelveticaNeueHv.ttf
│   ├── HelveticaNeueIt.ttf
│   ├── HelveticaNeueLt.ttf
│   └── HelveticaNeueMed.ttf
├── index.nginx-debian.html
└── maintenance.html -> /home/radarhub/app/frontend/templates/frontend/maintenance.html
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
