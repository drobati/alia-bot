# Troubleshooting Guide

> Common issues and solutions for Alia-bot deployment and operation

## Table of Contents
- [Database Issues](#database-issues)
- [Discord API Issues](#discord-api-issues)
- [OpenAI Integration Issues](#openai-integration-issues)
- [Bot Permission Issues](#bot-permission-issues)
- [Docker & Deployment Issues](#docker--deployment-issues)
- [Performance Issues](#performance-issues)
- [Logging & Monitoring](#logging--monitoring)

---

## Database Issues

### MySQL Connection Failed

**Symptoms:**
- Error: `ECONNREFUSED` or `Access denied for user`
- Bot fails to start with database connection errors

**Solutions:**

1. **Check Database Service:**
```bash
# Verify MySQL is running
docker-compose ps mysqldb

# View database logs
docker-compose logs mysqldb

# Restart database service
docker-compose restart mysqldb
```

2. **Verify Connection Parameters:**
```bash
# Test connection manually
mysql -h localhost -P 3306 -u aliabot -p aliadb

# Check environment variables
echo $MYSQLDB_USER
echo $MYSQLDB_DATABASE
```

3. **Reset Database Password:**
```bash
# Reset root password
docker-compose exec mysqldb mysql -u root -p
> ALTER USER 'aliabot'@'%' IDENTIFIED BY 'new_password';
> FLUSH PRIVILEGES;
```

4. **Database Connection Timeout:**
```bash
# Increase connection timeout in config
# Add to database config:
{
  "dialect": "mysql",
  "pool": {
    "max": 10,
    "min": 0,
    "acquire": 60000,
    "idle": 10000
  }
}
```

### Migration Failures

**Symptoms:**
- `SequelizeDatabaseError` during migration
- Tables not created or columns missing

**Solutions:**

1. **Check Migration Status:**
```bash
# View migration history
npm run sequelize-cli -- db:migrate:status

# Undo last migration
npm run sequelize-cli -- db:migrate:undo

# Run specific migration
npm run sequelize-cli -- db:migrate --to migration-name
```

2. **Manual Table Creation:**
```sql
-- If migrations fail, create tables manually
CREATE DATABASE IF NOT EXISTS aliadb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aliadb;

-- Check table structure
DESCRIBE table_name;
```

3. **Fix Migration Files:**
```bash
# Create new migration to fix issues
npm run sequelize-cli -- migration:generate --name fix-table-structure
```

---

## Discord API Issues

### Rate Limiting

**Symptoms:**
- Error: `429 Too Many Requests`
- Commands stop responding temporarily
- "You are being rate limited" messages

**Solutions:**

1. **Check Rate Limit Status:**
```javascript
// Add to command handler
if (error.code === 50013) {
  console.log('Rate limited, retry after:', error.retry_after);
}
```

2. **Implement Backoff Strategy:**
```javascript
// In utils/rateLimiter.js
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleRateLimit(error) {
  if (error.code === 50013) {
    await sleep(error.retry_after * 1000);
    return true; // Retry
  }
  return false;
}
```

3. **Reduce API Calls:**
- Cache user data locally
- Batch operations where possible
- Use webhooks instead of frequent API calls

### Bot Token Issues

**Symptoms:**
- Error: `401 Unauthorized`
- Bot appears offline
- Commands not registering

**Solutions:**

1. **Verify Token:**
```bash
# Check if token is correctly set
echo $BOT_TOKEN | wc -c  # Should be ~60 characters

# Test token with Discord API
curl -H "Authorization: Bot $BOT_TOKEN" https://discord.com/api/v10/users/@me
```

2. **Regenerate Token:**
- Go to Discord Developer Portal
- Navigate to Bot section
- Click "Regenerate Token"
- Update environment variables

3. **Check Token Permissions:**
- Verify bot has required scopes: `bot`, `applications.commands`
- Ensure bot is in the target guild

### Command Registration Failures

**Symptoms:**
- Slash commands not appearing
- Error: `Missing Permissions` or `Invalid Form Body`

**Solutions:**

1. **Clear and Re-register Commands:**
```bash
# Clear all global commands
node scripts/clear-commands.js

# Re-register commands
node scripts/register-commands.js
```

2. **Check Command Structure:**
```javascript
// Validate command data structure
const { SlashCommandBuilder } = require('discord.js');

const command = new SlashCommandBuilder()
  .setName('test')
  .setDescription('Test command')
  .toJSON();

console.log(JSON.stringify(command, null, 2));
```

3. **Guild vs Global Commands:**
```javascript
// Register to specific guild for testing
await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands }
);
```

---

## OpenAI Integration Issues

### API Key Authentication

**Symptoms:**
- Error: `401 Unauthorized`
- OpenAI responses not working

**Solutions:**

1. **Verify API Key:**
```bash
# Test API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Check key format (should start with sk-)
echo $OPENAI_API_KEY | cut -c1-3
```

2. **Check Usage Limits:**
```bash
# Check account usage
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/usage
```

### Rate Limiting & Quota Issues

**Symptoms:**
- Error: `RateLimitError` or `InsufficientQuotaError`
- Assistant responses intermittent

**Solutions:**

1. **Implement Request Queue:**
```javascript
// Add to utils/openai.js
const pQueue = require('p-queue');
const queue = new pQueue({ concurrency: 1, interval: 1000, intervalCap: 1 });

async function callOpenAI(prompt) {
  return queue.add(() => openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  }));
}
```

2. **Add Retry Logic:**
```javascript
async function retryOpenAI(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callOpenAI(prompt);
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

### Context Length Issues

**Symptoms:**
- Error: `maximum context length exceeded`
- Responses cut off mid-sentence

**Solutions:**

1. **Implement Token Counting:**
```javascript
const { encode } = require('gpt-3-encoder');

function countTokens(text) {
  return encode(text).length;
}

function truncateContext(messages, maxTokens = 3000) {
  // Keep system message and truncate conversation history
  return messages.filter((msg, index) => 
    msg.role === 'system' || index >= messages.length - maxTokens/100
  );
}
```

---

## Bot Permission Issues

### Missing Server Permissions

**Symptoms:**
- Error: `Missing Permissions`
- Bot cannot send messages or use features

**Solutions:**

1. **Check Bot Permissions:**
```javascript
// In command handler
if (!interaction.guild.members.me.permissions.has('SEND_MESSAGES')) {
  return interaction.reply({ content: 'I need Send Messages permission!', ephemeral: true });
}
```

2. **Required Permissions List:**
```
- Send Messages
- Use Slash Commands  
- Read Message History
- Embed Links
- Attach Files
- Connect (for voice)
- Speak (for voice)
- Use Voice Activity
```

3. **Fix Permission Issues:**
- Go to Server Settings → Roles
- Edit bot role permissions
- Check channel-specific overrides

### Voice Channel Issues

**Symptoms:**
- Bot cannot join voice channels
- Audio not playing

**Solutions:**

1. **Check Voice Permissions:**
```javascript
const voiceChannel = interaction.member.voice.channel;
if (!voiceChannel.permissionsFor(interaction.guild.members.me).has(['CONNECT', 'SPEAK'])) {
  return interaction.reply('I need Connect and Speak permissions!');
}
```

2. **Install Voice Dependencies:**
```bash
npm install @discordjs/voice ffmpeg-static
```

---

## Docker & Deployment Issues

### Container Won't Start

**Symptoms:**
- Container exits immediately
- Build failures

**Solutions:**

1. **Check Build Process:**
```bash
# Build with verbose output
docker build --no-cache --progress=plain -t alia-bot .

# Run container interactively
docker run -it alia-bot /bin/bash
```

2. **Check Container Logs:**
```bash
docker-compose logs app
docker logs container_id
```

3. **Environment Variable Issues:**
```bash
# Verify env vars in container
docker-compose exec app env | grep BOT_TOKEN
```

### Memory/Resource Issues

**Symptoms:**
- Container killed (OOMKilled)
- Slow performance

**Solutions:**

1. **Increase Memory Limits:**
```yaml
# In docker-compose.yml
services:
  app:
    mem_limit: 1g
    memswap_limit: 1g
```

2. **Monitor Resource Usage:**
```bash
docker stats container_name
```

---

## Performance Issues

### High Memory Usage

**Symptoms:**
- Bot becomes unresponsive
- Memory usage increases over time

**Solutions:**

1. **Memory Profiling:**
```javascript
// Add to index.js
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
  });
}, 30000);
```

2. **Clear Cache Periodically:**
```javascript
// Clear classifier cache
setInterval(() => {
  classifier.clear?.();
}, 3600000); // Every hour
```

### Slow Response Times

**Symptoms:**
- Commands take >3 seconds to respond
- Users see "thinking..." for too long

**Solutions:**

1. **Add Performance Monitoring:**
```javascript
const startTime = Date.now();
// ... command logic ...
const duration = Date.now() - startTime;
if (duration > 2000) {
  console.warn(`Slow command: ${interaction.commandName} took ${duration}ms`);
}
```

2. **Optimize Database Queries:**
```javascript
// Add indexes
await queryInterface.addIndex('table_name', ['frequently_queried_column']);

// Use findOne instead of findAll when possible
const result = await Model.findOne({ where: { id } });
```

---

## Logging & Monitoring

### Enable Debug Logging

**Environment Variables:**
```bash
DEBUG=*
LOG_LEVEL=debug
NODE_ENV=development
```

**Application Logging:**
```javascript
// Increase log level in config
const logger = bunyan.createLogger({
  name: 'alia-bot',
  level: process.env.LOG_LEVEL || 'info'
});
```

### Sentry Error Monitoring

**Check Recent Errors:**
```bash
# View recent Sentry events
sentry-cli events --org derek-robati --project alia-bot list

# Get error details
sentry-cli events --org derek-robati --project alia-bot info EVENT_ID
```

### Health Check Endpoint

Add to your main application:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});
```

---

## Emergency Procedures

### Bot Completely Down

1. **Quick Recovery:**
```bash
# Restart entire stack
docker-compose down && docker-compose up -d

# Check status
docker-compose ps
```

2. **Rollback Deployment:**
```bash
# Rollback to previous version
git checkout HEAD~1
npm run build
docker-compose up -d --build
```

### Database Corruption

1. **Restore from Backup:**
```bash
# Stop application
docker-compose stop app

# Restore database
mysql -u root -p aliadb < backup.sql

# Restart application
docker-compose start app
```

### Discord API Issues

1. **Use Discord Status Page:**
   - Check https://discordstatus.com/
   - Monitor @discordstatus on Twitter

2. **Implement Graceful Degradation:**
```javascript
// Fallback when Discord is down
if (error.status >= 500) {
  return interaction.reply('Discord is experiencing issues. Please try again later.');
}
```

---

## Getting Help

### Useful Commands for Debugging

```bash
# System information
npm run build && node --version && docker --version

# Check all environment variables
printenv | grep -E "(BOT_TOKEN|MYSQL|OPENAI|NODE_ENV)"

# Database connection test
npm run sequelize-cli -- db:migrate:status

# Discord token validation
curl -H "Authorization: Bot $BOT_TOKEN" https://discord.com/api/v10/users/@me

# OpenAI API test
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

### Log Locations

- **Application Logs:** `docker-compose logs app`
- **Database Logs:** `docker-compose logs mysqldb`
- **System Logs:** `/var/log/` (Linux) or Console.app (macOS)
- **Sentry Dashboard:** https://sentry.io/organizations/derek-robati/projects/alia-bot/

### Support Resources

- **Discord.js Guide:** https://discordjs.guide/
- **OpenAI Documentation:** https://platform.openai.com/docs
- **Sequelize Documentation:** https://sequelize.org/docs/
- **Docker Documentation:** https://docs.docker.com/

---

**Remember:** When reporting issues, always include:
1. Error messages (full stack trace)
2. Environment details (Node.js version, OS, Docker version)
3. Steps to reproduce
4. Recent changes made to the codebase