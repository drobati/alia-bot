import { Message } from 'discord.js';
import { Context } from '../types';

// Goodmorning responses
const GOODMORNING_MESSAGES = [
    "Good morning! Rise and shine!",
    "Morning! Hope your coffee is strong and your bugs are few!",
    "Good morning! May your code compile on the first try today!",
    "Rise and grind! Let's make today awesome!",
    "Good morning, sunshine! Ready to conquer the day?",
    "Morning! Time to turn dreams into reality!",
    "Good morning! Fresh day, fresh start!",
    "Wakey wakey! The world awaits!",
    "Good morning! May your Wi-Fi be strong and your meetings short!",
    "Top of the morning to you! Let's do this!",
    "Good morning! Another beautiful day to be alive!",
    "Morning, friend! Sending good vibes your way!",
    "Good morning! Remember: you're awesome!",
    "Rise up! Today is full of possibilities!",
    "Good morning! Don't forget to hydrate!",
];

// Goodnight responses
const GOODNIGHT_MESSAGES = [
    "Goodnight! Sweet dreams!",
    "Sleep well! See you tomorrow!",
    "Goodnight! May your dreams be filled with working code!",
    "Night night! Don't let the bugs bite!",
    "Sweet dreams! Rest up for another day of greatness!",
    "Goodnight! The servers will be here when you wake up!",
    "Sleep tight! Tomorrow's another adventure!",
    "Goodnight! May your sleep be as peaceful as a resolved merge conflict!",
    "Rest well, friend! You've earned it!",
    "Goodnight! Dream big!",
    "Nighty night! See you on the flip side!",
    "Sleep well! The Discord will still be here tomorrow!",
    "Goodnight! May your dreams compile without errors!",
    "Time to recharge! Goodnight!",
    "Sweet dreams! Don't forget to save your progress!",
];

// Patterns to match greetings (case insensitive)
const GOODMORNING_PATTERNS = [
    /\bgood\s*morning\b/i,
    /\bgoodmorning\b/i,
    /\bgm\b/i,
    /\bmorning\s+everyone\b/i,
    /\bmorning\s+all\b/i,
];

const GOODNIGHT_PATTERNS = [
    /\bgood\s*night\b/i,
    /\bgoodnight\b/i,
    /\bgn\b/i,
    /\bnight\s+everyone\b/i,
    /\bnight\s+all\b/i,
    /\bnighty\s*night\b/i,
];

// Cooldown tracking - stores last greeting timestamp per user per channel
const greetingCooldowns = new Map<string, number>();

// Configuration
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per user per channel

/**
 * Get a random item from an array
 */
function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Check if a message matches any pattern in the array
 */
function matchesPatterns(content: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(content));
}

/**
 * Greetings response handler - responds to goodmorning/goodnight messages
 * with random friendly responses
 */
export default async (message: Message, context: Context): Promise<boolean> => {
    const { log } = context;

    try {
        const content = message.content.trim();

        // Skip very long messages (probably not just a greeting)
        if (content.length > 50) {
            return false;
        }

        // Check cooldown for this user in this channel
        const cooldownKey = `${message.channel.id}:${message.author.id}`;
        const lastGreetingTime = greetingCooldowns.get(cooldownKey) || 0;
        const now = Date.now();

        if (now - lastGreetingTime < COOLDOWN_MS) {
            return false;
        }

        let responseMessage: string | null = null;
        let greetingType: string | null = null;

        // Check for goodmorning
        if (matchesPatterns(content, GOODMORNING_PATTERNS)) {
            responseMessage = getRandomMessage(GOODMORNING_MESSAGES);
            greetingType = 'goodmorning';
        }
        // Check for goodnight
        else if (matchesPatterns(content, GOODNIGHT_PATTERNS)) {
            responseMessage = getRandomMessage(GOODNIGHT_MESSAGES);
            greetingType = 'goodnight';
        }

        // No greeting matched
        if (!responseMessage) {
            return false;
        }

        // Send the response
        if ('send' in message.channel) {
            await message.channel.send(responseMessage);

            // Update cooldown
            greetingCooldowns.set(cooldownKey, now);

            log.debug('Greeting response sent', {
                channelId: message.channel.id,
                messageId: message.id,
                userId: message.author.id,
                greetingType,
            });

            return true;
        }

        return false;
    } catch (error) {
        log.error('Greetings response failed:', { error });
        return false;
    }
};

// Export for testing
export {
    GOODMORNING_MESSAGES,
    GOODNIGHT_MESSAGES,
    GOODMORNING_PATTERNS,
    GOODNIGHT_PATTERNS,
    COOLDOWN_MS,
};

// Reset cooldowns (for testing)
export function resetCooldowns(): void {
    greetingCooldowns.clear();
}
