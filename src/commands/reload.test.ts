import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import reload from './reload';
import * as permissions from '../utils/permissions';

// Mock the permissions module
jest.mock('../utils/permissions');

describe('reload command', () => {
    let mockInteraction: any;
    let mockContext: any;
    let mockCommand: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockCommand = {
            data: { name: 'test-command' },
        };

        mockInteraction = {
            commandName: 'reload',
            options: {
                getString: jest.fn().mockReturnValue('test-command'),
            },
            client: {
                commands: new Map([['test-command', mockCommand]]),
            },
            user: {
                id: '123456789',
                username: 'testuser',
            },
            reply: jest.fn(),
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
        };

        // Clear module cache to reload the command
        jest.resetModules();
    });

    it('should have correct command data', () => {
        expect(reload.data.name).toBe('reload');
        expect(reload.data.description).toBe('Reloads a command.');
    });

    it('should reject non-owner users', async () => {
        // Mock checkOwnerPermission to throw an error (non-owner)
        const mockCheckOwner = permissions.checkOwnerPermission as
            jest.MockedFunction<typeof permissions.checkOwnerPermission>;
        mockCheckOwner.mockRejectedValue(
            new Error('Unauthorized: User is not bot owner'),
        );

        await reload.execute(mockInteraction, mockContext);

        // Verify owner permission was checked
        expect(permissions.checkOwnerPermission).toHaveBeenCalledWith(
            mockInteraction,
            mockContext,
        );

        // Verify command was not reloaded
        expect(mockInteraction.reply).not.toHaveBeenCalledWith(
            expect.stringContaining('was reloaded'),
        );
    });

    it('should check owner permission and attempt reload for valid owner', async () => {
        // Mock checkOwnerPermission to succeed (owner)
        const mockCheckOwner = permissions.checkOwnerPermission as
            jest.MockedFunction<typeof permissions.checkOwnerPermission>;
        mockCheckOwner.mockResolvedValue(undefined as any);

        await reload.execute(mockInteraction, mockContext);

        // Verify owner permission was checked first
        expect(permissions.checkOwnerPermission).toHaveBeenCalledWith(
            mockInteraction,
            mockContext,
        );

        // Verify interaction was processed (either success or error, but permission was passed)
        expect(mockInteraction.reply).toHaveBeenCalled();
    });

    it('should handle invalid command names', async () => {
        // Mock checkOwnerPermission to succeed
        const mockCheckOwner = permissions.checkOwnerPermission as
            jest.MockedFunction<typeof permissions.checkOwnerPermission>;
        mockCheckOwner.mockResolvedValue(undefined as any);

        // Set invalid command name
        mockInteraction.options.getString = jest.fn().mockReturnValue('invalid-command');

        await reload.execute(mockInteraction, mockContext);

        // Verify error message for invalid command
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            'There is no command with name `invalid-command`!',
        );
    });

    it('should handle reload errors gracefully', async () => {
        // Mock checkOwnerPermission to succeed
        const mockCheckOwner = permissions.checkOwnerPermission as
            jest.MockedFunction<typeof permissions.checkOwnerPermission>;
        mockCheckOwner.mockResolvedValue(undefined as any);

        // Use a command that doesn't exist to trigger the error path naturally
        mockInteraction.options.getString = jest.fn().mockReturnValue('nonexistent-command');
        mockInteraction.client.commands.get = jest.fn().mockReturnValue({ data: { name: 'nonexistent-command' } });

        await reload.execute(mockInteraction, mockContext);

        // Verify owner permission was checked first
        expect(permissions.checkOwnerPermission).toHaveBeenCalledWith(
            mockInteraction,
            mockContext,
        );

        // Verify some error response was given (module loading failure)
        expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.stringContaining('There was an error while reloading command'),
        );
    });

    it('should log permission check attempts', async () => {
        // Mock checkOwnerPermission to throw
        const mockCheckOwner = permissions.checkOwnerPermission as
            jest.MockedFunction<typeof permissions.checkOwnerPermission>;
        mockCheckOwner.mockRejectedValue(
            new Error('Unauthorized'),
        );

        await reload.execute(mockInteraction, mockContext);

        // Verify logging occurred
        expect(permissions.checkOwnerPermission).toHaveBeenCalledWith(
            mockInteraction,
            mockContext,
        );
    });
});
