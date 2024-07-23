#!/bin/bash

git reset --hard
git pull

pip install -r requirements.txt

cd frontend
npm update
npm prune
npm run build
cd -

cd reporter
make -B
cd -

./restart.sh
