import axios from 'axios';
import { get } from 'lodash';
import twitchApi from './twitch';

// Mock external dependencies
jest.mock('axios');
jest.mock('lodash');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockGet = get as jest.MockedFunction<typeof get>;

describe('Twitch API', () => {
    let mockModel: any;
    let mockLog: any;
    let mockRecord: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock record
        mockRecord = {
            get: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
        };

        // Setup mock model
        mockModel = {
            findOne: jest.fn(),
            create: jest.fn().mockResolvedValue(mockRecord),
        };

        // Setup mock logger
        mockLog = {
            error: jest.fn(),
        };

        // Setup default axios responses
        mockAxios.post.mockResolvedValue({
            data: {
                access_token: 'test-token-123',
                expires_in: 3600,
                token_type: 'bearer'
            }
        });

        mockAxios.get.mockResolvedValue({
            data: {
                data: [{
                    id: '123456789',
                    login: 'testuser',
                    display_name: 'TestUser',
                    type: '',
                    broadcaster_type: 'affiliate',
                    description: 'Test user description',
                    profile_image_url: 'https://static-cdn.jtvnw.net/user-default-pictures/test.png',
                    offline_image_url: '',
                    view_count: 1000,
                    email: 'test@example.com'
                }]
            }
        });
    });

    describe('createToken', () => {
        beforeEach(() => {
            mockModel.findOne.mockResolvedValue(null); // No existing token
        });

        it('should create new token when none exists', async () => {
            await twitchApi.createToken('client-id-123', 'secret-456', mockModel);

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://id.twitch.tv/oauth2/token?client_id=client-id-123&client_secret=secret-456&grant_type=client_credentials'
            );
            expect(mockModel.create).toHaveBeenCalledWith({
                key: 'TOKEN',
                value: 'test-token-123'
            });
        });

        it('should update existing token', async () => {
            mockModel.findOne.mockResolvedValue(mockRecord);

            await twitchApi.createToken('client-id-123', 'secret-456', mockModel);

            expect(mockRecord.update).toHaveBeenCalledWith({
                key: 'TOKEN',
                value: 'test-token-123'
            });
            expect(mockModel.create).not.toHaveBeenCalled();
        });

        it('should handle API errors', async () => {
            const mockError = {
                response: {
                    status: 401,
                    data: { error: 'Invalid client credentials' }
                }
            };
            mockAxios.post.mockRejectedValue(mockError);

            await expect(twitchApi.createToken('invalid-id', 'invalid-secret', mockModel))
                .rejects.toEqual(mockError.response);
        });
    });

    describe('getUser', () => {
        beforeEach(() => {
            const tokenRecord = { get: jest.fn().mockReturnValue('valid-token') };
            mockModel.findOne.mockResolvedValue(tokenRecord);
        });

        it('should get user data by username', async () => {
            const user = await twitchApi.getUser('testuser', mockModel);

            expect(mockAxios.get).toHaveBeenCalledWith(
                'https://api.twitch.tv/helix/users?login=testuser',
                {
                    headers: {
                        Authorization: 'Bearer valid-token'
                    }
                }
            );
            expect(user).toEqual({
                id: '123456789',
                login: 'testuser',
                display_name: 'TestUser',
                type: '',
                broadcaster_type: 'affiliate',
                description: 'Test user description',
                profile_image_url: 'https://static-cdn.jtvnw.net/user-default-pictures/test.png',
                offline_image_url: '',
                view_count: 1000,
                email: 'test@example.com'
            });
        });

        it('should handle user not found', async () => {
            mockAxios.get.mockResolvedValue({ data: { data: [] } });

            const user = await twitchApi.getUser('nonexistentuser', mockModel);

            expect(user).toBeUndefined();
        });
    });

    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            const validationResponse = {
                data: {
                    client_id: 'test-client-id',
                    login: 'test-login',
                    scopes: [],
                    user_id: '123456',
                    expires_in: 3600
                }
            };
            mockAxios.get.mockResolvedValue(validationResponse);

            const result = await twitchApi.validateToken('valid-token');

            expect(mockAxios.get).toHaveBeenCalledWith(
                'https://id.twitch.tv/oauth2/validate',
                {
                    headers: { Authorization: 'OAuth valid-token' }
                }
            );
            expect(result).toEqual(validationResponse);
        });

        it('should handle invalid token', async () => {
            const invalidTokenError = {
                response: {
                    status: 401,
                    data: { message: 'invalid access token' }
                }
            };
            mockAxios.get.mockRejectedValue(invalidTokenError);

            await expect(twitchApi.validateToken('invalid-token'))
                .rejects.toEqual(invalidTokenError.response);
        });
    });
});