import { createContext, createTable } from "../src/utils/testHelpers";
import guildMemberAddEvent from "./guildMemberAdd";
import { Events } from "discord.js";

describe('events/guildMemberAdd', () => {
    let context: any;
    let member: any;
    let Config: any;
    let mockChannel: any;

    beforeEach(() => {
        context = createContext();
        Config = createTable();
        context.tables.Config = Config;

        mockChannel = {
            isTextBased: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({}),
            permissionsFor: jest.fn().mockReturnValue({
                has: jest.fn().mockReturnValue(true),
            }),
        };

        member = {
            id: 'newmember123',
            user: { tag: 'newuser#1234' },
            guild: {
                id: 'guild123',
                name: 'Test Server',
                memberCount: 100,
                channels: {
                    cache: new Map([['welcome123', mockChannel]]),
                },
                members: {
                    me: { id: 'bot123' },
                },
            },
        };
    });

    describe('event metadata', () => {
        it('should have correct event name', () => {
            expect(guildMemberAddEvent.name).toBe(Events.GuildMemberAdd);
        });
    });

    describe('configuration checks', () => {
        it('should return early if no welcome channel configured', async () => {
            Config.findOne.mockResolvedValue(null);

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.debug).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'guild123' }),
                'No welcome channel configured',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if no welcome message configured', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' }) // welcome channel
                .mockResolvedValueOnce(null); // no welcome message

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.debug).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'guild123' }),
                'No welcome message configured',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if channel not found', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'nonexistent' })
                .mockResolvedValueOnce({ value: 'Welcome!' });

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ welcomeChannelId: 'nonexistent' }),
                'Welcome channel not found or not text-based',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if channel is not text-based', async () => {
            mockChannel.isTextBased.mockReturnValue(false);
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' });

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ welcomeChannelId: 'welcome123' }),
                'Welcome channel not found or not text-based',
            );
        });

        it('should return early if bot lacks SendMessages permission', async () => {
            mockChannel.permissionsFor.mockReturnValue({
                has: jest.fn().mockReturnValue(false),
            });
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' });

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ welcomeChannelId: 'welcome123' }),
                'Bot lacks SendMessages permission in welcome channel',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if bot member not found', async () => {
            member.guild.members.me = null;
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' });

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ welcomeChannelId: 'welcome123' }),
                'Bot lacks SendMessages permission in welcome channel',
            );
        });
    });

    describe('message formatting', () => {
        beforeEach(() => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome {user} to {server}! We now have {memberCount} members.' });
        });

        it('should replace {user} placeholder with mention', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.stringContaining('<@newmember123>'),
            );
        });

        it('should replace {server} placeholder with guild name', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.stringContaining('Test Server'),
            );
        });

        it('should replace {memberCount} placeholder with count', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.stringContaining('100'),
            );
        });

        it('should replace all placeholders correctly', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith(
                'Welcome <@newmember123> to Test Server! We now have 100 members.',
            );
        });

        it('should handle message without placeholders', async () => {
            Config.findOne.mockReset();
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Hello there!' });

            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith('Hello there!');
        });

        it('should handle multiple occurrences of same placeholder', async () => {
            Config.findOne.mockReset();
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: '{user} {user} {user}' });

            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith(
                '<@newmember123> <@newmember123> <@newmember123>',
            );
        });
    });

    describe('successful execution', () => {
        beforeEach(() => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' });
        });

        it('should send welcome message', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith('Welcome!');
        });

        it('should log successful welcome message', async () => {
            await guildMemberAddEvent.execute(member, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: 'guild123',
                    userId: 'newmember123',
                    username: 'newuser#1234',
                    channelId: 'welcome123',
                }),
                'Sent welcome message',
            );
        });
    });

    describe('error handling', () => {
        it('should handle channel.send errors gracefully', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' });
            mockChannel.send.mockRejectedValue(new Error('Failed to send'));

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    guildId: 'guild123',
                    userId: 'newmember123',
                }),
                'Error sending welcome message',
            );
        });

        it('should handle database errors gracefully', async () => {
            Config.findOne.mockRejectedValue(new Error('Database error'));

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                'Error sending welcome message',
            );
        });
    });
});
