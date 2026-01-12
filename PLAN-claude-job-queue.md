# Discord + Claude Agent SDK Job Queue System

## Overview

Build an integrated system that allows Discord users to submit development tasks to Claude, with jobs processed by a scalable AWS worker service. Each job creates a dedicated Discord thread (forum-style) for real-time updates, PR status tracking, and merge capabilities.

## Core User Flow

1. User types a prompt in a designated "claude-jobs" channel
2. Bot creates a new thread/channel for this job session
3. Job is queued to AWS SQS
4. ECS Fargate worker picks up the job and runs Claude Agent SDK
5. Real-time updates stream back to the Discord thread
6. PR links, CI status, and merge buttons appear in the thread
7. Worker scales to zero when no jobs are pending

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DISCORD BOT (alia-bot)                         │
│                                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────┐   │
│  │ /claude cmd │────▶│ Job Manager  │────▶│ Create Thread in Forum Chan │   │
│  └─────────────┘     │   Service    │     └─────────────────────────────┘   │
│                      └──────┬───────┘                                       │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS INFRASTRUCTURE                              │
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐   │
│  │   SQS Queue     │────▶│   ECS Fargate   │────▶│  Claude Agent SDK   │   │
│  │  (Job Queue)    │     │    Service      │     │      Worker         │   │
│  └─────────────────┘     │  (Scale 0→N)    │     └──────────┬──────────┘   │
│         ▲                └─────────────────┘                │              │
│         │                                                   │              │
│         │                ┌─────────────────┐                │              │
│         │                │   DynamoDB      │◀───────────────┘              │
│         │                │  (Job State)    │                               │
│         │                └────────┬────────┘                               │
│         │                         │                                        │
│         │                         ▼                                        │
│         │                ┌─────────────────┐                               │
│         │                │  EventBridge    │──▶ SNS ──▶ Discord Webhook   │
│         │                │  (Status Evts)  │                               │
│         │                └─────────────────┘                               │
│         │                                                                  │
│  ┌──────┴────────────────────────────────────────────────────────────────┐ │
│  │                     GitHub Integration                                 │ │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐  │ │
│  │  │  PR Create  │────▶│  Webhooks   │────▶│  Update Discord Thread  │  │ │
│  │  └─────────────┘     └─────────────┘     └─────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Discord Bot Integration

#### New Command: `/claude`

```typescript
/claude <prompt>           # Submit a new job
/claude status [job_id]    # Check job status
/claude cancel <job_id>    # Cancel a running job
/claude list               # List active jobs
```

#### Forum Channel System

- Designate a "claude-jobs" forum channel for job submissions
- Each job creates a new thread with:
  - Initial prompt as thread title/first message
  - Real-time Claude responses as messages
  - Embedded PR cards with CI status
  - Action buttons for merge/close/retry

#### Message Types in Thread

1. **Job Started** - Initial confirmation with job ID
2. **Claude Thinking** - Streaming responses from Claude
3. **Tool Execution** - File edits, bash commands, etc.
4. **PR Created** - Embed with PR link, branch, files changed
5. **CI Status** - Live updates on checks passing/failing
6. **Merge Button** - Interactive button to trigger merge
7. **Job Complete** - Final summary with cost breakdown

### 2. AWS Worker Service

#### Why ECS Fargate over Lambda?

| Factor | Lambda | ECS Fargate |
|--------|--------|-------------|
| Max Duration | 15 minutes | Unlimited |
| Cold Start | Fast | ~30-60 seconds |
| Scale to Zero | Native | Via auto-scaling |
| Cost at Zero | $0 | $0 |
| Memory | 10GB max | 120GB max |
| Complex Dependencies | Difficult | Native Docker |

**Decision: ECS Fargate** - Claude jobs can run 30+ minutes, need full Node.js environment, and benefit from Docker packaging.

#### Auto-Scaling Configuration

```yaml
# Scale based on SQS queue depth
Service:
  MinCapacity: 0
  MaxCapacity: 5

ScalingPolicy:
  MetricType: SQSApproximateNumberOfMessagesVisible
  TargetValue: 1  # 1 task per message
  ScaleInCooldown: 300  # 5 min before scaling down
  ScaleOutCooldown: 60   # 1 min before scaling up
```

