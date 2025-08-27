#!/bin/bash
# Resource monitoring script for Alia Bot ECS deployment

set -e

CLUSTER="alia-bot-cluster"
SERVICE="alia-bot-service"
INSTANCE_ID="i-0b96d573338b6d094"

echo "=== Alia Bot Resource Monitor ==="
echo "Timestamp: $(date)"
echo

# Check ECS service status
echo "🔄 ECS Service Status:"
aws ecs describe-services --cluster $CLUSTER --services $SERVICE \
  --query 'services[0].[serviceName,runningCount,desiredCount,taskDefinition]' \
  --output table
echo

# Check deployment status
echo "🚀 Deployment Status:"
aws ecs describe-services --cluster $CLUSTER --services $SERVICE \
  --query 'services[0].deployments[0].[rolloutState,rolloutStateReason,failedTasks]' \
  --output table
echo

# Check running tasks
echo "📋 Running Tasks:"
aws ecs list-tasks --cluster $CLUSTER --service-name $SERVICE \
  --desired-status RUNNING --query 'taskArns' --output table
echo

# Check memory usage via SSM
echo "💾 Container Resource Usage:"
MEMORY_STATS=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo docker stats --no-stream $(sudo docker ps -q --filter name=alia-bot) 2>/dev/null || echo \"No container running\""]' \
  --query 'Command.CommandId' --output text)

sleep 3

aws ssm get-command-invocation \
  --command-id $MEMORY_STATS \
  --instance-id $INSTANCE_ID \
  --query 'StandardOutputContent' --output text
echo

# Check container health
echo "🏥 Container Health:"
HEALTH_CHECK=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo docker ps --filter name=alia-bot --format \"table {{.Names}}\t{{.Status}}\t{{.RunningFor}}\""]' \
  --query 'Command.CommandId' --output text)

sleep 2

aws ssm get-command-invocation \
  --command-id $HEALTH_CHECK \
  --instance-id $INSTANCE_ID \
  --query 'StandardOutputContent' --output text
echo

# Check recent logs for errors
echo "📄 Recent Logs (Last 20 lines):"
LOG_CHECK=$(aws ssm send-command \
  --instance-ids $INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo docker logs --tail 20 $(sudo docker ps -q --filter name=alia-bot) 2>/dev/null || echo \"No logs available\""]' \
  --query 'Command.CommandId' --output text)

sleep 3

aws ssm get-command-invocation \
  --command-id $LOG_CHECK \
  --instance-id $INSTANCE_ID \
  --query 'StandardOutputContent' --output text
echo

# Circuit breaker status
echo "⚡ Circuit Breaker Configuration:"
aws ecs describe-services --cluster $CLUSTER --services $SERVICE \
  --query 'services[0].deploymentConfiguration.deploymentCircuitBreaker' \
  --output table

echo
echo "=== Monitor Complete ==="