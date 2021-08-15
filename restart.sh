#!/bin/bash

echo "Updating settings ..."
sudo supervisorctl reread
sudo supervisorctl update

echo "Stopping services ..."
sudo supervisorctl stop all

echo "Starting services ..."
sudo supervisorctl start all
