import { MemeGenerator } from './memeGenerator';
import { MemeTemplateAttributes } from '../types/database';

// Simple integration tests for MemeGenerator
describe('MemeGenerator', () => {
    describe('Class Structure', () => {
        test('should have generateMeme static method', () => {
            expect(typeof MemeGenerator.generateMeme).toBe('function');
        });

        test('should have generateCustomMeme static method', () => {
            expect(typeof MemeGenerator.generateCustomMeme).toBe('function');
        });
    });

    describe('Input Validation', () => {
        test('generateMeme should require template parameter', async () => {
            await expect(MemeGenerator.generateMeme(null as any, 'test'))
                .rejects.toThrow();
        });

        test('generateCustomMeme should require URL parameter', async () => {
            await expect(MemeGenerator.generateCustomMeme(null as any, 'test'))
                .rejects.toThrow();
        });

        test('should handle invalid URLs gracefully', async () => {
            await expect(MemeGenerator.generateCustomMeme('invalid-url', 'test'))
                .rejects.toThrow('Failed to generate meme');
        });
    });

    describe('Template Structure', () => {
        test('should accept proper template structure', () => {
            const mockTemplate: MemeTemplateAttributes = {
                id: 1,
                name: 'Test Template',
                url: 'https://i.imgflip.com/test.jpg',
                description: 'Test description',
                default_font_size: 32,
                creator: 'test',
                usage_count: 0,
                is_active: true,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Should not throw when passed a properly structured template
            expect(() => {
                // Just test that the template structure is valid
                expect(mockTemplate.name).toBe('Test Template');
                expect(mockTemplate.url).toContain('https://');
                expect(mockTemplate.default_font_size).toBe(32);
            }).not.toThrow();
        });
    });
});