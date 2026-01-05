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

type Choice = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'lose' | 'tie';

interface RpsGame {
    botChoice: Choice;
    votes: Map<string, { choice: Choice; username: string }>;
    messageId: string;
}

export const activeGames: Map<string, RpsGame> = new Map();

const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];
const GAME_DURATION_SECONDS = 15;

const EMOJIS: Record<Choice, string> = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️',
};

const CHOICE_NAMES: Record<Choice, string> = {
    rock: 'Rock',
    paper: 'Paper',
    scissors: 'Scissors',
};

// Fun messages for winners
const WINNER_MESSAGES = [
    "You crushed it!",
    "Victory is yours!",
    "Nice moves!",
    "Unbeatable!",
    "The champion!",
];

// Fun roasts for losers
const LOSER_MESSAGES = [
    "Get rekt!",
    "Better luck next time!",
    "Oof, that's rough.",
    "Maybe try a different strategy?",
    "The bot sends its regards.",
    "Have you tried... winning?",
];

// Fun messages for ties
const TIE_MESSAGES = [
    "Great minds think alike!",
    "A battle of equals!",
    "Perfectly balanced.",
    "Neither wins, neither loses.",
];

// Messages for when nobody participates
const NO_PARTICIPATION_MESSAGES = [
    "Nobody wanted to play? Fine, I'll just play with myself... wait.",
    "The bot wins by default! (Because nobody showed up)",
    "Too scared to challenge me?",
    "I guess rock-paper-scissors isn't cool anymore.",
];

function generateGameId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function getBotChoice(): Choice {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function getResult(playerChoice: Choice, botChoice: Choice): Result {
    if (playerChoice === botChoice) {
        return 'tie';
    }

    const wins: Record<Choice, Choice> = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper',
    };

    return wins[playerChoice] === botChoice ? 'win' : 'lose';
}

function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

