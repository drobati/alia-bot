import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (choice: string) => ({
    options: {
        getString: jest.fn<any>().mockReturnValue(choice),
    },
    reply: jest.fn<any>(),
    user: {
        id: 'test-user-id',
        username: 'testuser',
    },
});

describe('RPS Command', () => {
    let rpsCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        rpsCommand = (await import('./rps')).default;
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(rpsCommand.data.name).toBe('rps');
            expect(rpsCommand.data.description).toContain('Rock-Paper-Scissors');
        });

        it('should have choice option with three choices', () => {
            const options = rpsCommand.data.options;
            const choiceOption = options.find((opt: any) => opt.name === 'choice');
            expect(choiceOption).toBeDefined();
            expect(choiceOption.required).toBe(true);
            expect(choiceOption.choices).toHaveLength(3);
        });

        it('should have rock, paper, and scissors as choices', () => {
            const options = rpsCommand.data.options;
            const choiceOption = options.find((opt: any) => opt.name === 'choice');
            const choiceValues = choiceOption.choices.map((c: any) => c.value);
            expect(choiceValues).toContain('rock');
            expect(choiceValues).toContain('paper');
            expect(choiceValues).toContain('scissors');
        });
    });

    describe('Execute', () => {
        it('should reply with an embed for rock', async () => {
            const mockInteraction = createMockInteraction('rock');

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it('should reply with an embed for paper', async () => {
            const mockInteraction = createMockInteraction('paper');

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
        });

        it('should reply with an embed for scissors', async () => {
            const mockInteraction = createMockInteraction('scissors');

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
        });

        it('should have Rock-Paper-Scissors in title', async () => {
            const mockInteraction = createMockInteraction('rock');

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain('Rock-Paper-Scissors');
        });

        it('should include player username in embed fields', async () => {
            const mockInteraction = createMockInteraction('rock');

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fieldNames = embed.data.fields.map((f: any) => f.name);
            expect(fieldNames).toContain('testuser');
        });

        it('should include bot name in embed fields', async () => {
            const mockInteraction = createMockInteraction('rock');

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fieldNames = embed.data.fields.map((f: any) => f.name);
            expect(fieldNames).toContain('Alia');
        });

        it('should set embed color based on result', async () => {
            const mockInteraction = createMockInteraction('rock');

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            // Color should be one of: green (win), red (lose), or yellow (tie)
            expect([0x00ff00, 0xff0000, 0xffff00]).toContain(embed.data.color);
        });

        it('should log the command usage', async () => {
            const mockInteraction = createMockInteraction('scissors');

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'rps command used',
                expect.objectContaining({
                    userId: 'test-user-id',
                    playerChoice: 'scissors',
                    botChoice: expect.stringMatching(/rock|paper|scissors/),
                    result: expect.stringMatching(/win|lose|tie/),
                }),
            );
        });
    });
});
