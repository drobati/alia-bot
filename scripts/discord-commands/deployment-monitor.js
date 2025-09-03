#!/usr/bin/env node

/**
 * Discord Command Deployment Monitoring System
 * Monitors command deployment health and performance
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';
const GUILD_ID = process.env.GUILD_ID;

/**
 * Health check configuration
 */
const HEALTH_CHECKS = {
    COMMAND_COUNT_DEVIATION: 0.2, // 20% deviation triggers warning
    RESPONSE_TIME_THRESHOLD: 5000, // 5 seconds
    RETRY_COUNT: 3,
    CHECK_INTERVAL: 300000, // 5 minutes
};

/**
 * Discord API health checker
 */
class DiscordCommandMonitor {
    constructor() {
        this.rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        this.route = GUILD_ID ? 
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) :
            Routes.applicationCommands(CLIENT_ID);
        this.metrics = [];
        this.alerts = [];
    }

    /**
     * Check current command deployment status
     */
    async checkCommandHealth() {
        const healthCheck = {
            timestamp: new Date().toISOString(),
            success: false,
            responseTime: null,
            commandCount: 0,
            errors: [],
            warnings: []
        };

        try {
            const startTime = Date.now();
            
            // Fetch current commands with retry logic
            let commands;
            let lastError;
            
            for (let attempt = 1; attempt <= HEALTH_CHECKS.RETRY_COUNT; attempt++) {
                try {
                    commands = await this.rest.get(this.route);
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt < HEALTH_CHECKS.RETRY_COUNT) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
            }

            if (!commands) {
                throw lastError || new Error('Failed to fetch commands after retries');
            }

            const endTime = Date.now();
            healthCheck.responseTime = endTime - startTime;
            healthCheck.commandCount = commands.length;

            // Response time check
            if (healthCheck.responseTime > HEALTH_CHECKS.RESPONSE_TIME_THRESHOLD) {
                healthCheck.warnings.push(`High response time: ${healthCheck.responseTime}ms`);
            }

            // Command count validation
            const expectedCount = this.getExpectedCommandCount();
            if (expectedCount > 0) {
                const deviation = Math.abs(commands.length - expectedCount) / expectedCount;
                if (deviation > HEALTH_CHECKS.COMMAND_COUNT_DEVIATION) {
                    healthCheck.errors.push(`Command count deviation: expected ${expectedCount}, found ${commands.length}`);
                }
            }

            // Command structure validation
            for (const command of commands) {
                if (!command.name || !command.description) {
                    healthCheck.errors.push(`Invalid command structure: ${JSON.stringify(command)}`);
                }
            }

            healthCheck.success = healthCheck.errors.length === 0;

        } catch (error) {
            healthCheck.errors.push(`Health check failed: ${error.message}`);
        }

        return healthCheck;
    }

    /**
     * Get expected command count from latest deployment
     */
    getExpectedCommandCount() {
        try {
            const reportPath = path.join(__dirname, '../../command-deployment-report.json');
            if (fs.existsSync(reportPath)) {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                return report.totalCommands || 0;
            }
        } catch (error) {
            console.warn(`Could not read deployment report: ${error.message}`);
        }
        return 0;
    }

    /**
     * Generate alerts based on health check results
     */
    generateAlerts(healthCheck) {
        const alerts = [];

        if (!healthCheck.success) {
            alerts.push({
                level: 'critical',
                message: 'Command deployment health check failed',
                details: healthCheck.errors,
                timestamp: healthCheck.timestamp
            });
        }

        if (healthCheck.warnings.length > 0) {
            alerts.push({
                level: 'warning',
                message: 'Command deployment performance issues detected',
                details: healthCheck.warnings,
                timestamp: healthCheck.timestamp
            });
        }

        return alerts;
    }

    /**
     * Send alerts to monitoring systems
     */
    async sendAlerts(alerts) {
        for (const alert of alerts) {
            // Log to console
            const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
            console.log(`${emoji} ${alert.level.toUpperCase()}: ${alert.message}`);
            alert.details.forEach(detail => console.log(`  - ${detail}`));

            // Send to Sentry if configured
            if (process.env.SENTRY_DSN) {
                try {
                    const Sentry = require('@sentry/node');
                    Sentry.captureMessage(alert.message, alert.level);
                } catch (error) {
                    console.warn('Failed to send alert to Sentry:', error.message);
                }
            }

            // Send to Slack webhook if configured
            if (process.env.SLACK_WEBHOOK_URL) {
                try {
                    const axios = require('axios');
                    await axios.post(process.env.SLACK_WEBHOOK_URL, {
                        text: `${emoji} Discord Commands Alert`,
                        attachments: [{
                            color: alert.level === 'critical' ? 'danger' : 'warning',
                            fields: [
                                {
                                    title: 'Message',
                                    value: alert.message,
                                    short: false
                                },
                                {
                                    title: 'Details',
                                    value: alert.details.join('\n'),
                                    short: false
                                },
                                {
                                    title: 'Timestamp',
                                    value: alert.timestamp,
                                    short: true
                                },
                                {
                                    title: 'Environment',
                                    value: process.env.NODE_ENV || 'unknown',
                                    short: true
                                }
                            ]
                        }]
                    });
                } catch (error) {
                    console.warn('Failed to send alert to Slack:', error.message);
                }
            }

            // Write to alerts log
            const alertsLogPath = path.join(__dirname, '../../alerts.log');
            fs.appendFileSync(alertsLogPath, JSON.stringify(alert) + '\n');
        }
    }

    /**
     * Store health check metrics
     */
    storeMetrics(healthCheck) {
        this.metrics.push(healthCheck);
        
        // Keep only last 100 health checks in memory
        if (this.metrics.length > 100) {
            this.metrics.shift();
        }

        // Write to metrics log
        const metricsLogPath = path.join(__dirname, '../../metrics.log');
        fs.appendFileSync(metricsLogPath, JSON.stringify(healthCheck) + '\n');
    }

    /**
     * Generate health summary report
     */
    generateHealthSummary() {
        const recent = this.metrics.slice(-10); // Last 10 checks
        const successful = recent.filter(m => m.success).length;
        const avgResponseTime = recent.reduce((sum, m) => sum + (m.responseTime || 0), 0) / recent.length;

        return {
            timestamp: new Date().toISOString(),
            recentChecks: recent.length,
            successRate: recent.length > 0 ? successful / recent.length : 0,
            averageResponseTime: Math.round(avgResponseTime),
            lastCheck: recent[recent.length - 1],
            trends: {
                responseTimeIncreasing: this.isResponseTimeIncreasing(),
                errorRateIncreasing: this.isErrorRateIncreasing()
            }
        };
    }

    /**
     * Detect if response time is trending upward
     */
    isResponseTimeIncreasing() {
        if (this.metrics.length < 5) return false;
        
        const recent = this.metrics.slice(-5);
        const responseTimes = recent.map(m => m.responseTime || 0);
        
        // Simple trend detection: compare first half to second half
        const firstHalf = responseTimes.slice(0, Math.floor(responseTimes.length / 2));
        const secondHalf = responseTimes.slice(Math.floor(responseTimes.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        return secondAvg > firstAvg * 1.2; // 20% increase threshold
    }

    /**
     * Detect if error rate is trending upward
     */
    isErrorRateIncreasing() {
        if (this.metrics.length < 5) return false;
        
        const recent = this.metrics.slice(-5);
        const errors = recent.map(m => m.success ? 0 : 1);
        
        const firstHalf = errors.slice(0, Math.floor(errors.length / 2));
        const secondHalf = errors.slice(Math.floor(errors.length / 2));
        
        const firstErrorRate = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondErrorRate = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        return secondErrorRate > firstErrorRate;
    }

    /**
     * Run continuous monitoring
     */
    async startMonitoring() {
        console.log('🔍 Starting Discord command deployment monitoring...');
        console.log(`Check interval: ${HEALTH_CHECKS.CHECK_INTERVAL / 1000}s`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

        const runCheck = async () => {
            try {
                console.log(`\n[${new Date().toISOString()}] Running health check...`);
                
                const healthCheck = await this.checkCommandHealth();
                this.storeMetrics(healthCheck);
                
                const alerts = this.generateAlerts(healthCheck);
                if (alerts.length > 0) {
                    await this.sendAlerts(alerts);
                }

                // Log status
                const status = healthCheck.success ? '✅' : '❌';
                console.log(`${status} Health check completed: ${healthCheck.commandCount} commands, ${healthCheck.responseTime}ms`);
                
                if (healthCheck.warnings.length > 0) {
                    console.log('⚠️ Warnings:', healthCheck.warnings.join(', '));
                }
                if (healthCheck.errors.length > 0) {
                    console.log('❌ Errors:', healthCheck.errors.join(', '));
                }

            } catch (error) {
                console.error('❌ Monitor check failed:', error);
            }
        };

        // Run initial check
        await runCheck();

        // Schedule recurring checks
        setInterval(runCheck, HEALTH_CHECKS.CHECK_INTERVAL);
    }

    /**
     * Run single health check and exit
     */
    async runSingleCheck() {
        console.log('🔍 Running single Discord command health check...');
        
        const healthCheck = await this.checkCommandHealth();
        const summary = this.generateHealthSummary();
        
        console.log('\n📊 Health Check Results:');
        console.log(`Status: ${healthCheck.success ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Commands: ${healthCheck.commandCount}`);
        console.log(`Response Time: ${healthCheck.responseTime}ms`);
        
        if (healthCheck.warnings.length > 0) {
            console.log('⚠️ Warnings:');
            healthCheck.warnings.forEach(w => console.log(`  - ${w}`));
        }
        
        if (healthCheck.errors.length > 0) {
            console.log('❌ Errors:');
            healthCheck.errors.forEach(e => console.log(`  - ${e}`));
        }

        // Set exit code based on health
        process.exit(healthCheck.success ? 0 : 1);
    }
}

/**
 * Main execution
 */
async function main() {
    if (!BOT_TOKEN || !CLIENT_ID) {
        console.error('❌ Missing required environment variables: BOT_TOKEN, CLIENT_ID');
        process.exit(1);
    }

    const monitor = new DiscordCommandMonitor();
    const args = process.argv.slice(2);

    if (args.includes('--continuous') || args.includes('-c')) {
        await monitor.startMonitoring();
    } else if (args.includes('--summary') || args.includes('-s')) {
        // Load existing metrics and show summary
        const summary = monitor.generateHealthSummary();
        console.log('📈 Health Summary:', JSON.stringify(summary, null, 2));
    } else {
        await monitor.runSingleCheck();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Monitoring failed:', error);
        process.exit(1);
    });
}

module.exports = { DiscordCommandMonitor };