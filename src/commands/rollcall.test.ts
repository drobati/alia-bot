import { ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import rollcallCommand from './rollcall';
import { Context } from '../types';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Op } from 'sequelize';

// Mock dependencies
jest.mock('chartjs-node-canvas');
jest.mock('lodash', () => ({
    uniq: jest.fn(arr => [...new Set(arr)]), // Simple mock implementation
}));

const mockChartJSNodeCanvas = ChartJSNodeCanvas as jest.MockedClass<typeof ChartJSNodeCanvas>;

describe('Rollcall Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: Context;
    let mockRollCall: any;
    let mockChartInstance: any;

    beforeEach(() => {
        mockInteraction = {
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getNumber: jest.fn(),
                getFocused: jest.fn(),
            } as any,
            user: {
                username: 'testuser',
                id: 'test-user-id',
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
        };

        mockRollCall = {
            findAll: jest.fn(),
            create: jest.fn(),
        };

        mockContext = {
            tables: {
                RollCall: mockRollCall,
            },
            log: {
                error: jest.fn(),
            },
        } as any;

        mockChartInstance = {
            renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('chart-data')),
        };

        mockChartJSNodeCanvas.mockImplementation(() => mockChartInstance);

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(rollcallCommand.data.name).toBe('rc');
            expect(rollcallCommand.data.description).toBe('Roll Call command');
        });

        it('should have three subcommands', () => {
            const commandData = rollcallCommand.data.toJSON();
            expect(commandData.options).toHaveLength(3);

            const subcommandNames = commandData.options?.map((opt: any) => opt.name) || [];
            expect(subcommandNames).toContain('for');
            expect(subcommandNames).toContain('graph');
            expect(subcommandNames).toContain('set');
        });
    });

    describe('Autocomplete Function', () => {
        it('should handle username autocomplete successfully', async () => {
            const mockUsers = [
                { username: 'testuser1' },
                { username: 'testuser2' },
                { username: 'testuser1' }, // Duplicate to test uniq
            ];

            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'username', value: 'test' }),
                },
            };

            mockRollCall.findAll.mockResolvedValue(mockUsers);

            await rollcallCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockRollCall.findAll).toHaveBeenCalledWith({
                where: {
                    username: { [Op.like]: '%test%' },
                },
                limit: 5,
            });

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'testuser1', value: 'testuser1' },
                { name: 'testuser2', value: 'testuser2' },
            ]);
        });

        it('should ignore non-username focused options', async () => {
            const mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'score', value: '50' }),
                },
                respond: jest.fn(),
            };

            await rollcallCommand.autocomplete(mockAutocompleteInteraction, mockContext);

            expect(mockRollCall.findAll).not.toHaveBeenCalled();
            expect(mockAutocompleteInteraction.respond).not.toHaveBeenCalled();
        });
    });

    describe('Execute Function', () => {
        it('should handle for subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('1d');

            const mockScores = [
                { value: 85, timestamp: new Date() },
            ];
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [expect.any(EmbedBuilder)],
            });
        });

        it('should handle graph subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('graph');
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('testuser');

            const mockScores = [
                { value: 85, timestamp: new Date() },
            ];
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                files: [expect.any(AttachmentBuilder)],
            });
        });

        it('should handle set subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('set');
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(75);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 75,
                timestamp: expect.any(Date),
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Your roll call has been set to 75',
                ephemeral: true,
            });
        });

        it('should handle unknown subcommand', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('unknown');

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith('Unknown command');
        });

        it('should handle errors in execute function', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockImplementation(() => {
                throw new Error('Test error');
            });

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(expect.any(Error));
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while executing the command.',
                ephemeral: true,
            });
        });
    });

    describe('For Command Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
        });

        it('should display latest score for user without interval', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce(null);

            const mockScores = [
                { value: 70, timestamp: new Date('2023-01-01T10:00:00Z') },
                { value: 85, timestamp: new Date('2023-01-02T10:00:00Z') },
            ];
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.findAll).toHaveBeenCalledWith({
                where: {
                    username: 'testuser',
                    timestamp: { [Op.gte]: expect.any(Date) },
                },
                order: [['timestamp', 'ASC']],
            });

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            expect(embed.data.title).toBe("testuser's RC Score");
            expect(embed.data.fields[0].name).toBe('Latest Score');
            expect(embed.data.fields[0].value).toBe('85');
        });

        it('should display score for user with interval', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('1d');

            const mockScores = [
                { value: 80, timestamp: new Date() },
            ];
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.findAll).toHaveBeenCalled();

            // Check that the where clause includes a proper date filter
            const whereClause = mockRollCall.findAll.mock.calls[0][0].where;
            expect(whereClause.timestamp[Op.gte]).toBeInstanceOf(Date);
        });

        it('should handle no scores found', async () => {
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('nonexistentuser')
                .mockReturnValueOnce(null);

            mockRollCall.findAll.mockResolvedValue([]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No scores found for nonexistentuser',
                ephemeral: true,
            });
        });
    });

    describe('Graph Command Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('graph');
        });

        it('should generate graph for user with scores', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('testuser');

            const mockScores = Array.from({ length: 15 }, (_, i) => ({
                value: 50 + i,
                timestamp: new Date(`2023-01-${i + 1}T10:00:00Z`),
            }));
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockChartJSNodeCanvas).toHaveBeenCalledWith({ width: 200, height: 100 });
            expect(mockChartInstance.renderToBuffer).toHaveBeenCalledWith({
                type: 'line',
                data: expect.objectContaining({
                    labels: expect.arrayContaining([expect.any(String)]),
                    datasets: expect.arrayContaining([
                        expect.objectContaining({
                            label: 'Roll Call Score Shadow',
                            data: expect.arrayContaining([expect.any(Number)]),
                        }),
                        expect.objectContaining({
                            label: 'Roll Call Score',
                            data: expect.arrayContaining([expect.any(Number)]),
                        }),
                    ]),
                }),
                options: expect.any(Object),
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                files: [expect.any(AttachmentBuilder)],
            });
        });

        it('should limit to last 10 scores', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('testuser');

            const mockScores = Array.from({ length: 15 }, (_, i) => ({
                value: 50 + i,
                timestamp: new Date(`2023-01-${i + 1}T10:00:00Z`),
            }));
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            // Verify that renderToBuffer was called with only last 10 scores
            const chartConfig = mockChartInstance.renderToBuffer.mock.calls[0][0];
            expect(chartConfig.data.datasets[0].data).toHaveLength(10);
            expect(chartConfig.data.datasets[1].data).toHaveLength(10);

            // Should be the last 10 values (55-64)
            const expectedValues = [55, 56, 57, 58, 59, 60, 61, 62, 63, 64];
            expect(chartConfig.data.datasets[0].data).toEqual(expectedValues);
        });

        it('should handle no scores found for graph', async () => {
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('nonexistentuser');

            mockRollCall.findAll.mockResolvedValue([]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No scores found for nonexistentuser',
                ephemeral: true,
            });
        });
    });

    describe('Set Command Handler', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('set');
        });

        it('should set valid score', async () => {
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(75);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 75,
                timestamp: expect.any(Date),
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Your roll call has been set to 75',
                ephemeral: true,
            });
        });

        it('should reject score below 0', async () => {
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(-5);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Score must be between 0 and 100',
                ephemeral: true,
            });
        });

        it('should reject score above 100', async () => {
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(105);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Score must be between 0 and 100',
                ephemeral: true,
            });
        });

        it('should accept boundary values', async () => {
            // Test score = 0
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(0);
            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 0,
                timestamp: expect.any(Date),
            });

            jest.clearAllMocks();

            // Test score = 100
            (mockInteraction.options!.getNumber as jest.Mock).mockReturnValue(100);
            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockRollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 100,
                timestamp: expect.any(Date),
            });
        });
    });

    describe('parseInterval function', () => {
        // Since parseInterval is not exported, we need to test it through the for command
        it('should handle hours interval', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('3h');

            mockRollCall.findAll.mockResolvedValue([]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            // Verify that the timestamp filter was applied with correct time calculation
            const whereClause = mockRollCall.findAll.mock.calls[0][0].where;
            const pastDate = whereClause.timestamp[Op.gte];
            const expectedMillis = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
            const now = new Date();
            const expectedPastDate = new Date(now.getTime() - expectedMillis);

            // Allow for some time difference due to execution time
            expect(Math.abs(pastDate.getTime() - expectedPastDate.getTime())).toBeLessThan(1000);
        });

        it('should handle days interval', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('2d');

            mockRollCall.findAll.mockResolvedValue([]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            const whereClause = mockRollCall.findAll.mock.calls[0][0].where;
            const pastDate = whereClause.timestamp[Op.gte];
            const expectedMillis = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
            const now = new Date();
            const expectedPastDate = new Date(now.getTime() - expectedMillis);

            expect(Math.abs(pastDate.getTime() - expectedPastDate.getTime())).toBeLessThan(1000);
        });

        it('should handle minutes interval', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('30m');

            mockRollCall.findAll.mockResolvedValue([]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            const whereClause = mockRollCall.findAll.mock.calls[0][0].where;
            const pastDate = whereClause.timestamp[Op.gte];
            const expectedMillis = 30 * 60 * 1000; // 30 minutes in milliseconds
            const now = new Date();
            const expectedPastDate = new Date(now.getTime() - expectedMillis);

            expect(Math.abs(pastDate.getTime() - expectedPastDate.getTime())).toBeLessThan(1000);
        });

        it('should handle invalid interval format', async () => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('for');
            (mockInteraction.options!.getString as jest.Mock)
                .mockReturnValueOnce('testuser')
                .mockReturnValueOnce('invalid');

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while executing the command.',
                ephemeral: true,
            });
        });
    });

    describe('Chart Configuration', () => {
        beforeEach(() => {
            (mockInteraction.options!.getSubcommand as jest.Mock).mockReturnValue('graph');
            (mockInteraction.options!.getString as jest.Mock).mockReturnValue('testuser');
        });

        it('should configure chart with correct dimensions', async () => {
            mockRollCall.findAll.mockResolvedValue([
                { value: 50, timestamp: new Date() },
            ]);

            await rollcallCommand.execute(mockInteraction, mockContext);

            expect(mockChartJSNodeCanvas).toHaveBeenCalledWith({
                width: 200, // 400 / 2 (scale)
                height: 100, // 200 / 2 (scale)
            });
        });

        it('should create chart with correct data structure', async () => {
            const mockScores = [
                { value: 75, timestamp: new Date('2023-01-01T10:00:00Z') },
                { value: 85, timestamp: new Date('2023-01-02T10:00:00Z') },
            ];
            mockRollCall.findAll.mockResolvedValue(mockScores);

            await rollcallCommand.execute(mockInteraction, mockContext);

            const chartConfig = mockChartInstance.renderToBuffer.mock.calls[0][0];

            expect(chartConfig.type).toBe('line');
            expect(chartConfig.data.labels).toHaveLength(2);
            expect(chartConfig.data.datasets).toHaveLength(2);

            // Shadow dataset
            expect(chartConfig.data.datasets[0]).toMatchObject({
                label: 'Roll Call Score Shadow',
                data: [75, 85],
                borderColor: 'rgba(0, 0, 0, 0.7)',
                borderWidth: 4,
            });

            // Main dataset
            expect(chartConfig.data.datasets[1]).toMatchObject({
                label: 'Roll Call Score',
                data: [75, 85],
                borderColor: 'rgba(120, 200, 255, 1)',
                borderWidth: 3,
            });

            // Chart options
            expect(chartConfig.options).toMatchObject({
                scales: {
                    x: { display: false },
                    y: { display: false },
                },
                plugins: {
                    legend: { display: false },
                },
                devicePixelRatio: 1,
            });
        });
    });
});