import { Client, ClientEvents, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import db from 'sequelize';
import models from './src/models';
import config from "config";
import bunyan from "bunyan";
import { join } from "path";
import { readdirSync } from "fs";
import { Command, Context, Event, ExecuteFunction, ExtendedClient } from "./src/utils/types";

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
    tables: {},
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

client.commands = new Collection<string, Command>();

// Couldn't figure out how to get eslint not to complain about (module: T, path: string) => void.
/* eslint-disable no-unused-vars */
function loadFiles<T>(directory: string, extension: string, handleFile: (module: T, path: string) => void,
    filterFile = '') {
    const filePath = join(__dirname, directory);
    const files = readdirSync(filePath).filter(file => file.endsWith(extension) && !file.includes(filterFile));

    for (const file of files) {
        const fullPath = join(filePath, file);
        const module: T = require(fullPath);
        handleFile(module, fullPath);
    }
}

function handleCommandFile(command: Command, fullPath: string) {
    if (command.data) {
        client.commands.set(command.data.name, command);
    } else {
        log.warn(`The command at ${fullPath} is missing a required "data" property.`);
    }
}

function handleEventFile(event: Event<keyof ClientEvents>) {
    if (event.once) {
        client.once(event.name, (...args) => { event.execute(...args); });
    } else {
        client.on(event.name, (...args) => { event.execute(...args); });
    }
}

loadFiles<Command>('src/commands', '.js', handleCommandFile, 'test.js');
loadFiles<Event<keyof ClientEvents>>('events', '.js', handleEventFile, 'test.js');

client.login(process.env.BOT_TOKEN).then(() => {
    log.info(`Logged in. Version ${VERSION}`);
});