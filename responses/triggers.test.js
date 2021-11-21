const triggers = require('./triggers');

describe('responses/triggers', () => {
    describe('should', () => {
        let message, Memories;

        beforeEach(() => {
            message = {
                content: '',
                channel: { send: jest.fn() }
            };
            Memories = {
                findAll: jest.fn().mockResolvedValue([
                    {
                        key: 'key',
                        value: 'response'
                    }
                ])
            };
        });

        it('responds to matches of triggers', async () => {
            message.content = 'this KEY matches';
            await triggers(message, Memories);
            expect(message.channel.send).toBeCalledWith('response');
        });

        it('does not respond to no match', async () => {
            message.content = "this doesn't match";
            await triggers(message, Memories);
            expect(message.channel.send).toBeCalledTimes(0);
        });
    });
});
