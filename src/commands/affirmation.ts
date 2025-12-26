import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    User,
} from "discord.js";
import { Context } from "../types";

// Affirmation templates - {user} will be replaced with the target's name
const AFFIRMATIONS = [
    // Personality
    "{user}, you have an amazing personality that lights up any room!",
    "{user}, your positive energy is contagious!",
    "{user}, you're the kind of person everyone wants to be friends with.",
    "{user}, your kindness knows no bounds!",
    "{user}, you make the world a better place just by being in it.",

    // Intelligence/Skills
    "{user}, your intelligence and creativity are truly inspiring!",
    "{user}, you have a brilliant mind and great ideas!",
    "{user}, your problem-solving skills are legendary!",
    "{user}, you're incredibly talented at everything you do!",
    "{user}, your wisdom and insight are remarkable!",

    // Social
    "{user}, you're an incredible friend and everyone is lucky to know you!",
    "{user}, you have a heart of gold!",
    "{user}, your sense of humor is absolutely top-tier!",
    "{user}, you're more fun than bubble wrap!",
    "{user}, talking to you is the highlight of anyone's day!",

    // Encouragement
    "{user}, you're capable of achieving anything you set your mind to!",
    "{user}, your potential is limitless!",
    "{user}, you're a true inspiration to others!",
    "{user}, the world needs more people like you!",
    "{user}, you're doing amazing and don't let anyone tell you otherwise!",

    // Unique/Fun
    "{user}, if you were a vegetable, you'd be a cute-cumber!",
    "{user}, you're like a ray of sunshine on a cloudy day!",
    "{user}, you're the human equivalent of a warm hug!",
    "{user}, you're proof that good things come in awesome packages!",
    "{user}, on a scale of 1 to 10, you're an 11!",
];

// Get a random affirmation
function getRandomAffirmation(username: string): string {
    const template = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
    return template.replace('{user}', username);
}

export default {
    data: new SlashCommandBuilder()
        .setName('affirmation')
        .setDescription('Send a positive affirmation to someone (or yourself!)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to affirm (leave empty for yourself)')
                .setRequired(false)),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const targetUser: User = interaction.options.getUser('user') || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;

        const affirmation = getRandomAffirmation(targetUser.username);

        const embed = new EmbedBuilder()
            .setColor(0xff69b4) // Hot pink
            .setTitle('💝 Affirmation')
            .setDescription(affirmation)
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .setFooter({
                text: isSelf
                    ? 'Self-love is important!'
                    : `From ${interaction.user.username} with 💕`,
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info('affirmation command used', {
            userId: interaction.user.id,
            targetUserId: targetUser.id,
            isSelf,
        });
    },
};
