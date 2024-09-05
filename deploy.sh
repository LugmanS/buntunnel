#!/bin/bash

echo "****************** Starting buntunnel deployment ******************"

git pull origin

sudo cp ./nginx.conf /etc/nginx/conf.d/buntunnel.conf

sudo nginx -s reload

bun install

echo "****************** Starting buntunnel server ******************"

bun run start
