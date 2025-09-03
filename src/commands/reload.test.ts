import { ChatInputCommandInteraction } from 'discord.js';
import reloadCommand from './reload';

describe('Reload Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: any;
    let mockCommands: Map<string, any>;

    beforeEach(() => {
        mockCommands = new Map();
        mockCommands.set('test-command', {
            data: { name: 'test-command' },
            execute: jest.fn(),
        });

        mockInteraction = {
            options: {
                getString: jest.fn(),
            } as any,
            client: {
                commands: mockCommands,
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
        } as any;

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
        };

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(reloadCommand.data.name).toBe('reload');
            expect(reloadCommand.data.description).toBe('Reloads a command.');
        });

        it('should be development only', () => {
            expect(reloadCommand.developmentOnly).toBe(true);
        });

        it('should have required command option', () => {
            const commandData = reloadCommand.data.toJSON();
            const commandOption = commandData.options?.[0];

            expect(commandOption?.name).toBe('command');
            expect(commandOption?.description).toBe('The command to reload.');
            expect(commandOption?.required).toBe(true);
        });
    });

    describe('Execute Function', () => {
        it('should handle non-existent command', async () => {
            const commandName = 'nonexistent-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Remove command from the client's command collection
            mockCommands.clear();

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `There is no command with name \`${commandName}\`!`,
            );
        });

        it('should handle empty command name', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('');

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                'There is no command with name ``!',
            );
        });

        it('should attempt to reload existing command and handle module errors', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            await reloadCommand.execute(mockInteraction, mockContext);

            // Since we can't easily mock require(), we expect it to fail with module not found
            // This still tests the error handling path which is valuable
            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.stringContaining(`Error while reloading command \`${commandName}\`:`),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.stringContaining(`There was an error while reloading command \`${commandName}\`:`),
            );
        });
    });
});