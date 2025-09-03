#!/usr/bin/env node

/**
 * Discord Command Rollback System
 * Rolls back to a previous command deployment state
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';
const GUILD_ID = process.env.GUILD_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
    console.error('❌ BOT_TOKEN and CLIENT_ID are required');
    process.exit(1);
}

const backupDir = path.join(__dirname, '../../command-backups');

/**
 * List available backups
 */
function listAvailableBackups() {
    if (!fs.existsSync(backupDir)) {
        console.log('❌ No backup directory found');
        return [];
    }

    const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('commands-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

    return backupFiles.map(file => {
        const timestamp = file.replace('commands-backup-', '').replace('.json', '');
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        let commandCount = 0;
        try {
            const backup = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            commandCount = Array.isArray(backup) ? backup.length : 0;
        } catch (error) {
            console.warn(`⚠️ Could not read backup file ${file}: ${error.message}`);
        }

        return {
            file,
            timestamp,
            size: stats.size,
            commandCount,
            created: stats.birthtime
        };
    });
}

/**
 * Load backup file
 */
function loadBackup(backupFile) {
    const backupPath = path.join(backupDir, backupFile);
    
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupFile}`);
    }

    try {
        const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        if (!Array.isArray(backup)) {
            throw new Error('Invalid backup format: expected array of commands');
        }

        return backup;
    } catch (error) {
        throw new Error(`Failed to load backup: ${error.message}`);
    }
}

/**
 * Validate backup commands
 */
function validateBackupCommands(commands) {
    const errors = [];

    if (commands.length === 0) {
        errors.push('Backup contains no commands');
    }

    for (const command of commands) {
        if (!command.name || !command.description) {
            errors.push(`Invalid command in backup: ${JSON.stringify(command)}`);
        }
    }

    return errors;
}

/**
 * Execute rollback
 */
async function executeRollback(backupFile) {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    
    console.log(`🔄 Loading backup: ${backupFile}`);
    const backupCommands = loadBackup(backupFile);
    
    console.log(`📦 Loaded ${backupCommands.length} commands from backup`);
    
    // Validate backup
    const validationErrors = validateBackupCommands(backupCommands);
    if (validationErrors.length > 0) {
        console.error('❌ Backup validation failed:');
        validationErrors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }

    // Determine deployment route
    const route = GUILD_ID ? 
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) :
        Routes.applicationCommands(CLIENT_ID);
    
    const deploymentType = GUILD_ID ? `guild ${GUILD_ID}` : 'globally';
    
    try {
        // Backup current state before rollback
        console.log('💾 Creating backup of current state...');
        const currentCommands = await rest.get(route);
        const rollbackBackupFile = path.join(backupDir, `commands-pre-rollback-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        fs.writeFileSync(rollbackBackupFile, JSON.stringify(currentCommands, null, 2));
        console.log(`✅ Current state backed up to: ${path.basename(rollbackBackupFile)}`);
        
        // Execute rollback
        console.log(`🚀 Rolling back commands ${deploymentType}...`);
        const data = await rest.put(route, { body: backupCommands });
        
        console.log(`✅ Rollback completed successfully!`);
        console.log(`📊 Restored ${data.length} commands from backup`);
        
        // Show restored commands
        console.log('\n📋 Restored commands:');
        data.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
        
        // Log rollback
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: 'rollback',
            backupFile,
            commandCount: data.length,
            deploymentType,
            success: true
        };
        
        const logPath = path.join(__dirname, '../../deployment.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        
        console.log(`\n🎉 Rollback completed at ${logEntry.timestamp}`);
        
    } catch (error) {
        console.error('❌ Rollback failed:', error);
        
        // Log failure
        const logEntry = {
            timestamp: new Date().toISOString(),
            action: 'rollback',
            backupFile,
            error: error.message,
            success: false
        };
        
        const logPath = path.join(__dirname, '../../deployment.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        
        process.exit(1);
    }
}

/**
 * Interactive backup selection
 */
function selectBackupInteractively(backups) {
    console.log('\n📋 Available backups:');
    backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.timestamp} (${backup.commandCount} commands, ${(backup.size / 1024).toFixed(1)}KB)`);
    });
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question('\nEnter backup number to rollback to (or press Enter for most recent): ', (answer) => {
            rl.close();
            
            if (!answer.trim()) {
                resolve(backups[0].file);
                return;
            }
            
            const index = parseInt(answer) - 1;
            if (index >= 0 && index < backups.length) {
                resolve(backups[index].file);
            } else {
                console.error('❌ Invalid backup number');
                process.exit(1);
            }
        });
    });
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Discord Command Rollback Tool\n');
        console.log('Usage:');
        console.log('  node rollback-commands.js [options]');
        console.log('  node rollback-commands.js --list');
        console.log('  node rollback-commands.js --file <backup-file>');
        console.log('  node rollback-commands.js --interactive');
        console.log('\nOptions:');
        console.log('  --list              List available backups');
        console.log('  --file <name>       Rollback to specific backup file');
        console.log('  --interactive       Interactive backup selection');
        console.log('  --latest            Rollback to most recent backup');
        return;
    }
    
    console.log('🔄 Discord Command Rollback System');
    console.log('==================================\n');
    
    const backups = listAvailableBackups();
    
    if (backups.length === 0) {
        console.log('❌ No backups found. Cannot perform rollback.');
        process.exit(1);
    }
    
    if (args.includes('--list')) {
        console.log('📋 Available backups:');
        backups.forEach((backup, index) => {
            console.log(`  ${index + 1}. ${backup.file}`);
            console.log(`     Created: ${backup.created.toISOString()}`);
            console.log(`     Commands: ${backup.commandCount}`);
            console.log(`     Size: ${(backup.size / 1024).toFixed(1)}KB\n`);
        });
        return;
    }
    
    let backupFile;
    
    if (args.includes('--file')) {
        const fileIndex = args.indexOf('--file');
        if (fileIndex === -1 || !args[fileIndex + 1]) {
            console.error('❌ --file requires a filename argument');
            process.exit(1);
        }
        backupFile = args[fileIndex + 1];
    } else if (args.includes('--latest')) {
        backupFile = backups[0].file;
    } else if (args.includes('--interactive')) {
        backupFile = await selectBackupInteractively(backups);
    } else {
        // Default to latest
        backupFile = backups[0].file;
        console.log(`ℹ️ No backup specified, using most recent: ${backupFile}`);
    }
    
    console.log(`\n⚠️ WARNING: This will replace all current Discord commands with the backup.`);
    console.log(`Selected backup: ${backupFile}`);
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('\nProceed with rollback? (yes/no): ', async (answer) => {
        rl.close();
        
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
            console.log('❌ Rollback cancelled.');
            process.exit(0);
        }
        
        await executeRollback(backupFile);
    });
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Rollback script failed:', error);
        process.exit(1);
    });
}

module.exports = {
    listAvailableBackups,
    loadBackup,
    executeRollback
};