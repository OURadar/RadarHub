#!/bin/bash

git pull

cd frontend
npm run build
cd -

cd reporter
make -B
cd -

sudo supervisorctl stop asgi:*
sudo systemctl stop backhaul

sudo supervisorctl reread
sudo supervisorctl update
sudo systemctl daemon-reload

sudo systemctl start backhaul
sudo supervisorctl start asgi:*
