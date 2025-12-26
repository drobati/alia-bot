import 'dotenv/config';
// Initialize Sentry first, before any other imports
import { initializeSentry } from './src/lib/sentry';
initializeSentry();

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import db from 'sequelize';
import models from './src/models';
import config from "config";
import { join } from "path";
import { readdirSync, readFileSync } from "fs";
import { BotCommand, Context, BotEvent, ExtendedClient } from "./src/utils/types";
import { MotivationalScheduler } from './src/services/motivationalScheduler';
import { VoiceService } from './src/services/voice';
import { captureOwnerIdDebug, Sentry } from './src/lib/sentry';
import { logger } from './src/utils/logger';

// Version from CI environment variable (set during deployment), fallback to package.json
// Note: __dirname is 'dist/' after compilation, so we need to go up one level
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const VERSION = process.env.APP_VERSION || packageJson.version;
// Commit SHA from CI environment variable (set during deployment)
const COMMIT_SHA = process.env.VERSION || 'development';

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
    COMMIT_SHA,
    motivationalScheduler: undefined, // Will be set after initialization
    client: client, // Discord client for sending messages
};

let motivationalScheduler: MotivationalScheduler;
let voiceService: VoiceService;

// Load database models
Object.keys(models).forEach(key => {
    try {
        const modelsForTable = models[key as keyof typeof models](sequelize);
        Object.keys(modelsForTable).forEach(tableKey => {
            context.tables[tableKey] = modelsForTable[tableKey as keyof typeof modelsForTable];
        });
    } catch (modelError) {
        log.error({ error: modelError, model: key, category: 'model_loading' }, `Error loading model ${key}`);
    }
});

log.info({ tables: Object.keys(context.tables), category: 'model_loading' }, 'Database models loaded');

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
    log.info(`Attempting to load command from: ${fullPath}`);

    // Check if command exists and has the expected structure
    if (!command) {
        log.error(`Command is null/undefined from: ${fullPath}`);
        return;
    }

    if (!command.data) {
        log.error(`Command is missing data property from: ${fullPath}`);
        return;
    }

    log.info(`Command data found: ${command.data.name} from ${fullPath}`);

    // Filter out development-only commands in production
    if (command.developmentOnly && process.env.NODE_ENV === 'production') {
        log.info(`Skipping development-only command: ${command.data?.name || 'unknown'}`);
        return;
    }

    if (command.data) {
        client.commands.set(command.data.name, command);
        log.info(`Successfully loaded command: ${command.data.name}`);
    } else {
        log.warn(`The command at ${fullPath} is missing a required "data" property.`);
    }
}

function handleEventFile(event: BotEvent) {
    if (event.once) {
        client.once(event.name, (...args) => {
            event.execute(...args, context).catch(err => log.error({ error: err }, `Error in event ${event.name}`));
        });
    } else {
        client.on(event.name, (...args) => {
            event.execute(...args, context).catch(err => log.error({ error: err }, `Error in event ${event.name}`));
        });
    }
}

async function startBot() {
    log.info('Starting command loading...');
    await loadFiles<BotCommand>('src/commands', '.js', handleCommandFile, 'test.js');
    log.info(`Command loading complete. Total commands loaded: ${client.commands.size}`);

    log.info('Starting event loading...');
    await loadFiles<BotEvent>('events', '.js', handleEventFile, 'test.js');
    log.info('Event loading complete.');

    await client.login(process.env.BOT_TOKEN);
    log.info({
        version: VERSION,
        nodeEnv: process.env.NODE_ENV,
        category: 'bot_lifecycle',
    }, `Logged in successfully. Version ${VERSION}`);

    // Log bot owner configuration for debugging
    const ownerId = config.get<string>('owner');
    log.info({
        ownerId,
        ownerIdType: typeof ownerId,
        category: 'bot_configuration',
    }, 'Bot owner configuration loaded');

    // Capture owner ID configuration in Sentry for debugging
    captureOwnerIdDebug({
        userId: 'SYSTEM',
        configuredOwnerId: ownerId,
        isOwner: true,
        event: 'login',
    });

    // Send deployment info to #deploy channel
    try {
        const deployChannelId = '847239885146333215'; // #deploy channel
        const deployChannel = await client.channels.fetch(deployChannelId);
        if (deployChannel?.isTextBased() && 'send' in deployChannel) {
            const shortSha = COMMIT_SHA.substring(0, 7);
            await deployChannel.send(`🚀 **Bot Deployed**\n` +
                `**Version:** ${VERSION}\n` +
                `**Commit:** ${shortSha}\n` +
                `**Environment:** ${process.env.NODE_ENV}\n` +
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

    // Final deployment success message
    log.info({
        version: VERSION,
        commitSha: COMMIT_SHA,
        environment: process.env.NODE_ENV || 'development',
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
    void client.destroy();
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
    void client.destroy();
    process.exit(0);
});

startBot().catch(error => {
    log.error({ error: error.message, stack: error.stack }, 'Failed to start bot');
    Sentry.captureException(error);
    process.exit(1);
});