import { createContext, createTable } from "../src/utils/testHelpers";
import guildMemberAddEvent from "./guildMemberAdd";
import { Events } from "discord.js";

describe('events/guildMemberAdd', () => {
    let context: any;
    let member: any;
    let Config: any;
    let mockChannel: any;
    let mockLogChannel: any;

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

        mockLogChannel = {
            isTextBased: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({}),
            permissionsFor: jest.fn().mockReturnValue({
                has: jest.fn().mockReturnValue(true),
            }),
        };

        member = {
            id: 'newmember123',
            user: {
                tag: 'newuser#1234',
                displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
                createdTimestamp: Date.now() - 86400000, // 1 day ago
            },
            guild: {
                id: 'guild123',
                name: 'Test Server',
                memberCount: 100,
                channels: {
                    cache: new Map([
                        ['welcome123', mockChannel],
                        ['log123', mockLogChannel],
                    ]),
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
            // No welcome channel, no log channel
            Config.findOne.mockResolvedValue(null);

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'guild123', category: 'member_join' }),
                'No welcome channel configured - skipping welcome message',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if no welcome message configured', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' }) // welcome channel
                .mockResolvedValueOnce(null) // no welcome message
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ guildId: 'guild123', category: 'member_join' }),
                'No welcome message configured - skipping welcome message',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if channel not found', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'nonexistent' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    welcomeChannelId: 'nonexistent',
                    category: 'member_join',
                }),
                'Welcome channel not found or not text-based',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if channel is not text-based', async () => {
            mockChannel.isTextBased.mockReturnValue(false);
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    welcomeChannelId: 'welcome123',
                    category: 'member_join',
                }),
                'Welcome channel not found or not text-based',
            );
        });

        it('should return early if bot lacks SendMessages permission', async () => {
            mockChannel.permissionsFor.mockReturnValue({
                has: jest.fn().mockReturnValue(false),
            });
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    welcomeChannelId: 'welcome123',
                    category: 'member_join',
                }),
                'Bot lacks SendMessages permission in welcome channel',
            );
            expect(mockChannel.send).not.toHaveBeenCalled();
        });

        it('should return early if bot member not found', async () => {
            member.guild.members.me = null;
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    welcomeChannelId: 'welcome123',
                    category: 'member_join',
                }),
                'Bot lacks SendMessages permission in welcome channel',
            );
        });
    });

    describe('message formatting', () => {
        beforeEach(() => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({
                    value: 'Welcome {user} to {server}! We now have {memberCount} members.',
                })
                .mockResolvedValueOnce(null); // no log channel
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
                .mockResolvedValueOnce({ value: 'Hello there!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith('Hello there!');
        });

        it('should handle multiple occurrences of same placeholder', async () => {
            Config.findOne.mockReset();
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: '{user} {user} {user}' })
                .mockResolvedValueOnce(null); // no log channel

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
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel
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
                    category: 'member_join',
                }),
                'Sent welcome message successfully',
            );
        });
    });

    describe('error handling', () => {
        it('should handle channel.send errors gracefully', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel
            mockChannel.send.mockRejectedValue(new Error('Failed to send'));

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    guildId: 'guild123',
                    userId: 'newmember123',
                    category: 'member_join',
                }),
                'Error processing member join event',
            );
        });

        it('should handle database errors gracefully', async () => {
            Config.findOne.mockReset();
            // First call throws, subsequent calls return null (for log channel)
            let callCount = 0;
            Config.findOne.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Database error');
                }
                return Promise.resolve(null);
            });

            await guildMemberAddEvent.execute(member, context);

            expect(context.log.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    category: 'member_join',
                }),
                'Error processing member join event',
            );
        });
    });

    describe('log channel functionality', () => {
        it('should send log message when log channel is configured', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' }) // welcome channel
                .mockResolvedValueOnce({ value: 'Welcome!' }) // welcome message
                .mockResolvedValueOnce({ value: 'log123' }); // log channel

            await guildMemberAddEvent.execute(member, context);

            // Should send to both welcome and log channels
            expect(mockChannel.send).toHaveBeenCalledWith('Welcome!');
            expect(mockLogChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                }),
            );
        });

        it('should not send log message when log channel is not configured', async () => {
            Config.findOne
                .mockResolvedValueOnce({ value: 'welcome123' })
                .mockResolvedValueOnce({ value: 'Welcome!' })
                .mockResolvedValueOnce(null); // no log channel

            await guildMemberAddEvent.execute(member, context);

            expect(mockChannel.send).toHaveBeenCalledWith('Welcome!');
            expect(mockLogChannel.send).not.toHaveBeenCalled();
        });

        it('should include welcome status in log message', async () => {
            Config.findOne
                .mockResolvedValueOnce(null) // no welcome channel
                .mockResolvedValueOnce({ value: 'log123' }); // log channel

            await guildMemberAddEvent.execute(member, context);

            expect(mockLogChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: 'Member Joined',
                            }),
                        }),
                    ]),
                }),
            );
        });
    });
});
