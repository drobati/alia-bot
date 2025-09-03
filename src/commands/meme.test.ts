import { ChatInputCommandInteraction } from 'discord.js';
import memeCommand from './meme';
import { Context } from '../types';
import { MemeGenerator } from '../utils/memeGenerator';
import { MemeTemplateAttributes } from '../types/database';

// Mock MemeGenerator
jest.mock('../utils/memeGenerator');
const mockMemeGenerator = MemeGenerator as jest.Mocked<typeof MemeGenerator>;

describe('Meme Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: Context;
    let mockMemeTemplate: any;

    beforeEach(() => {
        mockInteraction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getInteger: jest.fn(),
                getFocused: jest.fn(),
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue(undefined),
            deferReply: jest.fn().mockResolvedValue(undefined),
            replied: false,
            deferred: false,
        } as any;

        mockMemeTemplate = {
            findOne: jest.fn(),
            findAll: jest.fn(),
            findAndCountAll: jest.fn(),
        };

        mockContext = {
            tables: {
                MemeTemplate: mockMemeTemplate,
            },
            log: {
                error: jest.fn(),
            },
            sequelize: {
                query: jest.fn(),
            },
        } as any;

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(memeCommand.data.name).toBe('meme');
            expect(memeCommand.data.description).toBe('Generate memes with text overlays');
        });

        it('should have three subcommands', () => {
            const commandData = memeCommand.data.toJSON();
            expect(commandData.options).toHaveLength(3);

            const subcommandNames = commandData.options?.map((opt: any) => opt.name) || [];
            expect(subcommandNames).toContain('create');
            expect(subcommandNames).toContain('custom');
            expect(subcommandNames).toContain('list');
        });
    });

    describe('Autocomplete Function', () => {
        it('should handle template autocomplete successfully', async () => {
            const mockTemplates = [
                { name: 'Drake Pointing', usage_count: 10 },
                { name: 'Distracted Boyfriend', usage_count: 5 },
                { name: 'Drake Template', usage_count: 1 },
            ];

            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'template', value: 'drake' }),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            } as any;

            mockMemeTemplate.findAll.mockResolvedValue(mockTemplates);

            await memeCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockMemeTemplate.findAll).toHaveBeenCalledWith({
                where: { is_active: true },
                limit: 25,
                order: [['usage_count', 'DESC'], ['name', 'ASC']],
            });

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Drake Pointing', value: 'Drake Pointing' },
                { name: 'Drake Template', value: 'Drake Template' },
            ]);
        });

        it('should handle autocomplete errors gracefully', async () => {
            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'template', value: 'test' }),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            } as any;

            mockMemeTemplate.findAll.mockRejectedValue(new Error('Database error'));

            await memeCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in meme template autocomplete',
            );
            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([]);
        });

        it('should ignore non-template focused options', async () => {
            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'other', value: 'test' }),
                },
                respond: jest.fn(),
            };

            await memeCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockMemeTemplate.findAll).not.toHaveBeenCalled();
            expect(mockAutocompleteInteraction.respond).not.toHaveBeenCalled();
        });
    });

    describe('Execute Function', () => {
        it('should handle create subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('create');

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
        });

        it('should handle custom subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('custom');

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
        });

        it('should handle list subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('list');
            mockMemeTemplate.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
        });

        it('should handle unknown subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('unknown');

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Unknown subcommand.',
                ephemeral: true,
            });
        });

        it('should handle errors in execute function', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockImplementation(() => {
                throw new Error('Test error');
            });

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in meme command',
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while processing the meme command.',
                ephemeral: true,
            });
        });

        it('should handle errors with replied interaction', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockImplementation(() => {
                throw new Error('Test error');
            });
            mockInteraction.replied = true;

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.followUp).toHaveBeenCalledWith({
                content: 'An error occurred while processing the meme command.',
                ephemeral: true,
            });
        });
    });

    describe('Create Meme Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('create');
        });

        it('should create meme successfully with both texts', async () => {
            const mockTemplate: MemeTemplateAttributes = {
                id: 1,
                name: 'Test Template',
                url: 'http://example.com/image.jpg',
                is_active: true,
                usage_count: 5,
                description: 'Test description',
                default_font_size: 40,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template') // template
                .mockReturnValueOnce('Top Text') // top
                .mockReturnValueOnce('Bottom Text'); // bottom

            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);
            mockMemeGenerator.generateMeme.mockResolvedValue(Buffer.from('meme-data'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.findOne).toHaveBeenCalledWith({
                where: { name: 'Test Template', is_active: true },
            });

            expect(mockMemeGenerator.generateMeme).toHaveBeenCalledWith(
                mockTemplate,
                'Top Text',
                'Bottom Text',
            );

            expect(mockContext.sequelize.query).toHaveBeenCalledWith(
                'UPDATE meme_templates SET usage_count = usage_count + 1 WHERE id = ?',
                { replacements: [1] },
            );

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                files: [{
                    attachment: expect.any(Buffer),
                    name: 'test_template_meme.png',
                }],
            });
        });

        it('should create meme with only top text', async () => {
            const mockTemplate: MemeTemplateAttributes = {
                id: 1,
                name: 'Test Template',
                url: 'http://example.com/image.jpg',
                is_active: true,
                usage_count: 5,
                description: 'Test description',
                default_font_size: 40,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template') // template
                .mockReturnValueOnce('Top Text') // top
                .mockReturnValueOnce(null); // bottom

            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);
            mockMemeGenerator.generateMeme.mockResolvedValue(Buffer.from('meme-data'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeGenerator.generateMeme).toHaveBeenCalledWith(
                mockTemplate,
                'Top Text',
                undefined,
            );
        });

        it('should handle template not found', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Nonexistent Template')
                .mockReturnValueOnce('Top Text')
                .mockReturnValueOnce('Bottom Text');

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith('Template not found or inactive.');
        });

        it('should handle missing text fields', async () => {
            const mockTemplate: MemeTemplateAttributes = {
                id: 1,
                name: 'Test Template',
                url: 'http://example.com/image.jpg',
                is_active: true,
                usage_count: 5,
                description: 'Test description',
                default_font_size: 40,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce(null) // top
                .mockReturnValueOnce(null); // bottom

            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'At least one text field (top or bottom) must be provided.',
            );
        });

        it('should handle meme generation error', async () => {
            const mockTemplate: MemeTemplateAttributes = {
                id: 1,
                name: 'Test Template',
                url: 'http://example.com/image.jpg',
                is_active: true,
                usage_count: 5,
                description: 'Test description',
                default_font_size: 40,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce('Top Text')
                .mockReturnValueOnce('Bottom Text');

            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);
            mockMemeGenerator.generateMeme.mockRejectedValue(new Error('Generation failed'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error), templateName: 'Test Template' },
                'Failed to generate meme',
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Failed to generate meme. Please try again later.',
            );
        });

        it('should handle template without id for usage count', async () => {
            const mockTemplate: MemeTemplateAttributes = {
                // id: undefined,
                name: 'Test Template',
                url: 'http://example.com/image.jpg',
                is_active: true,
                usage_count: 5,
                description: 'Test description',
                default_font_size: 40,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any;

            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce('Top Text')
                .mockReturnValueOnce('Bottom Text');

            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);
            mockMemeGenerator.generateMeme.mockResolvedValue(Buffer.from('meme-data'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.sequelize.query).not.toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                files: [{
                    attachment: expect.any(Buffer),
                    name: 'test_template_meme.png',
                }],
            });
        });
    });

    describe('Custom Meme Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('custom');
        });

        it('should create custom meme successfully', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('https://example.com/image.jpg') // url
                .mockReturnValueOnce('Top Text') // top
                .mockReturnValueOnce('Bottom Text'); // bottom

            mockMemeGenerator.generateCustomMeme.mockResolvedValue(Buffer.from('custom-meme-data'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeGenerator.generateCustomMeme).toHaveBeenCalledWith(
                'https://example.com/image.jpg',
                'Top Text',
                'Bottom Text',
            );

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                files: [{
                    attachment: expect.any(Buffer),
                    name: 'custom_meme.png',
                }],
            });
        });

        it('should handle missing text fields', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('https://example.com/image.jpg')
                .mockReturnValueOnce(null) // top
                .mockReturnValueOnce(null); // bottom

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'At least one text field (top or bottom) must be provided.',
            );
        });

        it('should handle invalid URL', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('not-a-url')
                .mockReturnValueOnce('Top Text')
                .mockReturnValueOnce('Bottom Text');

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith('Invalid image URL provided.');
        });

        it('should handle custom meme generation error', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('https://example.com/image.jpg')
                .mockReturnValueOnce('Top Text')
                .mockReturnValueOnce('Bottom Text');

            mockMemeGenerator.generateCustomMeme.mockRejectedValue(new Error('Generation failed'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error), imageUrl: 'https://example.com/image.jpg' },
                'Failed to generate custom meme',
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Failed to generate meme. Please check the image URL and try again.',
            );
        });
    });

    describe('List Templates Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('list');
        });

        it('should list templates successfully with default page', async () => {
            const mockTemplates = [
                {
                    name: 'Drake Pointing',
                    usage_count: 10,
                    description: 'Drake pointing at something',
                },
                {
                    name: 'Distracted Boyfriend',
                    usage_count: 5,
                    description: null,
                },
            ];

            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);
            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 2,
                rows: mockTemplates,
            });

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.findAndCountAll).toHaveBeenCalledWith({
                where: { is_active: true },
                limit: 10,
                offset: 0,
                order: [['usage_count', 'DESC'], ['name', 'ASC']],
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{
                    title: '🎭 Available Meme Templates',
                    description: '1. **Drake Pointing** (used 10x) - Drake pointing at something\n' +
                        '2. **Distracted Boyfriend** (used 5x)',
                    color: 0x00FF00,
                    footer: {
                        text: 'Page 1/1 | Total: 2 templates',
                    },
                }],
            });
        });

        it('should list templates with specific page', async () => {
            const mockTemplates = [
                { name: 'Template 11', usage_count: 0, description: null },
            ];

            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(2);
            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 11,
                rows: mockTemplates,
            });

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.findAndCountAll).toHaveBeenCalledWith({
                where: { is_active: true },
                limit: 10,
                offset: 10,
                order: [['usage_count', 'DESC'], ['name', 'ASC']],
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [{
                    title: '🎭 Available Meme Templates',
                    description: '11. **Template 11**',
                    color: 0x00FF00,
                    footer: {
                        text: 'Page 2/2 | Total: 11 templates',
                    },
                }],
            });
        });

        it('should handle no templates available', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(1);
            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 0,
                rows: [],
            });

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith('No meme templates available.');
        });

        it('should handle database error in list templates', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(1);
            mockMemeTemplate.findAndCountAll.mockRejectedValue(new Error('Database error'));

            await memeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error listing meme templates',
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Failed to list templates.',
                ephemeral: true,
            });
        });
    });
});