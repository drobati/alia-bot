import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCommand = {
    data: { name: 'test-command' },
    execute: jest.fn(),
};

const mockClient = {
    commands: {
        get: jest.fn(),
        delete: jest.fn(),
        set: jest.fn(),
    },
};

const mockInteraction = {
    client: mockClient,
    options: {
        getString: jest.fn(),
    },
    reply: jest.fn(),
};

const mockContext = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
    },
};

// Mock require.cache and require.resolve
const originalRequireCache = require.cache;
const mockRequireResolve = jest.fn();
const mockRequire = jest.fn();

describe('Reload Command', () => {
    let reloadCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        // Setup mocks
        mockInteraction.options.getString.mockReturnValue('test-command');
        
        // Mock require functions
        (global as any).require = Object.assign(mockRequire, {
            cache: {},
            resolve: mockRequireResolve,
        });
        
        mockRequireResolve.mockReturnValue('./test-command.js');
        mockRequire.mockReturnValue(mockCommand);

        // Import after mocking
        reloadCommand = (await import('./reload')).default;
    });

    afterEach(() => {
        require.cache = originalRequireCache;
    });

    describe('execute', () => {
        it('should reload a command successfully', async () => {
            mockClient.commands.get.mockReturnValue(mockCommand);
            
            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.options.getString).toHaveBeenCalledWith('command', true);
            expect(mockClient.commands.get).toHaveBeenCalledWith('test-command');
            expect(mockClient.commands.delete).toHaveBeenCalledWith('test-command');
            expect(mockClient.commands.set).toHaveBeenCalledWith('test-command', mockCommand);
            expect(mockContext.log.info).toHaveBeenCalledWith('Command `test-command` was deleted.');
            expect(mockContext.log.info).toHaveBeenCalledWith('Command `test-command` was added.');
            expect(mockInteraction.reply).toHaveBeenCalledWith('Command `test-command` was reloaded!');
        });

        it('should handle non-existent command', async () => {
            mockClient.commands.get.mockReturnValue(null);
            
            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith('There is no command with name `test-command`!');
            expect(mockClient.commands.delete).not.toHaveBeenCalled();
        });

        it('should handle reload errors', async () => {
            mockClient.commands.get.mockReturnValue(mockCommand);
            const error = new Error('Delete failed');
            mockClient.commands.delete.mockImplementation(() => Promise.reject(error));
            
            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error while reloading command `test-command`: Error: Delete failed'
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                'There was an error while reloading command `test-command`: Delete failed'
            );
        });

        it('should handle case insensitive command names', async () => {
            mockInteraction.options.getString.mockReturnValue('TEST-COMMAND');
            mockClient.commands.get.mockReturnValue(mockCommand);
            
            await reloadCommand.execute(mockInteraction, mockContext);

            expect(mockClient.commands.get).toHaveBeenCalledWith('test-command');
        });
    });

    describe('command data', () => {
        it('should have correct command configuration', () => {
            expect(reloadCommand.data.name).toBe('reload');
            expect(reloadCommand.data.description).toBe('Reloads a command.');
        });
    });
});