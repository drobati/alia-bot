import axios from 'axios';
import quote from './quote';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('commands/quote', () => {
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
            expect(quote.data.name).toBe('quote');
            expect(quote.data.description).toBe('Get a random inspirational quote.');
        });
    });

    describe('Execute', () => {
        it('should fetch and display a quote successfully', async () => {
            mockedAxios.get.mockResolvedValue({
                data: [{ q: 'Be the change you wish to see.', a: 'Mahatma Gandhi' }],
            });

            await quote.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://zenquotes.io/api/random',
                expect.objectContaining({ headers: expect.any(Object) }),
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            description: expect.stringContaining('Be the change'),
                        }),
                    }),
                ]),
            });
        });

        it('should handle missing quote data', async () => {
            mockedAxios.get.mockResolvedValue({ data: [] });

            await quote.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Could not fetch a quote at this time.',
            );
        });

        it('should handle malformed response', async () => {
            mockedAxios.get.mockResolvedValue({ data: [{ invalid: 'data' }] });

            await quote.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Could not fetch a quote at this time.',
            );
        });

        it('should handle API errors gracefully', async () => {
            const error = new Error('Network error');
            mockedAxios.get.mockRejectedValue(error);
            mockInteraction.deferred = true;

            await quote.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { error },
                'Error fetching quote',
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'Sorry, I could not fetch a quote at this time.',
            );
        });

        it('should use reply if not deferred on error', async () => {
            const error = new Error('Network error');
            mockedAxios.get.mockRejectedValue(error);
            mockInteraction.deferred = false;

            await quote.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                'Sorry, I could not fetch a quote at this time.',
            );
        });
    });
});
