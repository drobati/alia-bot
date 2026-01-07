import { SparksService } from './sparksService';
import { createContext, createTable, createRecord } from '../utils/testHelpers';

describe('SparksService', () => {
    let service: SparksService;
    let context: ReturnType<typeof createContext>;
    let mockSparksUser: ReturnType<typeof createTable>;
    let mockSparksBalance: ReturnType<typeof createTable>;
    let mockSparksLedger: ReturnType<typeof createTable>;
    let mockSparksEngagement: ReturnType<typeof createTable>;

    beforeEach(() => {
        context = createContext();

        mockSparksUser = createTable();
        mockSparksBalance = createTable();
        mockSparksLedger = createTable();
        mockSparksEngagement = createTable();

        context.tables.SparksUser = mockSparksUser;
        context.tables.SparksBalance = mockSparksBalance;
        context.tables.SparksLedger = mockSparksLedger;
        context.tables.SparksEngagement = mockSparksEngagement;

        service = new SparksService(context as any);
    });

    describe('getOrCreateUser', () => {
        it('should return existing user', async () => {
            const existingUser = createRecord({
                id: 1,
                guild_id: 'guild-1',
                discord_id: 'user-1',
                username: 'testuser',
            });
            mockSparksUser.findOne.mockResolvedValue(existingUser);

            const result = await service.getOrCreateUser('guild-1', 'user-1', 'testuser');

            expect(result).toBe(existingUser);
            expect(mockSparksUser.findOne).toHaveBeenCalledWith({
                where: { guild_id: 'guild-1', discord_id: 'user-1' },
            });
        });

        it('should create new user with starting balance', async () => {
            mockSparksUser.findOne.mockResolvedValue(null);
            const newUser = createRecord({ id: 1, guild_id: 'guild-1', discord_id: 'user-1' });
            mockSparksUser.create.mockResolvedValue(newUser);

            const result = await service.getOrCreateUser('guild-1', 'user-1', 'newuser');

            expect(result).toBe(newUser);
            expect(mockSparksUser.create).toHaveBeenCalledWith({
                guild_id: 'guild-1',
                discord_id: 'user-1',
                username: 'newuser',
            });
            expect(mockSparksBalance.create).toHaveBeenCalledWith({
                user_id: 1,
                current_balance: 100,
                lifetime_earned: 100,
            });
            expect(mockSparksEngagement.create).toHaveBeenCalled();
            expect(mockSparksLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'earn',
                    amount: 100,
                    ref_type: 'signup_bonus',
                }),
            );
        });

        it('should update username if changed', async () => {
            const existingUser = createRecord({
                id: 1,
                guild_id: 'guild-1',
                discord_id: 'user-1',
                username: 'oldname',
            });
            mockSparksUser.findOne.mockResolvedValue(existingUser);

            await service.getOrCreateUser('guild-1', 'user-1', 'newname');

            expect(existingUser.update).toHaveBeenCalledWith({ username: 'newname' });
        });
    });

    describe('getBalance', () => {
        it('should return null if user not found', async () => {
            mockSparksUser.findOne.mockResolvedValue(null);

            const result = await service.getBalance('guild-1', 'user-1');

            expect(result).toBeNull();
        });

        it('should return balance info', async () => {
            const user = createRecord({ id: 1 });
            const balance = createRecord({
                current_balance: 150,
                escrow_balance: 10,
                lifetime_earned: 200,
                lifetime_spent: 50,
            });
            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);

            const result = await service.getBalance('guild-1', 'user-1');

            expect(result).toEqual({
                currentBalance: 150,
                escrowBalance: 10,
                lifetimeEarned: 200,
                lifetimeSpent: 50,
                availableBalance: 140,
            });
        });
    });

    describe('getRecentTransactions', () => {
        it('should return empty array if user not found', async () => {
            mockSparksUser.findOne.mockResolvedValue(null);

            const result = await service.getRecentTransactions('guild-1', 'user-1');

            expect(result).toEqual([]);
        });

        it('should return transactions', async () => {
            const user = createRecord({ id: 1 });
            const transactions = [
                { type: 'earn', amount: 1, description: 'Message', created_at: new Date() },
                { type: 'daily_bonus', amount: 3, description: 'Daily', created_at: new Date() },
            ];
            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksLedger.findAll.mockResolvedValue(transactions);

            const result = await service.getRecentTransactions('guild-1', 'user-1', 5);

            expect(mockSparksLedger.findAll).toHaveBeenCalledWith({
                where: { user_id: 1 },
                order: [['created_at', 'DESC']],
                limit: 5,
            });
            expect(result).toHaveLength(2);
        });
    });

    describe('isQualifyingMessage', () => {
        it('should qualify messages with 15+ characters', () => {
            const message = {
                content: 'This is a long enough message',
                attachments: { size: 0 },
            } as any;

            expect(service.isQualifyingMessage(message)).toBe(true);
        });

        it('should qualify messages with attachments', () => {
            const message = {
                content: 'short',
                attachments: { size: 1 },
            } as any;

            expect(service.isQualifyingMessage(message)).toBe(true);
        });

        it('should not qualify short messages without attachments', () => {
            const message = {
                content: 'short',
                attachments: { size: 0 },
            } as any;

            expect(service.isQualifyingMessage(message)).toBe(false);
        });
    });

    describe('processMessage', () => {
        let mockMessage: any;

        beforeEach(() => {
            mockMessage = {
                author: { bot: false, id: 'user-1', username: 'testuser' },
                guild: { id: 'guild-1' },
                channel: { id: 'channel-1' },
                content: 'This is a qualifying message with enough length',
                attachments: { size: 0 },
                id: 'msg-1',
            };
        });

        it('should skip bot messages', async () => {
            mockMessage.author.bot = true;

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(false);
            expect(result.reason).toBe('bot_message');
        });

        it('should skip DMs', async () => {
            mockMessage.guild = null;

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(false);
            expect(result.reason).toBe('dm_message');
        });

        it('should skip short messages', async () => {
            mockMessage.content = 'short';

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(false);
            expect(result.reason).toBe('message_too_short');
        });

        it('should award sparks for qualifying message', async () => {
            const user = createRecord({ id: 1, update: jest.fn() });
            const balance = createRecord({
                id: 1,
                current_balance: 100,
                lifetime_earned: 100,
                update: jest.fn(),
            });
            const engagement = createRecord({
                daily_earn_count: 0,
                daily_sparks_earned: 0,
                last_earn_at: null,
                last_daily_bonus_at: null,
                recent_message_count: 0,
                reset_date: new Date().toISOString().split('T')[0],
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksUser.create.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);
            mockSparksBalance.create.mockResolvedValue(balance);
            mockSparksEngagement.findOne.mockResolvedValue(engagement);
            mockSparksEngagement.create.mockResolvedValue(engagement);

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(true);
            expect(result.amount).toBeGreaterThan(0);
            expect(balance.update).toHaveBeenCalled();
            expect(mockSparksLedger.create).toHaveBeenCalled();
        });

        it('should include daily bonus on first message of day', async () => {
            const user = createRecord({ id: 1, update: jest.fn() });
            const balance = createRecord({
                id: 1,
                current_balance: 100,
                lifetime_earned: 100,
                update: jest.fn(),
            });
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const engagement = createRecord({
                daily_earn_count: 0,
                daily_sparks_earned: 0,
                last_earn_at: null,
                last_daily_bonus_at: yesterday,
                recent_message_count: 0,
                reset_date: new Date().toISOString().split('T')[0],
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);
            mockSparksEngagement.findOne.mockResolvedValue(engagement);

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(true);
            expect(result.amount).toBe(3); // 1 base + 2 daily bonus
            expect(result.isFirstOfDay).toBe(true);
        });

        it('should respect cooldown', async () => {
            const user = createRecord({ id: 1, update: jest.fn() });
            const balance = createRecord({ id: 1, current_balance: 100 });
            const recentEarn = new Date();
            recentEarn.setSeconds(recentEarn.getSeconds() - 30); // 30 seconds ago
            const engagement = createRecord({
                daily_earn_count: 1,
                daily_sparks_earned: 1,
                last_earn_at: recentEarn,
                last_daily_bonus_at: new Date(),
                recent_message_count: 1,
                reset_date: new Date().toISOString().split('T')[0],
                suppressed_until: null,
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);
            mockSparksEngagement.findOne.mockResolvedValue(engagement);

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(false);
            expect(result.reason).toBe('cooldown');
        });

        it('should respect daily cap', async () => {
            const user = createRecord({ id: 1, update: jest.fn() });
            const balance = createRecord({ id: 1, current_balance: 125 });
            const engagement = createRecord({
                daily_earn_count: 10,
                daily_sparks_earned: 25, // At cap
                last_earn_at: null,
                last_daily_bonus_at: new Date(),
                recent_message_count: 1,
                reset_date: new Date().toISOString().split('T')[0],
                suppressed_until: null,
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);
            mockSparksEngagement.findOne.mockResolvedValue(engagement);

            const result = await service.processMessage(mockMessage);

            expect(result.earned).toBe(false);
            expect(result.reason).toBe('daily_cap_reached');
        });
    });

    describe('addSparks', () => {
        it('should add sparks to user balance', async () => {
            const user = createRecord({ id: 1 });
            const balance = createRecord({
                current_balance: 100,
                lifetime_earned: 100,
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksUser.create.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);
            mockSparksBalance.create.mockResolvedValue(balance);
            mockSparksEngagement.create.mockResolvedValue({});

            const result = await service.addSparks('guild-1', 'user-1', 50, 'Test bonus');

            expect(result).toBe(true);
            expect(balance.update).toHaveBeenCalledWith({
                current_balance: 150,
                lifetime_earned: 150,
            });
            expect(mockSparksLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'earn',
                    amount: 50,
                    description: 'Test bonus',
                }),
            );
        });
    });

    describe('removeSparks', () => {
        it('should remove sparks from user balance', async () => {
            const user = createRecord({ id: 1 });
            const balance = createRecord({
                current_balance: 100,
                escrow_balance: 0,
                lifetime_spent: 0,
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);

            const result = await service.removeSparks('guild-1', 'user-1', 30, 'Test spend');

            expect(result).toBe(true);
            expect(balance.update).toHaveBeenCalledWith({
                current_balance: 70,
                lifetime_spent: 30,
            });
        });

        it('should reject if insufficient balance', async () => {
            const user = createRecord({ id: 1 });
            const balance = createRecord({
                current_balance: 50,
                escrow_balance: 30,
                lifetime_spent: 0,
                update: jest.fn(),
            });

            mockSparksUser.findOne.mockResolvedValue(user);
            mockSparksBalance.findOne.mockResolvedValue(balance);

            const result = await service.removeSparks('guild-1', 'user-1', 30, 'Test spend');

            expect(result).toBe(false);
            expect(balance.update).not.toHaveBeenCalled();
        });

        it('should return false if user not found', async () => {
            mockSparksUser.findOne.mockResolvedValue(null);

            const result = await service.removeSparks('guild-1', 'user-1', 30, 'Test spend');

            expect(result).toBe(false);
        });
    });
});
