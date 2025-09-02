import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { SlashCommandBuilder } from 'discord.js';
import fortuneCommand from './fortune';

describe('fortune command', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            commandName: 'fortune',
            user: {
                id: 'test-user-id',
                username: 'testuser',
            },
            guild: {
                id: 'test-guild-id',
            },
            options: {
                getBoolean: jest.fn(),
            },
            reply: jest.fn(),
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
        };
    });

    it('should have correct command data', () => {
        expect(fortuneCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(fortuneCommand.data.name).toBe('fortune');
        expect(fortuneCommand.data.description).toBe('Receive a fortune cookie message');
    });

    it('should send private fortune by default', async () => {
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await fortuneCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('🥠 **Your Fortune Cookie** 🥠'),
            ephemeral: true,
        });

        // Verify the fortune message structure
        const replyCall = mockInteraction.reply.mock.calls[0][0];
        expect(replyCall.content).toContain('Lucky Numbers:');
        expect(replyCall.content).toContain('Lucky Color:');
        expect(replyCall.content).toContain('Fortune Level:');
    });

    it('should send public fortune when requested', async () => {
        mockInteraction.options.getBoolean.mockReturnValue(true);

        await fortuneCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('🥠 **Your Fortune Cookie** 🥠'),
            ephemeral: false,
        });
    });

    it('should include fortune quote in message', async () => {
        await fortuneCommand.execute(mockInteraction, mockContext);

        const replyCall = mockInteraction.reply.mock.calls[0][0];
        // Check that a fortune quote is included (wrapped in quotes)
        expect(replyCall.content).toMatch(/\*".*"\*/);
    });

    it('should generate lucky numbers', async () => {
        await fortuneCommand.execute(mockInteraction, mockContext);

        const replyCall = mockInteraction.reply.mock.calls[0][0];
        // Lucky numbers should be 6 numbers between 1-49, separated by commas
        const luckyNumbersMatch = replyCall.content.match(/Lucky Numbers:\*\* ([\d, ]+)/);
        expect(luckyNumbersMatch).toBeTruthy();

        if (luckyNumbersMatch) {
            const numbers = luckyNumbersMatch[1].split(', ').map(Number);
            expect(numbers).toHaveLength(6);
            numbers.forEach((num: number) => {
                expect(num).toBeGreaterThanOrEqual(1);
                expect(num).toBeLessThanOrEqual(49);
            });
            // Numbers should be sorted
            for (let i = 1; i < numbers.length; i++) {
                expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
            }
        }
    });

    it('should include random color', async () => {
        await fortuneCommand.execute(mockInteraction, mockContext);

        const replyCall = mockInteraction.reply.mock.calls[0][0];
        expect(replyCall.content).toMatch(/Lucky Color:\*\* .+ [🔴🔵🟢🟡🟣🟠🩷⭐🌙🌈⚫⚪]/u);
    });

    it('should include fortune level', async () => {
        await fortuneCommand.execute(mockInteraction, mockContext);

        const replyCall = mockInteraction.reply.mock.calls[0][0];
        expect(replyCall.content).toMatch(/Fortune Level:\*\* .+ [⚡💎💫✨⭐🙏🍀🎯🎊]/u);
    });

    it('should log fortune execution', async () => {
        mockInteraction.options.getBoolean.mockReturnValue(true);

        await fortuneCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.info).toHaveBeenCalledWith(
            'Fortune command executed',
            expect.objectContaining({
                userId: 'test-user-id',
                username: 'testuser',
                guildId: 'test-guild-id',
                isPublic: true,
                fortune: expect.any(String),
            }),
        );
    });

    it('should handle errors gracefully', async () => {
        const error = new Error('Test error');
        mockInteraction.reply.mockRejectedValueOnce(error);

        await fortuneCommand.execute(mockInteraction, mockContext);

        // First call fails, second call should be the error message
        expect(mockInteraction.reply).toHaveBeenCalledTimes(2);
        expect(mockInteraction.reply).toHaveBeenLastCalledWith({
            content: '❌ The fortune spirits are not responding. Please try again later.',
            ephemeral: true,
        });

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Fortune command failed',
            expect.objectContaining({
                userId: 'test-user-id',
                error: error,
            }),
        );
    });

    it('should work without guild context', async () => {
        mockInteraction.guild = null;

        await fortuneCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('🥠 **Your Fortune Cookie** 🥠'),
            ephemeral: true,
        });

        expect(mockContext.log.info).toHaveBeenCalledWith(
            'Fortune command executed',
            expect.objectContaining({
                guildId: undefined,
            }),
        );
    });

    it('should vary fortunes on multiple executions', async () => {
        const fortunes = new Set();

        // Execute multiple times to check for variety
        for (let i = 0; i < 10; i++) {
            jest.clearAllMocks();
            await fortuneCommand.execute(mockInteraction, mockContext);

            const replyCall = mockInteraction.reply.mock.calls[0][0];
            const fortuneMatch = replyCall.content.match(/\*"(.*)"\*/);
            if (fortuneMatch) {
                fortunes.add(fortuneMatch[1]);
            }
        }

        // With 50+ fortunes and 10 executions, we should get some variety
        // (there's a small chance of getting the same fortune multiple times)
        expect(fortunes.size).toBeGreaterThan(1);
    });
});