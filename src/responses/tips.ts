// Tips about available commands and features
const TIPS = [
    "Try the `/horoscope` command to get your daily cosmic reading!",
    "Use `/fortune` to receive a fortune cookie message with lucky numbers.",
    "Create memes with `/meme create` - use `/meme list` to see available templates!",
    "Ask me anything! I'm powered by AI and can answer general knowledge questions.",
    "Use `/poll` to create a poll and gather opinions from the server.",
    "Check out `/dadjokes` for some quality humor (or groan-worthy puns).",
    "Use `/stock` to check current stock prices and market info.",
    "Try `/qrcode` to generate a QR code for any text or URL.",
    "Use `/memories` to save and recall memorable moments from the server.",
    "Join a voice channel and use `/speak` to have me say something!",
    "Use `/rollcall` to see who's active in the server.",
    "Configure TTS settings with `/tts-config` for voice channel responses.",
    "Type in ALL CAPS and I might respond with a loud message!",
    "Use `/fear` to share what scares you... or discover others' fears.",
    "Check `/stats` to see bot usage statistics.",
    "The `/coinbase` command shows cryptocurrency prices.",
    "Use `/adlibs` to create funny mad-libs style sentences!",
    "Try the `/dnd` commands for D&D game sessions in a dedicated channel.",
    "Roll dice with `/dice roll 2d6+3` - supports exploding (!), keep (k), drop (d), and more!",
    "Use `/dice coin` for a quick heads or tails flip!",
    "Create custom dice with `/dice custom create` - perfect for RPG tables or decision making!",
    "Try fudge dice with `/dice roll 4dF` for Fate/Fudge RPG systems!",
    "Ask the Magic 8-Ball with `/8ball` - will your question be answered favorably?",
    "Challenge me to Rock-Paper-Scissors with `/rps` - can you beat me?",
    "Spread positivity with `/affirmation` - send yourself or a friend an uplifting message!",
    "Need a laugh? Try `/joke` for jokes in categories like programming, animals, and more!",
    "Test your brain with `/riddle` - can you solve the mystery?",
    "Think you're smart? Try `/trivia` and test your knowledge across various categories!",
    "Play `/guess start` to begin a number guessing game - how few attempts can you win in?",
    "Feeling brave? Use `/roast` to get a playful roast for yourself or a friend!",
    "Curious about compatibility? Use `/ship` to see the love percentage between two users!",
    "Check the weather with `/weather <city>` - get current conditions and a 5-day forecast!",
];

// Cooldown tracking - stores last tip timestamp per channel
const channelCooldowns = new Map<string, number>();

// Configuration
const TIP_CHANCE = 0.05; // 5% chance to show a tip
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown per channel

/**
 * Tips response handler - occasionally shows helpful tips about bot commands
 * This runs at the lowest priority and only triggers randomly
 */
export default async (message: any, { log }: any): Promise<boolean> => {
    try {
        // Skip if message is too short (probably not meaningful conversation)
        if (message.content.length < 10) {
            return false;
        }

        // Check cooldown for this channel
        const channelId = message.channel.id;
        const lastTipTime = channelCooldowns.get(channelId) || 0;
        const now = Date.now();

        if (now - lastTipTime < COOLDOWN_MS) {
            return false;
        }

        // Random chance check
        if (Math.random() > TIP_CHANCE) {
            return false;
        }

        // Select a random tip
        const tip = TIPS[Math.floor(Math.random() * TIPS.length)];

        // Send the tip
        await message.channel.send(`**Tip:** ${tip}`);

        // Update cooldown
        channelCooldowns.set(channelId, now);

        log.debug('Tip sent', {
            channelId,
            messageId: message.id,
            userId: message.author.id,
            tip: tip.substring(0, 50),
        });

        return true;
    } catch (error) {
        log.error('Tips response failed:', { error });
        return false;
    }
};

// Export for testing
export { TIPS, TIP_CHANCE, COOLDOWN_MS };

// Reset cooldowns (for testing)
export function resetCooldowns(): void {
    channelCooldowns.clear();
}
