#!/bin/bash

echo "Updating settings ..."
supervisorctl reread
supervisorctl update

echo "Stopping services ..."
supervisorctl stop all

echo "Starting services ..."
supervisorctl start all
