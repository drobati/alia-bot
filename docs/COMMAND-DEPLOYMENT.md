# Discord Command Deployment System

This document describes the comprehensive CI/CD system for automatically deploying Discord slash commands in the alia-bot project.

## Overview

The command deployment system provides:
- ✅ **Automatic Detection**: Detects new, modified, or deleted commands
- ✅ **Environment-Aware**: Staging and production deployment pipelines  
- ✅ **Safety First**: Validation, circuit breakers, and rollback capabilities
- ✅ **Monitoring**: Health checks and alert systems
- ✅ **GitHub Integration**: Automated workflows with PR comments and issue creation

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Developer     │    │   GitHub Actions │    │   Discord API   │
│   Push/PR       │───▶│   CI/CD Pipeline  │───▶│   Command       │
│                 │    │                  │    │   Registration  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   AWS Parameter  │
                       │   Store (Secrets)│
                       └──────────────────┘
```

## Workflow Stages

### 1. Command Detection
- Compares command file checksums to detect changes
- Validates command structure and Discord API requirements
- Generates deployment report with change summary
- Caches checksums for next comparison

### 2. Staging Deployment
- Deploys to staging Discord server/guild
- Runs validation tests
- Creates backup of current production commands
- Blocks production deployment if staging fails

### 3. Production Deployment
- Circuit breaker checks staging deployment success
- Deploys globally to all Discord servers
- Post-deployment verification
- Creates GitHub issues on failure

### 4. Monitoring & Alerts
- Continuous health checks of deployed commands
- Response time and error rate monitoring
- Slack/Sentry alert integration
- Trend analysis for performance degradation

## Usage

### Local Development

```bash
# Detect command changes
npm run commands:detect

# Deploy to staging
npm run commands:deploy:staging

# Deploy to production
npm run commands:deploy

# Check deployment health
npm run commands:health

# List available backups
npm run commands:backup:list

# Emergency rollback
npm run commands:rollback
```

### GitHub Actions

The system automatically triggers on successful CI runs:

```yaml
# Automatic deployment on master push
on:
  workflow_run:
    workflows: ["CI"]
    branches: [master]
    types: [completed]
```

Manual triggers for emergency operations:

```bash
# Emergency rollback
gh workflow run command-deployment.yml -f action=rollback

# Force staging deployment
gh workflow run command-deployment.yml -f action=staging

# Rollback to specific backup
gh workflow run command-deployment.yml -f action=rollback -f backup_file=commands-backup-2025-01-15T10-30-00-000Z.json
```

## File Structure

```
scripts/
├── deploy-commands.js              # Enhanced deployment script
└── discord-commands/
    ├── command-detector.js         # Change detection and validation
    ├── rollback-commands.js        # Rollback system
    └── deployment-monitor.js       # Health monitoring

.github/workflows/
└── command-deployment.yml          # CI/CD pipeline

Generated Files:
├── .command-checksums.json         # Command change tracking
├── command-deployment-report.json  # Latest deployment status
├── deployment.log                  # Deployment history
├── metrics.log                     # Health check metrics  
├── alerts.log                      # Alert history
└── command-backups/                # Command backup files
    ├── commands-backup-*.json
    └── commands-pre-rollback-*.json
```

## Environment Configuration

### AWS Parameter Store
Commands are deployed using credentials stored in AWS Parameter Store:

**Staging:**
- `/alia-bot/staging/BOT_TOKEN`
- `/alia-bot/staging/CLIENT_ID`
- `/alia-bot/staging/GUILD_ID` (optional)

**Production:**
- `/alia-bot/production/BOT_TOKEN`
- `/alia-bot/production/CLIENT_ID`

### GitHub Secrets
Required GitHub repository secrets:
- `ROLE_TO_ASSUME` - AWS IAM role for parameter access
- `ROLE_SESSION_NAME` - AWS session identifier
- `SLACK_WEBHOOK_URL` - Slack notifications (optional)

### Environment Variables
Local development `.env` file:
```bash
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
GUILD_ID=your_test_guild_id  # Optional for testing
NODE_ENV=development
SENTRY_DSN=your_sentry_dsn   # Optional monitoring
SLACK_WEBHOOK_URL=your_slack_webhook  # Optional alerts
```

## Safety Mechanisms

### 1. Validation Checks
- Command name format validation (lowercase, no spaces)
- Description length limits (100 characters)
- Option count limits (max 25)
- Required field presence

### 2. Circuit Breakers
- Staging deployment must succeed before production
- Maximum 1 hour age for staging deployment
- Backup creation before all deployments
- Retry logic with exponential backoff

### 3. Rollback System
- Automatic backup creation before deployments
- Interactive and automated rollback options
- Pre-rollback state backup for safety
- Rollback validation and verification

### 4. Monitoring & Alerting
- Health checks every 5 minutes (configurable)
- Response time thresholds (5 seconds default)
- Command count deviation detection (20% threshold)
- Trend analysis for performance degradation
- Multi-channel alerting (Slack, Sentry, GitHub Issues)

## Command Development Best Practices

### Command File Structure
```typescript
// src/commands/example.ts
import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../types';

