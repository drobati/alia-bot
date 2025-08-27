# ECS Deployment Circuit Breaker Analysis and Recommendations

## Current State Analysis (Issue #152)

### Memory Usage Analysis
- **Current Allocation**: 512MB per container
- **Actual Usage**: 253.2MB (49.45% of allocated memory)
- **Previous Allocation**: 128MB (caused OOM kills)
- **Usage Pattern**: Stable at ~250MB during normal operation

### Current Circuit Breaker Configuration
```json
{
    "deploymentCircuitBreaker": {
        "enable": true,
        "rollback": true
    },
    "maximumPercent": 200,
    "minimumHealthyPercent": 0,
    "strategy": "ROLLING",
    "bakeTimeInMinutes": 0
}
```

### Incident Analysis

**What Changed in Task Definition 27 (Root Cause):**
- **Working Version** (TD 26): Git commit `84766e81` (December 2023)
- **First Failing Version** (TD 27): Git commit `cc44307` 

**Key Changes Introduced:**
1. **OpenAI Integration** (commit `669199f`):
   - Added `openai` package (4.20.1)
   - Added `natural` package (6.10.4) for Bayesian classification
   - New OpenAI client initialization: `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
   - Assistant response system with GPT-4 Turbo integration

2. **Security Updates** (commit `cc44307`):
   - Fixed 38 npm security vulnerabilities
   - Likely updated multiple dependencies to newer versions

**Memory Impact Analysis:**
- **Base Node.js app**: ~100-150MB
- **Discord.js v14 + Sequelize**: ~50-100MB  
- **OpenAI SDK + Natural.js**: ~50-100MB additional
- **Updated dependencies**: Additional memory overhead
- **Total requirement**: ~250-350MB (explains why 128MB was insufficient)

**Timeline of Memory-Related Failures:**
- Task definitions 27-33: All failed due to 128MB memory constraint
- Container pattern: Started successfully → Killed after ~30-60 seconds (during OpenAI client init)
- Exit code: 137 (SIGKILL from OOM killer)  
- Circuit breaker: Triggered after ~3-5 failed attempts
- Result: Rolled back to old version (task definition 26 from Dec 2023)

**Why the Application Failed:**
1. **Missing OPENAI_API_KEY**: Task definitions 27-32 didn't include this new required secret
2. **Insufficient Memory**: Even when API key was added, 128MB was too small for the expanded application
3. **OpenAI Client Initialization**: Heavy memory usage during startup when loading OpenAI SDK

## Root Cause
1. **Insufficient Memory**: 128MB was inadequate for Node.js app with Discord.js, Sequelize, OpenAI SDK
2. **Circuit Breaker Sensitivity**: No failure threshold configuration - uses AWS defaults
3. **No Health Checks**: Only process-level health checking, no application-level validation
4. **No Pre-deployment Validation**: No validation of resource requirements vs allocation

## Recommendations

### 1. Memory Allocation Strategy
```bash
# Current optimal allocation based on usage patterns
MEMORY_ALLOCATION=512  # 2x actual usage for safety buffer
ACTUAL_USAGE=253       # Observed stable usage
BUFFER_RATIO=2.0       # 100% safety buffer
```

**Recommendation**: Keep 512MB allocation with monitoring to adjust if usage patterns change.

### 2. Circuit Breaker Configuration Improvements

#### AWS Circuit Breaker Behavior (Non-Configurable)
- **Failure Threshold Formula**: `min(3, max(200, ceil(0.5 * desiredCount)))`
- **For Our Service** (desiredCount = 1): Threshold = 3 failed tasks
- **Stage 1**: Monitors tasks reaching RUNNING state
- **Stage 2**: Validates health checks (ELB, CloudMap, container health checks)

#### Current Issues with Default Configuration
- **No Application Health Checks**: Only process-level monitoring
- **No Bake Time**: Immediate rollback after threshold reached (bakeTimeInMinutes: 0)
- **Fast Failure Detection**: ~3-5 minutes to trigger rollback with OOM issues

#### Option A: Enhanced Configuration (Recommended)
```json
{
    "deploymentCircuitBreaker": {
        "enable": true,
        "rollback": true
    },
    "maximumPercent": 200,
    "minimumHealthyPercent": 0,
    "strategy": "ROLLING",
    "bakeTimeInMinutes": 10  // Allow 10 minutes for diagnosis
}
```

**Benefits of Increased Bake Time:**
- Allows time for memory pressure diagnosis
- Gives opportunity for manual intervention
- Prevents premature rollback during legitimate troubleshooting

#### Option B: Conditional Disabling for Known Issues (Emergency Use)
```bash
# Disable during known resource constraint fixes
aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
  --deployment-configuration "deploymentCircuitBreaker={enable=false,rollback=false}"

