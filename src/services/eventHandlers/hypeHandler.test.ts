import { HypeHandler, parseHypeInterval, DEFAULT_HYPE_INTERVALS } from './hypeHandler';
import { HypePayload } from '../../models/scheduledEvent';

describe('HypeHandler', () => {
    let mockChannel: any;
    let mockCtx: any;

    const basePayload: HypePayload = {
        eventName: 'Game Night',
        description: 'Weekly game session',
        showCountdown: true,
        announceAt: ['24h', '1h', '15m', 'now'],
        eventTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        announcementTier: '1h',
        hypeGroupId: 'grp12345',
    };

    beforeEach(() => {
        mockChannel = {
            send: jest.fn().mockResolvedValue(undefined),
        };
        mockCtx = {
            event: {
                eventId: 'abc12345',
                eventType: 'hype',
                creatorId: 'user123',
                guildId: 'guild123',
                channelId: 'channel123',
                payload: JSON.stringify(basePayload),
            },
            client: {},
            context: { log: { info: jest.fn(), error: jest.fn() } },
            channel: mockChannel,
            payload: basePayload,
        };
    });

    describe('type', () => {
        it('should be "hype"', () => {
            expect(HypeHandler.type).toBe('hype');
        });
    });

    describe('execute', () => {
        it('should send a countdown announcement', async () => {
            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(true);
            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                }),
            );
        });

        it('should show "IT\'S TIME!" for now tier', async () => {
            const nowPayload = { ...basePayload, announcementTier: 'now', eventTime: new Date().toISOString() };
            mockCtx.payload = nowPayload;

            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(true);
            const embedData = mockChannel.send.mock.calls[0][0].embeds[0].data;
            expect(embedData.title).toContain("IT'S TIME!");
        });

        it('should return failure when no channel', async () => {
            mockCtx.channel = null;

            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Channel not found');
        });

        it('should handle send failure', async () => {
            mockChannel.send.mockRejectedValue(new Error('Send failed'));

            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to send hype');
        });

        it('should include description when present', async () => {
            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(true);
            const embedData = mockChannel.send.mock.calls[0][0].embeds[0].data;
            expect(embedData.description).toContain('Weekly game session');
        });

        it('should work without description', async () => {
            mockCtx.payload = { ...basePayload, description: undefined };

            const result = await HypeHandler.execute(mockCtx);

            expect(result.success).toBe(true);
        });
    });

    describe('validate', () => {
        it('should accept valid payload', () => {
            const result = HypeHandler.validate!(basePayload);
            expect(result.valid).toBe(true);
        });

        it('should reject missing event name', () => {
            const result = HypeHandler.validate!({ ...basePayload, eventName: '' });
            expect(result.valid).toBe(false);
        });

        it('should reject long event name', () => {
            const result = HypeHandler.validate!({ ...basePayload, eventName: 'x'.repeat(101) });
            expect(result.valid).toBe(false);
        });

        it('should reject long description', () => {
            const result = HypeHandler.validate!({ ...basePayload, description: 'x'.repeat(501) });
            expect(result.valid).toBe(false);
        });

        it('should reject missing event time', () => {
            const result = HypeHandler.validate!({ ...basePayload, eventTime: '' });
            expect(result.valid).toBe(false);
        });
    });

    describe('formatDisplay', () => {
        it('should format event name and tier', () => {
            const result = HypeHandler.formatDisplay!({
                payload: JSON.stringify(basePayload),
            } as any);
            expect(result).toContain('Game Night');
            expect(result).toContain('1h');
        });

        it('should truncate long names', () => {
            const longPayload = { ...basePayload, eventName: 'A'.repeat(50) };
            const result = HypeHandler.formatDisplay!({
                payload: JSON.stringify(longPayload),
            } as any);
            expect(result).toContain('...');
        });
    });
});

describe('parseHypeInterval', () => {
    it('should parse hours', () => {
        expect(parseHypeInterval('24h')).toBe(24 * 60 * 60 * 1000);
        expect(parseHypeInterval('1h')).toBe(60 * 60 * 1000);
    });

    it('should parse minutes', () => {
        expect(parseHypeInterval('15m')).toBe(15 * 60 * 1000);
        expect(parseHypeInterval('30m')).toBe(30 * 60 * 1000);
    });

    it('should parse "now" and "0m" as 0', () => {
        expect(parseHypeInterval('now')).toBe(0);
        expect(parseHypeInterval('0m')).toBe(0);
    });

    it('should return null for invalid input', () => {
        expect(parseHypeInterval('abc')).toBeNull();
        expect(parseHypeInterval('24')).toBeNull();
        expect(parseHypeInterval('')).toBeNull();
    });
});

describe('DEFAULT_HYPE_INTERVALS', () => {
    it('should have sensible defaults', () => {
        expect(DEFAULT_HYPE_INTERVALS).toContain('24h');
        expect(DEFAULT_HYPE_INTERVALS).toContain('1h');
        expect(DEFAULT_HYPE_INTERVALS).toContain('now');
    });
});
