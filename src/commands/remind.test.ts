import remind from './remind';

describe('commands/remind', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getBoolean: jest.fn(),
                getFocused: jest.fn(),
            },
            reply: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined),
            replied: false,
            deferred: false,
            user: { id: 'user123' },
            guildId: 'guild123',
            channelId: 'channel123',
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            schedulerService: {
                scheduleEvent: jest.fn().mockResolvedValue({
                    eventId: 'abc12345',
                    executeAt: new Date(Date.now() + 3600000),
                }),
                listEvents: jest.fn().mockResolvedValue([]),
                cancelEvent: jest.fn().mockResolvedValue(true),
            },
        };
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(remind.data.name).toBe('remind');
            expect(remind.data.description).toBe('Set reminders for yourself or the channel');
        });

        it('should have all required subcommands', () => {
            const subcommands = (remind.data as any).options.map((opt: any) => opt.name);
            expect(subcommands).toContain('me');
            expect(subcommands).toContain('channel');
            expect(subcommands).toContain('list');
            expect(subcommands).toContain('cancel');
        });
    });

    describe('Execute - remind me', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('me');
        });

        it('should create a personal reminder successfully', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('in 2 hours')  // when
                .mockReturnValueOnce('Test reminder');  // message
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: 'guild123',
                    channelId: 'channel123',
                    creatorId: 'user123',
                    eventType: 'reminder',
                    scheduleType: 'once',
                    payload: expect.objectContaining({
                        message: 'Test reminder',
                        mentionUser: true,
                        sendDm: false,
                    }),
                }),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                    ephemeral: true,
                }),
            );
        });

        it('should create a DM reminder when dm option is true', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('in 1 hour')
                .mockReturnValueOnce('DM reminder');
            mockInteraction.options.getBoolean.mockReturnValue(true);

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    channelId: null, // DM reminders have null channelId
                    payload: expect.objectContaining({
                        sendDm: true,
                    }),
                }),
            );
        });

        it('should reject invalid time input', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('not a valid time')
                .mockReturnValueOnce('Test message');
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Could not understand'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle missing scheduler service', async () => {
            mockContext.schedulerService = undefined;
            mockInteraction.options.getString
                .mockReturnValueOnce('in 2 hours')
                .mockReturnValueOnce('Test message');
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await remind.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not available'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Execute - remind channel', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('channel');
        });

        it('should create a channel reminder successfully', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('tomorrow at 3pm')
                .mockReturnValueOnce('Channel reminder');

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    channelId: 'channel123',
                    payload: expect.objectContaining({
                        mentionUser: false,
                        sendDm: false,
                    }),
                }),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                }),
            );
        });
    });

    describe('Execute - remind list', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
        });

        it('should show message when no reminders exist', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([]);

            await remind.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'You have no active reminders.',
                    ephemeral: true,
                }),
            );
        });

        it('should list active reminders', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'abc12345',
                    executeAt: new Date(Date.now() + 3600000),
                    channelId: 'channel123',
                    payload: JSON.stringify({
                        message: 'Test reminder',
                        mentionUser: true,
                        sendDm: false,
                    }),
                },
            ]);

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.listEvents).toHaveBeenCalledWith(
                'guild123',
                expect.objectContaining({
                    creatorId: 'user123',
                    eventType: 'reminder',
                    status: 'active',
                }),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Execute - remind cancel', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('cancel');
        });

        it('should cancel a reminder successfully', async () => {
            mockInteraction.options.getString.mockReturnValue('abc12345');
            mockContext.schedulerService.cancelEvent.mockResolvedValue(true);

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.cancelEvent).toHaveBeenCalledWith(
                'abc12345',
                'user123',
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('cancelled'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle reminder not found', async () => {
            mockInteraction.options.getString.mockReturnValue('notfound');
            mockContext.schedulerService.cancelEvent.mockResolvedValue(false);

            await remind.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not found'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Autocomplete', () => {
        it('should provide reminder suggestions for cancel', async () => {
            mockInteraction.options.getFocused.mockReturnValue({ name: 'reminder_id', value: '' });
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'abc12345',
                    payload: JSON.stringify({ message: 'Test reminder' }),
                },
            ]);

            await remind.autocomplete(mockInteraction, mockContext);

            expect(mockInteraction.respond).toHaveBeenCalledWith([
                expect.objectContaining({
                    name: expect.stringContaining('abc12345'),
                    value: 'abc12345',
                }),
            ]);
        });

        it('should handle missing scheduler service in autocomplete', async () => {
            mockContext.schedulerService = undefined;
            mockInteraction.options.getFocused.mockReturnValue({ name: 'reminder_id', value: '' });

            await remind.autocomplete(mockInteraction, mockContext);

            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('me');
            mockInteraction.options.getString
                .mockReturnValueOnce('in 2 hours')
                .mockReturnValueOnce('Test');
            mockInteraction.options.getBoolean.mockReturnValue(false);
            mockContext.schedulerService.scheduleEvent.mockRejectedValue(new Error('Test error'));

            await remind.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true,
                }),
            );
        });
    });
});
