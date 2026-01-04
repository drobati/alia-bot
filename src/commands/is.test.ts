import { createContext, createInteraction, createTable, createRecord } from "../utils/testHelpers";
import isCommand from "./is";

describe('commands/is', () => {
    let interaction: ReturnType<typeof createInteraction>;
    let context: ReturnType<typeof createContext>;
    let UserDescriptions: ReturnType<typeof createTable>;

    const mockUser = {
        id: 'user-123',
        displayName: 'TestUser',
    };

    const mockCreator = {
        id: 'creator-456',
    };

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        UserDescriptions = createTable();
        context.tables.UserDescriptions = UserDescriptions;

        // Setup default interaction properties
        interaction.guildId = 'guild-123';
        interaction.user = mockCreator as any;
        interaction.options.getUser.mockReturnValue(mockUser);
        interaction.options.getString.mockReturnValue('a badass guitarist');
    });

    describe('add subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('add');
        });

        it('should add a new description to a user', async () => {
            UserDescriptions.findOne.mockResolvedValue(null);
            UserDescriptions.create.mockResolvedValue(createRecord({
                guild_id: 'guild-123',
                user_id: 'user-123',
                description: 'a badass guitarist',
                creator_id: 'creator-456',
            }));

            await isCommand.execute(interaction as never, context as never);

            expect(UserDescriptions.create).toHaveBeenCalledWith({
                guild_id: 'guild-123',
                user_id: 'user-123',
                description: 'a badass guitarist',
                creator_id: 'creator-456',
            });
            expect(interaction.reply).toHaveBeenCalledWith('Ok, TestUser is a badass guitarist.');
        });

        it('should show different message when describing yourself', async () => {
            interaction.user = { id: 'user-123' } as any;
            UserDescriptions.findOne.mockResolvedValue(null);
            UserDescriptions.create.mockResolvedValue(createRecord({}));

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith('Ok, you are a badass guitarist.');
        });

        it('should reject duplicate descriptions', async () => {
            UserDescriptions.findOne.mockResolvedValue(createRecord({
                description: 'a badass guitarist',
            }));

            await isCommand.execute(interaction as never, context as never);

            expect(UserDescriptions.create).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'I already know that TestUser is a badass guitarist.',
                ephemeral: true,
            });
        });

        it('should reject when not in a guild', async () => {
            interaction.guildId = null;

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });
    });

    describe('remove subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('remove');
        });

        it('should remove an existing description', async () => {
            const mockRecord = createRecord({ description: 'a badass guitarist' });
            UserDescriptions.findOne.mockResolvedValue(mockRecord);

            await isCommand.execute(interaction as never, context as never);

            expect(mockRecord.destroy).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                'Ok, TestUser is no longer a badass guitarist.',
            );
        });

        it('should inform when description does not exist', async () => {
            UserDescriptions.findOne.mockResolvedValue(null);

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "TestUser isn't a badass guitarist.",
                ephemeral: true,
            });
        });
    });

    describe('who subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand.mockReturnValue('who');
        });

        it('should list all descriptions for a user', async () => {
            UserDescriptions.findAll.mockResolvedValue([
                { description: 'a badass guitarist' },
                { description: 'an ego surfer' },
            ]);

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith(
                'TestUser is a badass guitarist, an ego surfer.',
            );
        });

        it('should use semicolons when descriptions contain commas', async () => {
            UserDescriptions.findAll.mockResolvedValue([
                { description: 'a guitarist, bassist, and drummer' },
                { description: 'an ego surfer' },
            ]);

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith(
                'TestUser is a guitarist, bassist, and drummer; an ego surfer.',
            );
        });

        it('should show special message when user has no descriptions', async () => {
            UserDescriptions.findAll.mockResolvedValue([]);

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith('TestUser? Nothing to me.');
        });

        it('should show special message when asking about the bot', async () => {
            interaction.options.getUser.mockReturnValue({
                id: 'bot-user-id',
                displayName: 'Alia',
            });
            UserDescriptions.findAll.mockResolvedValue([]);

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith('The best. 😎');
        });
    });

    describe('autocomplete', () => {
        it('should return matching descriptions for remove autocomplete', async () => {
            interaction.options.getFocused = jest.fn().mockReturnValue({
                name: 'description',
                value: 'guitar',
            });
            interaction.options.get = jest.fn().mockReturnValue({ value: 'user-123' });
            interaction.respond = jest.fn();

            UserDescriptions.findAll.mockResolvedValue([
                { description: 'a badass guitarist' },
                { description: 'a drummer' },
            ]);

            await isCommand.autocomplete(interaction as never, context as never);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'a badass guitarist', value: 'a badass guitarist' },
            ]);
        });

        it('should return empty array when no user selected', async () => {
            interaction.options.getFocused = jest.fn().mockReturnValue({
                name: 'description',
                value: '',
            });
            interaction.options.get = jest.fn().mockReturnValue(null);
            interaction.respond = jest.fn();

            await isCommand.autocomplete(interaction as never, context as never);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('error handling', () => {
        it('should handle unrecognized subcommand', async () => {
            interaction.options.getSubcommand.mockReturnValue('unknown');

            await isCommand.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "I don't recognize that command.",
                ephemeral: true,
            });
        });
    });

    describe('command data', () => {
        it('should have correct command name', () => {
            expect(isCommand.data.name).toBe('is');
        });

        it('should have description', () => {
            expect(isCommand.data.description).toBeDefined();
        });
    });
});