**Scale-to-Zero Strategy:**
1. CloudWatch Alarm monitors SQS `ApproximateNumberOfMessagesVisible`
2. When messages > 0: Scale to at least 1 task
3. When messages = 0 for 5 minutes: Scale to 0 tasks
4. Use task scale-in protection while job is running

#### Worker Container

```dockerfile
FROM node:20-slim

# Install git, gh CLI for PR operations
RUN apt-get update && apt-get install -y git gh

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/

# Clone target repo on startup
CMD ["node", "dist/worker/index.js"]
```

### 3. Claude Agent SDK Integration

#### Worker Job Handler

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

interface ClaudeJob {
  jobId: string;
  prompt: string;
  threadId: string;
  channelId: string;
  guildId: string;
  userId: string;
  repository: string;
  branch: string;
}

async function processJob(job: ClaudeJob): Promise<void> {
  const workDir = `/tmp/repos/${job.jobId}`;

  // Clone repository
  await cloneRepo(job.repository, job.branch, workDir);

  // Stream Claude responses
  for await (const message of query({
    prompt: job.prompt,
    options: {
      model: "sonnet",
      workingDir: workDir,
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      permissionMode: "acceptEdits",
      maxTurns: 100
    }
  })) {
    // Send updates to Discord via webhook/API
    await sendDiscordUpdate(job.threadId, message);

    // Update DynamoDB state
    await updateJobState(job.jobId, message);
  }

  // Create PR if changes made
  const hasChanges = await checkForChanges(workDir);
  if (hasChanges) {
    const pr = await createPullRequest(job, workDir);
    await sendPREmbed(job.threadId, pr);
  }
}
```

#### Message Streaming to Discord

```typescript
async function sendDiscordUpdate(
  threadId: string,
  message: SDKMessage
): Promise<void> {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) {
        // Chunk long messages for Discord's 2000 char limit
        await sendChunkedMessage(threadId, block.text);
      }
      if ("name" in block) {
        // Tool use - send as embed
        await sendToolEmbed(threadId, block);
      }
    }
  }

  if (message.type === "result") {
    await sendResultEmbed(threadId, {
      status: message.subtype,
      cost: message.total_cost_usd
    });
  }
}
```

### 4. Database Models

#### Jobs Table (DynamoDB)

```typescript
interface ClaudeJobRecord {
  PK: string;              // JOB#<jobId>
  SK: string;              // METADATA
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";

  // Discord context
  guildId: string;
  channelId: string;
  threadId: string;
  userId: string;

  // Job details
  prompt: string;
  repository: string;
  branch: string;

  // Results
  prUrl?: string;
  prNumber?: number;
  sessionId?: string;      // Claude session for resume
  totalCostUsd?: number;

  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  // TTL for automatic cleanup
  ttl: number;             // Unix timestamp
}
```

#### Jobs Table (MySQL - for Discord bot)

```typescript
// Migration: create_claude_jobs_table
ClaudeJobs {
  id: INTEGER PRIMARY KEY AUTO_INCREMENT,
  job_id: STRING UNIQUE,
  guild_id: STRING NOT NULL,
  channel_id: STRING NOT NULL,
  thread_id: STRING NOT NULL,
  user_id: STRING NOT NULL,
  prompt: TEXT NOT NULL,
  repository: STRING NOT NULL,
  branch: STRING,
  status: ENUM('queued', 'processing', 'completed', 'failed', 'cancelled'),
  pr_url: STRING,
  pr_number: INTEGER,
  session_id: STRING,
  total_cost_usd: DECIMAL(10, 6),
  error_message: TEXT,
  created_at: DATETIME,
  started_at: DATETIME,
  completed_at: DATETIME,
  updated_at: DATETIME
}

