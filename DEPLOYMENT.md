# Deployment Guide

> Comprehensive deployment guide for Alia-bot in production environments

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [AWS Deployment](#aws-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Production Checklist](#production-checklist)

## Prerequisites

### Required Tools
- Node.js 20+
- Docker & Docker Compose
- AWS CLI v2
- MySQL 8.0+
- Git

### Required Accounts & Access
- Discord Developer Account with bot token
- OpenAI API account with API key
- AWS Account (Account ID: 319709948884)
- GitHub repository access
- Sentry account for error monitoring

## Environment Configuration

### Environment Variables (.env)

Create a `.env` file in the project root:

```bash
# Discord Configuration
BOT_TOKEN=your_discord_bot_token_here
GUILD_ID=your_discord_guild_id

# Database Configuration
MYSQLDB_DATABASE=aliadb
MYSQLDB_USER=aliabot
MYSQLDB_PASSWORD=your_secure_password
MYSQLDB_ROOT_PASSWORD=your_root_password
MYSQLDB_LOCAL_PORT=3306
MYSQLDB_DOCKER_PORT=3306

# Node.js Configuration
NODE_ENV=production
NODE_LOCAL_PORT=8080
NODE_DOCKER_PORT=8080

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Monitoring Configuration
SENTRY_DSN=your_sentry_dsn_url

# AWS Configuration (for production)
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=319709948884
```

### AWS Systems Manager Parameters

Store sensitive values in AWS Parameter Store:

```bash
# Store bot token securely
aws ssm put-parameter --name "/alia-bot/prod/BOT_TOKEN" --value "your_bot_token" --type "SecureString"

# Store database password
aws ssm put-parameter --name "/alia-bot/prod/DB_PASSWORD" --value "your_db_password" --type "SecureString"

# Store OpenAI API key
aws ssm put-parameter --name "/alia-bot/prod/OPENAI_API_KEY" --value "your_openai_key" --type "SecureString"

# Store Sentry DSN
aws ssm put-parameter --name "/alia-bot/prod/SENTRY_DSN" --value "your_sentry_dsn" --type "SecureString"
```

Retrieve parameters:
```bash
aws ssm get-parameter --name "/alia-bot/prod/BOT_TOKEN" --with-decryption
```

## Docker Deployment

### Local Development

1. **Start Services:**
```bash
# Start MySQL database only
docker-compose up -d mysqldb

# Start full application stack
docker-compose up -d
```

2. **Database Setup:**
```bash
# Run migrations
npm run sequelize-cli -- db:migrate

# Seed database (if applicable)
npm run sequelize-cli -- db:seed:all
```

3. **View Logs:**
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f mysqldb
```

### Production Docker Deployment

1. **Build Production Image:**
```bash
# Build optimized image
docker build -t alia-bot:latest .

# Tag for registry
docker tag alia-bot:latest 319709948884.dkr.ecr.us-east-1.amazonaws.com/alia-bot:latest
```

2. **Production Docker Compose:**

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  app:
    image: alia-bot:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
      - BOT_TOKEN=${BOT_TOKEN}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SENTRY_DSN=${SENTRY_DSN}
    ports:
      - "8080:8080"
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=${MYSQL_DATABASE}
      - MYSQL_USER=${MYSQL_USER}
      - MYSQL_PASSWORD=${MYSQL_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
      - ./backups:/backups
    ports:
      - "3306:3306"

volumes:
  db_data:
```

## AWS Deployment

### AWS Infrastructure Setup

#### 1. ECR Repository
```bash
# Create ECR repository
aws ecr create-repository --repository-name alia-bot --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 319709948884.dkr.ecr.us-east-1.amazonaws.com

# Push image
docker push 319709948884.dkr.ecr.us-east-1.amazonaws.com/alia-bot:latest
```

#### 2. RDS Database Setup
```bash
# Create RDS MySQL instance
aws rds create-db-instance \
  --db-instance-identifier alia-bot-prod \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0 \
  --master-username admin \
  --master-user-password your_secure_password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted
```

#### 3. ECS/Fargate Deployment
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name alia-bot-cluster

# Create task definition (see task-definition.json)
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster alia-bot-cluster \
  --service-name alia-bot-service \
  --task-definition alia-bot:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxxx],securityGroups=[sg-xxxxxxxxx],assignPublicIp=ENABLED}"
```

#### 4. CloudWatch Logging
```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/alia-bot

# Set retention policy
aws logs put-retention-policy --log-group-name /ecs/alia-bot --retention-in-days 30
```

### ECS Task Definition

Create `task-definition.json`:
```json
{
  "family": "alia-bot",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::319709948884:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::319709948884:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "alia-bot",
      "image": "319709948884.dkr.ecr.us-east-1.amazonaws.com/alia-bot:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "BOT_TOKEN",
          "valueFrom": "arn:aws:ssm:us-east-1:319709948884:parameter/alia-bot/prod/BOT_TOKEN"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:ssm:us-east-1:319709948884:parameter/alia-bot/prod/DB_PASSWORD"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:ssm:us-east-1:319709948884:parameter/alia-bot/prod/OPENAI_API_KEY"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/alia-bot",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Alia Bot

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: alia-bot
  ECS_SERVICE: alia-bot-service
  ECS_CLUSTER: alia-bot-cluster
  ECS_TASK_DEFINITION: task-definition.json

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Fill in the new image ID in the Amazon ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION }}
          container-name: alia-bot
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy Amazon ECS task definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

### Required GitHub Secrets

Add these secrets to your GitHub repository:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DISCORD_BOT_TOKEN`
- `OPENAI_API_KEY`
- `SENTRY_DSN`

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] AWS resources provisioned
- [ ] Database migrations tested
- [ ] Health check endpoint implemented
- [ ] Monitoring and logging configured
- [ ] Security groups configured
- [ ] SSL certificates configured (if using HTTPS)

### Deployment
- [ ] Code builds successfully
- [ ] All tests passing
- [ ] Lint checks pass
- [ ] Docker image builds and runs
- [ ] Database migrations run successfully
- [ ] Bot connects to Discord
- [ ] OpenAI integration working
- [ ] Sentry error reporting active

### Post-Deployment
- [ ] Application health check passing
- [ ] Bot responds to commands
- [ ] Logs are being generated
- [ ] Metrics are being collected
- [ ] Alerts configured for errors
- [ ] Database backups scheduled
- [ ] Performance monitoring active

### Monitoring Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster alia-bot-cluster --services alia-bot-service

# View application logs
aws logs filter-log-events --log-group-name /ecs/alia-bot

# Check task health
aws ecs describe-tasks --cluster alia-bot-cluster --tasks $(aws ecs list-tasks --cluster alia-bot-cluster --service-name alia-bot-service --query 'taskArns[0]' --output text)

# Monitor Sentry events
sentry-cli events --org derek-robati --project alia-bot list

# Check parameter store values
aws ssm get-parameters-by-path --path "/alia-bot/prod" --recursive --with-decryption
```

## Rollback Procedures

### Quick Rollback
```bash
# Rollback to previous task definition
aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service --task-definition alia-bot:PREVIOUS_REVISION

# Check rollback status
aws ecs wait services-stable --cluster alia-bot-cluster --services alia-bot-service
```

### Database Rollback
```bash
# Restore from RDS snapshot
aws rds restore-db-instance-from-db-snapshot --db-instance-identifier alia-bot-rollback --db-snapshot-identifier alia-bot-snapshot-YYYYMMDD
```

---

**Note**: Replace placeholder values (like security group IDs, subnet IDs, etc.) with your actual AWS resource IDs before deployment.