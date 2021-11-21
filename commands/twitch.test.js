jest.mock('../lib/apis/twitch', () => ({
    getUserId: jest.fn(async (username) => {
        if (username === 'fake-user') {
            return 'fake-user-id';
        } else {
            return undefined;
        }
    }),
    setWebhook: jest.fn().mockResolvedValue('')
}));

const twitch = require('./twitch');

describe('commands/twitch', () => {
    describe('should', () => {
        let message = {},
            Twitch_Users = {};

        beforeEach(() => {
            message = {
                author: { username: 'derek' },
                channel: { send: jest.fn() }
            };
            Twitch_Users = {
                create: jest.fn(),
                findOne: jest.fn().mockResolvedValue(false)
            };
        });

        it('respond to subscribe and exists on twitch', async () => {
            message.content = '!twitch subscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('Subscription started.');
        });
        it('create twitch record', async () => {
            message.content = '!twitch subscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(Twitch_Users.create).toBeCalledWith({
                user_id: message.author.id,
                twitch_id: 'fake-user-id'
            });
        });
        it('respond to subscribe and nothing on twitch', async () => {
            message.content = '!twitch subscribe fake-nothing';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('User is not found.');
        });
        it('respond to subscribe and error code is 1', async () => {
            Twitch_Users.create = jest.fn().mockRejectedValue({ code: 1, message: 'works' });
            message.content = '!twitch subscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('works');
        });
        it('respond to subscribe and error', async () => {
            Twitch_Users.create = jest.fn().mockRejectedValue(new Error('Async error'));
            message.content = '!twitch subscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('I had a really bad error.');
        });
        it('respond to subscribe and exists in db', async () => {
            Twitch_Users.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!twitch subscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('User is already registered.');
        });
        it('respond to unsubscribe and exists in db', async () => {
            Twitch_Users.findOne = jest.fn().mockResolvedValue({
                twitch_id: 'fake-twitch-id',
                destroy: jest.fn().mockResolvedValue(true)
            });
            message.content = '!twitch unsubscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('Unsubscription started.');
        });
        it('destroy twitch record', async () => {
            const destroyed = jest.fn().mockResolvedValue(true);
            Twitch_Users.findOne = jest.fn().mockResolvedValue({
                destroy: destroyed
            });
            message.content = '!twitch unsubscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(destroyed).toBeCalledWith({ force: true });
        });
        it('respond to unsubscribe and nothing in db', async () => {
            message.content = '!twitch unsubscribe fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('User is not subscribed.');
        });
        it('respond to missing command', async () => {
            message.content = '!twitch hotgarbage fake-user';
            await twitch(message, Twitch_Users);
            expect(message.channel.send).toBeCalledWith('Twitch subcommand does not exist.');
        });
    });
});