// Index on guild_id + status for listing active jobs
// Index on user_id for user job history
```

### 5. GitHub Integration

#### PR Creation Flow

1. Worker completes code changes
2. Create new branch: `claude/<job-id>-<short-description>`
3. Commit changes with structured message
4. Push branch to origin
5. Create PR via GitHub CLI/API
6. Return PR URL to Discord thread

#### CI Status Updates

**Option A: GitHub Webhooks**
- Configure webhook to send check_run events
- Lambda receives webhook, updates Discord thread

**Option B: Polling**
- Worker polls PR status every 30 seconds
- Updates Discord when status changes

#### Merge Capability

```typescript
// Discord button interaction handler
async function handleMergeButton(interaction: ButtonInteraction) {
  const jobId = interaction.customId.split(":")[1];
  const job = await getJob(jobId);

  // Verify user has permission
  if (!canMergePR(interaction.user, job)) {
    return interaction.reply({ content: "No permission", ephemeral: true });
  }

  // Check CI status
  const prStatus = await getPRStatus(job.prUrl);
  if (!prStatus.allChecksPassed) {
    return interaction.reply({
      content: "CI checks not passed",
      ephemeral: true
    });
  }

  // Merge PR
  await mergePR(job.prNumber);
  await interaction.reply({ content: "PR merged!" });
}
```

### 6. Security Considerations

#### Bot Permissions

- Only designated roles can submit Claude jobs
- Repository whitelist per guild
- Cost limits per user/day

#### Worker Isolation

- Each job runs in isolated container
- Temporary workspace cleaned after job
- No persistent state between jobs
- Network isolation except GitHub/Discord

#### Secrets Management

```
AWS Systems Manager Parameter Store:
- /alia-bot/claude/ANTHROPIC_API_KEY
- /alia-bot/claude/GITHUB_TOKEN
- /alia-bot/claude/DISCORD_WEBHOOK_URL
```

## Implementation Tasks

### Phase 1: Foundation
1. [ ] Create ClaudeJobs database model and migration
2. [ ] Create ClaudeJobService for job management
3. [ ] Set up SQS queue for jobs
4. [ ] Create basic /claude command
5. [ ] Implement forum channel thread creation

### Phase 2: Worker Service
6. [ ] Create worker service project structure
7. [ ] Implement Claude Agent SDK integration
8. [ ] Add SQS message consumer
9. [ ] Implement Discord webhook updates
10. [ ] Create Dockerfile and ECS task definition

### Phase 3: AWS Infrastructure
11. [ ] Create CDK/Terraform for ECS Fargate service
12. [ ] Configure auto-scaling with SQS metrics
13. [ ] Set up CloudWatch alarms for scale-to-zero
14. [ ] Configure VPC and security groups
15. [ ] Set up Parameter Store secrets

### Phase 4: GitHub Integration
16. [ ] Implement PR creation in worker
17. [ ] Add GitHub webhook handler for CI status
18. [ ] Create merge button interaction
19. [ ] Add CI status embeds

### Phase 5: Polish
20. [ ] Add cost tracking and limits
21. [ ] Implement job cancellation
22. [ ] Add error handling and retry logic
23. [ ] Create admin dashboard/commands
24. [ ] Write tests and documentation

## Cost Estimation

### AWS Services (per month, assuming ~100 jobs)

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| ECS Fargate | 50 hours @ 0.5 vCPU, 1GB | ~$10 |
| SQS | 10,000 requests | ~$0.01 |
| DynamoDB | 1GB storage, 100k reads/writes | ~$1 |
| CloudWatch | Metrics + Alarms | ~$3 |
| **Total AWS** | | **~$15/month** |

### Claude API (per job, assuming avg 50k tokens)

| Model | Input | Output | Est. Cost/Job |
|-------|-------|--------|---------------|
| Sonnet | 40k @ $3/M | 10k @ $15/M | ~$0.27 |
| Opus | 40k @ $15/M | 10k @ $75/M | ~$1.35 |

## Open Questions

1. **Repository Access**: How to handle credentials for private repos?
   - Option A: Per-guild GitHub App installation
   - Option B: User provides PAT stored encrypted

2. **Concurrency**: Allow multiple jobs per user?
   - Consider: 1 active job per user, queue additional

3. **Context Persistence**: Resume jobs after timeout?
   - Claude sessions can be resumed via sessionId

4. **Cost Controls**: How to prevent runaway costs?
   - Per-job budget limit
   - Per-user daily limit
   - Model tier restrictions by role

## References

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [AWS Fargate SQS Scaling Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/run-message-driven-workloads-at-scale-by-using-aws-fargate.html)
- [Discord.js Forum Channels](https://discordjs.guide/popular-topics/threads.html)
- [ECS Task Scale-In Protection](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-scale-in-protection.html)
