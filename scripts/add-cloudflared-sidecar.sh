#!/bin/bash
# One-time script to add cloudflared tunnel sidecar to the ECS task definition.
# This registers a new task definition revision and updates the service.
#
# Prerequisites:
#   1. Create tunnel in Cloudflare Zero Trust dashboard (name: alia-bot)
#   2. Store tunnel token in SSM:
#      aws ssm put-parameter --name "/alia-bot/prod/CLOUDFLARE_TUNNEL_TOKEN" \
#        --value "<token>" --type "SecureString"
#   3. Grant ecsTaskExecutionRole access to the new SSM parameter

set -euo pipefail

CLUSTER="alia-bot-cluster"
SERVICE="alia-bot-service"
TASK_FAMILY="alia-bot-task"

echo "=== Adding cloudflared sidecar to ECS task definition ==="

# Fetch the task definition currently used by the service
echo "Fetching current task definition from service..."
SERVICE_TASK_DEF=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --query 'services[0].taskDefinition' \
  --output text)
echo "Service is using: $SERVICE_TASK_DEF"

aws ecs describe-task-definition --task-definition "$SERVICE_TASK_DEF" \
  --query taskDefinition > /tmp/alia-bot-task-def.json

# Check if cloudflared container already exists
EXISTING=$(jq '[.containerDefinitions[] | select(.name == "cloudflared")] | length' /tmp/alia-bot-task-def.json)
if [ "$EXISTING" -gt 0 ]; then
  echo "cloudflared container already exists in task definition. Nothing to do."
  exit 0
fi

# Add cloudflared sidecar and bump memory
echo "Adding cloudflared sidecar container..."
jq '
  # Add cloudflared container
  .containerDefinitions += [{
    "name": "cloudflared",
    "image": "cloudflare/cloudflared:latest",
    "essential": false,
    "command": ["tunnel", "--no-autoupdate", "run"],
    "secrets": [{
      "name": "TUNNEL_TOKEN",
      "valueFrom": "/alia-bot/prod/CLOUDFLARE_TUNNEL_TOKEN"
    }],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": .containerDefinitions[0].logConfiguration.options["awslogs-group"],
        "awslogs-region": .containerDefinitions[0].logConfiguration.options["awslogs-region"],
        "awslogs-stream-prefix": "cloudflared"
      }
    }
  }] |
  # Bump task memory to accommodate sidecar
  .memory = "1024" |
  # Clean fields that cannot be passed to register-task-definition
  del(.taskDefinitionArn, .revision, .status, .requiresAttributes,
      .compatibilities, .registeredAt, .registeredBy)
' /tmp/alia-bot-task-def.json > /tmp/alia-bot-task-def-updated.json

# Register the new task definition revision
echo "Registering new task definition revision..."
NEW_ARN=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/alia-bot-task-def-updated.json \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo "New task definition: $NEW_ARN"

# Update the service to use the new task definition
echo "Updating service..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_ARN" \
  --force-new-deployment \
  --query 'service.taskDefinition' \
  --output text

echo "=== Done. Service is deploying with cloudflared sidecar ==="
echo "Monitor with: aws ecs describe-services --cluster $CLUSTER --services $SERVICE --query 'services[0].deployments'"
