import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import db from 'sequelize';
import models from './src/models';
import config from "config";
import bunyan from "bunyan";
import { join } from "path";
import { readdirSync } from "fs";
import { BotCommand, Context, BotEvent, ExtendedClient } from "./src/utils/types";

const VERSION = '2.0.0';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
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
};

Object.keys(models).forEach(key => {
    const modelsForTable = models[key as keyof typeof models](sequelize);
    Object.keys(modelsForTable).forEach(key => {
        // context.tables[key] = modelsForTable[key];
        context.tables[key] = modelsForTable[key as keyof typeof modelsForTable];
    });
});

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
}

startBot().catch(error => {
    log.error({ error }, 'Failed to start bot');
    process.exit(1);
});