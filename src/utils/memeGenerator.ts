import axios from 'axios';
import { MemeTemplateAttributes } from '../types/database';

export interface MemeText {
    text: string;
    x: number;
    y: number;
    fontSize?: number;
    align?: 'center' | 'left' | 'right';
    baseline?: 'top' | 'middle' | 'bottom';
}

export class MemeGenerator {
    private static async downloadImage(url: string): Promise<Buffer> {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Alia-Bot/2.0.0 (Discord Bot)',
                },
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download image: ${error}`);
        }
    }

    public static async generateMeme(
        template: MemeTemplateAttributes,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _textLines: string[],
    ): Promise<Buffer> {
        try {
            // For now, just return the original image without text overlay
            // This will be enhanced once we get the image processing working
            const imageBuffer = await this.downloadImage(template.url);
            return imageBuffer;
        } catch (error) {
            throw new Error(`Failed to generate meme: ${error}`);
        }
    }

    public static async generateCustomMeme(
        imageUrl: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _texts: MemeText[],
    ): Promise<Buffer> {
        try {
            // For now, just return the original image without text overlay
            const imageBuffer = await this.downloadImage(imageUrl);
            return imageBuffer;
        } catch (error) {
            throw new Error(`Failed to generate custom meme: ${error}`);
        }
    }
}