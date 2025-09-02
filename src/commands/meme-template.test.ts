import { ChatInputCommandInteraction } from 'discord.js';
import memeTemplateCommand from './meme-template';
import { Context } from '../types';

describe('Meme Template Command', () => {
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
            user: {
                username: 'testuser',
                id: 'test-user-id',
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue(undefined),
            replied: false,
            deferred: false,
        };

        mockMemeTemplate = {
            findOne: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            destroy: jest.fn(),
            findAndCountAll: jest.fn(),
        };

        mockContext = {
            tables: {
                MemeTemplate: mockMemeTemplate,
            },
            log: {
                error: jest.fn(),
                info: jest.fn(),
            },
        } as any;

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(memeTemplateCommand.data.name).toBe('meme-template');
            expect(memeTemplateCommand.data.description).toBe('Manage meme templates');
        });

        it('should have six subcommands', () => {
            const commandData = memeTemplateCommand.data.toJSON();
            expect(commandData.options).toHaveLength(6);

            const subcommandNames = commandData.options?.map((opt: any) => opt.name) || [];
            expect(subcommandNames).toContain('add');
            expect(subcommandNames).toContain('remove');
            expect(subcommandNames).toContain('edit');
            expect(subcommandNames).toContain('toggle');
            expect(subcommandNames).toContain('info');
            expect(subcommandNames).toContain('stats');
        });
    });

    describe('Autocomplete Function', () => {
        it('should handle name autocomplete successfully', async () => {
            const mockTemplates = [
                { name: 'Drake Pointing', is_active: true },
                { name: 'Distracted Boyfriend', is_active: false },
                { name: 'Drake Template', is_active: true },
            ];

            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'name', value: 'drake' }),
                },
            };

            mockMemeTemplate.findAll.mockResolvedValue(mockTemplates);

            await memeTemplateCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockMemeTemplate.findAll).toHaveBeenCalledWith({
                limit: 25,
                order: [['name', 'ASC']],
            });

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Drake Pointing ✅', value: 'Drake Pointing' },
                { name: 'Drake Template ✅', value: 'Drake Template' },
            ]);
        });

        it('should handle autocomplete errors gracefully', async () => {
            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'name', value: 'test' }),
                },
            };

            mockMemeTemplate.findAll.mockRejectedValue(new Error('Database error'));

            await memeTemplateCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in template autocomplete',
            );
            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([]);
        });

        it('should ignore non-name focused options', async () => {
            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'description', value: 'test' }),
                },
                respond: jest.fn(),
            };

            await memeTemplateCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockMemeTemplate.findAll).not.toHaveBeenCalled();
            expect(mockAutocompleteInteraction.respond).not.toHaveBeenCalled();
        });
    });

    describe('Execute Function', () => {
        it('should handle all subcommands', async () => {
            const subcommands = ['add', 'remove', 'edit', 'toggle', 'info', 'stats'];

            for (const subcommand of subcommands) {
                jest.clearAllMocks();
                (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue(subcommand);

                // Mock required data for each subcommand
                if (subcommand === 'add') {
                    (mockInteraction.options!.getString as jest.Mock)
                        .mockReturnValueOnce('Test Template')
                        .mockReturnValueOnce('https://example.com/image.jpg');
                    mockMemeTemplate.findOne.mockResolvedValue(null);
                } else if (['remove', 'edit', 'toggle', 'info'].includes(subcommand)) {
                    (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Test Template');
                    mockMemeTemplate.findOne.mockResolvedValue({
                        name: 'Test Template',
                        is_active: true,
                        id: 1,
                    });
                } else if (subcommand === 'stats') {
                    mockMemeTemplate.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
                }

                await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalled();
            }
        });

        it('should handle unknown subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('unknown');

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Unknown subcommand.',
                ephemeral: true,
            });
        });

        it('should handle errors in execute function', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockImplementation(() => {
                throw new Error('Test error');
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in meme-template command',
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while processing the template command.',
                ephemeral: true,
            });
        });

        it('should handle errors with replied interaction', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockImplementation(() => {
                throw new Error('Test error');
            });
            mockInteraction.replied = true;

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.followUp).toHaveBeenCalledWith({
                content: 'An error occurred while processing the template command.',
                ephemeral: true,
            });
        });
    });

    describe('Add Template Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('add');
        });

        it('should add template successfully with all options', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('  Test Template  ') // name (with spaces to test trim)
                .mockReturnValueOnce('  https://example.com/image.jpg  ') // url
                .mockReturnValueOnce('  A test template  '); // description
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(50); // fontsize

            mockMemeTemplate.findOne.mockResolvedValue(null); // No existing template

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.create).toHaveBeenCalledWith({
                name: 'Test Template',
                url: 'https://example.com/image.jpg',
                description: 'A test template',
                default_font_size: 50,
                creator: 'testuser',
                usage_count: 0,
                is_active: true,
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Test Template" has been added successfully!',
                ephemeral: true,
            });
        });

        it('should add template with minimal required options', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Minimal Template') // name
                .mockReturnValueOnce('https://example.com/minimal.jpg') // url
                .mockReturnValueOnce(null); // description
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null); // fontsize

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.create).toHaveBeenCalledWith({
                name: 'Minimal Template',
                url: 'https://example.com/minimal.jpg',
                description: undefined,
                default_font_size: 40, // default value
                creator: 'testuser',
                usage_count: 0,
                is_active: true,
            });
        });

        it('should handle invalid URL', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce('not-a-valid-url');

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Invalid URL provided.',
                ephemeral: true,
            });
            expect(mockMemeTemplate.create).not.toHaveBeenCalled();
        });

        it('should handle duplicate template name', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Existing Template')
                .mockReturnValueOnce('https://example.com/image.jpg');

            mockMemeTemplate.findOne.mockResolvedValue({
                name: 'Existing Template',
                id: 1,
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template with name "Existing Template" already exists.',
                ephemeral: true,
            });
            expect(mockMemeTemplate.create).not.toHaveBeenCalled();
        });

        it('should handle database error during creation', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce('https://example.com/image.jpg');

            mockMemeTemplate.findOne.mockResolvedValue(null);
            mockMemeTemplate.create.mockRejectedValue(new Error('Database error'));

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in meme-template command',
            );
        });
    });

    describe('Remove Template Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('remove');
        });

        it('should remove template successfully', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Test Template');

            mockMemeTemplate.findOne.mockResolvedValue({
                name: 'Test Template',
                id: 1,
                destroy: jest.fn().mockResolvedValue(undefined),
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Test Template" has been removed.',
                ephemeral: true,
            });
        });

        it('should handle template not found', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Nonexistent Template');

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Nonexistent Template" not found.',
                ephemeral: true,
            });
        });
    });

    describe('Edit Template Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('edit');
        });

        it('should edit all template properties', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Old Template') // name
                .mockReturnValueOnce('https://example.com/new-image.jpg') // url
                .mockReturnValueOnce('Updated description'); // description
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(60); // fontsize

            const mockTemplate = {
                id: 1,
                name: 'Old Template',
                url: 'https://example.com/old-image.jpg',
                update: jest.fn().mockResolvedValue([1]),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTemplate.update).toHaveBeenCalledWith({
                url: 'https://example.com/new-image.jpg',
                description: 'Updated description',
                default_font_size: 60,
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Old Template" has been updated successfully!',
                ephemeral: true,
            });
        });

        it('should edit only provided properties', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template') // name
                .mockReturnValueOnce(null) // url
                .mockReturnValueOnce('New description only'); // description
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null); // fontsize

            const mockTemplate = {
                id: 1,
                name: 'Test Template',
                update: jest.fn().mockResolvedValue([1]),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTemplate.update).toHaveBeenCalledWith({
                description: 'New description only',
            });
        });

        it('should handle no changes provided', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce(null) // url
                .mockReturnValueOnce(null); // description
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null); // fontsize

            const mockTemplate = { id: 1, name: 'Test Template' };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No changes provided to update.',
                ephemeral: true,
            });
        });

        it('should handle template not found', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Nonexistent Template');

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Nonexistent Template" not found.',
                ephemeral: true,
            });
        });

        it('should handle invalid URL in edit', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('Test Template')
                .mockReturnValueOnce('invalid-url');

            const mockTemplate = { id: 1, name: 'Test Template' };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Invalid URL provided.',
                ephemeral: true,
            });
        });
    });

    describe('Toggle Template Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('toggle');
        });

        it('should toggle active template to inactive', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Active Template');

            const mockTemplate = {
                id: 1,
                name: 'Active Template',
                is_active: true,
                update: jest.fn().mockResolvedValue([1]),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTemplate.update).toHaveBeenCalledWith({ is_active: false });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Active Template" has been disabled.',
                ephemeral: true,
            });
        });

        it('should toggle inactive template to active', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Inactive Template');

            const mockTemplate = {
                id: 1,
                name: 'Inactive Template',
                is_active: false,
                update: jest.fn().mockResolvedValue([1]),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTemplate.update).toHaveBeenCalledWith({ is_active: true });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Inactive Template" has been enabled.',
                ephemeral: true,
            });
        });

        it('should handle template not found', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Nonexistent Template');

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Nonexistent Template" not found.',
                ephemeral: true,
            });
        });
    });

    describe('Template Info Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('info');
        });

        it('should display complete template information', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Test Template');

            const mockTemplate = {
                name: 'Test Template',
                url: 'https://example.com/image.jpg',
                description: 'A test template',
                default_font_size: 40,
                creator: 'testuser',
                usage_count: 25,
                is_active: true,
                created_at: new Date('2023-01-01T10:00:00Z'),
                updated_at: new Date('2023-01-02T10:00:00Z'),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: '🎭 Test Template',
                    fields: expect.arrayContaining([
                        { name: 'Status', value: '✅ Active', inline: true },
                        { name: 'Usage Count', value: '25', inline: true },
                        { name: 'Font Size', value: '40', inline: true },
                        { name: 'Creator', value: 'testuser', inline: true },
                        { name: 'Description', value: 'A test template', inline: false },
                        { name: 'Created', value: expect.stringContaining('1/1/2023'), inline: true },
                        { name: 'Updated', value: expect.stringContaining('1/2/2023'), inline: true },
                    ]),
                    image: { url: 'https://example.com/image.jpg' },
                    color: 0x00FF00,
                })],
            });
        });

        it('should handle template without description', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Minimal Template');

            const mockTemplate = {
                name: 'Minimal Template',
                url: 'https://example.com/image.jpg',
                description: null,
                default_font_size: 40,
                creator: 'testuser',
                usage_count: 0,
                is_active: false,
                created_at: new Date(),
                updated_at: new Date(),
            };
            mockMemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];

            expect(embed.fields).not.toContainEqual(
                expect.objectContaining({ name: 'Description' }),
            );
            expect(embed.fields).toContainEqual({ name: 'Status', value: '❌ Inactive', inline: true });
        });

        it('should handle template not found', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Nonexistent Template');

            mockMemeTemplate.findOne.mockResolvedValue(null);

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Template "Nonexistent Template" not found.',
                ephemeral: true,
            });
        });
    });

    describe('Template Stats Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('stats');
        });

        it('should display template statistics with default limit', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

            const mockTemplates = [
                { name: 'Popular Template', usage_count: 50, is_active: true, creator: 'user1' },
                { name: 'Another Template', usage_count: 25, is_active: true, creator: 'user2' },
                { name: 'Unused Template', usage_count: 0, is_active: false, creator: 'user3' },
            ];

            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 25,
                rows: mockTemplates,
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.findAndCountAll).toHaveBeenCalledWith({
                order: [['usage_count', 'DESC'], ['name', 'ASC']],
                limit: 10, // default limit
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.objectContaining({
                    title: '📊 Meme Template Usage Statistics',
                    description: expect.stringContaining('1. **Popular Template** ✅ - 50 uses (by user1)'),
                    footer: { text: 'Showing top 10 of 25 total templates' },
                })],
            });
        });

        it('should display stats with custom limit', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(5);

            const mockTemplates = [
                { name: 'Template 1', usage_count: 10, is_active: true, creator: 'user1' },
            ];

            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 15,
                rows: mockTemplates,
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockMemeTemplate.findAndCountAll).toHaveBeenCalledWith({
                order: [['usage_count', 'DESC'], ['name', 'ASC']],
                limit: 5,
            });

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            expect(replyCall.embeds[0].footer.text).toBe('Showing top 5 of 15 total templates');
        });

        it('should handle no templates available', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

            mockMemeTemplate.findAndCountAll.mockResolvedValue({
                count: 0,
                rows: [],
            });

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No templates found.',
                ephemeral: true,
            });
        });

        it('should handle database error in stats', async () => {
            (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

            mockMemeTemplate.findAndCountAll.mockRejectedValue(new Error('Database error'));

            await memeTemplateCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error: expect.any(Error) },
                'Error in meme-template command',
            );
        });
    });
});