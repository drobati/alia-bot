import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    User,
} from "discord.js";
import { Context } from "../types";

// Love statements based on compatibility percentage
const LOVE_STATEMENTS: { threshold: number; statement: string }[] = [
    { threshold: 90, statement: "{user1} is mass-simping for {user2}" },
    { threshold: 80, statement: "{user1} is head over heels for {user2}" },
    { threshold: 70, statement: "{user1} really likes {user2}" },
    { threshold: 60, statement: "{user1} has a crush on {user2}" },
    { threshold: 50, statement: "{user1} kinda vibes with {user2}" },
    { threshold: 40, statement: "{user1} tolerates {user2}" },
    { threshold: 30, statement: "{user1} is unsure about {user2}" },
    { threshold: 20, statement: "{user1} avoids {user2}" },
    { threshold: 10, statement: "{user1} runs away from {user2}" },
    { threshold: 0, statement: "{user1} has blocked {user2}" },
];

// Messages based on compatibility percentage
const COMPATIBILITY_MESSAGES: { threshold: number; emoji: string; message: string }[] = [
    { threshold: 100, emoji: "💍", message: "A match made in heaven! Wedding bells are ringing!" },
    { threshold: 90, emoji: "💕", message: "Soulmates! You two are perfect for each other!" },
    { threshold: 80, emoji: "💗", message: "Amazing chemistry! This could be something special!" },
    { threshold: 70, emoji: "💖", message: "Great potential! The stars are aligned!" },
    { threshold: 60, emoji: "💓", message: "Pretty good match! There's definitely a spark!" },
    { threshold: 50, emoji: "💛", message: "Could work with some effort. Give it a shot!" },
    { threshold: 40, emoji: "🤔", message: "Might be a bumpy ride, but who knows?" },
    { threshold: 30, emoji: "😬", message: "Hmm... opposites attract, right? Right?!" },
    { threshold: 20, emoji: "💔", message: "Not looking great... maybe just be friends?" },
    { threshold: 10, emoji: "🚫", message: "Yikes. Let's pretend this never happened." },
    { threshold: 0, emoji: "☠️", message: "Absolutely not. The universe says no." },
];

// Generate a deterministic "random" percentage based on user IDs
function calculateCompatibility(user1Id: string, user2Id: string): number {
    // Sort IDs to ensure same result regardless of order
    const sortedIds = [user1Id, user2Id].sort();
    const combined = sortedIds[0] + sortedIds[1];

    // Simple hash function to get a number
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to 0-100 percentage
    return Math.abs(hash % 101);
}

// Generate ship name from two usernames
function generateShipName(name1: string, name2: string): string {
    // Take first half of first name and second half of second name
    const half1 = Math.ceil(name1.length / 2);
    const half2 = Math.floor(name2.length / 2);

    const part1 = name1.slice(0, half1);
    const part2 = name2.slice(half2);

    return part1 + part2;
}

// Get message based on percentage
function getCompatibilityMessage(percentage: number): { emoji: string; message: string } {
    for (const level of COMPATIBILITY_MESSAGES) {
        if (percentage >= level.threshold) {
            return { emoji: level.emoji, message: level.message };
        }
    }
    return COMPATIBILITY_MESSAGES[COMPATIBILITY_MESSAGES.length - 1];
}

// Get love statement based on percentage
function getLoveStatement(percentage: number, user1: string, user2: string): string {
    for (const level of LOVE_STATEMENTS) {
        if (percentage >= level.threshold) {
            return level.statement.replace("{user1}", user1).replace("{user2}", user2);
        }
    }
    const fallback = LOVE_STATEMENTS[LOVE_STATEMENTS.length - 1];
    return fallback.statement.replace("{user1}", user1).replace("{user2}", user2);
}

// Generate a heart meter visualization
function generateHeartMeter(percentage: number): string {
    const filledHearts = Math.round(percentage / 10);
    const emptyHearts = 10 - filledHearts;
    return "❤️".repeat(filledHearts) + "🖤".repeat(emptyHearts);
}

export default {
    data: new SlashCommandBuilder()
        .setName("ship")
        .setDescription("Calculate the compatibility between two users")
        .addUserOption(option =>
            option
                .setName("user1")
                .setDescription("First user")
                .setRequired(true),
        )
        .addUserOption(option =>
            option
                .setName("user2")
                .setDescription("Second user (leave empty to ship with yourself)")
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const user1: User = interaction.options.getUser("user1", true);
        const user2: User = interaction.options.getUser("user2") || interaction.user;

        const isSameUser = user1.id === user2.id;
        const compatibility = isSameUser ? 100 : calculateCompatibility(user1.id, user2.id);
        const shipName = generateShipName(user1.username, user2.username);
        const { emoji, message } = getCompatibilityMessage(compatibility);
        const heartMeter = generateHeartMeter(compatibility);
        const loveStatement = getLoveStatement(compatibility, user1.username, user2.username);

        const embed = new EmbedBuilder()
            .setColor(compatibility >= 50 ? 0xff69b4 : 0x808080)
            .setTitle(`${emoji} Ship Calculator`)
            .setDescription(
                isSameUser
                    ? `**${user1.username}** loves themselves! Self-love is important! 💕`
                    : `**${loveStatement}** (${compatibility}%)`,
            )
            .addFields(
                {
                    name: "Ship Name",
                    value: `💑 **${shipName}**`,
                    inline: true,
                },
                {
                    name: "Compatibility",
                    value: `**${compatibility}%**`,
                    inline: true,
                },
                {
                    name: "Love Meter",
                    value: heartMeter,
                    inline: false,
                },
                {
                    name: "Verdict",
                    value: message,
                    inline: false,
                },
            )
            .setFooter({ text: `Shipped by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info("ship command used", {
            userId: interaction.user.id,
            user1Id: user1.id,
            user2Id: user2.id,
            compatibility,
        });
    },
};
