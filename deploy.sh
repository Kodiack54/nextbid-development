#!/bin/bash

# Deploy Dev Studio to Dev Droplet
# Target: 161.35.229.220:5000 (Studio) + 5100 (Worker)

set -e

DROPLET_IP="161.35.229.220"
DROPLET_USER="root"
REMOTE_PATH="/var/www/NextBid_Dev/dev-studio-5000"
LOCAL_PATH="."
PM2_NAME="dev-studio-5000"

echo "=== Building Next.js App ==="
npm run build

echo "=== Creating deployment package ==="
# Create a clean package (exclude node_modules, .git, etc.)
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next/cache' \
  --exclude '*.log' \
  $LOCAL_PATH/ $DROPLET_USER@$DROPLET_IP:$REMOTE_PATH/

echo "=== Installing dependencies on server ==="
ssh $DROPLET_USER@$DROPLET_IP "cd $REMOTE_PATH && npm install --production"

echo "=== Restarting PM2 process ==="
ssh $DROPLET_USER@$DROPLET_IP "cd $REMOTE_PATH && pm2 restart $PM2_NAME || pm2 start npm --name '$PM2_NAME' -- start -- -p 5000"

echo "=== Saving PM2 config ==="
ssh $DROPLET_USER@$DROPLET_IP "pm2 save"

echo "=== Deployment Complete ==="
echo "Dev Studio running at: http://$DROPLET_IP:5000"
echo "Worker will run at: http://$DROPLET_IP:5100"
