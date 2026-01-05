import 'dotenv/config';
// Initialize Sentry first, before any other imports
import { initializeSentry } from './src/lib/sentry';
initializeSentry();

// Global handlers for unhandled errors - log but don't crash
process.on('uncaughtException', error => {
    // eslint-disable-next-line no-console
    console.error('Uncaught Exception:', error);
    // Don't exit - let the bot continue running
});

process.on('unhandledRejection', (reason, promise) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - let the bot continue running
});

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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
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

    // NOTE: Deployment notification is handled in events/ready.ts using safelyFindChannel
    // which is more reliable than direct channel.fetch() during startup

    // Initialize motivational scheduler after successful login
    try {
        motivationalScheduler = new MotivationalScheduler(client, context);
        context.motivationalScheduler = motivationalScheduler;
        await motivationalScheduler.initialize();
        log.info({ category: 'service_initialization' }, 'Motivational scheduler initialized');
    } catch (motivationalError) {
        log.warn({
            error: motivationalError,
            category: 'service_initialization',
        }, 'Motivational scheduler failed to initialize - bot will continue without motivational messages');
    }

    // Initialize voice service
    try {
        voiceService = new VoiceService(context);
        context.voiceService = voiceService;
        log.info({ category: 'service_initialization' }, 'Voice service initialized');
    } catch (voiceError) {
        log.warn({
            error: voiceError,
            category: 'service_initialization',
        }, 'Voice service failed to initialize - bot will continue without voice features');
    }

    // NOTE: SchedulerService is initialized in the ready event AFTER table sync

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
    if (context.schedulerService) {
        context.schedulerService.shutdown();
        log.info('Scheduler service shut down');
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
    if (context.schedulerService) {
        context.schedulerService.shutdown();
        log.info('Scheduler service shut down');
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