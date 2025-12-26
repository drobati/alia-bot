import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    User,
} from "discord.js";
import { Context } from "../types";

// Light-hearted, playful roasts - nothing actually mean!
const ROASTS = [
    "{user}, you're the reason the gene pool needs a lifeguard.",
    "{user}, I'd agree with you but then we'd both be wrong.",
    "{user}, you're not stupid; you just have bad luck thinking.",
    "{user}, I'm not saying I hate you, but I'd unplug your life support to charge my phone.",
    "{user}, if you were any more inbred, you'd be a sandwich.",
    "{user}, you're like a cloud. When you disappear, it's a beautiful day.",
    "{user}, I'd explain it to you, but I left my crayons at home.",
    "{user}, you're the human equivalent of a participation award.",
    "{user}, somewhere out there, a tree is working hard to produce oxygen for you. Go apologize to it.",
    "{user}, you're proof that evolution can go in reverse.",
    "{user}, I've seen salads that were more intimidating than you.",
    "{user}, if laughter is the best medicine, your face must be curing the world.",
    "{user}, you're like a software update. Whenever I see you, I think 'not now'.",
    "{user}, I'm jealous of people who don't know you.",
    "{user}, you bring everyone so much joy... when you leave.",
    "{user}, you're not completely useless. You can always serve as a bad example.",
    "{user}, I'd call you a tool, but that would imply you're useful.",
    "{user}, you're the reason we have warning labels on everything.",
    "{user}, if brains were dynamite, you wouldn't have enough to blow your nose.",
    "{user}, you're about as useful as a screen door on a submarine.",
    "{user}, I'm not insulting you, I'm describing you.",
    "{user}, you're like a penny: two-faced and not worth much.",
    "{user}, some drink from the fountain of knowledge. You just gargled.",
    "{user}, you're the human version of a low battery notification.",
    "{user}, if you were a spice, you'd be flour.",
];

// Comebacks when roasting yourself
const SELF_ROASTS = [
    "Roasting yourself? Bold move, {user}. Here's the mirror you apparently don't need.",
    "{user}, I was going to roast you, but you beat me to it. Self-awareness level: expert.",
    "Ah {user}, the only person brave enough to roast yourself. That's... actually kind of sad.",
    "{user} asked for a self-roast. This is what rock bottom looks like, folks.",
    "I'd roast you {user}, but it seems life already did.",
];

function getRandomRoast(username: string, isSelf: boolean): string {
    const roasts = isSelf ? SELF_ROASTS : ROASTS;
    const template = roasts[Math.floor(Math.random() * roasts.length)];
    return template.replace("{user}", username);
}

export default {
    data: new SlashCommandBuilder()
        .setName("roast")
        .setDescription("Get a playful roast for someone (or yourself!)")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to roast (leave empty for yourself)")
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const targetUser: User = interaction.options.getUser("user") || interaction.user;
        const isSelf = targetUser.id === interaction.user.id;

        const roast = getRandomRoast(targetUser.username, isSelf);

        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("🔥 Roast")
            .setDescription(roast)
            .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
            .setFooter({
                text: isSelf
                    ? "Self-roast! Those are rare."
                    : `Requested by ${interaction.user.username} 😈`,
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info("roast command used", {
            userId: interaction.user.id,
            targetUserId: targetUser.id,
            isSelf,
        });
    },
};
