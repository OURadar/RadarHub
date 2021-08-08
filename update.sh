#!/bin/bash

git pull

cd frontend
npm run build
cd -

sudo supervisorctl stop asgi:*
sudo systemctl stop backhaul

sudo systemctl daemon-reload

sudo systemctl start backhaul
sudo supervisorctl start asgi:*
