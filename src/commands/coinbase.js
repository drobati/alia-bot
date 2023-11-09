// !coinbase <currency> <currency> <amount>
const axios = require('axios');
const { get, find } = require('lodash');
const Fuse = require('fuse.js');
const {SlashCommandBuilder} = require("discord.js");

const cache = {
    data: null,
    lastFetch: 0
};

function isCacheValid() {
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    return (Date.now() - cache.lastFetch) < fiveMinutes;
}

async function getCurrenciesWithCache(context) {
    const { log } = context;

    if (cache.data && isCacheValid()) {
        log.info('Cache is not invalid yet.')
        return cache.data;
    } else {
        log.info('Cache is invalid.')
        try {
            log.info('Fetching currencies from coinbase.')
            const response = await axios.get('https://api.coinbase.com/v2/currencies');
            const allCurrencies = get(response, 'data.data', []);

            // Add custom currencies to the list
            allCurrencies.push({id: 'BTC', name: 'Bitcoin'}, {id: 'ETH', name: 'Ethereum'});

            // Update cache
            cache.data = allCurrencies;
            cache.lastFetch = Date.now();

            log.info('Currencies fetched from coinbase.')
            return allCurrencies;
        } catch (error) {
            log.error('Error fetching currencies from coinbase.', error);
            return cache.data || [];
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exchange')
        .setDescription('Get exchange rates from coinbase.')
        .addStringOption(option =>
            option.setName('source')
                .setDescription('Source currency.')
                .setAutocomplete(true)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Target currency.')
                .setAutocomplete(true)
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('amount')
                .setDescription('Amount of source currency.')),
    async autocomplete(interaction, context) {
        const {log} = context;
        const focusedValue = interaction.options.getFocused();
        log.debug('focusedValue', focusedValue);
        const currencies = await getCurrenciesWithCache(context)
        log.debug('choices', currencies);
        const fuse = new Fuse(currencies, {keys: ['id', 'name']});
        const results = fuse.search(focusedValue, {limit: 10})
            .map(({item}) => ({name: `${item.id} - ${item.name}`, value: item.id}));
        log.debug('results', results);
        await interaction.respond(results);
    },
    async execute(interaction, context) {
        const {log} = context;
        const source = interaction.options.get('source');
        const target = interaction.options.get('target');

        const currencies = await getCurrenciesWithCache(context);
        const sourceCurrency = source.value.toUpperCase();
        const sourceName = get(find(currencies, {id: sourceCurrency}), 'name', sourceCurrency);
        const targetCurrency = target.value.toUpperCase();
        const targetName = get(find(currencies, {id: targetCurrency}), 'name', targetCurrency);
        const amount = interaction.options.getNumber('amount') || 1;
        log.debug('sourceCurrency', sourceCurrency);
        log.debug('sourceName', sourceName)
        log.debug('targetCurrency', targetCurrency);
        log.debug('targetName', targetName);
        log.debug('amount', amount);

        // send a query to coinbase
        const exchangeRates = await axios.get(
            `https://api.coinbase.com/v2/exchange-rates?currency=${sourceCurrency}`
        );
        log.debug('exchangeRates', exchangeRates);

        // get the exchange rate
        const exchangeRate = get(exchangeRates, 'data.data.rates.' + targetCurrency, 0);
        log.debug('exchangeRate', exchangeRate);

        // if exchange rate is 0, return error
        if (exchangeRate <= 0) {
            log.warn(`${sourceName} to ${targetName} exchange rate is not valid.`)
            return await interaction.reply(
                `${sourceName} to ${targetName} exchange rate is not valid.`
            );
        }

        // calculate the amount of right currency, with 2 decimal places
        const newAmount = Math.round(amount * exchangeRate * 100) / 100;
        log.debug('newAmount', newAmount)

        // send the result
        return await interaction.reply(`${amount} ${sourceName} is ${newAmount} ${targetName}.`);
    }
};
