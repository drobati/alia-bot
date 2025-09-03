import hapi from '@hapi/hapi';
import config from 'config';
import serverModule from './server';
import { MemeGenerator } from '../utils/memeGenerator';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

// Mock external dependencies
jest.mock('@hapi/hapi');
jest.mock('config');
jest.mock('../utils/memeGenerator');
jest.mock('chartjs-node-canvas');

const mockHapi = hapi as jest.Mocked<typeof hapi>;
const mockConfig = config as jest.Mocked<typeof config>;
const MockMemeGenerator = MemeGenerator as jest.Mocked<typeof MemeGenerator>;
const MockChartJSNodeCanvas = ChartJSNodeCanvas as jest.MockedClass<typeof ChartJSNodeCanvas>;

describe('Server Module', () => {
    let mockServer: any;
    let mockClient: any;
    let mockChannel: any;
    let mockEmbed: any;
    let mockModel: any;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Setup server mock
        mockServer = {
            route: jest.fn(),
            start: jest.fn().mockResolvedValue(undefined),
            info: { uri: 'http://localhost:3000' },
        };
        mockHapi.server.mockReturnValue(mockServer);

        // Setup config mock
        mockConfig.get.mockReturnValue(3000);

        // Setup Discord client mock
        mockClient = {
            users: new Map([
                ['123', { toString: () => '<@123>' }],
            ]),
        };

        // Setup Discord channel mock
        mockChannel = {
            send: jest.fn().mockResolvedValue({ id: 'message123' }),
        };

        // Setup Discord embed mock
        mockEmbed = {
            setColor: jest.fn().mockReturnThis(),
            setTitle: jest.fn().mockReturnThis(),
            setURL: jest.fn().mockReturnThis(),
            setDescription: jest.fn().mockReturnThis(),
        };

        // Setup model mock
        mockModel = {
            Twitch_Users: {
                findOne: jest.fn(),
            },
            Twitch_Notifications: {
                findOne: jest.fn(),
                create: jest.fn(),
            },
            MemeTemplate: {
                findOne: jest.fn(),
            },
            RollCall: {
                findAll: jest.fn(),
                create: jest.fn(),
            },
        };

        // Setup MemeGenerator mocks
        MockMemeGenerator.generateMeme = jest.fn().mockResolvedValue(Buffer.from('meme-data'));
        MockMemeGenerator.generateCustomMeme = jest.fn().mockResolvedValue(Buffer.from('custom-meme-data'));

        // Setup ChartJS mock
        const mockChartInstance = {
            renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('chart-data')),
            renderToDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test'),
            renderToDataURLSync: jest.fn().mockReturnValue('data:image/png;base64,test'),
            renderToBufferSync: jest.fn().mockReturnValue(Buffer.from('chart-data')),
            renderToStream: jest.fn().mockReturnValue({} as any),
            destroy: jest.fn(),
            getType: jest.fn().mockReturnValue('png'),
            getQuality: jest.fn().mockReturnValue(0.92),
            getMimeType: jest.fn().mockReturnValue('image/png'),
            getWidth: jest.fn().mockReturnValue(400),
            getHeight: jest.fn().mockReturnValue(400),
            getBackgroundColour: jest.fn().mockReturnValue('#FFFFFF'),
            getPlugins: jest.fn().mockReturnValue([]),
            registerFont: jest.fn(),
        };
        MockChartJSNodeCanvas.mockImplementation(() => mockChartInstance as any);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('Server initialization', () => {
        it('should create server with correct port from config', async () => {
            mockConfig.get.mockReturnValue(8080);

            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);

            expect(mockHapi.server).toHaveBeenCalledWith({
                port: 8080,
            });
            expect(mockConfig.get).toHaveBeenCalledWith('webhook.port');
        });

        it('should start server and log URI', async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);

            expect(mockServer.start).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('Server running at:', 'http://localhost:3000');
        });

        it('should register all required routes', async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);

            expect(mockServer.route).toHaveBeenCalledTimes(7);

            // Verify route registrations
            const routeCalls = mockServer.route.mock.calls;
            expect(routeCalls[0][0]).toMatchObject({
                method: 'GET',
                path: '/api/webhook',
            });
            expect(routeCalls[1][0]).toMatchObject({
                method: 'POST',
                path: '/api/webhook',
            });
            expect(routeCalls[2][0]).toMatchObject({
                method: 'POST',
                path: '/api/test-meme',
            });
            expect(routeCalls[3][0]).toMatchObject({
                method: 'POST',
                path: '/api/test-custom-meme',
            });
            expect(routeCalls[4][0]).toMatchObject({
                method: 'GET',
                path: '/api/test-rc-graph/{username}',
            });
            expect(routeCalls[5][0]).toMatchObject({
                method: 'GET',
                path: '/api/test-rc-graph-sample',
            });
            expect(routeCalls[6][0]).toMatchObject({
                method: 'POST',
                path: '/api/add-rc-score',
            });
        });
    });

    describe('GET /api/webhook handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[0][0].handler;
        });

        it('should return hub challenge for validation', () => {
            const mockRequest = {
                query: { 'hub.challenge': 'test-challenge-123' },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            const result = handler(mockRequest, mockH);

            expect(result).toBe('test-challenge-123');
            expect(consoleLogSpy).toHaveBeenCalledWith('test-challenge-123');
            expect(mockH.response).toHaveBeenCalledWith('success');
        });

        it('should handle missing challenge', () => {
            const mockRequest = { query: {} };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            const result = handler(mockRequest, mockH);

            expect(result).toBeUndefined();
            expect(consoleLogSpy).toHaveBeenCalledWith(undefined);
        });
    });

    describe('POST /api/webhook handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[1][0].handler;
        });

        it('should process new Twitch notification for known user', async () => {
            const mockRequest = {
                payload: {
                    data: [{
                        id: 'notification-123',
                        user_id: 'twitch-user-456',
                        user_name: 'teststreamer',
                        title: 'Test Stream',
                        type: 'live',
                    }],
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            // Mock database responses
            mockModel.Twitch_Notifications.findOne.mockResolvedValue(null);
            mockModel.Twitch_Notifications.create.mockResolvedValue({});
            mockModel.Twitch_Users.findOne.mockResolvedValue({
                user_id: '123',
            });

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockModel.Twitch_Notifications.findOne).toHaveBeenCalledWith({
                where: { notification_id: 'notification-123' },
            });
            expect(mockModel.Twitch_Notifications.create).toHaveBeenCalledWith({
                notification_id: 'notification-123',
            });
            expect(mockModel.Twitch_Users.findOne).toHaveBeenCalledWith({
                where: { twitch_id: 'twitch-user-456' },
            });

            expect(mockEmbed.setColor).toHaveBeenCalledWith('#0099ff');
            expect(mockEmbed.setTitle).toHaveBeenCalledWith('Test Stream');
            expect(mockEmbed.setURL).toHaveBeenCalledWith('https://www.twitch.tv/teststreamer');
            expect(mockEmbed.setDescription).toHaveBeenCalledWith('<@123> is live');

            expect(mockChannel.send).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith('success');
        });

        it('should handle unknown Discord user', async () => {
            const mockRequest = {
                payload: {
                    data: [{
                        id: 'notification-456',
                        user_id: 'unknown-user',
                        user_name: 'unknownstreamer',
                        title: 'Unknown Stream',
                        type: 'live',
                    }],
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.Twitch_Notifications.findOne.mockResolvedValue(null);
            mockModel.Twitch_Notifications.create.mockResolvedValue({});
            mockModel.Twitch_Users.findOne.mockResolvedValue(null);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockChannel.send).toHaveBeenCalledWith('Unknown discord user for unknownstreamer on twitch.');
            expect(mockH.response).toHaveBeenCalledWith('success');
        });

        it('should handle duplicate notifications', async () => {
            const mockRequest = {
                payload: {
                    data: [{
                        id: 'duplicate-notification',
                        user_id: 'user-123',
                        user_name: 'streamer',
                        title: 'Stream',
                        type: 'live',
                    }],
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.Twitch_Notifications.findOne.mockResolvedValue({ id: 'existing' });

            const result = await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockModel.Twitch_Notifications.create).not.toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith('success');
            expect(result).toBe('');
        });

        it('should handle requests without data', async () => {
            const mockRequest = { payload: {} };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            const result = await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith('success');
            expect(result).toBe('');
        });
    });

    describe('POST /api/test-meme handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[2][0].handler;
        });

        it('should generate meme successfully', async () => {
            const mockRequest = {
                payload: {
                    templateName: 'drake',
                    topText: 'Bad thing',
                    bottomText: 'Good thing',
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            const mockTemplate = { id: 1, name: 'drake', is_active: true };
            mockModel.MemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockModel.MemeTemplate.findOne).toHaveBeenCalledWith({
                where: { name: 'drake', is_active: true },
            });
            expect(MockMemeGenerator.generateMeme).toHaveBeenCalledWith(
                mockTemplate,
                'Bad thing',
                'Good thing',
            );
            expect(mockH.response).toHaveBeenCalledWith(Buffer.from('meme-data'));
            expect(consoleLogSpy).toHaveBeenCalledWith(
                'Testing meme generation: drake with texts: "Bad thing", "Good thing"',
            );
        });

        it('should handle missing template', async () => {
            const mockRequest = {
                payload: {
                    templateName: 'nonexistent',
                    topText: 'Top',
                    bottomText: 'Bottom',
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.MemeTemplate.findOne.mockResolvedValue(null);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith({ error: 'Template not found' });
        });

        it('should handle meme generation errors', async () => {
            const mockRequest = {
                payload: {
                    templateName: 'drake',
                    topText: 'Top',
                    bottomText: 'Bottom',
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            const mockTemplate = { id: 1, name: 'drake', is_active: true };
            mockModel.MemeTemplate.findOne.mockResolvedValue(mockTemplate);
            MockMemeGenerator.generateMeme.mockRejectedValue(new Error('Canvas error'));

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Meme generation error:', expect.any(Error));
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Failed to generate meme',
                details: 'Canvas error',
            });
        });

        it('should handle undefined text values', async () => {
            const mockRequest = {
                payload: {
                    templateName: 'drake',
                    // No topText or bottomText
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            const mockTemplate = { id: 1, name: 'drake', is_active: true };
            mockModel.MemeTemplate.findOne.mockResolvedValue(mockTemplate);

            await handler(mockRequest, mockH);

            expect(MockMemeGenerator.generateMeme).toHaveBeenCalledWith(
                mockTemplate,
                undefined,
                undefined,
            );
        });
    });

    describe('POST /api/test-custom-meme handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[3][0].handler;
        });

        it('should generate custom meme with array texts', async () => {
            const mockRequest = {
                payload: {
                    imageUrl: 'https://example.com/image.jpg',
                    texts: ['Top text', 'Bottom text'],
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(MockMemeGenerator.generateCustomMeme).toHaveBeenCalledWith(
                'https://example.com/image.jpg',
                'Top text',
                'Bottom text',
            );
            expect(mockH.response).toHaveBeenCalledWith(Buffer.from('custom-meme-data'));
        });

        it('should generate custom meme with object texts', async () => {
            const mockRequest = {
                payload: {
                    imageUrl: 'https://example.com/image.jpg',
                    texts: { topText: 'Top', bottomText: 'Bottom' },
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(MockMemeGenerator.generateCustomMeme).toHaveBeenCalledWith(
                'https://example.com/image.jpg',
                'Top',
                'Bottom',
            );
        });

        it('should generate custom meme with string texts', async () => {
            const mockRequest = {
                payload: {
                    imageUrl: 'https://example.com/image.jpg',
                    texts: 'Single text',
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(MockMemeGenerator.generateCustomMeme).toHaveBeenCalledWith(
                'https://example.com/image.jpg',
                'Single text',
                undefined,
            );
        });

        it('should handle custom meme generation errors', async () => {
            const mockRequest = {
                payload: {
                    imageUrl: 'https://example.com/image.jpg',
                    texts: ['Top', 'Bottom'],
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            MockMemeGenerator.generateCustomMeme.mockRejectedValue(new Error('Network error'));

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Custom meme generation error:', expect.any(Error));
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Failed to generate custom meme',
                details: 'Network error',
            });
        });
    });

    describe('GET /api/test-rc-graph/{username} handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[4][0].handler;
        });

        it('should generate RC graph for user with scores', async () => {
            const mockRequest = {
                params: { username: 'testuser' },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            const mockScores = [
                { value: 10, timestamp: new Date('2025-08-23T11:46:05') },
                { value: 8, timestamp: new Date('2025-08-24T10:30:00') },
                { value: 9, timestamp: new Date('2025-08-25T09:15:00') },
            ];
            mockModel.RollCall.findAll.mockResolvedValue(mockScores);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockModel.RollCall.findAll).toHaveBeenCalledWith({
                where: {
                    username: 'testuser',
                    timestamp: expect.any(Object),
                },
                order: [['timestamp', 'ASC']],
            });
            expect(mockH.response).toHaveBeenCalledWith(Buffer.from('chart-data'));
            expect(consoleLogSpy).toHaveBeenCalledWith('Testing RC graph generation for: testuser');
            expect(consoleLogSpy).toHaveBeenCalledWith('Found 3 scores for testuser');
        });

        it('should handle user with no scores', async () => {
            const mockRequest = {
                params: { username: 'newuser' },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.RollCall.findAll.mockResolvedValue([]);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'No scores found for newuser',
            });
        });

        it('should handle database errors', async () => {
            const mockRequest = {
                params: { username: 'testuser' },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.RollCall.findAll.mockRejectedValue(new Error('Database connection failed'));

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('RC graph generation error:', expect.any(Error));
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Failed to generate RC graph',
                details: 'Database connection failed',
            });
        });

        it('should limit to most recent 10 scores', async () => {
            const mockRequest = {
                params: { username: 'activeuser' },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            // Create 15 scores to test slicing
            const mockScores = Array.from({ length: 15 }, (_, i) => ({
                value: 5 + i,
                timestamp: new Date(`2025-08-${10 + i}T10:00:00`),
            }));
            mockModel.RollCall.findAll.mockResolvedValue(mockScores);

            await handler(mockRequest, mockH);

            // Verify that ChartJS was called (meaning scores were processed)
            expect(MockChartJSNodeCanvas).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('Found 10 scores for activeuser');
        });
    });

    describe('GET /api/test-rc-graph-sample handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[5][0].handler;
        });

        it('should generate sample RC graph', async () => {
            const mockRequest = {};
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('Testing RC graph generation with sample data');
            expect(consoleLogSpy).toHaveBeenCalledWith('Generated 5 sample scores');
            expect(mockH.response).toHaveBeenCalledWith(Buffer.from('chart-data'));
        });

        it('should handle chart generation errors', async () => {
            const mockRequest = {};
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            const mockChartInstance = {
                renderToBuffer: jest.fn().mockRejectedValue(new Error('Chart rendering failed')),
                renderToDataURL: jest.fn().mockResolvedValue('data:image/png;base64,test'),
                renderToDataURLSync: jest.fn().mockReturnValue('data:image/png;base64,test'),
                renderToBufferSync: jest.fn().mockReturnValue(Buffer.from('chart-data')),
                renderToStream: jest.fn().mockReturnValue({} as any),
                destroy: jest.fn(),
                getType: jest.fn().mockReturnValue('png'),
                getQuality: jest.fn().mockReturnValue(0.92),
                getMimeType: jest.fn().mockReturnValue('image/png'),
                getWidth: jest.fn().mockReturnValue(400),
                getHeight: jest.fn().mockReturnValue(400),
                getBackgroundColour: jest.fn().mockReturnValue('#FFFFFF'),
                getPlugins: jest.fn().mockReturnValue([]),
                registerFont: jest.fn(),
            };
            MockChartJSNodeCanvas.mockImplementation(() => mockChartInstance as any);

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('RC graph generation error:', expect.any(Error));
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Failed to generate RC graph',
                details: 'Chart rendering failed',
            });
        });
    });

    describe('POST /api/add-rc-score handler', () => {
        let handler: any;

        beforeEach(async () => {
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            handler = mockServer.route.mock.calls[6][0].handler;
        });

        it('should add valid RC score', async () => {
            const mockRequest = {
                payload: {
                    username: 'testuser',
                    score: 85,
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.RollCall.create.mockResolvedValue({});

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockModel.RollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 85,
                timestamp: expect.any(Date),
            });
            expect(mockH.response).toHaveBeenCalledWith({
                success: true,
                message: 'Added score 85 for testuser',
            });
            expect(consoleLogSpy).toHaveBeenCalledWith('Adding RC score for testuser: 85');
        });

        it('should reject score below 0', async () => {
            const mockRequest = {
                payload: {
                    username: 'testuser',
                    score: -5,
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Score must be between 0 and 100',
            });
            expect(mockModel.RollCall.create).not.toHaveBeenCalled();
        });

        it('should reject score above 100', async () => {
            const mockRequest = {
                payload: {
                    username: 'testuser',
                    score: 150,
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Score must be between 0 and 100',
            });
            expect(mockModel.RollCall.create).not.toHaveBeenCalled();
        });

        it('should handle database errors when adding score', async () => {
            const mockRequest = {
                payload: {
                    username: 'testuser',
                    score: 75,
                },
            };
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };

            mockModel.RollCall.create.mockRejectedValue(new Error('Database write failed'));

            await handler(mockRequest, mockH);

            expect(mockH.response).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Add RC score error:', expect.any(Error));
            expect(mockH.response).toHaveBeenCalledWith({
                error: 'Failed to add RC score',
                details: 'Database write failed',
            });
        });

        it('should accept boundary values (0 and 100)', async () => {
            const mockH = {
                response: jest.fn().mockReturnValue({
                    code: jest.fn().mockReturnThis(),
                }),
            };
            mockModel.RollCall.create.mockResolvedValue({});

            // Test score of 0
            await handler({
                payload: { username: 'testuser', score: 0 },
            }, mockH);

            expect(mockModel.RollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 0,
                timestamp: expect.any(Date),
            });

            // Reset and test score of 100
            mockModel.RollCall.create.mockClear();
            await handler({
                payload: { username: 'testuser', score: 100 },
            }, mockH);

            expect(mockModel.RollCall.create).toHaveBeenCalledWith({
                username: 'testuser',
                value: 100,
                timestamp: expect.any(Date),
            });
        });
    });

    describe('Chart generation utility', () => {
        it('should be tested through API endpoints', async () => {
            // The generateSparkline function is tested indirectly through the API endpoints
            // This test ensures we have coverage of the chart generation logic
            await serverModule(mockClient, mockChannel, mockEmbed, mockModel);
            const sampleHandler = mockServer.route.mock.calls[5][0].handler;

            const mockRequest = {};
            const mockH = {
                response: jest.fn().mockReturnValue({
                    type: jest.fn().mockReturnThis(),
                }),
            };

            await sampleHandler(mockRequest, mockH);

            // Verify ChartJS was instantiated with correct dimensions
            expect(MockChartJSNodeCanvas).toHaveBeenCalledWith({
                width: 200, // 400 / 2
                height: 100,  // 200 / 2
            });

            // Verify renderToBuffer was called with chart configuration
            const mockChartInstance = MockChartJSNodeCanvas.mock.results[0].value;
            expect(mockChartInstance.renderToBuffer).toHaveBeenCalledWith({
                type: 'line',
                data: expect.objectContaining({
                    labels: expect.any(Array),
                    datasets: expect.arrayContaining([
                        expect.objectContaining({
                            label: 'Roll Call Score Shadow',
                            borderColor: 'rgba(0, 0, 0, 0.7)',
                            borderWidth: 4,
                        }),
                        expect.objectContaining({
                            label: 'Roll Call Score',
                            borderColor: 'rgba(120, 200, 255, 1)',
                            borderWidth: 3,
                        }),
                    ]),
                }),
                options: expect.objectContaining({
                    scales: {
                        x: { display: false },
                        y: { display: false },
                    },
                    plugins: {
                        legend: { display: false },
                    },
                }),
            });
        });
    });
});