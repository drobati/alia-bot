import OpenAI from 'openai';
import { Context } from "./types";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface MotivationalMessageOptions {
    category: 'motivation' | 'productivity' | 'general';
    frequency: 'daily' | 'weekly';
}

function getSystemPrompt(category: string, frequency: string): string {
    const basePrompt = 'You are Alia, a motivational Discord bot. Generate an uplifting, ' +
                       'encouraging message that inspires and motivates people. ';

    let categoryPrompt = '';
    switch (category) {
        case 'motivation':
            categoryPrompt = 'Focus on personal growth, overcoming challenges, and believing in oneself. ';
            break;
        case 'productivity':
            categoryPrompt = 'Focus on getting things done, time management, and ' +
                           'achieving goals efficiently. ';
            break;
        case 'general':
            categoryPrompt = 'Focus on general positivity, gratitude, and making the day better. ';
            break;
    }

    let frequencyPrompt = '';
    if (frequency === 'daily') {
        frequencyPrompt = 'Make it suitable for daily motivation - something that helps people ' +
                         'start or continue their day positively. ';
    } else if (frequency === 'weekly') {
        frequencyPrompt = 'Make it suitable for weekly motivation - something that helps people ' +
                         'reflect and prepare for the week ahead. ';
    }

    const constraints = 'Keep the message under 1500 characters to fit Discord limits. ' +
                       'Make it friendly, authentic, and actionable. ' +
                       'Vary your style and approach to keep messages fresh and engaging. ' +
                       'Avoid repetitive language or phrases. ' +
                       'Include emojis sparingly to add warmth but don\'t overuse them.';

    return basePrompt + categoryPrompt + frequencyPrompt + constraints;
}

/**
 * Generates a motivational message using OpenAI API
 */
export async function generateMotivationalMessage(
    options: MotivationalMessageOptions,
    context: Context,
): Promise<string | null> {
    const startTime = Date.now();
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';

    try {
        const systemPrompt = getSystemPrompt(options.category, options.frequency);

        const requestData = {
            model: 'gpt-4-turbo-preview' as const,
            messages: [
                {
                    role: 'system' as const,
                    content: systemPrompt,
                },
                {
                    role: 'user' as const,
                    content: `Generate a ${options.category} motivational message for ${options.frequency} delivery.`,
                },
            ],
            max_tokens: 250,
            temperature: 0.8, // Higher creativity for varied messages
        };

        context.log.info('Generating motivational message', {
            category: options.category,
            frequency: options.frequency,
            model: requestData.model,
            stage: 'motivational_generation_start',
        });

        if (isDebugMode) {
            context.log.debug('Motivational message generation request', {
                systemPromptLength: systemPrompt.length,
                requestConfig: {
                    model: requestData.model,
                    maxTokens: requestData.max_tokens,
                    temperature: requestData.temperature,
                },
            });
        }

        const completion = await openai.chat.completions.create(requestData);

        const processingTime = Date.now() - startTime;
        const responseContent = completion.choices[0].message.content;

        context.log.info('Motivational message generated successfully', {
            category: options.category,
            frequency: options.frequency,
            responseLength: responseContent?.length || 0,
            tokensUsed: completion.usage?.total_tokens,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            processingTimeMs: processingTime,
            finishReason: completion.choices[0].finish_reason,
            stage: 'motivational_generation_success',
            success: true,
        });

        if (isDebugMode && responseContent) {
            context.log.debug('Generated motivational message preview', {
                messagePreview: responseContent.slice(0, 100) + (responseContent.length > 100 ? '...' : ''),
                fullLength: responseContent.length,
            });
        }

        return responseContent;

    } catch (error: any) {
        const processingTime = Date.now() - startTime;

        const errorData = {
            category: options.category,
            frequency: options.frequency,
            processingTimeMs: processingTime,
            errorType: error.constructor.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorStatus: error.status,
            stage: 'motivational_generation_error',
            success: false,
        };

        if (error.code === 'rate_limit_exceeded') {
            context.log.warn('OpenAI API rate limit exceeded during motivational message generation', errorData);
        } else if (error.code === 'insufficient_quota') {
            context.log.error('OpenAI API insufficient quota for motivational message generation', errorData);
        } else if (error.status === 401) {
            context.log.error('OpenAI API authentication failed for motivational message generation', errorData);
        } else if (error.status >= 500) {
            context.log.error('OpenAI API server error during motivational message generation', errorData);
        } else {
            context.log.error('Unknown error during motivational message generation', {
                ...errorData,
                fullError: isDebugMode ? error : undefined,
            });
        }

        return null;
    }
}

/**
 * Rate limiting utility for motivational messages
 */
export class MotivationalRateLimiter {
    private static lastMessageTimes: Map<string, number> = new Map();
    private static readonly MIN_INTERVAL_MS = 60 * 1000; // 1 minute minimum between messages

    static canSendMessage(channelId: string): boolean {
        const lastTime = this.lastMessageTimes.get(channelId);
        if (!lastTime) {
            return true;
        }

        const timeSinceLastMessage = Date.now() - lastTime;
        return timeSinceLastMessage >= this.MIN_INTERVAL_MS;
    }

    static markMessageSent(channelId: string): void {
        this.lastMessageTimes.set(channelId, Date.now());
    }

    static cleanup(): void {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [channelId, timestamp] of this.lastMessageTimes.entries()) {
            if (timestamp < oneHourAgo) {
                this.lastMessageTimes.delete(channelId);
            }
        }
    }
}