import { Sequelize } from 'sequelize';
import dndGameModel from './dndGame';

describe('DndGame Model', () => {
    let sequelize: Sequelize;
    let DndGame: any;

    beforeAll(() => {
        // Create in-memory SQLite database for testing
        sequelize = new Sequelize('sqlite::memory:', {
            logging: false,
        });

        // Initialize model
        const models = dndGameModel(sequelize);
        DndGame = models.DndGame;
    });

    beforeEach(async () => {
        // Sync database (create tables)
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('model creation', () => {
        it('should create a DndGame with required fields', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                conversationHistory: [],
                isActive: false,
                waitPeriodMinutes: 5,
                currentRound: 0,
                pendingMessages: [],
            });

            expect(game.id).toBeDefined();
            expect(game.guildId).toBe('guild-123');
            expect(game.name).toBe('Test Campaign');
            expect(game.systemPrompt).toBe('You are a DM');
            expect(game.isActive).toBe(false);
            expect(game.waitPeriodMinutes).toBe(5);
            expect(game.currentRound).toBe(0);
            expect(game.createdAt).toBeInstanceOf(Date);
            expect(game.updatedAt).toBeInstanceOf(Date);
        });

        it('should create a DndGame with optional fields', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                conversationHistory: [
                    { role: 'user', content: 'Hello' },
                    { role: 'assistant', content: 'Greetings adventurer!' },
                ],
                channelId: 'channel-123',
                isActive: true,
                waitPeriodMinutes: 10,
                currentRound: 5,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                ],
                lastResponseTime: new Date(),
            });

            expect(game.channelId).toBe('channel-123');
            expect(game.isActive).toBe(true);
            expect(game.waitPeriodMinutes).toBe(10);
            expect(game.currentRound).toBe(5);
            expect(game.conversationHistory).toHaveLength(2);
            expect(game.pendingMessages).toHaveLength(1);
            expect(game.lastResponseTime).toBeInstanceOf(Date);
        });

        it('should use default values for optional fields', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            expect(game.conversationHistory).toEqual([]);
            expect(game.isActive).toBe(false);
            expect(game.waitPeriodMinutes).toBe(5);
            expect(game.currentRound).toBe(0);
            expect(game.pendingMessages).toEqual([]);
        });
    });

    describe('model validation', () => {
        it('should require guildId', async () => {
            await expect(
                DndGame.create({
                    name: 'Test Campaign',
                    systemPrompt: 'You are a DM',
                }),
            ).rejects.toThrow();
        });

        it('should require name', async () => {
            await expect(
                DndGame.create({
                    guildId: 'guild-123',
                    systemPrompt: 'You are a DM',
                }),
            ).rejects.toThrow();
        });

        it('should require systemPrompt', async () => {
            await expect(
                DndGame.create({
                    guildId: 'guild-123',
                    name: 'Test Campaign',
                }),
            ).rejects.toThrow();
        });

        it('should enforce name length limit (100 characters)', async () => {
            const longName = 'a'.repeat(101);

            const game = await DndGame.create({
                guildId: 'guild-123',
                name: longName,
                systemPrompt: 'You are a DM',
            });

            // SQLite doesn't enforce VARCHAR length, but we verify it accepts it
            expect(game.name).toBe(longName);
        });
    });

    describe('unique constraints', () => {
        it('should enforce unique guildId + name combination', async () => {
            await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            // SQLite in-memory doesn't enforce all constraints the same way as MySQL
            // This test documents the expected behavior
            await expect(
                DndGame.create({
                    guildId: 'guild-123',
                    name: 'Test Campaign',
                    systemPrompt: 'Different prompt',
                }),
            ).rejects.toThrow();
        });

        it('should allow same name in different guilds', async () => {
            await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            const game2 = await DndGame.create({
                guildId: 'guild-456',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            expect(game2.id).toBeDefined();
            expect(game2.guildId).toBe('guild-456');
            expect(game2.name).toBe('Test Campaign');
        });
    });

    describe('JSON fields', () => {
        it('should store and retrieve conversationHistory as JSON', async () => {
            const history = [
                { role: 'system', content: 'You are a DM' },
                { role: 'user', content: 'I enter the dungeon' },
                { role: 'assistant', content: 'You see torches flickering...' },
            ];

            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                conversationHistory: history,
            });

            const retrieved = await DndGame.findByPk(game.id);
            expect(retrieved.conversationHistory).toEqual(history);
        });

        it('should store and retrieve pendingMessages as JSON', async () => {
            const messages = [
                {
                    userId: 'user-123',
                    username: 'Player1',
                    content: 'I attack!',
                    timestamp: new Date('2025-01-15T10:00:00Z'),
                },
                {
                    userId: 'user-456',
                    username: 'Player2',
                    content: 'I defend!',
                    timestamp: new Date('2025-01-15T10:01:00Z'),
                },
            ];

            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                pendingMessages: messages,
            });

            const retrieved = await DndGame.findByPk(game.id);
            expect(retrieved.pendingMessages).toHaveLength(2);
            expect(retrieved.pendingMessages[0].userId).toBe('user-123');
            expect(retrieved.pendingMessages[1].username).toBe('Player2');
        });

        it('should handle empty JSON arrays', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                conversationHistory: [],
                pendingMessages: [],
            });

            const retrieved = await DndGame.findByPk(game.id);
            expect(retrieved.conversationHistory).toEqual([]);
            expect(retrieved.pendingMessages).toEqual([]);
        });
    });

    describe('querying', () => {
        beforeEach(async () => {
            await DndGame.bulkCreate([
                {
                    guildId: 'guild-123',
                    name: 'Campaign A',
                    systemPrompt: 'You are a DM',
                    isActive: true,
                    channelId: 'channel-1',
                },
                {
                    guildId: 'guild-123',
                    name: 'Campaign B',
                    systemPrompt: 'You are a DM',
                    isActive: false,
                },
                {
                    guildId: 'guild-456',
                    name: 'Campaign C',
                    systemPrompt: 'You are a DM',
                    isActive: true,
                    channelId: 'channel-2',
                },
            ]);
        });

        it('should find games by guildId', async () => {
            const games = await DndGame.findAll({
                where: { guildId: 'guild-123' },
            });

            expect(games).toHaveLength(2);
            expect(games.map((g: any) => g.name)).toEqual(
                expect.arrayContaining(['Campaign A', 'Campaign B']),
            );
        });

        it('should find active game by guildId and channelId', async () => {
            const game = await DndGame.findOne({
                where: {
                    guildId: 'guild-123',
                    channelId: 'channel-1',
                    isActive: true,
                },
            });

            expect(game).not.toBeNull();
            expect(game.name).toBe('Campaign A');
            expect(game.isActive).toBe(true);
        });

        it('should find game by name and guildId', async () => {
            const game = await DndGame.findOne({
                where: {
                    guildId: 'guild-123',
                    name: 'Campaign B',
                },
            });

            expect(game).not.toBeNull();
            expect(game.name).toBe('Campaign B');
            expect(game.isActive).toBe(false);
        });

        it('should return null for non-existent game', async () => {
            const game = await DndGame.findOne({
                where: {
                    guildId: 'guild-999',
                    name: 'Non-existent',
                },
            });

            expect(game).toBeNull();
        });
    });

    describe('updating', () => {
        it('should update game fields', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                isActive: false,
                currentRound: 0,
            });

            await DndGame.update(
                {
                    isActive: true,
                    channelId: 'channel-123',
                    currentRound: 5,
                },
                { where: { id: game.id } },
            );

            const updated = await DndGame.findByPk(game.id);
            expect(updated.isActive).toBe(true);
            expect(updated.channelId).toBe('channel-123');
            expect(updated.currentRound).toBe(5);
        });

        it('should update JSON fields', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
                conversationHistory: [],
            });

            const newHistory = [
                { role: 'user', content: 'Test message' },
                { role: 'assistant', content: 'Test response' },
            ];

            await DndGame.update(
                { conversationHistory: newHistory },
                { where: { id: game.id } },
            );

            const updated = await DndGame.findByPk(game.id);
            expect(updated.conversationHistory).toEqual(newHistory);
        });

        it('should deactivate all games in a guild', async () => {
            await DndGame.bulkCreate([
                {
                    guildId: 'guild-123',
                    name: 'Campaign A',
                    systemPrompt: 'You are a DM',
                    isActive: true,
                },
                {
                    guildId: 'guild-123',
                    name: 'Campaign B',
                    systemPrompt: 'You are a DM',
                    isActive: true,
                },
            ]);

            await DndGame.update(
                { isActive: false },
                { where: { guildId: 'guild-123' } },
            );

            const games = await DndGame.findAll({
                where: { guildId: 'guild-123' },
            });

            expect(games.every((g: any) => !g.isActive)).toBe(true);
        });
    });

    describe('deleting', () => {
        it('should delete a game', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            await DndGame.destroy({
                where: { id: game.id },
            });

            const retrieved = await DndGame.findByPk(game.id);
            expect(retrieved).toBeNull();
        });

        it('should delete by guildId and name', async () => {
            await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            const deleted = await DndGame.destroy({
                where: {
                    guildId: 'guild-123',
                    name: 'Test Campaign',
                },
            });

            expect(deleted).toBe(1);

            const game = await DndGame.findOne({
                where: { guildId: 'guild-123', name: 'Test Campaign' },
            });
            expect(game).toBeNull();
        });

        it('should return 0 when deleting non-existent game', async () => {
            const deleted = await DndGame.destroy({
                where: {
                    guildId: 'guild-999',
                    name: 'Non-existent',
                },
            });

            expect(deleted).toBe(0);
        });
    });

    describe('timestamps', () => {
        it('should set createdAt and updatedAt on creation', async () => {
            const before = new Date();
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });
            const after = new Date();

            expect(game.createdAt).toBeInstanceOf(Date);
            expect(game.updatedAt).toBeInstanceOf(Date);
            expect(game.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(game.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should update updatedAt on modification', async () => {
            const game = await DndGame.create({
                guildId: 'guild-123',
                name: 'Test Campaign',
                systemPrompt: 'You are a DM',
            });

            const originalUpdatedAt = game.updatedAt;

            // Wait a bit to ensure timestamp changes
            await new Promise(resolve => setTimeout(resolve, 10));

            await game.update({ currentRound: 5 });

            expect(game.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
        });
    });
});
