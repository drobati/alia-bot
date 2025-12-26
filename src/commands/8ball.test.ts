import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (question: string) => ({
    options: {
        getString: jest.fn<any>().mockReturnValue(question),
    },
    reply: jest.fn<any>(),
    user: {
        id: 'test-user-id',
        username: 'testuser',
    },
});

describe('8ball Command', () => {
    let eightBallCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        eightBallCommand = (await import('./8ball')).default;
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(eightBallCommand.data.name).toBe('8ball');
            expect(eightBallCommand.data.description).toContain('Magic 8-Ball');
        });

        it('should have a required question option', () => {
            const options = eightBallCommand.data.options;
            const questionOption = options.find((opt: any) => opt.name === 'question');
            expect(questionOption).toBeDefined();
            expect(questionOption.required).toBe(true);
        });
    });

    describe('Execute', () => {
        it('should reply with an embed', async () => {
            const mockInteraction = createMockInteraction('Will I win the lottery?');

            await eightBallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it('should include the question in the response', async () => {
            const question = 'Is today a good day?';
            const mockInteraction = createMockInteraction(question);

            await eightBallCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fields = embed.data.fields;

            const questionField = fields.find((f: any) => f.name.includes('Question'));
            expect(questionField.value).toBe(question);
        });

        it('should include an answer in the response', async () => {
            const mockInteraction = createMockInteraction('Should I do it?');

            await eightBallCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fields = embed.data.fields;

            const answerField = fields.find((f: any) => f.name.includes('Answer'));
            expect(answerField).toBeDefined();
            expect(answerField.value.length).toBeGreaterThan(0);
        });

        it('should have Magic 8-Ball title', async () => {
            const mockInteraction = createMockInteraction('Will it rain?');

            await eightBallCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain('Magic 8-Ball');
        });

        it('should log the command usage', async () => {
            const mockInteraction = createMockInteraction('Is this a test?');

            await eightBallCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                '8ball command used',
                expect.objectContaining({
                    userId: 'test-user-id',
                    question: expect.any(String),
                    response: expect.any(String),
                    responseType: expect.stringMatching(/positive|neutral|negative/),
                }),
            );
        });

        it('should set embed color based on response type', async () => {
            const mockInteraction = createMockInteraction('Test question');

            await eightBallCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            // Color should be one of: green (0x00ff00), yellow (0xffff00), or red (0xff0000)
            expect([0x00ff00, 0xffff00, 0xff0000]).toContain(embed.data.color);
        });
    });
});
