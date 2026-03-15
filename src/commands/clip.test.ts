import clipCommand, { contextMenu } from './clip';

// Mock context factory
function createMockContext() {
    return {
        log: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        tables: {
            Clip: {
                findOrCreate: jest.fn(),
                findAll: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                count: jest.fn().mockResolvedValue(0),
                destroy: jest.fn().mockResolvedValue(1),
            },
        },
    } as any;
}

function createMockContextMenuInteraction(overrides: any = {}) {
    return {
        guildId: 'guild1',
        user: { id: 'clipper1', displayName: 'Clipper', username: 'clipper' },
        targetMessage: {
            id: 'msg1',
            channelId: 'ch1',
            content: 'This is a hilarious message',
            author: { id: 'author1', displayName: 'Author', username: 'author' },
            createdAt: new Date('2026-03-14T12:00:00Z'),
        },
        reply: jest.fn(),
        ...overrides,
    } as any;
}

function createMockSlashInteraction(subcommand: string, options: any = {}) {
    return {
        guildId: 'guild1',
        user: { id: 'user1', displayName: 'User', username: 'user' },
        isChatInputCommand: () => true,
        options: {
            getSubcommand: () => subcommand,
            getUser: (name: string) => options[name] || null,
            // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
            getInteger: (name: string, _required?: boolean) => options[name] ?? null,
            // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
            getString: (name: string, _required?: boolean) => options[name] ?? null,
        },
        reply: jest.fn(),
        replied: false,
        deferred: false,
        ...options.interactionOverrides,
    } as any;
}

