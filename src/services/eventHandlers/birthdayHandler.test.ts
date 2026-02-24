import { BirthdayHandler, birthdayToCron } from './birthdayHandler';
import { BirthdayPayload } from '../../models/scheduledEvent';

describe('BirthdayHandler', () => {
    let mockChannel: any;
    let mockCtx: any;

    const basePayload: BirthdayPayload = {
        userId: 'user456',
        username: 'TestUser',
        birthDate: '03-15',
    };

    beforeEach(() => {
        mockChannel = {
            send: jest.fn().mockResolvedValue(undefined),
            isTextBased: jest.fn().mockReturnValue(true),
        };
        mockCtx = {
            event: {
                eventId: 'bday1234',
                eventType: 'birthday',
                creatorId: 'user123',
                guildId: 'guild123',
                channelId: null,
                payload: JSON.stringify(basePayload),
            },
            client: {
                channels: {
                    cache: {
                        get: jest.fn(),
                    },
                },
            },
            context: {
                log: { info: jest.fn(), error: jest.fn() },
                tables: {
                    Config: {
                        findOne: jest.fn().mockResolvedValue(null),
                    },
                },
            },
            channel: mockChannel,
            payload: basePayload,
        };
    });

    describe('type', () => {
        it('should be "birthday"', () => {
            expect(BirthdayHandler.type).toBe('birthday');
        });
    });

    describe('execute', () => {
        it('should send a birthday message when channel is provided', async () => {
            const result = await BirthdayHandler.execute(mockCtx);

            expect(result.success).toBe(true);
            expect(result.shouldReschedule).toBe(true);
            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: '<@user456>',
                    embeds: expect.any(Array),
                }),
            );
        });

        it('should mention the birthday person', async () => {
            await BirthdayHandler.execute(mockCtx);

            const sendCall = mockChannel.send.mock.calls[0][0];
            expect(sendCall.content).toBe('<@user456>');
        });

        it('should include username in title', async () => {
            await BirthdayHandler.execute(mockCtx);

            const embedData = mockChannel.send.mock.calls[0][0].embeds[0].data;
            expect(embedData.title).toContain('TestUser');
        });

        it('should use custom message when provided', async () => {
            const customPayload = { ...basePayload, customMessage: 'You rock!' };
            mockCtx.payload = customPayload;

            await BirthdayHandler.execute(mockCtx);

            const embedData = mockChannel.send.mock.calls[0][0].embeds[0].data;
            expect(embedData.description).toBe('You rock!');
        });

        it('should use a random default message when no custom message', async () => {
            await BirthdayHandler.execute(mockCtx);

            const embedData = mockChannel.send.mock.calls[0][0].embeds[0].data;
            expect(embedData.description).toBeTruthy();
            expect(typeof embedData.description).toBe('string');
        });

        it('should look up birthday channel from config when ctx.channel is null', async () => {
            mockCtx.channel = null;
            const configChannel = {
                send: jest.fn().mockResolvedValue(undefined),
                isTextBased: jest.fn().mockReturnValue(true),
            };
            mockCtx.context.tables.Config.findOne.mockResolvedValue({ value: 'config-channel-id' });
            mockCtx.client.channels.cache.get.mockReturnValue(configChannel);

            const result = await BirthdayHandler.execute(mockCtx);

            expect(result.success).toBe(true);
            expect(mockCtx.context.tables.Config.findOne).toHaveBeenCalledWith({
                where: { key: 'birthday_channel_guild123' },
            });
            expect(mockCtx.client.channels.cache.get).toHaveBeenCalledWith('config-channel-id');
            expect(configChannel.send).toHaveBeenCalled();
        });

        it('should fail when no channel and no config', async () => {
            mockCtx.channel = null;
            mockCtx.context.tables.Config.findOne.mockResolvedValue(null);

            const result = await BirthdayHandler.execute(mockCtx);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No birthday channel configured');
        });

        it('should fail when config channel no longer exists', async () => {
            mockCtx.channel = null;
            mockCtx.context.tables.Config.findOne.mockResolvedValue({ value: 'deleted-channel' });
            mockCtx.client.channels.cache.get.mockReturnValue(undefined);

            const result = await BirthdayHandler.execute(mockCtx);

            expect(result.success).toBe(false);
            expect(result.message).toContain('No birthday channel configured');
        });

        it('should handle send failure', async () => {
            mockChannel.send.mockRejectedValue(new Error('Send failed'));

            const result = await BirthdayHandler.execute(mockCtx);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to send birthday');
        });
    });

    describe('validate', () => {
        it('should accept valid payload', () => {
            const result = BirthdayHandler.validate!(basePayload);
            expect(result.valid).toBe(true);
        });

        it('should reject missing userId', () => {
            const result = BirthdayHandler.validate!({ ...basePayload, userId: '' });
            expect(result.valid).toBe(false);
        });

        it('should reject missing username', () => {
            const result = BirthdayHandler.validate!({ ...basePayload, username: '' });
            expect(result.valid).toBe(false);
        });

        it('should reject missing birthDate', () => {
            const result = BirthdayHandler.validate!({ ...basePayload, birthDate: '' });
            expect(result.valid).toBe(false);
        });

        it('should reject invalid date format', () => {
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '3-15' }).valid).toBe(false);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '13-01' }).valid).toBe(false);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '00-15' }).valid).toBe(false);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '12-32' }).valid).toBe(false);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: 'March 15' }).valid).toBe(false);
        });

        it('should accept valid date formats', () => {
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '01-01' }).valid).toBe(true);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '12-31' }).valid).toBe(true);
            expect(BirthdayHandler.validate!({ ...basePayload, birthDate: '06-15' }).valid).toBe(true);
        });

        it('should reject long custom message', () => {
            const result = BirthdayHandler.validate!({ ...basePayload, customMessage: 'x'.repeat(501) });
            expect(result.valid).toBe(false);
        });

        it('should accept custom message within limits', () => {
            const result = BirthdayHandler.validate!({ ...basePayload, customMessage: 'Happy bday!' });
            expect(result.valid).toBe(true);
        });
    });

    describe('formatDisplay', () => {
        it('should show username and date', () => {
            const result = BirthdayHandler.formatDisplay!({
                payload: JSON.stringify(basePayload),
            } as any);
            expect(result).toContain('TestUser');
            expect(result).toContain('03-15');
        });
    });
});

describe('birthdayToCron', () => {
    it('should generate correct cron for March 15', () => {
        expect(birthdayToCron('03-15')).toBe('0 9 15 3 *');
    });

    it('should generate correct cron for January 1', () => {
        expect(birthdayToCron('01-01')).toBe('0 9 1 1 *');
    });

    it('should generate correct cron for December 31', () => {
        expect(birthdayToCron('12-31')).toBe('0 9 31 12 *');
    });

    it('should strip leading zeros from day and month', () => {
        expect(birthdayToCron('06-05')).toBe('0 9 5 6 *');
    });
});
