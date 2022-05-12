#!/bin/bash

if [[ ${USER} != "radarhub" &&  ${USER} != "root" ]]; then
    echo "This script is meant for the user radarhub"
    exit 1;
fi

echo "Updating settings ..."
supervisorctl reread
supervisorctl update

echo "Stopping services ..."
supervisorctl stop all

echo "Starting services ..."
supervisorctl start all
