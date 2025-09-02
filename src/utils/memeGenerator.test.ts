import axios from 'axios';
import { Jimp, loadFont, measureText } from 'jimp';
import { MemeGenerator } from './memeGenerator';
import { MemeTemplateAttributes } from '../types/database';

// Mock external dependencies
jest.mock('axios');
jest.mock('jimp');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockJimp = Jimp as jest.Mocked<typeof Jimp>;
const mockLoadFont = loadFont as jest.MockedFunction<typeof loadFont>;
const mockMeasureText = measureText as jest.MockedFunction<typeof measureText>;

describe('MemeGenerator', () => {
    let mockImage: any;
    let mockFont: any;
    let mockOutlineFont: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock image object
        mockImage = {
            width: 500,
            height: 300,
            getPixelColor: jest.fn().mockReturnValue(0xFF808080), // Gray pixel
            resize: jest.fn().mockReturnThis(),
            print: jest.fn(),
            getBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data'))
        };

        // Setup mock fonts
        mockFont = { name: 'mock-font' };
        mockOutlineFont = { name: 'mock-outline-font' };
        mockLoadFont.mockResolvedValue(mockFont);

        // Setup axios mock
        mockAxios.get.mockResolvedValue({
            data: Buffer.from('mock-image-data')
        });

        // Setup Jimp mock
        mockJimp.read.mockResolvedValue(mockImage);
        mockMeasureText.mockReturnValue(100); // Mock text width
    });

    describe('Class Structure', () => {
        test('should have generateMeme static method', () => {
            expect(typeof MemeGenerator.generateMeme).toBe('function');
        });

        test('should have generateCustomMeme static method', () => {
            expect(typeof MemeGenerator.generateCustomMeme).toBe('function');
        });
    });

    describe('generateMeme', () => {
        const mockTemplate: MemeTemplateAttributes = {
            id: 1,
            name: 'Drake',
            url: 'https://i.imgflip.com/30b1gx.jpg',
            description: 'Drake pointing',
            default_font_size: 32,
            creator: 'test',
            usage_count: 0,
            is_active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        test('should generate meme with template and text', async () => {
            const result = await MemeGenerator.generateMeme(mockTemplate, 'Top Text', 'Bottom Text');

            expect(result).toBeInstanceOf(Buffer);
            expect(mockAxios.get).toHaveBeenCalledWith(mockTemplate.url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'Alia-Bot/2.0.0 (Discord Bot)' },
                maxRedirects: 5
            });
            expect(mockJimp.read).toHaveBeenCalled();
            expect(mockImage.print).toHaveBeenCalled();
            expect(mockImage.getBuffer).toHaveBeenCalledWith('image/png');
        });

        test('should handle null template', async () => {
            await expect(MemeGenerator.generateMeme(null as any, 'test'))
                .rejects.toThrow();
        });

        test('should work with only top text', async () => {
            await MemeGenerator.generateMeme(mockTemplate, 'Top Text');

            expect(mockImage.print).toHaveBeenCalled();
            expect(mockImage.getBuffer).toHaveBeenCalledWith('image/png');
        });

        test('should work with only bottom text', async () => {
            await MemeGenerator.generateMeme(mockTemplate, undefined, 'Bottom Text');

            expect(mockImage.print).toHaveBeenCalled();
            expect(mockImage.getBuffer).toHaveBeenCalledWith('image/png');
        });

        test('should work with no text', async () => {
            const result = await MemeGenerator.generateMeme(mockTemplate);

            expect(result).toBeInstanceOf(Buffer);
            expect(mockImage.getBuffer).toHaveBeenCalledWith('image/png');
        });

        test('should use template default font size', async () => {
            const templateWithLargeFont = {
                ...mockTemplate,
                default_font_size: 64
            };

            await MemeGenerator.generateMeme(templateWithLargeFont, 'Test');

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-64-')
            );
        });
    });

    describe('generateCustomMeme', () => {
        test('should generate meme with custom URL', async () => {
            const customUrl = 'https://example.com/custom-image.jpg';
            const result = await MemeGenerator.generateCustomMeme(customUrl, 'Top', 'Bottom');

            expect(result).toBeInstanceOf(Buffer);
            expect(mockAxios.get).toHaveBeenCalledWith(customUrl, expect.any(Object));
            expect(mockImage.print).toHaveBeenCalled();
        });

        test('should use default font size when not specified', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-32-')
            );
        });

        test('should use custom font size when specified', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test', undefined, 16);

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-16-')
            );
        });

        test('should handle invalid URLs', async () => {
            mockAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(MemeGenerator.generateCustomMeme('invalid-url', 'test'))
                .rejects.toThrow('Failed to download image');
        });

        test('should handle null URL', async () => {
            await expect(MemeGenerator.generateCustomMeme(null as any, 'test'))
                .rejects.toThrow();
        });
    });

    describe('Image Processing', () => {
        test('should resize large images to target width', async () => {
            mockImage.width = 1000;
            mockImage.height = 600;

            await MemeGenerator.generateCustomMeme('https://example.com/large.jpg', 'Test');

            expect(mockImage.resize).toHaveBeenCalledWith({ w: 500, h: 300 });
        });

        test('should not resize small images', async () => {
            mockImage.width = 300;
            mockImage.height = 200;

            await MemeGenerator.generateCustomMeme('https://example.com/small.jpg', 'Test');

            expect(mockImage.resize).not.toHaveBeenCalled();
        });

        test('should calculate image brightness correctly', async () => {
            // Test bright image (should use black text)
            mockImage.getPixelColor.mockReturnValue(0xFFFFFF00); // White pixel

            await MemeGenerator.generateCustomMeme('https://example.com/bright.jpg', 'Test');

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('black')
            );
        });

        test('should use white text on dark images', async () => {
            // Test dark image (should use white text)
            mockImage.getPixelColor.mockReturnValue(0x00000000); // Black pixel

            await MemeGenerator.generateCustomMeme('https://example.com/dark.jpg', 'Test');

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('white')
            );
        });
    });

    describe('Font Selection', () => {
        test('should select closest available font size', async () => {
            // Test with font size 30 (should pick 32)
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test', undefined, 30);

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-32-')
            );
        });

        test('should select closest available font size for smaller fonts', async () => {
            // Test with font size 15 (should pick 16)
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test', undefined, 15);

            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-16-')
            );
        });

        test('should load both main and outline fonts', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            expect(mockLoadFont).toHaveBeenCalledTimes(2);
            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('white')
            );
            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('black')
            );
        });
    });

    describe('Text Rendering', () => {
        test('should render text with outline', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            // Should print outline (multiple times for different offsets) + main text
            expect(mockImage.print).toHaveBeenCalledTimes(9); // 8 outline positions + 1 main text
        });

        test('should center text properly', async () => {
            mockMeasureText.mockReturnValue(200); // Text width
            mockImage.width = 500;

            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            // Should call measureText to calculate centering
            expect(mockMeasureText).toHaveBeenCalledWith(mockFont, 'TEST');
        });

        test('should convert text to uppercase', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'lowercase text');

            expect(mockImage.print).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'LOWERCASE TEXT'
                })
            );
        });

        test('should wrap long text', async () => {
            const longText = 'This is a very long text that should be wrapped across multiple lines';
            mockMeasureText.mockReturnValue(600); // Wider than image

            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', longText);

            // Should still render text (wrapped)
            expect(mockImage.print).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle network timeouts', async () => {
            mockAxios.get.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

            await expect(MemeGenerator.generateCustomMeme('https://slow-server.com/image.jpg', 'Test'))
                .rejects.toThrow('Failed to download image');
        });

        test('should handle image processing errors', async () => {
            mockJimp.read.mockRejectedValue(new Error('Invalid image format'));

            await expect(MemeGenerator.generateCustomMeme('https://example.com/corrupted.jpg', 'Test'))
                .rejects.toThrow('Invalid image format');
        });

        test('should handle font loading errors', async () => {
            mockLoadFont.mockRejectedValue(new Error('Font not found'));

            await expect(MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test'))
                .rejects.toThrow('Font not found');
        });

        test('should handle buffer generation errors', async () => {
            mockImage.getBuffer.mockRejectedValue(new Error('Buffer generation failed'));

            await expect(MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test'))
                .rejects.toThrow('Buffer generation failed');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty strings', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', '', '');

            expect(mockImage.print).toHaveBeenCalled();
        });

        test('should handle very small images', async () => {
            mockImage.width = 50;
            mockImage.height = 50;

            const result = await MemeGenerator.generateCustomMeme('https://example.com/tiny.jpg', 'Test');

            expect(result).toBeInstanceOf(Buffer);
            expect(mockImage.resize).not.toHaveBeenCalled();
        });

        test('should handle very large font sizes', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test', undefined, 200);

            // Should select largest available font (128)
            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-128-')
            );
        });

        test('should handle very small font sizes', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test', undefined, 5);

            // Should select smallest available font (8)
            expect(mockLoadFont).toHaveBeenCalledWith(
                expect.stringContaining('open-sans-8-')
            );
        });
    });

    describe('HTTP Request Configuration', () => {
        test('should use proper headers for image download', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            expect(mockAxios.get).toHaveBeenCalledWith(
                'https://example.com/test.jpg',
                expect.objectContaining({
                    headers: {
                        'User-Agent': 'Alia-Bot/2.0.0 (Discord Bot)'
                    }
                })
            );
        });

        test('should set proper timeout and redirect limits', async () => {
            await MemeGenerator.generateCustomMeme('https://example.com/test.jpg', 'Test');

            expect(mockAxios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    timeout: 30000,
                    maxRedirects: 5,
                    responseType: 'arraybuffer'
                })
            );
        });
    });
});