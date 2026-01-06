# Alia Bot Infrastructure

AWS CDK infrastructure as code for the Alia Bot Discord bot.

## Overview

This CDK project defines all AWS infrastructure required to run Alia Bot:

- **ECS Cluster** - Container orchestration with EC2 capacity
- **ECS Service** - Manages the bot container with circuit breaker deployment
- **ECR Repository** - Container registry (referenced, not created)
- **IAM Roles & Policies** - Task execution permissions and secrets access
- **CloudWatch Logs** - Centralized logging with 30-day retention
- **VPC** - Networking (optional - can use existing VPC)

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Installation

```bash
cd infrastructure
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm test` | Run unit tests |
| `npm run synth:prod` | Synthesize CloudFormation for production |
| `npm run synth:staging` | Synthesize CloudFormation for staging |
| `npm run diff:prod` | Compare production stack with deployed |
| `npm run deploy:prod` | Deploy production stack |
| `npm run deploy:staging` | Deploy staging stack |

## Environment Configuration

The stack supports multiple environments via context:

```bash
# Deploy to production
npx cdk deploy -c environment=prod

# Deploy to staging
npx cdk deploy -c environment=staging
```

## Stack Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `environment` | `prod` | Environment name (prod, staging) |
| `containerMemory` | `512` | Container memory in MB |
| `desiredCount` | `1` | Number of ECS tasks |
| `vpcId` | (none) | Optional VPC ID to use |

## SSM Parameters Required

The following SSM parameters must exist before deployment:

- `/BOT_TOKEN` - Discord bot token
- `/DB_HOST` - Database host
- `/DB_PASSWORD` - Database password
- `/NODE_ENV` - Node environment
- `/OPENAI_API_KEY` - OpenAI API key
- `/alia-bot/SENTRY_DSN` - Sentry DSN
- `/alia-bot/{environment}/POLYGON_API_KEY` - Polygon API key

## First-Time Setup

1. Bootstrap CDK (one-time per account/region):
   ```bash
   npx cdk bootstrap aws://319709948884/us-east-1
   ```

2. Deploy the stack:
   ```bash
   npm run deploy:prod
   ```

## Migration from Existing Infrastructure

This CDK stack is designed to replace manually-created AWS resources. To migrate:

1. Run `cdk diff` to see what would change
2. Import existing resources if needed using `cdk import`
3. Or deploy fresh and update CI/CD to use new resource names

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        VPC                               │
│  ┌─────────────────┐        ┌─────────────────┐        │
│  │  Public Subnet  │        │  Private Subnet │        │
│  │  (NAT Gateway)  │        │  (ECS Tasks)    │        │
│  └─────────────────┘        └─────────────────┘        │
│                                      │                  │
│                              ┌───────┴───────┐         │
│                              │  ECS Cluster  │         │
│                              │  ┌─────────┐  │         │
│                              │  │ Service │  │         │
│                              │  │ (1 task)│  │         │
│                              │  └─────────┘  │         │
│                              └───────────────┘         │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  ┌─────────────┐              ┌─────────────────┐
  │     ECR     │              │ SSM Parameters  │
  │ (alia-bot)  │              │   (Secrets)     │
  └─────────────┘              └─────────────────┘
```

## Outputs

After deployment, the stack exports:

- `ClusterName` - ECS cluster name
- `ServiceName` - ECS service name
- `TaskDefinitionArn` - Task definition ARN
- `ExecutionRoleArn` - IAM execution role ARN
- `RepositoryUri` - ECR repository URI
- `LogGroupName` - CloudWatch log group name
