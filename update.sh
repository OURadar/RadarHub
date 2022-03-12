#!/bin/bash

git reset --hard
git pull

cd frontend
npm i
npm run build
cd -

cd reporter
make -B
cd -

./restart.sh
