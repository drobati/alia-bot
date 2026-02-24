import hype from './hype';

describe('commands/hype', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getUser: jest.fn(),
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
                    executeAt: new Date(Date.now() + 86400000),
                }),
                listEvents: jest.fn().mockResolvedValue([]),
                cancelEvent: jest.fn().mockResolvedValue(true),
                getEvent: jest.fn(),
            },
        };
    });

    describe('Command Data', () => {
        it('should have correct name', () => {
            expect(hype.data.name).toBe('hype');
        });

        it('should have all subcommands', () => {
            const subcommands = (hype.data as any).options.map((opt: any) => opt.name);
            expect(subcommands).toContain('create');
            expect(subcommands).toContain('list');
            expect(subcommands).toContain('cancel');
        });
    });

    describe('Execute - hype create', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('create');
        });

        it('should create a hype event with default intervals', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('Game Night')           // name
                .mockReturnValueOnce('in 2 days')            // when
                .mockReturnValueOnce(null)                   // description
                .mockReturnValueOnce(null);                  // intervals

            await hype.execute(mockInteraction, mockContext);

            // Default intervals: 24h, 1h, 15m, now — all should be in future for "in 2 days"
            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledTimes(4);
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                }),
            );
        });

        it('should create a hype event with custom intervals', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('Launch Party')
                .mockReturnValueOnce('in 3 days')
                .mockReturnValueOnce('Product launch!')
                .mockReturnValueOnce('48h,12h,1h');

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledTimes(3);
            // Verify all events have the hype type
            const calls = mockContext.schedulerService.scheduleEvent.mock.calls;
            for (const call of calls) {
                expect(call[0].eventType).toBe('hype');
            }
        });

        it('should reject invalid time input', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('Event')
                .mockReturnValueOnce('not a valid time')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Could not understand'),
                    ephemeral: true,
                }),
            );
        });

        it('should reject invalid interval format', async () => {
            mockInteraction.options.getString
                .mockReturnValueOnce('Event')
                .mockReturnValueOnce('in 2 days')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce('24h,invalid,1h');

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Invalid interval'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle missing scheduler service', async () => {
            mockContext.schedulerService = undefined;
            mockInteraction.options.getString
                .mockReturnValueOnce('Event')
                .mockReturnValueOnce('in 2 days')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);

            await hype.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not available'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Execute - hype list', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
        });

        it('should show message when no hype events', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([]);

            await hype.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'No active hype events.',
                    ephemeral: true,
                }),
            );
        });

        it('should list active hype events grouped', async () => {
            const eventTime = new Date(Date.now() + 86400000).toISOString();
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'evt1',
                    creatorId: 'user123',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        eventTime,
                        hypeGroupId: 'grp1',
                        announcementTier: '24h',
                        showCountdown: true,
                        announceAt: ['24h', '1h'],
                    }),
                },
                {
                    eventId: 'evt2',
                    creatorId: 'user123',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        eventTime,
                        hypeGroupId: 'grp1',
                        announcementTier: '1h',
                        showCountdown: true,
                        announceAt: ['24h', '1h'],
                    }),
                },
            ]);

            await hype.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Execute - hype cancel', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('cancel');
        });

        it('should cancel all events in a hype group', async () => {
            mockInteraction.options.getString.mockReturnValue('grp12345');
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'evt1',
                    creatorId: 'user123',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        hypeGroupId: 'grp12345',
                        announcementTier: '24h',
                        eventTime: new Date().toISOString(),
                        showCountdown: true,
                        announceAt: ['24h'],
                    }),
                },
                {
                    eventId: 'evt2',
                    creatorId: 'user123',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        hypeGroupId: 'grp12345',
                        announcementTier: '1h',
                        eventTime: new Date().toISOString(),
                        showCountdown: true,
                        announceAt: ['1h'],
                    }),
                },
            ]);

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.cancelEvent).toHaveBeenCalledTimes(2);
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Cancelled'),
                    ephemeral: true,
                }),
            );
        });

        it('should reject cancellation by non-owner', async () => {
            mockInteraction.options.getString.mockReturnValue('grp12345');
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'evt1',
                    creatorId: 'other-user',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        hypeGroupId: 'grp12345',
                        announcementTier: '24h',
                        eventTime: new Date().toISOString(),
                        showCountdown: true,
                        announceAt: ['24h'],
                    }),
                },
            ]);

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.cancelEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('only cancel'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle not found', async () => {
            mockInteraction.options.getString.mockReturnValue('nonexistent');
            mockContext.schedulerService.listEvents.mockResolvedValue([]);

            await hype.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not found'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Autocomplete', () => {
        it('should provide hype group suggestions', async () => {
            mockInteraction.options.getFocused.mockReturnValue({ name: 'hype_id', value: '' });
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'evt1',
                    payload: JSON.stringify({
                        eventName: 'Game Night',
                        hypeGroupId: 'grp12345',
                        announcementTier: '24h',
                        eventTime: new Date().toISOString(),
                        showCountdown: true,
                        announceAt: ['24h'],
                    }),
                },
            ]);

            await hype.autocomplete(mockInteraction, mockContext);

            expect(mockInteraction.respond).toHaveBeenCalledWith([
                expect.objectContaining({
                    name: expect.stringContaining('grp12345'),
                    value: 'grp12345',
                }),
            ]);
        });

        it('should handle missing scheduler service', async () => {
            mockContext.schedulerService = undefined;
            mockInteraction.options.getFocused.mockReturnValue({ name: 'hype_id', value: '' });

            await hype.autocomplete(mockInteraction, mockContext);

            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString
                .mockReturnValueOnce('Event')
                .mockReturnValueOnce('in 2 days')
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);
            mockContext.schedulerService.scheduleEvent.mockRejectedValue(new Error('DB error'));

            await hype.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });
});
