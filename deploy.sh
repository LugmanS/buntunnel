#!/bin/bash

echo "****************** Deploying buntunnel ******************"

git pull origin

sudo cp ./nginx.conf /etc/nginx/conf.d/buntunnel.conf

sudo nginx -s reload

bun install

bun run start

echo "****************** Deployed buntunnel ******************"