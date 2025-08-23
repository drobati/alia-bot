import OpenAI from 'openai';
import { Context } from "./types";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a response using OpenAI chat completions.
 *
 * @param {string} message - The user message to respond to.
 * @param {Context} context - The context object.
 * @returns {Promise<string|null>} A promise that resolves with the generated response or null if an error occurs.
 */
async function generateResponse(message: string, context: Context): Promise<string | null> {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                {
                    role: 'system',
                    content: 'You are Alia, a helpful Discord bot. ' +
                        'Provide concise, friendly responses to general knowledge questions. ' +
                        'Keep responses under 2000 characters to fit Discord message limits.',
                },
                {
                    role: 'user',
                    content: message,
                },
            ],
            max_tokens: 300,
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        context.log.error('Error in generating response from OpenAI:', error);
        return null;
    }
}

export default generateResponse;