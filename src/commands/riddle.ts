import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Message,
} from "discord.js";
import { Context } from "../types";

interface Riddle {
    riddle: string;
    answer: string;
}

interface RiddleGame {
    correctIndex: number;
    correctAnswer: string;
    votes: Map<string, { optionIndex: number; username: string }>;
    messageId: string;
}

export const activeGames: Map<string, RiddleGame> = new Map();

const RIDDLES: Riddle[] = [
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

// Wrong answers pool for generating options
const WRONG_ANSWERS = [
    "A mirror", "A shadow", "A dream", "A river", "A mountain",
    "The sun", "The moon", "A tree", "A door", "A window",
    "A bridge", "A cloud", "A star", "A fire", "A wave",
    "A secret", "A memory", "A whisper", "A breath", "A silence",
    "A rainbow", "A storm", "A feather", "A stone", "A flame",
    "Time", "Love", "Hope", "Fear", "Darkness",
];

const OPTION_LETTERS = ["A", "B", "C", "D"];
const GAME_DURATION_SECONDS = 30;

// Fun messages for winners
const WINNER_MESSAGES = [
    "Riddle master in the house!",
    "Sherlock would be proud!",
    "Big brain time!",
    "You cracked it!",
    "The sphinx bows to you!",
];

// Fun roasts for losers
const LOSER_MESSAGES = [
    "The riddle remains... a riddle to you.",
    "Maybe try reading it again? Slowly?",
    "Were you even trying?",
    "The sphinx is disappointed.",
    "Smooth brain moment.",
    "Google was right there...",
];

// Messages for when nobody participates
const NO_PARTICIPATION_MESSAGES = [
    "Nobody dared to answer? Cowards!",
    "The riddle stumped everyone into silence.",
    "Too hard? Or just too lazy?",
    "I guess riddles aren't your thing.",
];

function getRandomRiddle(): Riddle {
    return RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
}

function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

function generateGameId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getWrongAnswers(correctAnswer: string, count: number): string[] {
    // Filter out the correct answer and any similar answers
    const available = WRONG_ANSWERS.filter(
        a => a.toLowerCase() !== correctAnswer.toLowerCase(),
    );
    const shuffled = shuffleArray(available);
    return shuffled.slice(0, count);
}

export default {
    data: new SlashCommandBuilder()
        .setName("riddle")
        .setDescription("Solve a riddle! 30 seconds to vote on the correct answer."),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const channelId = interaction.channelId;

        // Check if there's already an active game in this channel
        if (activeGames.has(channelId)) {
            await interaction.reply({
                content: "There's already a riddle game in progress! Wait for it to finish.",
                ephemeral: true,
            });
            return;
        }

        const riddle = getRandomRiddle();
        const gameId = generateGameId();

        // Generate wrong answers and create options
        const wrongAnswers = getWrongAnswers(riddle.answer, 3);
        const allAnswers = [riddle.answer, ...wrongAnswers];
        const shuffledAnswers = shuffleArray(allAnswers);
        const correctIndex = shuffledAnswers.indexOf(riddle.answer);

        // Create the game state
        const game: RiddleGame = {
            correctIndex,
            correctAnswer: riddle.answer,
            votes: new Map(),
            messageId: '',
        };
        activeGames.set(channelId, game);

        const optionsText = shuffledAnswers
            .map((answer, i) => `**${OPTION_LETTERS[i]}.** ${answer}`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle("🤔 Riddle Me This!")
            .setDescription(`${riddle.riddle}\n\n${optionsText}`)
            .addFields({
                name: "⏱️ Time",
                value: `${GAME_DURATION_SECONDS} seconds to vote!`,
            })
            .setFooter({ text: "Click a button to vote!" })
            .setTimestamp();

        // Create answer buttons
        const buttons = shuffledAnswers.map((_, index) =>
            new ButtonBuilder()
                .setCustomId(`riddle_vote_${gameId}_${index}`)
                .setLabel(`${OPTION_LETTERS[index]}`)
                .setStyle(ButtonStyle.Primary),
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        }) as Message;

        game.messageId = message.id;

        context.log.info("riddle game started", {
            userId: interaction.user.id,
            answer: riddle.answer,
            gameId,
            channelId,
        });

        // Set up button collector for 30 seconds
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: GAME_DURATION_SECONDS * 1000,
        });

        collector.on('collect', async buttonInteraction => {
            const parts = buttonInteraction.customId.split('_');
            if (parts.length !== 4) {
                return;
            }

            const optionIndex = parseInt(parts[3]);
            const oddsId = buttonInteraction.user.id;
            const username = buttonInteraction.user.displayName || buttonInteraction.user.username;

            const existingVote = game.votes.get(oddsId);
            if (existingVote) {
                existingVote.optionIndex = optionIndex;
                await buttonInteraction.reply({
                    content: `Vote changed to **${OPTION_LETTERS[optionIndex]}. ${shuffledAnswers[optionIndex]}**!`,
                    ephemeral: true,
                });
            } else {
                game.votes.set(oddsId, { optionIndex, username });
                await buttonInteraction.reply({
                    content: `Vote recorded for **${OPTION_LETTERS[optionIndex]}. ${shuffledAnswers[optionIndex]}**!`,
                    ephemeral: true,
                });
            }

            context.log.info("riddle vote recorded", {
                oddsId,
                optionIndex,
                gameId,
            });
        });

        collector.on('end', async () => {
            activeGames.delete(channelId);

            const winners: string[] = [];
            const losers: string[] = [];
            const voteCounts: number[] = [0, 0, 0, 0];

            for (const [, vote] of game.votes) {
                voteCounts[vote.optionIndex]++;
                if (vote.optionIndex === correctIndex) {
                    winners.push(vote.username);
                } else {
                    losers.push(vote.username);
                }
            }

            const resultsEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("🤔 Riddle Results!")
                .setDescription(`**${riddle.riddle}**\n\nThe answer was **${riddle.answer}**!\n\n` +
                    shuffledAnswers.map((answer, i) => {
                        const isCorrect = i === correctIndex;
                        const marker = isCorrect ? "✅" : "❌";
                        const count = voteCounts[i];
                        return `${marker} **${OPTION_LETTERS[i]}.** ${answer} - ${count} vote${count !== 1 ? 's' : ''}`;
                    }).join("\n"))
                .setTimestamp();

            if (winners.length > 0) {
                resultsEmbed.addFields({
                    name: "🏆 Riddle Masters",
                    value: `${winners.join(", ")}\n*${getRandomMessage(WINNER_MESSAGES)}*`,
                });
            }

            if (losers.length > 0) {
                resultsEmbed.addFields({
                    name: "💀 Stumped",
                    value: `${losers.join(", ")}\n*${getRandomMessage(LOSER_MESSAGES)}*`,
                });
            }

            if (game.votes.size === 0) {
                resultsEmbed.addFields({
                    name: "😶 No Participants",
                    value: getRandomMessage(NO_PARTICIPATION_MESSAGES),
                });
            }

            const disabledButtons = shuffledAnswers.map((_, index) => {
                const isCorrect = index === correctIndex;
                return new ButtonBuilder()
                    .setCustomId(`riddle_ended_${gameId}_${index}`)
                    .setLabel(`${OPTION_LETTERS[index]}`)
                    .setStyle(isCorrect ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(true);
            });

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

            try {
                await message.edit({
                    embeds: [resultsEmbed],
                    components: [disabledRow],
                });
            } catch (error) {
                context.log.error("Failed to edit riddle results message", { error, gameId });
            }

            context.log.info("riddle game ended", {
                gameId,
                channelId,
                correctAnswer: riddle.answer,
                totalVotes: game.votes.size,
                winnersCount: winners.length,
                losersCount: losers.length,
            });
        });
    },
};
