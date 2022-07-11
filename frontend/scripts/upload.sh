#!/bin/zsh

if [[ ${HOSTNAME} == "dwv05" ]]; then
    echo "This script is not meant for here."
    exit
fi

rsync -av --size-only --exclude=.DS_Store ../static/maps radarhub@dwv05:/home/radarhub/app/frontend/static/
