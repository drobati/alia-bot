import 'dotenv/config';
// Initialize Sentry first, before any other imports
import { initializeSentry } from './src/lib/sentry';
initializeSentry();

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import db from 'sequelize';
import models from './src/models';
import config from "config";
import { join } from "path";
import { readdirSync } from "fs";
import { BotCommand, Context, BotEvent, ExtendedClient } from "./src/utils/types";
import { MotivationalScheduler } from './src/services/motivationalScheduler';
import { VoiceService } from './src/services/voice';
import { captureOwnerIdDebug, Sentry } from './src/lib/sentry';
import { logger } from './src/utils/logger';

const VERSION = '2.0.0';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel],
}) as ExtendedClient;

// Use enhanced logger with Sentry integration
const log = logger;
log.info(`NODE_ENV: ${process.env.NODE_ENV}`);

const sequelize = new db.Sequelize(
    config.get('database.name'),
    config.get('database.user'),
    process.env.DB_PASSWORD,
    {
        ...config.get('database.options'),
        host: process.env.DB_HOST,
    },
);

const context: Context = {
    tables: {} as any,
    sequelize,
    log,
    VERSION,
    motivationalScheduler: undefined, // Will be set after initialization
};

let motivationalScheduler: MotivationalScheduler;
let voiceService: VoiceService;

// Debug model loading
log.info('=== MODEL LOADING DEBUG START ===');
log.info(`Models object keys: ${Object.keys(models).join(', ')}`);

Object.keys(models).forEach(key => {
    try {
        log.info(`Loading model: ${key}`);
        const modelsForTable = models[key as keyof typeof models](sequelize);
        log.info(`Model ${key} returned object with keys: ${Object.keys(modelsForTable).join(', ')}`);

        Object.keys(modelsForTable).forEach(tableKey => {
            log.info(`Adding table to context: ${tableKey}`);
            context.tables[tableKey] = modelsForTable[tableKey as keyof typeof modelsForTable];
        });
    } catch (modelError) {
        log.error(`Error loading model ${key}:`, modelError);
    }
});

log.info(`Final context.tables keys: ${Object.keys(context.tables).join(', ')}`);
log.info('=== MODEL LOADING DEBUG END ===');

client.commands = new Collection<string, BotCommand>();

// Couldn't figure out how to get eslint not to complain about (module: T, path: string) => void.
/* eslint-disable no-unused-vars */
async function loadFiles<T>(directory: string, extension: string, handleFile: (module: T, path: string) => void,
    filterFile = '') {
    const filePath = join(__dirname, directory);
    const files = readdirSync(filePath).filter(file => file.endsWith(extension) && !file.includes(filterFile));

    for (const file of files) {
        const fullPath = join(filePath, file);
        const moduleImport = await import(fullPath);
        const module = moduleImport.default;
        handleFile(module, fullPath);
    }
}

function handleCommandFile(command: BotCommand, fullPath: string) {
    if (command.data) {
        client.commands.set(command.data.name, command);
    } else {
        log.warn(`The command at ${fullPath} is missing a required "data" property.`);
    }
}

function handleEventFile(event: BotEvent) {
    if (event.once) {
        client.once(event.name, (...args) => { event.execute(...args, context).then(r => r); });
    } else {
        client.on(event.name, (...args) => { event.execute(...args, context).then(r => r); });
    }
}

