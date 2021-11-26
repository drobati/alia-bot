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
            expect(message.channel.send).toBeCalledWith("I've removed that loud.");
        });

        it('respond to ban', async () => {
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've banned that loud.");
        });

        it('respond to unban', async () => {
            message.content = '!louds unban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("That's not banned.");
        });

        it('respond to missing command', async () => {
            message.content = '!louds delete fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've removed that loud.");
        });

        it('respond to failed delete', async () => {
            Louds.destroy = jest.fn().mockResolvedValueOnce(0);
            message.content = '!louds delete fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I couldn't find that loud.");
        });

        it('ban loud with ban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(false);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've banned that loud.");
        });

        it('cannot ban if already banned with ban command', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've banned that loud.");
        });

        it('responds to ban command if removed and banned', async () => {
            Louds.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds ban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've removed & banned that loud.");
        });

        it('responds to unban', async () => {
            Louds_Banned.findOne = jest.fn().mockResolvedValue(true);
            message.content = '!louds unban fake-data';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I've added & unbanned that loud.");
        });

        it('responds to a bad action', async () => {
            message.content = '!louds garbo';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send).toBeCalledWith("I don't recognize that command.");
        });
    });
});
