import { SlashCommandBuilder } from 'discord.js';
import voiceCommand from './voice';
import { createInteraction, createContext, createTable } from '../utils/testHelpers';
import config from 'config';

jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('commands/voice', () => {
    let interaction: ReturnType<typeof createInteraction>;
    let context: ReturnType<typeof createContext>;
    let Voice: ReturnType<typeof createTable>;

    beforeEach(() => {
        jest.clearAllMocks();
        interaction = createInteraction();
        context = createContext();
        Voice = createTable();
        context.tables.Voice = Voice;

        // Default to owner
        interaction.user.id = 'test-owner-id';
        mockConfig.get.mockImplementation((key: string) => {
            if (key === 'owner') { return 'test-owner-id'; }
            return undefined;
        });
    });

    describe('command data', () => {
        it('should have correct command name and description', () => {
            expect(voiceCommand.data).toBeInstanceOf(SlashCommandBuilder);
            expect(voiceCommand.data.name).toBe('voice');
            expect(voiceCommand.data.description).toBe('Manage saved TTS voices.');
        });

        it('should have add, remove, and list subcommands', () => {
            const json = voiceCommand.data.toJSON();
            const subcommands = json.options?.map((o: any) => o.name);
            expect(subcommands).toEqual(['add', 'remove', 'list']);
        });
    });

    describe('permission check', () => {
        it('should reject non-owner users', async () => {
            interaction.user.id = 'not-owner';
            interaction.options.getSubcommand.mockReturnValue('list');

            await voiceCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('restricted to the bot owner'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('add subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('add');
        });

        it('should save a new voice', async () => {
            interaction.options.getString
                .mockReturnValueOnce('morgan')
                .mockReturnValueOnce('abc123')
                .mockReturnValueOnce('Deep smooth narrator');
            Voice.findOne.mockResolvedValue(null);

            await voiceCommand.execute(interaction as never, context as never);

            expect(Voice.create).toHaveBeenCalledWith({
                name: 'morgan',
                voiceId: 'abc123',
                description: 'Deep smooth narrator',
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Saved voice **morgan** (`abc123`)\n> Deep smooth narrator',
                ephemeral: true,
            });
        });

        it('should lowercase and trim the name', async () => {
            interaction.options.getString
                .mockReturnValueOnce('  Morgan  ')
                .mockReturnValueOnce('abc123')
                .mockReturnValueOnce('A voice');
            Voice.findOne.mockResolvedValue(null);

            await voiceCommand.execute(interaction as never, context as never);

            expect(Voice.create).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'morgan' }),
            );
        });

        it('should reject duplicate names', async () => {
            interaction.options.getString
                .mockReturnValueOnce('morgan')
                .mockReturnValueOnce('abc123')
                .mockReturnValueOnce('A voice');
            Voice.findOne.mockResolvedValue({ name: 'morgan' });

            await voiceCommand.execute(interaction as never, context as never);

            expect(Voice.create).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Voice **morgan** already exists. Remove it first to re-add.',
                ephemeral: true,
            });
        });
    });

    describe('remove subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('remove');
        });

        it('should remove an existing voice', async () => {
            interaction.options.getString.mockReturnValue('morgan');
            Voice.destroy.mockResolvedValue(1);

            await voiceCommand.execute(interaction as never, context as never);

            expect(Voice.destroy).toHaveBeenCalledWith({
                where: { name: 'morgan' },
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Removed voice **morgan**.',
                ephemeral: true,
            });
        });

        it('should report when voice not found', async () => {
            interaction.options.getString.mockReturnValue('nonexistent');
            Voice.destroy.mockResolvedValue(0);

            await voiceCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'No voice found with name **nonexistent**.',
                ephemeral: true,
            });
        });
    });

    describe('list subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('list');
        });

        it('should list all saved voices', async () => {
            Voice.findAll.mockResolvedValue([
                { name: 'alice', voiceId: 'id1', description: 'Soft female' },
                { name: 'morgan', voiceId: 'id2', description: 'Deep male' },
            ]);

            await voiceCommand.execute(interaction as never, context as never);

            expect(Voice.findAll).toHaveBeenCalledWith({
                order: [['name', 'ASC']],
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Saved Voices (2)'),
                ephemeral: true,
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('**alice** `id1`'),
                ephemeral: true,
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('**morgan** `id2`'),
                ephemeral: true,
            });
        });

        it('should show empty message when no voices saved', async () => {
            Voice.findAll.mockResolvedValue([]);

            await voiceCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'No saved voices. Use `/voice add` to save one.',
                ephemeral: true,
            });
        });
    });

    describe('autocomplete', () => {
        it('should return matching voices for owner', async () => {
            interaction.options.getFocused.mockReturnValue('mor');
            Voice.findAll.mockResolvedValue([
                { name: 'morgan', description: 'Deep male' },
            ]);

            await voiceCommand.autocomplete(interaction as never, context as never);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'morgan - Deep male', value: 'morgan' },
            ]);
        });

        it('should return empty for non-owner', async () => {
            interaction.user.id = 'not-owner';
            interaction.options.getFocused.mockReturnValue('mor');

            await voiceCommand.autocomplete(interaction as never, context as never);

            expect(interaction.respond).toHaveBeenCalledWith([]);
            expect(Voice.findAll).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            interaction.options.getSubcommand.mockReturnValue('list');
            Voice.findAll.mockRejectedValue(new Error('DB error'));

            await voiceCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Something went wrong.',
                ephemeral: true,
            });
            expect(context.log.error).toHaveBeenCalled();
        });
    });
});
