// !coinbase <currency> <currency> <amount>
const axios = require('axios');
const { get } = require('lodash');
const Fuse = require('fuse.js');

module.exports = async (message) => {
    const words = message.content.split(' ').splice(1);
    const left = words.shift();
    const right = words.shift();
    const amount = words.shift() ?? 1;

    // get coinbase currencies
    const allCurrencies = get(
        await axios.get('https://api.coinbase.com/v2/currencies'),
        'data.data',
        []
    );
    allCurrencies.push({ id: 'BTC', name: 'Bitcoin' }, { id: 'ETH', name: 'Ethereum' });

    // use fuse.js to find the currencies
    const fuse = new Fuse(allCurrencies, { keys: ['id', 'name'] });
    const leftType = get(fuse.search(left, { limit: 1 }), '0.item');
    const rightType = get(fuse.search(right, { limit: 1 }), '0.item');

    const { id: leftCurrency, name: leftName } = leftType;
    const { id: rightCurrency, name: rightName } = rightType;

    // send a query to coinbase
    const exchangeRates = await axios.get(
        `https://api.coinbase.com/v2/exchange-rates?currency=${leftCurrency}`
    );

    // get the exchange rate
    const exchangeRate = get(exchangeRates, 'data.data.rates.' + rightCurrency, 0);

    // if exchange rate is 0, return error
    if (exchangeRate <= 0) {
        return await message.channel.send(
            `${leftName} to ${rightName} exchange rate is not valid.`
        );
    }

    // calculate the amount of right currency, with 2 decimal places
    const newAmount = Math.round(amount * exchangeRate * 100) / 100;

    // send the result
    return await message.channel.send(`${amount} ${leftName} is ${newAmount} ${rightName}.`);
};