# Re-enable after fix is validated
aws ecs update-service --cluster alia-bot-cluster --service alia-bot-service \
  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true}"
```

#### Option C: Application-Level Health Checks (Long-term)
```bash
# Health check configuration for task definition
"healthCheck": {
    "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
    "interval": 30,
    "timeout": 5,
    "retries": 3,
    "startPeriod": 60
}
```

### 3. Health Check Implementation
```javascript
// Proposed health check endpoint in Express server
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.VERSION,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        checks: {
            database: 'connected',  // Check DB connection
            discord: 'connected',   // Check Discord client status
            openai: 'available'     // Check OpenAI API availability
        }
    };
    res.status(200).json(health);
});
```

### 4. Pre-deployment Validation Checklist

#### Automated Checks (To Implement)
- [ ] Memory allocation >= 400MB (minimum safe threshold)
- [ ] Required environment variables present
- [ ] Database connectivity test
- [ ] Discord bot token validation
- [ ] OpenAI API key validation

#### Manual Checks (Current Process)
- [ ] Git commit hash matches expected version
- [ ] All secrets available in Parameter Store
- [ ] IAM permissions updated if needed
- [ ] ECS task definition resource allocation reviewed

### 5. Monitoring and Alerting

#### Container Resource Monitoring
```bash
# CloudWatch custom metrics to implement
aws cloudwatch put-metric-data \
  --namespace "ECS/AliaBotService" \
  --metric-data MetricName=MemoryUtilization,Value=${MEMORY_PERCENT}

aws cloudwatch put-metric-data \
  --namespace "ECS/AliaBotService" \
  --metric-data MetricName=TaskFailureCount,Value=${FAILURE_COUNT}
```

#### Recommended Alerts
- Memory usage > 80% for 5 minutes
- Task failure count > 2 in 10 minutes
- Circuit breaker activation
- Deployment rollback events

### 6. Deployment Process Improvements

#### Staging Environment Validation
1. Deploy to staging first with same resource constraints
2. Run automated health checks
3. Validate command functionality
4. Check memory usage patterns
5. Promote to production only after validation

#### Rollback Strategy
```bash
# Quick rollback to last known good task definition
LAST_GOOD_TASK_DEF=$(aws ecs describe-services \
  --cluster alia-bot-cluster \
  --services alia-bot-service \
  --query 'services[0].deployments[?rolloutState==`COMPLETED`][0].taskDefinition' \
  --output text)

aws ecs update-service \
  --cluster alia-bot-cluster \
  --service alia-bot-service \
  --task-definition $LAST_GOOD_TASK_DEF
```

## Implementation Priority

### Phase 1: Immediate (High Priority)
1. ✅ **Memory allocation fixed** (512MB implemented)
2. ✅ **Circuit breaker re-enabled** with monitoring
3. [ ] Document deployment checklist
4. [ ] Implement basic health check endpoint

### Phase 2: Short-term (Medium Priority)
1. [ ] CloudWatch custom metrics for memory usage
2. [ ] Automated pre-deployment validation
3. [ ] Alert configuration for resource issues
4. [ ] Staging environment for validation

### Phase 3: Long-term (Lower Priority)
1. [ ] Infrastructure as Code for circuit breaker settings
2. [ ] Advanced health checks with external service validation
3. [ ] Automated rollback triggers
4. [ ] Performance optimization based on usage patterns

## Success Metrics
- Zero deployment failures due to resource constraints
- Circuit breaker activations only for legitimate application issues
- Mean time to recovery < 5 minutes
- Deployment success rate > 95%

## Cost Impact
- Current allocation (512MB): ~$15-30/month
- Monitoring overhead: ~$5-10/month
- Total impact: Minimal, well within acceptable limits