Copy the font files to the `nginx` root content folder, typically at `/var/www/html` so that the tree structure is like:

```text
/var/www/html/
├── 503.html -> /home/radarhub/app/frontend/static/html/503.html
└── index.nginx-debian.html
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

	location /static/ {
		root /home/radarhub/app/frontend;
	}

	location / {
		if (-f $document_root/503.html) {
			return 503;
		}
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ =404;
	}

	error_page 503 @maintenance;
	location @maintenance {
		rewrite ^(.*)$ /503.html break;
	}

    ...
}
```

Then, restart `nginx` as:

```shell
sudo systemctl reload nginx && sudo systemctl restart nginx
```