describe('clip command', () => {
    describe('command data', () => {
        it('should have correct command name', () => {
            expect(clipCommand.data.name).toBe('clip');
        });

        it('should have four subcommands', () => {
            const json = clipCommand.data.toJSON();
            expect(json.options).toHaveLength(4);
            const names = json.options!.map((o: any) => o.name);
            expect(names).toEqual(['random', 'list', 'show', 'delete']);
        });
    });

    describe('context menu data', () => {
        it('should have correct name', () => {
            expect(contextMenu.data.name).toBe('Save Clip');
        });
    });

    describe('Save Clip (context menu)', () => {
        it('should save a clip successfully', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();
            const mockClip = { id: 1 };

            context.tables.Clip.findOrCreate.mockResolvedValue([mockClip, true]);

            await contextMenu.execute(interaction, context);

            expect(context.tables.Clip.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { guild_id: 'guild1', message_id: 'msg1' },
                }),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Clipped!') }),
            );
        });

        it('should reject duplicate clips', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();

            context.tables.Clip.findOrCreate.mockResolvedValue([{}, false]);

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'This message is already clipped!' }),
            );
        });

        it('should clip image-only messages', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({
                targetMessage: {
                    id: 'msg2',
                    channelId: 'ch1',
                    content: '',
                    author: { id: 'author1', displayName: 'Author', username: 'author' },
                    createdAt: new Date('2026-03-14T12:00:00Z'),
                    attachments: { first: () => ({ url: 'https://cdn.discord.com/img.png' }) },
                },
            });
            const mockClip = { id: 2 };
            context.tables.Clip.findOrCreate.mockResolvedValue([mockClip, true]);

            await contextMenu.execute(interaction, context);

            expect(context.tables.Clip.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaults: expect.objectContaining({
                        message_content: '[Image]',
                        attachment_url: 'https://cdn.discord.com/img.png',
                    }),
                }),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Clipped!') }),
            );
        });

        it('should save attachment_url for messages with text and image', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({
                targetMessage: {
                    id: 'msg3',
                    channelId: 'ch1',
                    content: 'Check this out',
                    author: { id: 'author1', displayName: 'Author', username: 'author' },
                    createdAt: new Date('2026-03-14T12:00:00Z'),
                    attachments: { first: () => ({ url: 'https://cdn.discord.com/pic.png' }) },
                },
            });
            const mockClip = { id: 3 };
            context.tables.Clip.findOrCreate.mockResolvedValue([mockClip, true]);

            await contextMenu.execute(interaction, context);

            expect(context.tables.Clip.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaults: expect.objectContaining({
                        message_content: 'Check this out',
                        attachment_url: 'https://cdn.discord.com/pic.png',
                    }),
                }),
            );
        });

        it('should reject empty messages with no attachments', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({
                targetMessage: {
                    ...createMockContextMenuInteraction().targetMessage,
                    content: '',
                    attachments: { first: () => undefined },
                },
            });

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("Can't clip") }),
            );
        });

        it('should reject DM usage', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({ guildId: null });

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clips only work in servers.' }),
            );
        });

        it('should handle database errors', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();

            context.tables.Clip.findOrCreate.mockRejectedValue(new Error('DB error'));

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Failed to save clip') }),
            );
        });
    });

    describe('/clip random', () => {
        it('should return a random clip', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('random');

            context.tables.Clip.count.mockResolvedValue(5);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 3,
                guild_id: 'guild1',
                channel_id: 'ch1',
                message_id: 'msg3',
                message_content: 'Something funny',
                message_author_id: 'author1',
                clipped_by_username: 'Clipper',
                message_timestamp: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should handle empty clip board', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('random');

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No clips saved yet') }),
            );
        });
    });

    describe('/clip list', () => {
        it('should list clips', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('list');

            context.tables.Clip.count.mockResolvedValue(1);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 1,
                message_content: 'Funny quote',
                message_author_id: 'author1',
                created_at: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should filter by user', async () => {
            const context = createMockContext();
            const mockUser = { id: 'author1', displayName: 'Author', username: 'author' };
            const interaction = createMockSlashInteraction('list', { user: mockUser });

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(context.tables.Clip.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ message_author_id: 'author1' }),
                }),
            );
        });

        it('should handle empty results', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('list');

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No clips saved yet') }),
            );
        });
    });

    describe('/clip show', () => {
        it('should return a matching clip with query', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('show', { query: 'funny' });

            context.tables.Clip.count.mockResolvedValue(2);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 5,
                guild_id: 'guild1',
                channel_id: 'ch1',
                message_id: 'msg5',
                message_content: 'Something funny happened',
                message_author_id: 'author1',
                clipped_by_username: 'Clipper',
                message_timestamp: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should show random clip for user with no query', async () => {
            const context = createMockContext();
            const mockUser = { id: 'author1', displayName: 'Author', username: 'author' };
            const interaction = createMockSlashInteraction('show', { user: mockUser });

            context.tables.Clip.count.mockResolvedValue(3);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 2,
                guild_id: 'guild1',
                channel_id: 'ch1',
                message_id: 'msg2',
                message_content: 'A quote by author',
                message_author_id: 'author1',
                clipped_by_username: 'Clipper',
                message_timestamp: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(context.tables.Clip.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ message_author_id: 'author1' }),
                }),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should filter by user and query', async () => {
            const context = createMockContext();
            const mockUser = { id: 'author1', displayName: 'Author', username: 'author' };
            const interaction = createMockSlashInteraction('show', {
                query: 'funny', user: mockUser,
            });

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(context.tables.Clip.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        message_author_id: 'author1',
                    }),
                }),
            );
        });

        it('should handle no matches with query', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('show', { query: 'nonexistent' });

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No clips matching'),
                }),
            );
        });

        it('should handle no clips for user', async () => {
            const context = createMockContext();
            const mockUser = { id: 'author1', displayName: 'Author', username: 'author' };
            const interaction = createMockSlashInteraction('show', { user: mockUser });

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No clips by Author'),
                }),
            );
        });
    });

    describe('autocomplete', () => {
        it('should return matching clips', async () => {
            const context = createMockContext();
            const respond = jest.fn();
            const interaction = {
                guildId: 'guild1',
                options: {
                    getFocused: () => 'funny',
                    getUser: () => null,
                },
                respond,
            };

            context.tables.Clip.findAll.mockResolvedValue([
                { id: 1, message_content: 'Something funny', created_at: new Date() },
                { id: 2, message_content: 'Very funny stuff', created_at: new Date() },
            ]);

            await clipCommand.autocomplete(interaction, context);

            expect(respond).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ name: expect.stringContaining('funny') }),
                ]),
            );
        });

        it('should filter by user when selected', async () => {
            const context = createMockContext();
            const respond = jest.fn();
            const interaction = {
                guildId: 'guild1',
                options: {
                    getFocused: () => '',
                    getUser: () => ({ id: 'author1' }),
                },
                respond,
            };

            context.tables.Clip.findAll.mockResolvedValue([]);

            await clipCommand.autocomplete(interaction, context);

            expect(context.tables.Clip.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        message_author_id: 'author1',
                    }),
                }),
            );
        });
    });

    describe('/clip delete', () => {
        it('should delete clip when requested by clipper', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'user1',
                message_author_id: 'author1',
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clip #1 deleted.' }),
            );
        });

        it('should delete clip when requested by quoted person', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'someone_else',
                message_author_id: 'user1', // interaction.user.id matches
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).toHaveBeenCalled();
        });

        it('should reject unauthorized delete', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'other1',
                message_author_id: 'other2',
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('can only delete') }),
            );
        });

        it('should handle clip not found', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 999 });

            context.tables.Clip.findOne.mockResolvedValue(null);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clip #999 not found.' }),
            );
        });
    });
});
