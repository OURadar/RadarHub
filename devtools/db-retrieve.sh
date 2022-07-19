#!/bin/bash

if [[ ${HOSTNAME} == "dwv05" ]]; then
    echo "This script is not meant for here."
    exit
fi

scp -Cp dwv05:/home/radarhub/app/database/user-agent-strings.json ../database
