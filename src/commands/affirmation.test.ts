import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (targetUser: any = null) => ({
    options: {
        getUser: jest.fn<any>().mockReturnValue(targetUser),
    },
    reply: jest.fn<any>(),
    user: {
        id: 'test-user-id',
        username: 'testuser',
    },
});

const mockTargetUser = {
    id: 'target-user-id',
    username: 'targetuser',
    displayAvatarURL: jest.fn<any>().mockReturnValue('https://example.com/avatar.png'),
};

describe('Affirmation Command', () => {
    let affirmationCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        affirmationCommand = (await import('./affirmation')).default;
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(affirmationCommand.data.name).toBe('affirmation');
            expect(affirmationCommand.data.description).toContain('affirmation');
        });

        it('should have optional user option', () => {
            const options = affirmationCommand.data.options;
            const userOption = options.find((opt: any) => opt.name === 'user');
            expect(userOption).toBeDefined();
            expect(userOption.required).toBe(false);
        });
    });

    describe('Execute - Self Affirmation', () => {
        it('should reply with an embed when no user specified', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it('should have Affirmation in title', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain('Affirmation');
        });

        it('should include self-love footer when affirming self', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.footer.text).toContain('Self-love');
        });

        it('should log with isSelf true', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'affirmation command used',
                expect.objectContaining({
                    userId: 'test-user-id',
                    targetUserId: 'test-user-id',
                    isSelf: true,
                }),
            );
        });
    });

    describe('Execute - Affirming Another User', () => {
        it('should reply with embed when target user specified', async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await affirmationCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it('should include sender in footer when affirming another', async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.footer.text).toContain('testuser');
        });

        it('should use target user avatar as thumbnail', async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await affirmationCommand.execute(mockInteraction, mockContext);

            expect(mockTargetUser.displayAvatarURL).toHaveBeenCalledWith({ size: 128 });
        });

        it('should log with isSelf false', async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await affirmationCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'affirmation command used',
                expect.objectContaining({
                    userId: 'test-user-id',
                    targetUserId: 'target-user-id',
                    isSelf: false,
                }),
            );
        });
    });

    describe('Embed Properties', () => {
        it('should set pink color', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.color).toBe(0xff69b4);
        });

        it('should include username in description', async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.description).toContain('targetuser');
        });

        it('should have timestamp', async () => {
            const mockInteraction = createMockInteraction(null);
            (mockInteraction.user as any).displayAvatarURL = jest.fn<any>()
                .mockReturnValue('https://example.com/avatar.png');

            await affirmationCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.timestamp).toBeDefined();
        });
    });
});
