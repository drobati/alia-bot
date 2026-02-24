import birthday from './birthday';

describe('commands/birthday', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getUser: jest.fn(),
                getBoolean: jest.fn(),
                getFocused: jest.fn(),
            },
            reply: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined),
            replied: false,
            deferred: false,
            user: { id: 'user123', username: 'TestUser', displayName: 'Test User' },
            guildId: 'guild123',
            channelId: 'channel123',
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            tables: {
                Config: {
                    findOne: jest.fn().mockResolvedValue(null),
                },
            },
            schedulerService: {
                scheduleEvent: jest.fn().mockResolvedValue({
                    eventId: 'bday1234',
                }),
                listEvents: jest.fn().mockResolvedValue([]),
                cancelEvent: jest.fn().mockResolvedValue(true),
                getEvent: jest.fn(),
            },
        };
    });

    describe('Command Data', () => {
        it('should have correct name', () => {
            expect(birthday.data.name).toBe('birthday');
        });

        it('should have all subcommands', () => {
            const subcommands = (birthday.data as any).options.map((opt: any) => opt.name);
            expect(subcommands).toContain('set');
            expect(subcommands).toContain('list');
            expect(subcommands).toContain('remove');
        });

        it('should not have a user option on set (self-only)', () => {
            const setSubcommand = (birthday.data as any).options.find((opt: any) => opt.name === 'set');
            const optionNames = setSubcommand.options.map((opt: any) => opt.name);
            expect(optionNames).not.toContain('user');
            expect(optionNames).toContain('date');
        });

        it('should not have a birthday_id option on remove (self-only)', () => {
            const removeSubcommand = (birthday.data as any).options.find((opt: any) => opt.name === 'remove');
            expect(removeSubcommand.options).toHaveLength(0);
        });

        it('should not have autocomplete', () => {
            expect((birthday as any).autocomplete).toBeUndefined();
        });
    });

    describe('Execute - birthday set', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('set');
        });

        it('should register the calling user\'s birthday', async () => {
            mockInteraction.options.getString.mockReturnValue('03-15');

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: 'birthday',
                    scheduleType: 'cron',
                    cronSchedule: '0 9 15 3 *',
                    channelId: null, // channel comes from config
                    creatorId: 'user123',
                    payload: expect.objectContaining({
                        userId: 'user123',
                        username: 'Test User',
                        birthDate: '03-15',
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

        it('should reject invalid date format', async () => {
            mockInteraction.options.getString.mockReturnValue('March 15');

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Invalid date format'),
                    ephemeral: true,
                }),
            );
        });

        it('should reject month 13', async () => {
            mockInteraction.options.getString.mockReturnValue('13-01');

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
        });

        it('should reject duplicate birthday for same user', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'existing',
                    payload: JSON.stringify({ userId: 'user123', username: 'Test', birthDate: '03-15' }),
                },
            ]);

            mockInteraction.options.getString.mockReturnValue('03-15');

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.scheduleEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already have a birthday registered'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle missing scheduler service', async () => {
            mockContext.schedulerService = undefined;
            mockInteraction.options.getString.mockReturnValue('03-15');

            await birthday.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not available'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Execute - birthday remove', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('remove');
        });

        it('should remove the calling user\'s birthday', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'bday1234',
                    payload: JSON.stringify({ userId: 'user123', username: 'Test User', birthDate: '03-15' }),
                },
            ]);

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.cancelEvent).toHaveBeenCalledWith('bday1234');
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Removed your birthday'),
                    ephemeral: true,
                }),
            );
        });

        it('should tell user when no birthday is registered', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([]);

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.schedulerService.cancelEvent).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining("don't have a birthday registered"),
                    ephemeral: true,
                }),
            );
        });

        it('should not remove another user\'s birthday', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'bday9999',
                    payload: JSON.stringify({ userId: 'other-user', username: 'Other', birthDate: '06-01' }),
                },
            ]);

            await birthday.execute(mockInteraction, mockContext);

            // user123's birthday not found among results
            expect(mockContext.schedulerService.cancelEvent).not.toHaveBeenCalled();
        });
    });

    describe('Execute - birthday list', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
        });

        it('should show message when no birthdays', async () => {
            await birthday.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'No birthdays registered in this server.',
                    ephemeral: true,
                }),
            );
        });

        it('should list birthdays sorted by date', async () => {
            mockContext.schedulerService.listEvents.mockResolvedValue([
                {
                    eventId: 'bday2',
                    payload: JSON.stringify({ userId: 'user2', username: 'Bob', birthDate: '12-25' }),
                },
                {
                    eventId: 'bday1',
                    payload: JSON.stringify({ userId: 'user1', username: 'Alice', birthDate: '01-01' }),
                },
            ]);

            await birthday.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('set');
            mockInteraction.options.getString.mockReturnValue('03-15');
            mockContext.schedulerService.scheduleEvent.mockRejectedValue(new Error('DB error'));

            await birthday.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });
});
