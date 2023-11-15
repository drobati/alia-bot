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
log.info(`Connecting to ${config.get('database.user')}@${process.env.DB_HOST}/${config.get('database.name')}`);

const sequelize = new db.Sequelize(
    config.get('database.name'),
    config.get('database.user'),
    process.env.DB_PASSWORD,
    {
        ...config.get('database.options'),
        host: process.env.DB_HOST
    }
);

const tables = {};
Object.keys(models).forEach((key) => {
    const modelsForTable = models[key](sequelize);
    Object.keys(modelsForTable).forEach((key) => {
        tables[key] = modelsForTable[key];
    });
});

const context = {
    tables,
    log,
    VERSION
};

client.commands = new Collection();

const commandsPath = join(__dirname, 'src/commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    if (filePath.includes('test.js')) continue;
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        log.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const eventsPath = join(__dirname, 'events');
const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, context));
    } else {
        client.on(event.name, (...args) => event.execute(...args, context));
    }
}

client.login(process.env.BOT_TOKEN).then(() => {
    log.info(`Logged in. Version ${VERSION}`);
});