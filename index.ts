import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import db from 'sequelize';
import models from './src/models';
import config from "config";
import bunyan from "bunyan";
import { join } from "path";
import { readdirSync } from "fs";
import { BotCommand, Context, BotEvent, ExtendedClient } from "./src/utils/types";
import { MotivationalScheduler } from './src/services/motivationalScheduler';
import { VoiceService } from './src/services/voice';

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

const log = bunyan.createLogger({ name: 'alia-bot', level: config.get('level') });
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
    log.info(`Logged in. Version ${VERSION}`);
    
    // Log bot owner configuration for debugging
    const ownerId = config.get<string>('owner');
    log.info(`=== BOT OWNER CONFIGURATION ===`);
    log.info(`Configured owner ID: ${ownerId}`);
    log.info(`Owner ID type: ${typeof ownerId}`);
    log.info(`===================================`);
    
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
        log.error('Failed to send deploy message:', error);
    }

    // Initialize motivational scheduler after successful login
    motivationalScheduler = new MotivationalScheduler(client, context);
    context.motivationalScheduler = motivationalScheduler;
    await motivationalScheduler.initialize();
    log.info('Motivational scheduler initialized');

    // Initialize voice service
    voiceService = new VoiceService(context);
    context.voiceService = voiceService;
    log.info('Voice service initialized');
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
    process.exit(1);
});