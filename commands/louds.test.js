const louds = require('./louds');

describe('commands/louds', () => {
    describe('should', () => {
        let message = {},
            Louds = {},
            Louds_Banned = {};

        beforeEach(() => {
            message = {
                content: 'FEAR',
                author: { username: 'derek' },
                channel: { send: jest.fn() },
                reply: jest.fn().mockResolvedValue(true)
            };
            Louds = {
                create: jest.fn(),
                findOne: jest.fn().mockResolvedValue(false),
                destroy: jest.fn().mockResolvedValueOnce(1)
            };
            Louds_Banned = {
                create: jest.fn(),
                findOne: jest.fn().mockResolvedValue(false),
                destroy: jest.fn().mockResolvedValueOnce(1)
            };
        });

        it('respond to delete', async () => {
            message.content = '!louds delete fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledTimes(1);
        });

        it('respond to ban', async () => {
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledTimes(1);
        });

        it('respond to unban', async () => {
            message.content = '!louds unban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledTimes(1);
        });

        it('respond to missing command', async () => {
            message.content = '!louds delete fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeTruthy();
        });

        it('respond to failed delete', async () => {
            Louds.destroy = jest.fn().mockResolvedValueOnce(0);
            message.content = '!louds delete fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeTruthy();
        });

        it('ban loud with ban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(false);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            const create = Louds_Banned.create.mock.calls;
            expect(create).toHaveLength(1);
        });

        it('cannot ban if already banned with ban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            const create = Louds_Banned.create.mock.calls;
            expect(create).toHaveLength(0);
        });

        it('delete loud with ban command', async () => {
            Louds.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            const destroy = Louds.destroy.mock.calls;
            expect(destroy).toHaveLength(1);
        });

        it('add loud with unban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds unban fake-data';
            await louds(message, Louds, Louds_Banned);
            const create = Louds.create.mock.calls;
            expect(create).toHaveLength(1);
        });

        it('delete banned loud with unban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds unban fake-data';
            await louds(message, Louds, Louds_Banned);
            const destroy = Louds_Banned.destroy.mock.calls;
            expect(destroy).toHaveLength(1);
        });
    });
});
