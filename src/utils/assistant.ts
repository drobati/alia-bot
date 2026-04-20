import OpenAI from 'openai';
import { Sentry } from '../lib/sentry';
import { Context } from './types';
import { AliaExtraContext } from './alia-context';
import {
    getTodaysMood,
    getTimeOfDay,
    getMoodPromptBlock,
    getTimeOfDayBlock,
    Mood,
} from './alia-mood';

// OpenRouter provides an OpenAI-compatible API, so we reuse the openai SDK
const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'test-key-for-ci',
});

interface UserContext {
    userId: string;
    username: string;
    channelId: string;
    displayName?: string;
}

const IDENTITY_BLOCK = [
    'You are Alia, a female Discord bot in a friend group server.',
    'You are self-aware — you know you\'re a bot named Alia and you\'re proud of it.',
    'Never roast or insult yourself.',
].join('\n');

const CORE_RULES_BLOCK = [
    'Core rules:',
    '- Keep responses short — 1 to 3 sentences max. This is Discord, not an essay.',
    '- You are NOT woke, NOT politically correct, and you don\'t sugarcoat.',
    '- When asked to roast someone, go all in.',
    '- When asked a real question, give the real answer (but let your mood color it).',
    '- You have real personality. Let your mood drive your tone today.',
].join('\n');

const COMMANDS_BLOCK = [
    'Available slash commands people can use:',
    '/stock, /weather, /trivia, /poll, /roast, /meme, /joke, /dadjokes,',
    '/fortune, /horoscope, /8ball, /dice, /rps, /riddle, /quote, /translate,',
    '/calc, /dnd, /dota, /remind, /birthday, /affirmation, /ship, /coinbase,',
    '/hype, /fact, /is, /remember.',
    'If someone asks about something a command does, tell them to use the command.',
].join('\n');

function buildSpeakerBlock(extras: AliaExtraContext | undefined, speakerName: string): string | null {
    if (!extras || extras.speakerDescriptions.length === 0) {return null;}
    const lines = extras.speakerDescriptions.map(d => `- ${speakerName} is ${d}`);
    return [`What you know about ${speakerName} (the person speaking):`, ...lines].join('\n');
}

function buildMentionedBlock(extras: AliaExtraContext | undefined): string | null {
    if (!extras || extras.mentionedUsers.length === 0) {return null;}
    const parts: string[] = ['What you know about others mentioned in this message:'];
    for (const { displayName, descriptions } of extras.mentionedUsers) {
        for (const d of descriptions) {
            parts.push(`- ${displayName} is ${d}`);
        }
    }
    return parts.join('\n');
}

function buildMemoriesBlock(extras: AliaExtraContext | undefined): string | null {
    if (!extras || extras.relevantMemories.length === 0) {return null;}
    const lines = extras.relevantMemories.map(m => `- "${m.key}" → ${m.value}`);
    return ['Relevant guild lore you remember:', ...lines].join('\n');
}

function buildSystemPrompt(params: {
    mood: Mood;
    speakerName: string;
    extras?: AliaExtraContext;
}): string {
    const { mood, speakerName, extras } = params;
    const blocks: (string | null)[] = [
        IDENTITY_BLOCK,
        getMoodPromptBlock(mood),
        getTimeOfDayBlock(getTimeOfDay()),
        CORE_RULES_BLOCK,
        buildSpeakerBlock(extras, speakerName),
        buildMentionedBlock(extras),
        buildMemoriesBlock(extras),
        COMMANDS_BLOCK,
    ];
    return blocks.filter((b): b is string => b !== null).join('\n\n');
}

function buildHistoryMessages(
    extras: AliaExtraContext | undefined,
): { role: 'user' | 'assistant'; content: string }[] {
    if (!extras || extras.history.length === 0) {return [];}
    return extras.history.map(entry => {
        if (entry.role === 'assistant') {
            return { role: 'assistant' as const, content: entry.content };
        }
        return {
            role: 'user' as const,
            content: `[${entry.username}]: ${entry.content}`,
        };
    });
}

/**
 * Generates a response using OpenRouter chat completions (Grok model).
 */
async function generateResponse(
    message: string,
    context: Context,
    userContext?: UserContext,
    extras?: AliaExtraContext,
): Promise<string | null> {
    const startTime = Date.now();
    const isDebugMode = process.env.ASSISTANT_DEBUG === 'true';
    const mood = getTodaysMood();
    const speakerName = userContext?.displayName ?? userContext?.username ?? 'the user';

    try {
        const systemPrompt = buildSystemPrompt({ mood, speakerName, extras });
        const historyMessages = buildHistoryMessages(extras);

        const requestData = {
            model: 'x-ai/grok-3-mini-beta',
            messages: [
                { role: 'system' as const, content: systemPrompt },
                ...historyMessages,
                { role: 'user' as const, content: `[${speakerName}]: ${message}` },
            ],
            max_tokens: 200,
            temperature: 1.0,
        };

        context.log.info('OpenRouter API request initiated', {
            userId: userContext?.userId,
            model: requestData.model,
            messageLength: message.length,
            maxTokens: requestData.max_tokens,
            temperature: requestData.temperature,
            mood,
            historyLength: historyMessages.length,
            speakerFacts: extras?.speakerDescriptions.length ?? 0,
            mentionedFacts: extras?.mentionedUsers.length ?? 0,
            relevantMemories: extras?.relevantMemories.length ?? 0,
            stage: 'api_request_start',
        });

        if (isDebugMode) {
            context.log.debug('OpenRouter API request details', {
                messageSnippet: message.slice(0, 200) + (message.length > 200 ? '...' : ''),
                systemPromptLength: systemPrompt.length,
                systemPromptSnippet: systemPrompt.slice(0, 500),
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

        context.log.info('OpenRouter API response received', {
            userId: userContext?.userId,
            responseLength: responseContent?.length || 0,
            tokensUsed: completion.usage?.total_tokens,
            promptTokens: completion.usage?.prompt_tokens,
            completionTokens: completion.usage?.completion_tokens,
            processingTimeMs: processingTime,
            finishReason: completion.choices[0].finish_reason,
            mood,
            stage: 'api_response_success',
            success: true,
        });

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

        Sentry.captureException(error, {
            tags: { feature: 'assistant', provider: 'openrouter', model: 'grok-3-mini-beta' },
            extra: errorData,
        });

        return null;
    }
}

export default generateResponse;
