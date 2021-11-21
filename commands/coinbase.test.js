const coinbase = require('./coinbase');
const axios = require('axios');
jest.mock('axios');

describe('commands/coinbase', () => {
    let message, currencies, exchanges;

    beforeEach(() => {
        message = {
            content: '',
            channel: {
                send: jest.fn().mockResolvedValue(true)
            }
        };
        currencies = { data: { data: [{ id: 'USD', name: 'United States Dollar' }] } };
        exchanges = { data: { data: { rates: { USD: 2 } } } };
        axios.get = jest.fn().mockResolvedValueOnce(currencies).mockResolvedValueOnce(exchanges);
    });

    const run = async (message) => await coinbase(message);

    describe('should respond', () => {
        it('respond if successful', async function () {
            message.content = '!coinbase BTC USD';
            await run(message);
            expect(message.channel.send).toBeCalledWith('1 Bitcoin is 2 United States Dollar.');
        });

        it('if exchange rate is not valid', async function () {
            exchanges = { data: { data: { rates: { USD: 0 } } } };
            axios.get = jest
                .fn()
                .mockResolvedValueOnce(currencies)
                .mockResolvedValueOnce(exchanges);
            message.content = '!coinbase BTC USD';
            await run(message);
            expect(message.channel.send).toBeCalledWith(
                'Bitcoin to United States Dollar exchange rate is not valid.'
            );
        });

        it('if values are lowercase', async function () {
            message.content = '!coinbase btc usd';
            await run(message);
            expect(message.channel.send).toBeCalledWith('1 Bitcoin is 2 United States Dollar.');
        });

        it('if values are similar', async function () {
            message.content = '!coinbase bitcoin dollar';
            await run(message);
            expect(message.channel.send).toBeCalledWith('1 Bitcoin is 2 United States Dollar.');
        });
    });
});
