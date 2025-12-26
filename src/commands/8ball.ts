import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

// Classic Magic 8-Ball responses
const RESPONSES = {
    positive: [
        "It is certain.",
        "It is decidedly so.",
        "Without a doubt.",
        "Yes, definitely.",
        "You may rely on it.",
        "As I see it, yes.",
        "Most likely.",
        "Outlook good.",
        "Yes.",
        "Signs point to yes.",
    ],
    neutral: [
        "Reply hazy, try again.",
        "Ask again later.",
        "Better not tell you now.",
        "Cannot predict now.",
        "Concentrate and ask again.",
    ],
    negative: [
        "Don't count on it.",
        "My reply is no.",
        "My sources say no.",
        "Outlook not so good.",
        "Very doubtful.",
    ],
};

// All responses flattened for random selection
const ALL_RESPONSES = [
    ...RESPONSES.positive,
    ...RESPONSES.neutral,
    ...RESPONSES.negative,
];

// Get response type for coloring
function getResponseType(response: string): 'positive' | 'neutral' | 'negative' {
    if (RESPONSES.positive.includes(response)) {
        return 'positive';
    }
    if (RESPONSES.neutral.includes(response)) {
        return 'neutral';
    }
    return 'negative';
}

// Get color based on response type
function getColor(type: 'positive' | 'neutral' | 'negative'): number {
    switch (type) {
        case 'positive':
            return 0x00ff00; // Green
        case 'neutral':
            return 0xffff00; // Yellow
        case 'negative':
            return 0xff0000; // Red
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the Magic 8-Ball a yes/no question')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your yes/no question for the Magic 8-Ball')
                .setRequired(true)
                .setMaxLength(256)),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const question = interaction.options.getString('question', true);

        // Select random response
        const response = ALL_RESPONSES[Math.floor(Math.random() * ALL_RESPONSES.length)];
        const responseType = getResponseType(response);
        const color = getColor(responseType);

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: '❓ Question', value: question },
                { name: '🔮 Answer', value: `**${response}**` },
            )
            .setFooter({ text: `Asked by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info('8ball command used', {
            userId: interaction.user.id,
            question: question.substring(0, 50),
            response,
            responseType,
        });
    },
};
