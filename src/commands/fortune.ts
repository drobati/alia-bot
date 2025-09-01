import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';

// Fortune cookie messages - a mix of wisdom, humor, and motivation
const FORTUNES = [
    // Wisdom & Philosophy
    "The journey of a thousand miles begins with a single step.",
    "Your code will compile on the first try today... just kidding!",
    "A bug in the hand is worth two in the debugger.",
    "The best time to plant a tree was 20 years ago. The second best time is now.",
    "Your future holds many pull requests.",
    "Wise is the developer who documents their code.",
    "Today's bugs are tomorrow's features.",
    
    // Humor & Tech
    "404: Fortune not found. Try again later.",
    "There are only 10 types of people: those who understand binary and those who don't.",
    "Your next coffee will be particularly effective.",
    "A missing semicolon will soon reveal itself to you.",
    "The answer you seek lies in Stack Overflow.",
    "Your rubber duck has wisdom to share. Listen carefully.",
    "Commit early, commit often, push with confidence.",
    
    // Motivation & Success
    "Great opportunities await you in the coming sprints.",
    "Your persistence will pay off sooner than you think.",
    "A new skill will soon become your superpower.",
    "The solution you seek is closer than it appears.",
    "Your next project will exceed all expectations.",
    "Collaboration will lead to unexpected breakthroughs.",
    "Your creativity knows no bounds today.",
    
    // Discord & Gaming
    "Your next voice chat will bring good news.",
    "A legendary drop awaits you in your next gaming session.",
    "Your memes will be exceptionally dank today.",
    "The Discord gods smile upon you.",
    "Your next raid will be victorious.",
    "RNG will be in your favor today.",
    "Your K/D ratio is about to improve significantly.",
    
    // Life & Relationships
    "A pleasant surprise awaits you this week.",
    "Someone appreciates your efforts more than you know.",
    "Your positive attitude will inspire others today.",
    "Good news will come from an unexpected source.",
    "Your hard work has not gone unnoticed.",
    "A new friendship will blossom from shared interests.",
    "Today is a good day to try something new.",
    
    // Mysterious & Cryptic
    "The void stares back, but it thinks you're neat.",
    "When the moon is full, your code will run true.",
    "Three crows bring news of a successful deployment.",
    "The ancient scrolls speak of your coming victory.",
    "In the land of undefined, you shall find your purpose.",
    "The matrix has you... and it likes your style.",
    "Your aura attracts good PRs and repels merge conflicts.",
];

// Lucky numbers for lottery-style fortune
function generateLuckyNumbers(): string {
    const numbers = new Set<number>();
    while (numbers.size < 6) {
        numbers.add(Math.floor(Math.random() * 49) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b).join(', ');
}

export default {
    data: new SlashCommandBuilder()
        .setName('fortune')
        .setDescription('Receive a fortune cookie message')
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Share your fortune with the channel (default: private)')
                .setRequired(false)),

    async execute(interaction: any, context: Context) {
        const { log } = context;
        const isPublic = interaction.options.getBoolean('public') || false;

        try {
            // Select a random fortune
            const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
            const luckyNumbers = generateLuckyNumbers();

            // Create fortune cookie message with emoji decoration
            const fortuneMessage = 
                `🥠 **Your Fortune Cookie** 🥠\n\n` +
                `*"${fortune}"*\n\n` +
                `🔢 **Lucky Numbers:** ${luckyNumbers}\n` +
                `✨ **Lucky Color:** ${getRandomColor()}\n` +
                `🌟 **Fortune Level:** ${getFortuneLevel()}`;

            await interaction.reply({
                content: fortuneMessage,
                ephemeral: !isPublic,
            });

            log.info('Fortune command executed', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guild?.id,
                isPublic: isPublic,
                fortune: fortune.substring(0, 50) + '...', // Log partial fortune
            });

        } catch (error) {
            log.error('Fortune command failed', {
                userId: interaction.user.id,
                error: error,
            });

            await interaction.reply({
                content: '❌ The fortune spirits are not responding. Please try again later.',
                ephemeral: true,
            });
        }
    },
};

// Helper function to get random color
function getRandomColor(): string {
    const colors = [
        'Red 🔴', 'Blue 🔵', 'Green 🟢', 'Yellow 🟡', 
        'Purple 🟣', 'Orange 🟠', 'Pink 🩷', 'Gold ⭐',
        'Silver 🌙', 'Rainbow 🌈', 'Black ⚫', 'White ⚪',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Helper function to get fortune level
function getFortuneLevel(): string {
    const levels = [
        'Legendary ⚡', 'Epic 💎', 'Rare 💫', 'Uncommon ✨', 'Common ⭐',
        'Blessed 🙏', 'Lucky 🍀', 'Fortunate 🎯', 'Auspicious 🎊',
    ];
    return levels[Math.floor(Math.random() * levels.length)];
}