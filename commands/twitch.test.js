jest.mock('../lib/apis/twitch', () => ({
    getUserId: jest.fn(async username => {
        if (username == 'fake-user') {
            return await 'fake-user-id';
        } else {
            return await undefined;
        }
    }),
    setWebhook: jest.fn().mockResolvedValue(''),
}));

const twitch = require('./twitch');

describe('commands/twitch', () => {
    describe('should', () => {
        let message = {},
            model = {};

        beforeEach(() => {
            message = {
                author: { username: 'derek' },
                channel: { send: jest.fn().mockName('send') },
                reply: jest
                    .fn()
                    .mockResolvedValue(true)
                    .mockName('reply'),
            };
            model = {
                Twitch_Users: {
                    create: jest.fn().mockName('createTwitch'),
                    update: jest.fn().mockName('updateTwitch'),
                    destroy: jest.fn().mockName('destroyTwitch'),
                    findOne: jest
                        .fn()
                        .mockResolvedValue(false)
                        .mockName('findOneTwitch'),
                },
            };
        });

        it('respond to subscribe and exists on twitch', async () => {
            await twitch(message, 'subscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Subscription started.');
        });
        it('create twitch record', async () => {
            await twitch(message, 'subscribe fake-user', model);
            const created = model.Twitch_Users.create;
            expect(created).toBeCalledTimes(1);
            expect(created).toBeCalledWith({
                user_id: message.author.id,
                twitch_id: 'fake-user-id',
            });
        });
        it('respond to subscribe and nothing on twitch', async () => {
            await twitch(message, 'subscribe fake-nothing', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('User is not found.');
        });
        it('respond to subscribe and error code is 1', async () => {
            model.Twitch_Users.create = jest.fn().mockRejectedValue({ code: 1, message: 'works' });
            await twitch(message, 'subscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('works');
        });
        it('respond to subscribe and error', async () => {
            model.Twitch_Users.create = jest.fn().mockRejectedValue(new Error('Async error'));
            await twitch(message, 'subscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('I had a really bad error.');
        });
        it('respond to subscribe and exists in db', async () => {
            model.Twitch_Users.findOne = jest
                .fn()
                .mockResolvedValue(true)
                .mockName('findOneConfigExists');
            await twitch(message, 'subscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('User is already registered.');
        });
        it('respond to unsubscribe and exists in db', async () => {
            model.Twitch_Users.findOne = jest
                .fn()
                .mockResolvedValue({
                    twitch_id: 'fake-twitch-id',
                    destroy: model.Twitch_Users.destroy,
                })
                .mockName('findOneConfigExists');
            await twitch(message, 'unsubscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Unsubscription started.');
        });
        it('destroy twitch record', async () => {
            model.Twitch_Users.findOne = jest
                .fn()
                .mockResolvedValue({
                    destroy: model.Twitch_Users.destroy,
                })
                .mockName('findOneConfigExists');
            await twitch(message, 'unsubscribe fake-user', model);
            const destroyed = model.Twitch_Users.destroy;
            expect(destroyed).toBeCalledTimes(1);
            expect(destroyed).toBeCalledWith({ force: true });
        });
        it('respond to unsubscribe and nothing in db', async () => {
            await twitch(message, 'unsubscribe fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('User is not subscribed.');
        });
        it('respond to missing command', async () => {
            await twitch(message, 'hotgarbage fake-user', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Subcommand does not exist.');
        });
    });
});
