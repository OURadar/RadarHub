#!/bin/bash

echo "Updating settings ..."
sudo supervisorctl reread
sudo supervisorctl update
sudo systemctl daemon-reload

echo "Stopping dgen ..."
sudo systemctl stop dgen
echo "Stopping frontend ..."
sudo supervisorctl stop asgi:*
echo "Stopping backhaul ..."
sudo systemctl stop backhaul


echo "Starting backhaul ..."
sudo systemctl start backhaul
echo "Starting frontend ..."
sudo supervisorctl start asgi:*
echo "Starting dgen ..."
sudo systemctl start dgen
