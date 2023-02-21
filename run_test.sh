#!/bin/bash
echo -e "### connecting to the ec2 instance ###"
ssh ubuntu@ip-address -i 'key-location' -o StrictHostKeyChecking=no '
echo -e "### git clone the repo... ###";
git clone https://[dp-test-access-token]@github.com/christine1729/dp-test.git;
cd dp-test/capacity/puppeteer;
echo -e "### resolve dependencies ###";
sudo apt-get update;
sudo DEBIAN_FRONTEND=noninteractive apt-get -y install nodejs;
sudo DEBIAN_FRONTEND=noninteractive apt-get -y installbuild-essential;
sudo DEBIAN_FRONTEND=noninteractive apt-get -y install npm;
npm install;
npm install chalk;
sudo DEBIAN_FRONTEND=noninteractive apt install -y gconf-service libasound2 libgbm-dev libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget;
echo -e "### run puppeteer script ###";
node server_capacity.js;
'