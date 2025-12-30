import { ReminderHandler } from './reminderHandler';
import { EventContext } from './types';
import { ScheduledEventAttributes } from '../../models/scheduledEvent';

describe('ReminderHandler', () => {
    describe('type', () => {
        it('should be reminder type', () => {
            expect(ReminderHandler.type).toBe('reminder');
        });
    });

    describe('execute', () => {
        let mockContext: EventContext;
        let mockChannel: any;

        beforeEach(() => {
            mockChannel = {
                send: jest.fn().mockResolvedValue({}),
            };

            mockContext = {
                event: {
                    eventId: 'test1234',
                    guildId: 'guild123',
                    channelId: 'channel123',
                    creatorId: 'user123',
                    eventType: 'reminder',
                    payload: '{}',
                    scheduleType: 'once',
                    status: 'active',
                    timezone: 'UTC',
                    executionCount: 0,
                } as ScheduledEventAttributes,
                client: {} as any,
                context: {} as any,
                channel: mockChannel,
                payload: {
                    message: 'Test reminder',
                    mentionUser: true,
                    sendDm: false,
                },
            };
        });

        it('should send reminder message successfully', async () => {
            const result = await ReminderHandler.execute(mockContext);

            expect(result.success).toBe(true);
            expect(result.shouldReschedule).toBe(false);
            expect(mockChannel.send).toHaveBeenCalledWith({
                content: '<@user123>',
                embeds: expect.any(Array),
            });
        });

        it('should not mention user when sendDm is true', async () => {
            mockContext.payload = {
                message: 'DM reminder',
                mentionUser: true,
                sendDm: true,
            };

            await ReminderHandler.execute(mockContext);

            expect(mockChannel.send).toHaveBeenCalledWith({
                content: undefined,
                embeds: expect.any(Array),
            });
        });

        it('should not mention user when mentionUser is false', async () => {
            mockContext.payload = {
                message: 'Channel reminder',
                mentionUser: false,
                sendDm: false,
            };

            await ReminderHandler.execute(mockContext);

            expect(mockChannel.send).toHaveBeenCalledWith({
                content: undefined,
                embeds: expect.any(Array),
            });
        });

        it('should fail when channel is null', async () => {
            mockContext.channel = null;

            const result = await ReminderHandler.execute(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toBe('Channel not found or not accessible');
        });

        it('should handle send errors', async () => {
            mockChannel.send.mockRejectedValue(new Error('Send failed'));

            const result = await ReminderHandler.execute(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toBe('Failed to send reminder message');
            expect(result.error).toBeInstanceOf(Error);
        });
    });

    describe('validate', () => {
        it('should validate valid payload', () => {
            const result = ReminderHandler.validate!({
                message: 'Test reminder',
                mentionUser: true,
                sendDm: false,
            });

            expect(result.valid).toBe(true);
        });

        it('should reject missing message', () => {
            const result = ReminderHandler.validate!({
                mentionUser: true,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('required');
        });

        it('should reject empty message', () => {
            const result = ReminderHandler.validate!({
                message: '',
            });

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should reject message over 500 characters', () => {
            const result = ReminderHandler.validate!({
                message: 'a'.repeat(501),
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('500');
        });

        it('should accept message at 500 characters', () => {
            const result = ReminderHandler.validate!({
                message: 'a'.repeat(500),
            });

            expect(result.valid).toBe(true);
        });

        it('should reject non-string message', () => {
            const result = ReminderHandler.validate!({
                message: 123,
            });

            expect(result.valid).toBe(false);
            expect(result.error).toContain('required');
        });
    });

    describe('formatDisplay', () => {
        it('should format short messages', () => {
            const event = {
                payload: JSON.stringify({ message: 'Short reminder' }),
            } as ScheduledEventAttributes;

            const result = ReminderHandler.formatDisplay!(event);

            expect(result).toBe('"Short reminder"');
        });

        it('should truncate long messages', () => {
            const longMessage = 'a'.repeat(60);
            const event = {
                payload: JSON.stringify({ message: longMessage }),
            } as ScheduledEventAttributes;

            const result = ReminderHandler.formatDisplay!(event);

            expect(result).toContain('...');
            expect(result.length).toBeLessThan(60);
        });

        it('should handle invalid JSON', () => {
            const event = {
                payload: 'invalid json',
            } as ScheduledEventAttributes;

            const result = ReminderHandler.formatDisplay!(event);

            expect(result).toBe('"Unknown reminder"');
        });
    });
});
