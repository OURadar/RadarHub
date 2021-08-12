#!/bin/bash

git pull

cd frontend
npm run build
cd -

cd reporter
make -B
cd -

./update.sh
