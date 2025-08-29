import { describe, it, expect } from '@jest/globals';

describe('Models Index', () => {
    it('should export all model functions', async () => {
        const models = await import('./index');
        
        expect(typeof models.default.adlibs).toBe('function');
        expect(typeof models.default.config).toBe('function');
        expect(typeof models.default.louds).toBe('function');
        expect(typeof models.default.memories).toBe('function');
        expect(typeof models.default.rollcall).toBe('function');
        expect(typeof models.default.twitch).toBe('function');
        expect(typeof models.default.Poll).toBe('function');
        expect(typeof models.default.PollVote).toBe('function');
        expect(typeof models.default.memeTemplate).toBe('function');
    });

    it('should initialize models with sequelize instance', async () => {
        const models = await import('./index');
        const mockSequelize = { define: jest.fn() };
        
        // Test that models can be called with sequelize instance
        expect(() => models.default.adlibs(mockSequelize)).not.toThrow();
        expect(() => models.default.config(mockSequelize)).not.toThrow();
        expect(() => models.default.louds(mockSequelize)).not.toThrow();
        expect(() => models.default.memories(mockSequelize)).not.toThrow();
        expect(() => models.default.rollcall(mockSequelize)).not.toThrow();
        expect(() => models.default.twitch(mockSequelize)).not.toThrow();
        expect(() => models.default.Poll(mockSequelize)).not.toThrow();
        expect(() => models.default.PollVote(mockSequelize)).not.toThrow();
        expect(() => models.default.memeTemplate(mockSequelize)).not.toThrow();
    });
});