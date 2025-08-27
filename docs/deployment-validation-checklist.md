# Deployment Validation Checklist

## Pre-deployment Validation

### 1. Resource Requirements ✅
- [ ] **Memory allocation >= 400MB** (minimum safe threshold)
  ```bash
  # Check current task definition memory allocation
  aws ecs describe-task-definition --task-definition alia-bot-task:latest \
    --query 'taskDefinition.containerDefinitions[0].memory'
  ```

- [ ] **CPU allocation appropriate** (0 = shared, or specific value)
- [ ] **Environment variables present**:
  - [ ] `NODE_ENV` (production/development)
  - [ ] `VERSION` (Git commit hash)

### 2. Secrets Validation ✅
- [ ] **Required secrets exist in Parameter Store**:
  ```bash
  # Validate all required secrets exist
  aws ssm get-parameters --names BOT_TOKEN DB_HOST DB_PASSWORD NODE_ENV OPENAI_API_KEY \
    --with-decryption --query 'Parameters[].Name' --output table
  ```

- [ ] **IAM permissions for secrets access**:
  ```bash
  # Check IAM policy includes all parameter paths
  aws iam get-policy-version --policy-arn arn:aws:iam::319709948884:policy/AliaBotSecretsAccess \
    --version-id v6 --query 'PolicyVersion.Document.Statement[0].Resource'
  ```

### 3. Code Changes Analysis ✅
- [ ] **Review commits since last deployment**:
  ```bash
  # Compare current deployment with new version
  CURRENT_IMAGE=$(aws ecs describe-services --cluster alia-bot-cluster --services alia-bot-service \
    --query 'services[0].taskDefinition' --output text | xargs aws ecs describe-task-definition \
    --task-definition | jq -r '.taskDefinition.containerDefinitions[0].image')
  
  # Extract commit hash and check what changed
  git log --oneline CURRENT_COMMIT..NEW_COMMIT
  ```

- [ ] **Check for new dependencies** (package.json changes)
- [ ] **Check for new environment variables required**
- [ ] **Estimate memory impact of new features**

### 4. Database Migrations ✅
- [ ] **Check for pending migrations**:
  ```bash
  npm run sequelize-cli -- db:migrate:status
  ```
- [ ] **Backup database before structural changes** (if needed)

## Deployment Process

### 1. Circuit Breaker Preparation ✅
- [ ] **Circuit breaker enabled with appropriate bake time**:
  ```bash
  # Verify current circuit breaker settings
  aws ecs describe-services --cluster alia-bot-cluster --services alia-bot-service \
    --query 'services[0].deploymentConfiguration.deploymentCircuitBreaker'
  ```

- [ ] **Consider disabling for known resource issues**:
  ```bash
  # Emergency disable if deploying memory/resource fixes
  aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
    --deployment-configuration "deploymentCircuitBreaker={enable=false,rollback=false}"
  ```

### 2. Deploy and Monitor ✅
- [ ] **Execute deployment**:
  ```bash
  aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
    --task-definition alia-bot-task:NEW_REVISION
  ```

- [ ] **Monitor deployment events**:
  ```bash
  # Watch deployment progress
  aws ecs describe-services --cluster alia-bot-cluster --services alia-bot-service \
    --query 'services[0].events[0:5]' --output table
  ```

- [ ] **Check container startup**:
  ```bash
  # Get EC2 instance and check container status
  aws ssm send-command --instance-ids i-0b96d573338b6d094 \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["sudo docker ps | grep alia-bot"]'
  ```

### 3. Health Validation ✅
- [ ] **Container running successfully**:
  ```bash
  # Check container memory usage and health
  aws ssm send-command --instance-ids i-0b96d573338b6d094 \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["sudo docker stats --no-stream $(sudo docker ps -q --filter name=alia-bot)"]'
  ```

- [ ] **Application logs healthy**:
  ```bash
  # Check application startup logs
  aws ssm send-command --instance-ids i-0b96d573338b6d094 \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["sudo docker logs --tail 50 $(sudo docker ps -q --filter name=alia-bot)"]'
  ```

- [ ] **Key indicators present in logs**:
  - [ ] `Logged in. Version X.X.X`
  - [ ] `TABLE SYNC COMPLETED`
  - [ ] `Server running at: http://...`
  - [ ] No `Killed` or OOM errors

## Post-deployment Validation

### 1. Functional Testing ✅
- [ ] **Discord bot responds to basic commands**:
  - [ ] `/fear` command works
  - [ ] `/meme list` command works
  - [ ] `/meme custom` command works

- [ ] **Database connectivity**:
  - [ ] Commands that query database work
  - [ ] New meme templates accessible (if applicable)

### 2. Performance Validation ✅
- [ ] **Memory usage within expected range**:
  ```bash
  # Expected: ~250-350MB usage, <70% of 512MB allocation
  # Monitor over first 10 minutes of deployment
  ```

- [ ] **Response times acceptable**:
  - [ ] Command responses < 3 seconds
  - [ ] No timeout errors

### 3. Circuit Breaker Re-enabling ✅
- [ ] **Re-enable circuit breaker after successful deployment**:
  ```bash
  # Only if it was disabled for the deployment
  aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
    --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},bakeTimeInMinutes=10"
  ```

## Rollback Procedures

### 1. Quick Rollback ✅
```bash
# Get last known good task definition
LAST_GOOD=$(aws ecs describe-services --cluster alia-bot-cluster --services alia-bot-service \
  --query 'services[0].deployments[?rolloutState==`COMPLETED`][0].taskDefinition' --output text)

# Rollback to last good version
aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
  --task-definition $LAST_GOOD
```

### 2. Manual Container Restart ✅
```bash
# If container is stuck, force restart via task stop
CURRENT_TASK=$(aws ecs list-tasks --cluster alia-bot-cluster --service-name alia-bot-service \
  --desired-status RUNNING --query 'taskArns[0]' --output text)

aws ecs stop-task --cluster alia-bot-cluster --task $CURRENT_TASK --reason "Manual restart"
```

## Monitoring and Alerting

### 1. Key Metrics to Watch ✅
- **Memory Usage**: Should remain <80% of allocated
- **Task Failure Count**: Should be 0 after successful deployment
- **Circuit Breaker Activations**: Should not trigger for legitimate deployments
- **Response Times**: Discord command responses

### 2. Success Criteria ✅
- ✅ No task failures for 30 minutes post-deployment
- ✅ Memory usage stable and within expected range
- ✅ All critical commands functional
- ✅ No error spikes in application logs
- ✅ Circuit breaker remains inactive

## Lessons Learned from Recent Incident

### What Caused the Failures ✅
1. **Task Definition 27+**: Added OpenAI integration requiring additional memory
2. **New Dependencies**: `openai` + `natural` packages increased memory footprint
3. **Missing Secret**: `OPENAI_API_KEY` not initially included in task definitions
4. **Insufficient Memory**: 128MB → 512MB required for expanded application

### Prevention Measures ✅
1. **Memory Analysis**: Always analyze memory impact of new dependencies
2. **Staging Environment**: Test resource requirements before production
3. **Dependency Audit**: Check package.json changes for memory-heavy additions
4. **Secret Management**: Validate all required secrets before deployment

### Circuit Breaker Improvements ✅
1. **Increased Bake Time**: 0 → 10 minutes for troubleshooting window
2. **Better Monitoring**: Container resource usage tracking
3. **Health Checks**: Plan for application-level health validation
4. **Documentation**: This checklist for systematic validation