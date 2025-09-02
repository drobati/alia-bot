import { ChatInputCommandInteraction } from 'discord.js';
import reloadCommand from './reload';

describe('Reload Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: any;
    let mockCommands: Map<string, any>;
    let originalRequireCache: any;

    beforeEach(() => {
        // Mock the require cache
        originalRequireCache = require.cache;
        require.cache = {};

        // Mock require function

        // Override require for specific test files
        jest.doMock('./test-command.js', () => ({
            data: { name: 'test-command' },
            execute: jest.fn(),
        }));

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

    afterEach(() => {
        require.cache = originalRequireCache;
        jest.resetModules();
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
        it('should successfully reload existing command', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Mock the require.resolve and require for the command
            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);

            // Set up cache entry to be deleted
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            } as any;

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `Command \`${commandName}\` was reloaded!`,
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                `Command \`${commandName}\` was deleted.`,
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                `Command \`test-command\` was added.`,
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should handle non-existent command', async () => {
            const commandName = 'nonexistent-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Remove command from the client's command collection
            mockCommands.delete('nonexistent-command');

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `There is no command with name \`${commandName}\`!`,
            );
            expect(mockContext.log.info).not.toHaveBeenCalled();
        });

        it('should handle case insensitive command names', async () => {
            const commandName = 'TEST-COMMAND';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // The command exists in lowercase
            const lowerCommandName = commandName.toLowerCase();
            mockCommands.set(lowerCommandName, {
                data: { name: lowerCommandName },
                execute: jest.fn(),
            });

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            };

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `Command \`${lowerCommandName}\` was reloaded!`,
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should handle reload errors gracefully', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Mock require.resolve to throw an error
            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockImplementation(() => {
                throw new Error('Module not found');
            });

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                `Error while reloading command \`${commandName}\`: Error: Module not found`,
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `There was an error while reloading command \`${commandName}\`: Module not found`,
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should handle require error during module loading', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);

            // Set up cache entry
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            };

            // Mock client.commands.delete to throw error
            mockCommands.delete = jest.fn().mockImplementation(() => {
                throw new Error('Cannot delete command');
            });

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.stringContaining('Error while reloading command'),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.stringContaining('There was an error while reloading command'),
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should handle empty command name', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('');

            // Empty command won't exist in commands collection
            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                'There is no command with name ``!',
            );
        });

        it('should handle whitespace in command name', async () => {
            const commandName = '  test-command  ';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            const trimmedName = commandName.trim().toLowerCase();
            mockCommands.set(trimmedName, {
                data: { name: trimmedName },
                execute: jest.fn(),
            });

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            };

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `Command \`${trimmedName}\` was reloaded!`,
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });
    });

    describe('validateCommand function', () => {
        it('should return true for existing command', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Ensure command exists
            mockCommands.set(commandName, {
                data: { name: commandName },
                execute: jest.fn(),
            });

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            };

            await reloadCommand.execute(mockInteraction, mockContext);

            // Should complete successfully without validation error
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `Command \`${commandName}\` was reloaded!`,
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should return false and reply for non-existent command', async () => {
            const commandName = 'nonexistent';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            // Ensure command doesn't exist
            mockCommands.clear();

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                `There is no command with name \`${commandName}\`!`,
            );

            // Should not proceed to reload
            expect(mockContext.log.info).not.toHaveBeenCalled();
        });
    });

    describe('reloadCommand function', () => {
        it('should clear require cache and reload module', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            const originalResolve = require.resolve;
            const modulePath = './test-command.js';
            (require.resolve as any) = jest.fn().mockReturnValue(modulePath);

            // Set up cache entry
            (require.cache as any)[modulePath] = {
                exports: { data: { name: 'old-command' } },
            };

            // Mock command collection methods
            const mockDelete = jest.fn();
            const mockSet = jest.fn();
            mockCommands.delete = mockDelete;
            mockCommands.set = mockSet;

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockDelete).toHaveBeenCalledWith(commandName);
            expect(mockSet).toHaveBeenCalled();
            expect(require.cache[modulePath]).toBeUndefined();

            // Restore original require.resolve
            require.resolve = originalResolve;
        });
    });

    describe('Error handling edge cases', () => {
        it('should handle errors with undefined message property', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockImplementation(() => {
                const error = new Error();
                delete (error as any).message;
                throw error;
            });

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.stringContaining('There was an error while reloading command'),
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });

        it('should handle async errors in command deletion', async () => {
            const commandName = 'test-command';
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue(commandName);

            const originalResolve = require.resolve;
            (require.resolve as any) = jest.fn().mockReturnValue(`./test-command.js`);
            (require.cache as any)[`./test-command.js`] = {
                exports: { data: { name: 'old-command' } },
            };

            // Mock async error in delete operation
            mockCommands.delete = jest.fn().mockImplementation(async () => {
                throw new Error('Async delete error');
            });

            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.stringContaining('Async delete error'),
            );

            // Restore original require.resolve
            require.resolve = originalResolve;
        });
    });
});