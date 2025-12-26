import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

const RIDDLES = [
    {
        riddle: "What has keys but no locks, space but no room, and you can enter but can't go inside?",
        answer: "A keyboard",
    },
    {
        riddle: "I speak without a mouth and hear without ears. " +
            "I have no body, but I come alive with the wind. What am I?",
        answer: "An echo",
    },
    {
        riddle: "The more you take, the more you leave behind. What am I?",
        answer: "Footsteps",
    },
    {
        riddle: "What can travel around the world while staying in a corner?",
        answer: "A stamp",
    },
    {
        riddle: "I have cities, but no houses live there. I have mountains, but no trees grow there. " +
            "I have water, but no fish swim there. What am I?",
        answer: "A map",
    },
    {
        riddle: "What has a head and a tail but no body?",
        answer: "A coin",
    },
    {
        riddle: "What gets wetter the more it dries?",
        answer: "A towel",
    },
    {
        riddle: "I can be cracked, made, told, and played. What am I?",
        answer: "A joke",
    },
    {
        riddle: "What has hands but can't clap?",
        answer: "A clock",
    },
    {
        riddle: "What can you catch but not throw?",
        answer: "A cold",
    },
    {
        riddle: "What has an eye but cannot see?",
        answer: "A needle",
    },
    {
        riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?",
        answer: "The letter M",
    },
    {
        riddle: "What can fill a room but takes up no space?",
        answer: "Light",
    },
    {
        riddle: "What goes up but never comes down?",
        answer: "Your age",
    },
    {
        riddle: "I'm tall when I'm young, and short when I'm old. What am I?",
        answer: "A candle",
    },
    {
        riddle: "What has words but never speaks?",
        answer: "A book",
    },
    {
        riddle: "What can you break without touching it?",
        answer: "A promise",
    },
    {
        riddle: "What is always in front of you but can't be seen?",
        answer: "The future",
    },
    {
        riddle: "What has a neck but no head?",
        answer: "A bottle",
    },
    {
        riddle: "What belongs to you but others use it more than you do?",
        answer: "Your name",
    },
];

function getRandomRiddle(): typeof RIDDLES[0] {
    return RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
}

export default {
    data: new SlashCommandBuilder()
        .setName("riddle")
        .setDescription("Get a random riddle to solve"),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const riddle = getRandomRiddle();

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("🤔 Riddle Me This!")
            .setDescription(riddle.riddle)
            .addFields({
                name: "Answer",
                value: `||${riddle.answer}||`,
            })
            .setFooter({ text: "Click the spoiler to reveal the answer!" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info("riddle command used", {
            userId: interaction.user.id,
        });
    },
};
