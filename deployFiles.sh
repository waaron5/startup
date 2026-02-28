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

# Step 0
printf "\n----> Build frontend distribution (Vite).\n"
npm run build

# Step 1
printf "\n----> Clear out the previous distribution on the target.\n"
ssh -i "$key" ubuntu@$hostname << ENDSSH
rm -rf services/${service}/public
mkdir -p services/${service}/public
ENDSSH

# Step 2
printf "\n----> Copy Vite dist files to the target.\n"
scp -r -i "$key" dist/* ubuntu@$hostname:services/$service/public