async function startBot() {
    await loadFiles<BotCommand>('src/commands', '.js', handleCommandFile, 'test.js');
    await loadFiles<BotEvent>('events', '.js', handleEventFile, 'test.js');

    await client.login(process.env.BOT_TOKEN);
    log.info({
        version: VERSION,
        nodeEnv: process.env.NODE_ENV,
        category: 'bot_lifecycle',
    }, `Logged in successfully. Version ${VERSION}`);

    // COMPREHENSIVE CONFIG DEBUGGING - Show all config sources
    log.info('=== COMPREHENSIVE CONFIG DEBUGGING ===');
    log.info(`NODE_ENV: ${process.env.NODE_ENV}`);
    log.info(`NODE_CONFIG_ENV: ${process.env.NODE_CONFIG_ENV || 'undefined'}`);
    log.info(`NODE_CONFIG_DIR: ${process.env.NODE_CONFIG_DIR || 'default (./config)'}`);
    log.info(`NODE_CONFIG: ${process.env.NODE_CONFIG || 'undefined'}`);
    log.info(`Current working directory: ${process.cwd()}`);
    
    // Check which config files exist and would be loaded
    const fs = require('fs');
    const path = require('path');
    const configDir = process.env.NODE_CONFIG_DIR || path.join(process.cwd(), 'config');
    log.info(`Config directory: ${configDir}`);
    
    try {
        const configFiles = fs.readdirSync(configDir);
        log.info(`Available config files: ${configFiles.join(', ')}`);
        
        // Check specific files that would be loaded based on NODE_ENV
        const env = process.env.NODE_ENV || 'development';
        const possibleFiles = [
            'default.yaml',
            'default.yml',
            'default.json',
            `${env}.yaml`,
            `${env}.yml`, 
            `${env}.json`,
            'local.yaml',
            'local.yml',
            'local.json'
        ];
        
        log.info('Config file loading order and existence:');
        possibleFiles.forEach(filename => {
            const filePath = path.join(configDir, filename);
            const exists = fs.existsSync(filePath);
            log.info(`  ${filename}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
            if (exists) {
                const stats = fs.statSync(filePath);
                log.info(`    Size: ${stats.size} bytes, Modified: ${stats.mtime.toISOString()}`);
            }
        });
    } catch (error) {
        log.error(`Failed to read config directory: ${(error as Error).message}`);
    }

    // Log all config sources that the config package would consider
    log.info(`Config package sources (in precedence order):`);
    log.info(`1. Command line arguments: ${JSON.stringify(process.argv.slice(2))}`);
    log.info(`2. Environment variables: NODE_CONFIG exists = ${!!process.env.NODE_CONFIG}`);
    log.info(`3. Config files: See file existence check above`);
    log.info('=== END CONFIG DEBUGGING ===');

    // Log bot owner configuration for debugging
    const ownerId = config.get<string>('owner');
    log.info({
        ownerId,
        ownerIdType: typeof ownerId,
        category: 'bot_configuration',
    }, 'Bot owner configuration loaded');
    
    // Additional debugging - show raw config and environment overrides
    log.info('=== OWNER CONFIG DETAILED ANALYSIS ===');
    
    // Check if owner is being set by environment variable
    const envVars = Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('owner') || 
        key.toLowerCase().includes('config') ||
        key.startsWith('ALIA_') ||
        key.startsWith('BOT_')
    );
    log.info(`Environment variables that might affect config: ${JSON.stringify(envVars.map(key => `${key}=${process.env[key]}`))}`);
    
    // Try to get the raw config object
    try {
        const configKeys = config.util.getConfigSources();
        log.info(`Config sources loaded: ${JSON.stringify(configKeys, null, 2)}`);
    } catch (error) {
        log.warn(`Could not get config sources: ${(error as Error).message}`);
    }
    
    // Check if there are any config overrides
    if (process.env.NODE_CONFIG) {
        try {
            const nodeConfigOverride = JSON.parse(process.env.NODE_CONFIG);
            log.info(`NODE_CONFIG override: ${JSON.stringify(nodeConfigOverride, null, 2)}`);
        } catch (error) {
            log.warn(`NODE_CONFIG exists but is not valid JSON: ${process.env.NODE_CONFIG}`);
        }
    }
    
    log.info('=== END OWNER CONFIG ANALYSIS ===');

    // Capture owner ID configuration in Sentry for debugging
    captureOwnerIdDebug({
        userId: 'SYSTEM',
        configuredOwnerId: ownerId,
        isOwner: true,
        event: 'login',
    });

    // Send owner config to #deploy channel
    try {
        const deployChannelId = '847239885146333215'; // #deploy channel
        const deployChannel = await client.channels.fetch(deployChannelId);
        if (deployChannel?.isTextBased() && 'send' in deployChannel) {
            await deployChannel.send(`🚀 **Bot Deployed**\n` +
                `**Version:** ${VERSION}\n` +
                `**Configured Owner ID:** ${ownerId}\n` +
                `**Owner ID Type:** ${typeof ownerId}\n` +
                `**Node Environment:** ${process.env.NODE_ENV}\n` +
                `**Timestamp:** ${new Date().toISOString()}`);
        }
    } catch (error) {
        log.error({
            error,
            category: 'deployment_notification',
        }, 'Failed to send deploy message to channel');
    }

    // Initialize motivational scheduler after successful login
    motivationalScheduler = new MotivationalScheduler(client, context);
    context.motivationalScheduler = motivationalScheduler;
    await motivationalScheduler.initialize();
    log.info({ category: 'service_initialization' }, 'Motivational scheduler initialized');

    // Initialize voice service
    voiceService = new VoiceService(context);
    context.voiceService = voiceService;
    log.info({ category: 'service_initialization' }, 'Voice service initialized');

    // Final deployment success message with owner configuration
    log.info({
        version: VERSION,
        environment: process.env.NODE_ENV || 'development',
        ownerId,
        ownerIdType: typeof ownerId,
        deployTimestamp: new Date().toISOString(),
        category: 'bot_deployment',
    }, '🚀 Bot deployed successfully - ready to accept commands');
}

// Graceful shutdown handler
process.on('SIGINT', () => {
    log.info('Received SIGINT, shutting down gracefully...');
    if (motivationalScheduler) {
        motivationalScheduler.shutdown();
    }
    if (voiceService) {
        voiceService.destroy();
        log.info('Voice service destroyed');
    }
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('Received SIGTERM, shutting down gracefully...');
    if (motivationalScheduler) {
        motivationalScheduler.shutdown();
    }
    if (voiceService) {
        voiceService.destroy();
        log.info('Voice service destroyed');
    }
    client.destroy();
    process.exit(0);
});

startBot().catch(error => {
    log.error({ error: error.message, stack: error.stack }, 'Failed to start bot');
    Sentry.captureException(error);
    process.exit(1);
});