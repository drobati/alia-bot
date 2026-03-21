import OpenAI from 'openai';
import { Context } from "./types";

// OpenRouter provides an OpenAI-compatible API, so we reuse the openai SDK
const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'test-key-for-ci',
});

interface UserContext {
    userId: string;
    username: string;
    channelId: string;
}

/**
 * Generates a response using OpenRouter chat completions (Grok model).
 *
 * @param {string} message - The user message to respond to.
 * @param {Context} context - The context object.
 * @param {UserContext} userContext - Additional user context for logging.
 * @returns {Promise<string|null>} A promise that resolves with the generated response or null if an error occurs.
 */
async function generateResponse(message: string, context: Context, userContext?: UserContext): Promise<string | null> {
    const startTime = Date.now();
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';

    try {
        const requestData = {
            model: 'x-ai/grok-3-mini-beta',
            messages: [
                {
                    role: 'system' as const,
                    content: 'You are Alia, a sassy Discord bot who doesn\'t sugarcoat anything. ' +
                        'Respond in one short sentence. Be witty, blunt, and a little unhinged. ' +
                        'This is a Discord chat, not an essay.',
                },
                {
                    role: 'user' as const,
                    content: message,
                },
            ],
            max_tokens: 150,
            temperature: 0.9,
        };

        // Log OpenRouter API request initiation
        context.log.info('OpenRouter API request initiated', {
            userId: userContext?.userId,
            model: requestData.model,
            messageLength: message.length,
            maxTokens: requestData.max_tokens,
            temperature: requestData.temperature,
            stage: 'api_request_start',
        });

        // Debug mode: log request details
        if (isDebugMode) {
            context.log.debug('OpenRouter API request details', {
                messageSnippet: message.slice(0, 200) + (message.length > 200 ? '...' : ''),
                systemPromptLength: requestData.messages[0].content.length,
                requestConfig: {
                    model: requestData.model,
                    maxTokens: requestData.max_tokens,
                    temperature: requestData.temperature,
                },
            });
        }

        const completion = await openrouter.chat.completions.create(requestData);

        const processingTime = Date.now() - startTime;
        const responseContent = completion.choices[0].message.content;

        // Log successful API response
        context.log.info('OpenRouter API response received', {
            userId: userContext?.userId,
            responseLength: responseContent?.length || 0,
            tokensUsed: completion.usage?.total_tokens,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            processingTimeMs: processingTime,
            finishReason: completion.choices[0].finish_reason,
            stage: 'api_response_success',
            success: true,
        });

        // Debug mode: log response details
        if (isDebugMode && responseContent) {
            context.log.debug('OpenRouter API response details', {
                responseSnippet: responseContent.slice(0, 200) + (responseContent.length > 200 ? '...' : ''),
                model: completion.model,
                created: completion.created,
                responseId: completion.id,
            });
        }

        return responseContent;

    } catch (error: any) {
        const processingTime = Date.now() - startTime;

        // Enhanced error logging with more context
        const errorData = {
            userId: userContext?.userId,
            messageLength: message.length,
            processingTimeMs: processingTime,
            errorType: error.constructor.name,
            errorMessage: error.message,
            errorCode: error.code,
            errorStatus: error.status,
            stage: 'api_error',
            success: false,
        };

        // Check for specific API error types
        if (error.code === 'rate_limit_exceeded') {
            context.log.warn('OpenRouter API rate limit exceeded', errorData);
        } else if (error.code === 'insufficient_quota') {
            context.log.error('OpenRouter API insufficient quota', errorData);
        } else if (error.status === 401) {
            context.log.error('OpenRouter API authentication failed', errorData);
        } else if (error.status >= 500) {
            context.log.error('OpenRouter API server error', errorData);
        } else {
            context.log.error('OpenRouter API unknown error', {
                ...errorData,
                fullError: isDebugMode ? error : undefined,
            });
        }

        return null;
    }
}

export default generateResponse;