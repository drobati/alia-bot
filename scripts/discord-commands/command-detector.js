#!/usr/bin/env node

/**
 * Command Change Detection System
 * Detects new, modified, or deleted Discord slash commands for CI/CD automation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COMMANDS_DIR = path.join(__dirname, '../../dist/src/commands');
const COMMAND_CHECKSUMS_FILE = path.join(__dirname, '../../.command-checksums.json');

/**
 * Calculate checksum for command file content
 */
function calculateChecksum(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Extract command metadata from compiled command file
 */
function extractCommandMetadata(filePath) {
    try {
        const command = require(filePath);
        const commandData = command.default || command;
        
        if (!commandData.data) {
            return null;
        }

        const data = commandData.data.toJSON ? commandData.data.toJSON() : commandData.data;
        
        return {
            name: data.name,
            description: data.description,
            options: data.options || [],
            developmentOnly: commandData.developmentOnly || false,
            ownerOnly: commandData.ownerOnly || false,
            checksum: calculateChecksum(filePath)
        };
    } catch (error) {
        console.error(`❌ Error extracting metadata from ${filePath}:`, error.message);
        return null;
    }
}

/**
 * Load previous command checksums
 */
function loadPreviousChecksums() {
    try {
        if (fs.existsSync(COMMAND_CHECKSUMS_FILE)) {
            return JSON.parse(fs.readFileSync(COMMAND_CHECKSUMS_FILE, 'utf8'));
        }
    } catch (error) {
        console.warn(`⚠️ Could not load previous checksums: ${error.message}`);
    }
    return {};
}

/**
 * Save current command checksums
 */
function saveCurrentChecksums(checksums) {
    fs.writeFileSync(COMMAND_CHECKSUMS_FILE, JSON.stringify(checksums, null, 2));
}

/**
 * Scan for command changes
 */
function detectCommandChanges() {
    if (!fs.existsSync(COMMANDS_DIR)) {
        console.error(`❌ Commands directory not found: ${COMMANDS_DIR}`);
        process.exit(1);
    }

    const commandFiles = fs.readdirSync(COMMANDS_DIR)
        .filter(file => file.endsWith('.js') && !file.includes('.test.'));

    const previousChecksums = loadPreviousChecksums();
    const currentCommands = {};
    const changes = {
        new: [],
        modified: [],
        deleted: [],
        unchanged: []
    };

    // Process current command files
    for (const file of commandFiles) {
        const filePath = path.join(COMMANDS_DIR, file);
        const metadata = extractCommandMetadata(filePath);
        
        if (!metadata) {
            console.warn(`⚠️ Skipping ${file} - invalid command structure`);
            continue;
        }

        currentCommands[metadata.name] = metadata;

        if (!(metadata.name in previousChecksums)) {
            changes.new.push(metadata);
            console.log(`🆕 NEW: ${metadata.name}`);
        } else if (previousChecksums[metadata.name].checksum !== metadata.checksum) {
            changes.modified.push({
                ...metadata,
                previousChecksum: previousChecksums[metadata.name].checksum
            });
            console.log(`📝 MODIFIED: ${metadata.name}`);
        } else {
            changes.unchanged.push(metadata);
        }
    }

    // Detect deleted commands
    for (const [commandName, oldMetadata] of Object.entries(previousChecksums)) {
        if (!(commandName in currentCommands)) {
            changes.deleted.push(oldMetadata);
            console.log(`🗑️ DELETED: ${commandName}`);
        }
    }

    // Save current checksums for next run
    const currentChecksums = {};
    Object.values(currentCommands).forEach(cmd => {
        currentChecksums[cmd.name] = {
            checksum: cmd.checksum,
            description: cmd.description,
            developmentOnly: cmd.developmentOnly,
            ownerOnly: cmd.ownerOnly
        };
    });
    saveCurrentChecksums(currentChecksums);

    return {
        changes,
        currentCommands: Object.values(currentCommands),
        hasChanges: changes.new.length > 0 || changes.modified.length > 0 || changes.deleted.length > 0
    };
}

/**
 * Validate command structure and dependencies
 */
function validateCommands(commands) {
    const errors = [];
    const warnings = [];

    for (const command of commands) {
        // Required fields validation
        if (!command.name || !command.description) {
            errors.push(`Command missing required name or description: ${JSON.stringify(command)}`);
            continue;
        }

        // Name format validation
        if (!/^[a-z0-9_-]+$/.test(command.name)) {
            errors.push(`Command name "${command.name}" contains invalid characters. Use only lowercase letters, numbers, hyphens, and underscores.`);
        }

        if (command.name.length > 32) {
            errors.push(`Command name "${command.name}" is too long (max 32 characters)`);
        }

        // Description validation
        if (command.description.length > 100) {
            errors.push(`Command "${command.name}" description is too long (max 100 characters)`);
        }

        // Options validation
        if (command.options && command.options.length > 25) {
            errors.push(`Command "${command.name}" has too many options (max 25)`);
        }

        // Development-only commands in production check
        if (command.developmentOnly && process.env.NODE_ENV === 'production') {
            warnings.push(`Development-only command "${command.name}" will be skipped in production`);
        }

        // Owner-only commands security check
        if (command.ownerOnly) {
            warnings.push(`Owner-only command "${command.name}" requires proper permission validation`);
        }
    }

    return { errors, warnings };
}

/**
 * Generate deployment report
 */
function generateDeploymentReport(detection, validation) {
    const report = {
        timestamp: new Date().toISOString(),
        hasChanges: detection.hasChanges,
        totalCommands: detection.currentCommands.length,
        changes: detection.changes,
        validation: validation,
        deployment: {
            required: detection.hasChanges && validation.errors.length === 0,
            environment: process.env.NODE_ENV || 'development'
        }
    };

    // Write report for GitHub Actions
    const reportPath = path.join(__dirname, '../../command-deployment-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 DEPLOYMENT REPORT');
    console.log('====================');
    console.log(`Total commands: ${report.totalCommands}`);
    console.log(`New: ${report.changes.new.length}`);
    console.log(`Modified: ${report.changes.modified.length}`);
    console.log(`Deleted: ${report.changes.deleted.length}`);
    console.log(`Validation errors: ${report.validation.errors.length}`);
    console.log(`Validation warnings: ${report.validation.warnings.length}`);
    console.log(`Deployment required: ${report.deployment.required}`);

    if (report.validation.errors.length > 0) {
        console.log('\n❌ VALIDATION ERRORS:');
        report.validation.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (report.validation.warnings.length > 0) {
        console.log('\n⚠️ VALIDATION WARNINGS:');
        report.validation.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    return report;
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Detecting Discord command changes...\n');
    
    const detection = detectCommandChanges();
    const validation = validateCommands(detection.currentCommands);
    const report = generateDeploymentReport(detection, validation);

    // Set GitHub Actions outputs
    if (process.env.GITHUB_ACTIONS) {
        console.log(`::set-output name=has-changes::${report.hasChanges}`);
        console.log(`::set-output name=deployment-required::${report.deployment.required}`);
        console.log(`::set-output name=validation-passed::${validation.errors.length === 0}`);
        console.log(`::set-output name=new-commands::${report.changes.new.length}`);
        console.log(`::set-output name=modified-commands::${report.changes.modified.length}`);
        console.log(`::set-output name=deleted-commands::${report.changes.deleted.length}`);
    }

    // Exit with error if validation failed
    if (validation.errors.length > 0) {
        console.log('\n❌ Command validation failed. Deployment blocked.');
        process.exit(1);
    }

    console.log('\n✅ Command detection and validation completed successfully.');
    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = {
    detectCommandChanges,
    validateCommands,
    generateDeploymentReport
};