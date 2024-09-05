#!/bin/bash

echo "****************** Deploying buntunnel ******************"

git pull origin

bun install

bun run start

sudo cp ./nginx.conf /etc/nginx/conf.d/buntunnel.conf

sudo nginx -s reload

echo "****************** Deployed buntunnel ******************"