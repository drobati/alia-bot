import OpenAI from 'openai';

// OpenRouter configuration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp';

// Create OpenRouter client (uses OpenAI SDK with custom base URL)
export const openrouter = new OpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: process.env.OPENROUTER_API_KEY || 'test-key-for-ci',
    defaultHeaders: {
        'HTTP-Referer': 'https://github.com/drobati/alia-bot',
        'X-Title': 'Alia Discord Bot',
    },
});

// Export default model for use in other modules
export const DEFAULT_OPENROUTER_MODEL = DEFAULT_MODEL;

// Common model aliases for convenience
export const MODELS = {
    GEMINI_FLASH: 'google/gemini-2.0-flash-exp',
    GEMINI_PRO: 'google/gemini-pro-1.5',
    CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
    CLAUDE_HAIKU: 'anthropic/claude-3-haiku',
    GPT4_TURBO: 'openai/gpt-4-turbo-preview',
    GPT4O: 'openai/gpt-4o',
    LLAMA_70B: 'meta-llama/llama-3.1-70b-instruct',
} as const;

export type ModelName = typeof MODELS[keyof typeof MODELS] | string;

/**
 * Get the configured model, with fallback to default
 * Can be overridden via OPENROUTER_MODEL environment variable
 */
export function getModel(): string {
    return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}
