#!/bin/bash

set -e

REGION="eu-north-1"

ASG_NAME="nagp-app-asg"

echo "Region: $REGION"
echo "ASG: $ASG_NAME"

read -p "Scale ASG to 0 and stop compute resources? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "Scaling ASG down..."

aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name "$ASG_NAME" \
  --min-size 0 \
  --desired-capacity 0 \
  --region "$REGION"

echo "Waiting for instances to terminate..."

aws autoscaling wait group-in-service-instances-stable \
  --auto-scaling-group-name "$ASG_NAME" \
  --region "$REGION" || true

echo "ASG scaled down."

echo "Cleanup completed."