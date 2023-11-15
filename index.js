const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const db = require('sequelize');
const models = require('./src/models');
const config = require('config');
const bunyan = require('bunyan');
const { join } = require("path");
const { readdirSync } = require("fs");

const VERSION = '2.0.0';

const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });
const log = bunyan.createLogger({ name: 'aliabot', level: config.get('level') });

log.info(`NODE_ENV: ${process.env.NODE_ENV}`);

const sequelize = new db.Sequelize(
    config.get('database.name'),
    config.get('database.user'),
    process.env.DB_PASSWORD,
    {
        ...config.get('database.options'),
        host: process.env.DB_HOST
    }
);

const context = {
    tables: {},
    sequelize,
    log,
    VERSION
};

Object.keys(models).forEach((key) => {
    const modelsForTable = models[key](sequelize);
    Object.keys(modelsForTable).forEach((key) => {
        context.tables[key] = modelsForTable[key];
    });
});

client.commands = new Collection();

function loadFiles(directory, extension, handleFile, filterFile = '') {
    const filePath = join(__dirname, directory);
    const files = readdirSync(filePath).filter(file => file.endsWith(extension) && !file.includes(filterFile));

    for (const file of files) {
        const fullPath = join(filePath, file);
        const module = require(fullPath);
        handleFile(module, fullPath);
    }
}

// Handling commands
function handleCommandFile(command, fullPath) {
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        log.warn(`The command at ${fullPath} is missing a required "data" or "execute" property.`);
    }
}

// Handling events
function handleEventFile(event) {
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, context));
    } else {
        client.on(event.name, (...args) => event.execute(...args, context));
    }
}

// Load commands and events
loadFiles('src/commands', '.js', handleCommandFile, 'test.js');
loadFiles('events', '.js', handleEventFile);

client.login(process.env.BOT_TOKEN).then(() => {
    log.info(`Logged in. Version ${VERSION}`);
});