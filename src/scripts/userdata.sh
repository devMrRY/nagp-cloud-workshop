#!/bin/bash
set -e

AWS_REGION="eu-north-1"
S3_BUCKET="nagp-insurance-docs-160885278821-eu-north-1-an"
APP_DIR="/home/ec2-user/app"

mkdir -p "$APP_DIR"

# Download latest deployment
aws s3 cp \
  "s3://$S3_BUCKET/deployments/latest.zip" \
  /tmp/latest.zip

# Clean previous deployment
rm -rf "$APP_DIR/current"
mkdir -p "$APP_DIR/current"

# Extract application
unzip -o /tmp/latest.zip -d "$APP_DIR/current"

# Create runtime environment configuration
cat > "$APP_DIR/current/.env" <<EOF
PORT=4000
AWS_REGION=$AWS_REGION
S3_BUCKET=$S3_BUCKET
EOF

# Give ec2-user ownership
chown -R ec2-user:ec2-user "$APP_DIR"
chmod 600 "$APP_DIR/current/.env"

# Start application with PM2
sudo -u ec2-user bash -c '
  source /home/ec2-user/.nvm/nvm.sh
  nvm use 24

  cd /home/ec2-user/app/current

  pm2 delete nagp-app || true
  pm2 start npm --name nagp-app -- start
  pm2 save

  pm2 list
'