// !coinbase <currency> <currency> <amount>
const axios = require('axios');
const { get } = require('lodash');

module.exports = async (message, commandArgs) => {
    const splitArgs = commandArgs.split(' ');
    const left = splitArgs.shift();
    const right = splitArgs.shift();
    const amount = splitArgs.shift();

    try {
        // get coinbase currencies
        const allCurrencies = get(
            await axios.get('https://api.coinbase.com/v2/currencies'),
            'data.data',
            []
        );
        allCurrencies.push({ id: 'BTC', name: 'Bitcoin' }, { id: 'ETH', name: 'Ethereum' });

        // define left and right currency names
        const { name: leftName } = allCurrencies.find((cur) => cur.id === left);
        const { name: rightName } = allCurrencies.find((cur) => cur.id === right);

        // send a query to coinbase
        const exchangeRates = await axios.get(
            `https://api.coinbase.com/v2/exchange-rates?currency=${left}`
        );

        // get the exchange rate
        const exchangeRate = get(exchangeRates, 'data.data.rates.' + right, 0);

        // if exchange rate is 0, return error
        if (exchangeRate === 0) {
            return message.channel.send(`${leftName} to ${rightName} exchange rate is 0.`);
        }

        // calculate the amount of right currency, with 2 decimal places
        const newAmount = Math.round(amount * exchangeRate * 100) / 100;

        // send the result
        return message.channel.send(`${amount} ${leftName} is ${newAmount} ${rightName}.`);
    } catch (error) {
        console.log(error);
        message.channel.send('There was an error.');
    }
};