export default {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock-Paper-Scissors! Everyone has 15 seconds to pick.'),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const channelId = interaction.channelId;

        // Check if there's already an active game in this channel
        if (activeGames.has(channelId)) {
            await interaction.reply({
                content: "There's already an RPS game in progress! Wait for it to finish.",
                ephemeral: true,
            });
            return;
        }

        const gameId = generateGameId();
        const botChoice = getBotChoice();

        // Create the game state
        const game: RpsGame = {
            botChoice,
            votes: new Map(),
            messageId: '',
        };
        activeGames.set(channelId, game);

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🎮 Rock-Paper-Scissors!")
            .setDescription(
                "Everyone can play! Click a button to make your choice.\n\n" +
                "The bot has already made its choice... 🤫",
            )
            .addFields({
                name: "⏱️ Time",
                value: `${GAME_DURATION_SECONDS} seconds to choose!`,
            })
            .setFooter({ text: "May the best player win!" })
            .setTimestamp();

        // Create choice buttons
        const buttons = CHOICES.map(choice =>
            new ButtonBuilder()
                .setCustomId(`rps_vote_${gameId}_${choice}`)
                .setLabel(`${EMOJIS[choice]} ${CHOICE_NAMES[choice]}`)
                .setStyle(ButtonStyle.Primary),
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

        const message = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        }) as Message;

        game.messageId = message.id;

        context.log.info("rps game started", {
            userId: interaction.user.id,
            botChoice,
            gameId,
            channelId,
        });

        // Set up button collector for 15 seconds
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: GAME_DURATION_SECONDS * 1000,
        });

        collector.on('collect', async buttonInteraction => {
            const parts = buttonInteraction.customId.split('_');
            if (parts.length !== 4) {
                return;
            }

            const choice = parts[3] as Choice;
            const oddsId = buttonInteraction.user.id;
            const username = buttonInteraction.user.displayName || buttonInteraction.user.username;

            const existingVote = game.votes.get(oddsId);
            if (existingVote) {
                existingVote.choice = choice;
                await buttonInteraction.reply({
                    content: `Choice changed to ${EMOJIS[choice]} **${CHOICE_NAMES[choice]}**!`,
                    ephemeral: true,
                });
            } else {
                game.votes.set(oddsId, { choice, username });
                await buttonInteraction.reply({
                    content: `You chose ${EMOJIS[choice]} **${CHOICE_NAMES[choice]}**!`,
                    ephemeral: true,
                });
            }

            context.log.info("rps choice recorded", {
                oddsId,
                choice,
                gameId,
            });
        });

        collector.on('end', async () => {
            activeGames.delete(channelId);

            const winners: string[] = [];
            const losers: string[] = [];
            const ties: string[] = [];
            const choiceCounts: Record<Choice, number> = { rock: 0, paper: 0, scissors: 0 };

            for (const [, vote] of game.votes) {
                choiceCounts[vote.choice]++;
                const result = getResult(vote.choice, botChoice);
                if (result === 'win') {
                    winners.push(vote.username);
                } else if (result === 'lose') {
                    losers.push(vote.username);
                } else {
                    ties.push(vote.username);
                }
            }

            // Determine embed color based on overall results
            let embedColor = 0x3498db; // Default blue
            if (winners.length > losers.length) {
                embedColor = 0x00ff00; // Green - players won more
            } else if (losers.length > winners.length) {
                embedColor = 0xff0000; // Red - bot won more
            } else if (ties.length > 0 && winners.length === 0 && losers.length === 0) {
                embedColor = 0xffff00; // Yellow - all ties
            }

            const resultsEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle("🎮 Rock-Paper-Scissors Results!")
                .setDescription(
                    `**The bot chose:** ${EMOJIS[botChoice]} ${CHOICE_NAMES[botChoice]}\n\n` +
                    `**Player choices:**\n` +
                    CHOICES.map(c => {
                        const count = choiceCounts[c];
                        const players = count !== 1 ? 's' : '';
                        return `${EMOJIS[c]} ${CHOICE_NAMES[c]}: ${count} player${players}`;
                    }).join("\n"),
                )
                .setTimestamp();

            if (winners.length > 0) {
                resultsEmbed.addFields({
                    name: "🏆 Winners",
                    value: `${winners.join(", ")}\n*${getRandomMessage(WINNER_MESSAGES)}*`,
                });
            }

            if (losers.length > 0) {
                resultsEmbed.addFields({
                    name: "💀 Defeated",
                    value: `${losers.join(", ")}\n*${getRandomMessage(LOSER_MESSAGES)}*`,
                });
            }

            if (ties.length > 0) {
                resultsEmbed.addFields({
                    name: "🤝 Tied",
                    value: `${ties.join(", ")}\n*${getRandomMessage(TIE_MESSAGES)}*`,
                });
            }

            if (game.votes.size === 0) {
                resultsEmbed.addFields({
                    name: "😶 No Participants",
                    value: getRandomMessage(NO_PARTICIPATION_MESSAGES),
                });
            }

            // Create disabled buttons showing the bot's choice
            const disabledButtons = CHOICES.map(choice => {
                const isBot = choice === botChoice;
                return new ButtonBuilder()
                    .setCustomId(`rps_ended_${gameId}_${choice}`)
                    .setLabel(`${EMOJIS[choice]} ${CHOICE_NAMES[choice]}${isBot ? ' (Bot)' : ''}`)
                    .setStyle(isBot ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(true);
            });

            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

            try {
                await message.edit({
                    embeds: [resultsEmbed],
                    components: [disabledRow],
                });
            } catch (error) {
                context.log.error("Failed to edit rps results message", { error, gameId });
            }

            context.log.info("rps game ended", {
                gameId,
                channelId,
                botChoice,
                totalPlayers: game.votes.size,
                winnersCount: winners.length,
                losersCount: losers.length,
                tiesCount: ties.length,
            });
        });
    },
};
