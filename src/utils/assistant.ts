import OpenAI from 'openai';
import { Context } from "./types";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface UserContext {
    userId: string;
    username: string;
    channelId: string;
}

/**
 * Generates a response using OpenAI chat completions.
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
            model: 'gpt-4-turbo-preview' as const,
            messages: [
                {
                    role: 'system' as const,
                    content: 'You are Alia, a helpful Discord bot. ' +
                        'Provide concise, friendly responses to general knowledge questions. ' +
                        'Keep responses under 2000 characters to fit Discord message limits.',
                },
                {
                    role: 'user' as const,
                    content: message,
                },
            ],
            max_tokens: 300,
            temperature: 0.7,
        };

        // Log OpenAI API request initiation
        context.log.info('OpenAI API request initiated', {
            userId: userContext?.userId,
            model: requestData.model,
            messageLength: message.length,
            maxTokens: requestData.max_tokens,
            temperature: requestData.temperature,
            stage: 'api_request_start',
        });

        // Debug mode: log request details
        if (isDebugMode) {
            context.log.debug('OpenAI API request details', {
                messageSnippet: message.slice(0, 200) + (message.length > 200 ? '...' : ''),
                systemPromptLength: requestData.messages[0].content.length,
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

        // Log successful API response
        context.log.info('OpenAI API response received', {
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
            context.log.debug('OpenAI API response details', {
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

        // Check for specific OpenAI error types
        if (error.code === 'rate_limit_exceeded') {
            context.log.warn('OpenAI API rate limit exceeded', errorData);
        } else if (error.code === 'insufficient_quota') {
            context.log.error('OpenAI API insufficient quota', errorData);
        } else if (error.status === 401) {
            context.log.error('OpenAI API authentication failed', errorData);
        } else if (error.status >= 500) {
            context.log.error('OpenAI API server error', errorData);
        } else {
            context.log.error('OpenAI API unknown error', {
                ...errorData,
                fullError: isDebugMode ? error : undefined,
            });
        }

        return null;
    }
}

export default generateResponse;