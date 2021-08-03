#!/bin/bash

git pull

cd frontend
npm run build
cd -

sudo systemctl daemon-reload
sudo systemctl restart backhaul

sudo supervisorctl restart asgi:*

