import axios from 'axios';
import fact from './fact';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('commands/fact', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockInteraction = {
            deferReply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            reply: jest.fn().mockResolvedValue(undefined),
            deferred: false,
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
        };
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(fact.data.name).toBe('fact');
            expect(fact.data.description).toBe('Get a random fun fact.');
        });
    });

    describe('Execute', () => {
        it('should fetch and display a fact successfully', async () => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    text: 'Honey never spoils.',
                    source: 'Wikipedia',
                },
            });

            await fact.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://uselessfacts.jsph.pl/api/v2/facts/random',
                expect.objectContaining({ headers: expect.any(Object) }),
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: '🧠 Random Fact',
                            description: 'Honey never spoils.',
                        }),
                    }),
                ]),
            });
        });

        it('should handle fact without source', async () => {
            mockedAxios.get.mockResolvedValue({
                data: {
                    text: 'A group of flamingos is called a flamboyance.',
                },
            });

            await fact.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            description: 'A group of flamingos is called a flamboyance.',
                        }),
                    }),
                ]),
            });
        });

        it('should handle missing fact data', async () => {
            mockedAxios.get.mockResolvedValue({ data: {} });

            await fact.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Could not fetch a fact at this time.',
            );
        });

        it('should handle API errors gracefully', async () => {
            const error = new Error('Network error');
            mockedAxios.get.mockRejectedValue(error);
            mockInteraction.deferred = true;

            await fact.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error },
                'Error fetching fact',
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Sorry, I could not fetch a fact at this time.',
            );
        });

        it('should use reply if not deferred on error', async () => {
            const error = new Error('Network error');
            mockedAxios.get.mockRejectedValue(error);
            mockInteraction.deferred = false;

            await fact.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                'Sorry, I could not fetch a fact at this time.',
            );
        });
    });
});