export const exampleCommand = {
    data: new SlashCommandBuilder()
        .setName('example')
        .setDescription('Example command description'),
    
    // Optional deployment flags
    developmentOnly: false,  // Skip in production
    ownerOnly: false,        // Requires owner permissions
    
    async execute(interaction, context: Context) {
        // Command implementation
    }
};

export default exampleCommand;
```

### Validation Rules
1. **Name**: Lowercase, 1-32 characters, alphanumeric + hyphens/underscores
2. **Description**: 1-100 characters, descriptive and clear
3. **Options**: Maximum 25 options per command
4. **Structure**: Must export `data` and `execute` properties
5. **Testing**: Include `.test.ts` file for all commands

### Development Workflow
1. Create/modify command file in `src/commands/`
2. Write comprehensive tests
3. Run local validation: `npm run commands:detect`
4. Create PR - automatic command change detection comments
5. Merge to master - automatic staging → production deployment
6. Monitor deployment health: `npm run commands:health`

## Troubleshooting

### Common Issues

**Deployment Fails with "Invalid Command Structure"**
- Check command name format (lowercase, no spaces)
- Verify all required fields are present
- Run local validation: `npm run commands:detect`

**Circuit Breaker Blocks Production**
- Check staging deployment logs
- Ensure staging deployment was recent (< 1 hour)
- Manually trigger staging: `gh workflow run command-deployment.yml -f action=staging`

**Commands Not Appearing in Discord**
- Global commands take up to 1 hour to propagate
- Use guild-specific deployment for faster testing
- Verify bot has correct permissions in Discord server

**Health Checks Failing**
- Check Discord API status: https://discordstatus.com
- Verify bot token hasn't expired
- Review metrics log: `cat metrics.log | tail -10`

### Emergency Procedures

**Complete Command Failure**
```bash
# 1. Emergency rollback to last known good state
gh workflow run command-deployment.yml -f action=rollback

# 2. Check available backups
npm run commands:backup:list

# 3. Rollback to specific backup if needed
gh workflow run command-deployment.yml -f action=rollback -f backup_file=backup-filename.json
```

**Stuck Deployment Pipeline**
```bash
# 1. Cancel running workflow
gh run cancel [run-id]

# 2. Manual deployment bypass (emergency only)
NODE_ENV=production npm run commands:deploy

# 3. Force staging deployment to reset pipeline
gh workflow run command-deployment.yml -f action=staging
```

### Monitoring & Debugging

**View Deployment History**
```bash
# Recent deployments
cat deployment.log | tail -5 | jq .

# Deployment success rate
grep '"success":true' deployment.log | wc -l
```

**Health Check Status**
```bash
# Single health check
npm run commands:health

# Continuous monitoring (Ctrl+C to stop)
npm run commands:monitor:continuous

# View recent alerts
cat alerts.log | tail -5 | jq .
```

**Command Change Analysis**
```bash
# See what changed
npm run commands:detect

# View deployment report
cat command-deployment-report.json | jq .
```

## Performance Metrics

### Target SLAs
- **Deployment Time**: < 2 minutes from merge to production
- **Health Check Response**: < 5 seconds
- **Availability**: 99.9% uptime
- **Command Propagation**: < 1 hour globally

### Monitoring Dashboards
- Deployment success rate
- Command response times
- Error rate trends
- Backup/rollback frequency

## Support & Contact

For issues with the command deployment system:
1. Check this documentation
2. Review GitHub Actions logs
3. Check deployment health: `npm run commands:health`
4. Create GitHub issue with `deployment` label
5. Emergency contact: Slack #alia-bot-deployments channel

---

*Last updated: January 2025*
*System version: 1.0.0*