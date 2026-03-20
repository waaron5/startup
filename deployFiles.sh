# ./deployFiles.sh -k /Users/aaronwood/.ssh/thequisling-server-us-east-1.pem -h thequisling.online -s startup

#!/bin/bash
set -euo pipefail

while getopts k:h:s: flag
do
    case "${flag}" in
        k) key=${OPTARG};;
        h) hostname=${OPTARG};;
        s) service=${OPTARG};;
    esac
done

if [[ -z "$key" || -z "$hostname" || -z "$service" ]]; then
    printf "\nMissing required parameter.\n"
    printf "  syntax: deployFiles.sh -k <pem key file> -h <hostname> -s <service>\n\n"
    exit 1
fi

printf "\n----> Deploying files for $service to $hostname with $key\n"

printf "\n----> Build deployment bundle.\n"
npm run build

rm -rf build
mkdir -p build/service

cp -rf dist build/dist
cp package.json build/

if [[ -f package-lock.json ]]; then
    cp package-lock.json build/
fi

cp service/*.js build/service/

if [[ -f dbConfig.json ]]; then
    cp dbConfig.json build/
fi

printf "\n----> Prepare remote service directory.\n"
ssh -i "$key" ubuntu@$hostname << ENDSSH
rm -rf services/${service}
mkdir -p services/${service}
ENDSSH

printf "\n----> Copy deployment bundle to target.\n"
scp -r -i "$key" build/* ubuntu@$hostname:services/$service

printf "\n----> Install runtime dependencies and restart PM2 service.\n"
ssh -i "$key" ubuntu@$hostname << ENDSSH
bash -i
cd services/${service}

if [[ -f package-lock.json ]]; then
    npm ci --omit=dev
else
    npm install --omit=dev
fi

if pm2 describe ${service} >/dev/null 2>&1; then
    pm2 restart ${service} --update-env
else
    pm2 start service/index.js --name ${service}
fi
ENDSSH

printf "\n----> Local cleanup.\n"
rm -rf build
