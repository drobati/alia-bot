import axios from 'axios';
import { Jimp, loadFont, measureText } from 'jimp';
import path from 'path';
import { MemeTemplateAttributes } from '../types/database';

export class MemeGenerator {
    private static calculateImageBrightness(image: any): number {
        let totalBrightness = 0;
        let pixelCount = 0;

        // Sample every 10th pixel for performance
        const step = 10;
        for (let y = 0; y < image.height; y += step) {
            for (let x = 0; x < image.width; x += step) {
                const pixelColor = image.getPixelColor(x, y);

                // Extract RGB values from pixel color
                const r = (pixelColor >> 24) & 0xFF;
                const g = (pixelColor >> 16) & 0xFF;
                const b = (pixelColor >> 8) & 0xFF;

                // Calculate relative luminance (perceived brightness)
                const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                totalBrightness += brightness;
                pixelCount++;
            }
        }

        return totalBrightness / pixelCount;
    }

    private static async downloadImage(url: string): Promise<Buffer> {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Alia-Bot/2.0.0 (Discord Bot)',
                },
                maxRedirects: 5,
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download image from ${url}: ${error instanceof Error ? error.message : error}`);
        }
    }

    private static wrapText(text: string, maxWidth: number, estimatedCharWidth: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const estimatedWidth = testLine.length * estimatedCharWidth;

            if (estimatedWidth <= maxWidth) {
                currentLine = testLine;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // Word is too long, break it up
                    const maxChars = Math.floor(maxWidth / estimatedCharWidth);
                    let remainingWord = word;
                    while (remainingWord.length > maxChars) {
                        lines.push(remainingWord.substring(0, maxChars));
                        remainingWord = remainingWord.substring(maxChars);
                    }
                    currentLine = remainingWord;
                }
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.length > 0 ? lines : [text];
    }

    private static renderTextLine(
        image: any,
        font: any,
        outlineFont: any,
        text: string,
        y: number,
        margin: number,
        maxWidth: number,
    ): void {
        // Use Jimp's font measurement for accurate centering
        const textWidth = measureText(font, text);

        // Center the text within the available width, respecting margins
        let x = margin + (maxWidth - textWidth) / 2;

        // Ensure the text stays within bounds with proper margins
        x = Math.max(margin, x);
        x = Math.min(image.width - textWidth - margin, x);

        // Create text outline by drawing outline text with slight offsets
        const outlineOffset = 2;
        for (let dx = -outlineOffset; dx <= outlineOffset; dx++) {
            for (let dy = -outlineOffset; dy <= outlineOffset; dy++) {
                if (dx !== 0 || dy !== 0) {
                    image.print({
                        font: outlineFont,
                        x: x + dx,
                        y: y + dy,
                        text: text,
                    });
                }
            }
        }

        // Draw main text on top
        image.print({
            font: font,
            x: x,
            y: y,
            text: text,
        });
    }

    // STANDARDIZED MEME GENERATION - Used by both templates and custom URLs
    private static async generateStandardizedMeme(
        imageUrl: string,
        topText?: string,
        bottomText?: string,
        fontSize: number = 32,
    ): Promise<Buffer> {
        try {
            // Download the image
            const imageBuffer = await this.downloadImage(imageUrl);

            // Load image with Jimp
            let image = await Jimp.read(imageBuffer);

            // Scale image down to Discord display width (500px) while maintaining aspect ratio
            const TARGET_WIDTH = 500;
            if (image.width > TARGET_WIDTH) {
                // Calculate proportional height to maintain aspect ratio
                const aspectRatio = image.height / image.width;
                const targetHeight = Math.round(TARGET_WIDTH * aspectRatio);
                // Use any type to avoid Jimp type issues
                image = (image as any).resize({ w: TARGET_WIDTH, h: targetHeight });
            }

            // Analyze image brightness to determine optimal text color
            const brightness = this.calculateImageBrightness(image);

            // Choose text colors based on brightness
            const useWhiteText = brightness < 0.5;
            const mainFontColor = useWhiteText ? 'white' : 'black';
            const outlineFontColor = useWhiteText ? 'black' : 'white';

            // Available font sizes in Jimp
            const availableFontSizes = [8, 10, 12, 14, 16, 32, 64, 128];
            
            // Find the closest available font size
            const closestFontSize = availableFontSizes.reduce((prev, curr) => 
                Math.abs(curr - fontSize) < Math.abs(prev - fontSize) ? curr : prev
            );
            
            // Load fonts with the closest available size and appropriate colors
            const mainColor = useWhiteText ? 'white' : 'black';
            const outlineColor = useWhiteText ? 'black' : 'white';
            
            const fontPath = `node_modules/@jimp/plugin-print/dist/fonts/open-sans/open-sans-${closestFontSize}-${mainColor}/open-sans-${closestFontSize}-${mainColor}.fnt`;
            const outlineFontPath = `node_modules/@jimp/plugin-print/dist/fonts/open-sans/open-sans-${closestFontSize}-${outlineColor}/open-sans-${closestFontSize}-${outlineColor}.fnt`;
            
            const font = await loadFont(fontPath);
            const outlineFont = await loadFont(outlineFontPath);

            // PROPORTIONAL POSITIONING - Scales with image size for consistency
            const margin = Math.max(20, Math.floor(image.width * 0.08)); // 8% of width, min 20px
            const maxWidth = image.width - (2 * margin);
            const baseCharWidth = Math.max(8, Math.floor(closestFontSize * 0.6)); // Scale with actual font size
            const lineHeight = Math.max(20, Math.floor(closestFontSize * 1.2)); // 120% of actual font size

            // Add top text if provided
            if (topText) {
                const upperText = topText.toUpperCase();
                const lines = this.wrapText(upperText, maxWidth, baseCharWidth);

                // Position top text with margin from top - ALWAYS THE SAME
                const startY = margin;

                lines.forEach((line, lineIndex) => {
                    const currentY = startY + (lineIndex * lineHeight);
                    this.renderTextLine(image, font, outlineFont, line, currentY, margin, maxWidth);
                });
            }

            // Add bottom text if provided
            if (bottomText) {
                const upperText = bottomText.toUpperCase();
                const lines = this.wrapText(upperText, maxWidth, baseCharWidth);
                const totalTextHeight = lines.length * lineHeight;

                // Position bottom text with margin from bottom - ALWAYS THE SAME
                const startY = image.height - totalTextHeight - margin;

                lines.forEach((line, lineIndex) => {
                    const currentY = startY + (lineIndex * lineHeight);
                    this.renderTextLine(image, font, outlineFont, line, currentY, margin, maxWidth);
                });
            }

            // Return the processed image as a buffer
            return await image.getBuffer('image/png');
        } catch (error) {
            console.error('MemeGenerator error details:', error);
            throw error;
        }
    }

    // PUBLIC API - Template meme generation (uses standardized approach)
    public static async generateMeme(
        template: MemeTemplateAttributes,
        topText?: string,
        bottomText?: string,
    ): Promise<Buffer> {
        return await this.generateStandardizedMeme(template.url, topText, bottomText, template.default_font_size);
    }

    // PUBLIC API - Custom meme generation (uses same standardized approach)
    public static async generateCustomMeme(
        imageUrl: string,
        topText?: string,
        bottomText?: string,
        fontSize: number = 32,
    ): Promise<Buffer> {
        return await this.generateStandardizedMeme(imageUrl, topText, bottomText, fontSize);
    }
}