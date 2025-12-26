import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

type Choice = 'rock' | 'paper' | 'scissors';
type Result = 'win' | 'lose' | 'tie';

const CHOICES: Choice[] = ['rock', 'paper', 'scissors'];

const EMOJIS: Record<Choice, string> = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️',
};

const RESULT_EMOJIS: Record<Result, string> = {
    win: '🎉',
    lose: '😢',
    tie: '🤝',
};

const RESULT_COLORS: Record<Result, number> = {
    win: 0x00ff00,   // Green
    lose: 0xff0000,  // Red
    tie: 0xffff00,   // Yellow
};

const RESULT_MESSAGES: Record<Result, string[]> = {
    win: [
        "You win! Nice one!",
        "Victory is yours!",
        "You crushed it!",
        "Winner winner!",
        "You got me this time!",
    ],
    lose: [
        "I win! Better luck next time!",
        "Ha! Got you!",
        "Victory is mine!",
        "Better luck next time!",
        "I am unbeatable... sometimes.",
    ],
    tie: [
        "It's a tie! Great minds think alike.",
        "We picked the same! Rematch?",
        "A draw! How about another round?",
        "Tied! We're evenly matched.",
        "Same choice! Try again?",
    ],
};

// Determine the winner
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

// Get random message for result
function getResultMessage(result: Result): string {
    const messages = RESULT_MESSAGES[result];
    return messages[Math.floor(Math.random() * messages.length)];
}

// Get bot's random choice
function getBotChoice(): Choice {
    return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

export default {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Play Rock-Paper-Scissors against the bot')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Your choice')
                .setRequired(true)
                .addChoices(
                    { name: '🪨 Rock', value: 'rock' },
                    { name: '📄 Paper', value: 'paper' },
                    { name: '✂️ Scissors', value: 'scissors' },
                )),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const playerChoice = interaction.options.getString('choice', true) as Choice;
        const botChoice = getBotChoice();
        const result = getResult(playerChoice, botChoice);

        const playerEmoji = EMOJIS[playerChoice];
        const botEmoji = EMOJIS[botChoice];
        const resultEmoji = RESULT_EMOJIS[result];
        const resultMessage = getResultMessage(result);

        const embed = new EmbedBuilder()
            .setColor(RESULT_COLORS[result])
            .setTitle(`${resultEmoji} Rock-Paper-Scissors`)
            .addFields(
                {
                    name: `${interaction.user.username}`,
                    value: `${playerEmoji} ${playerChoice.charAt(0).toUpperCase() + playerChoice.slice(1)}`,
                    inline: true,
                },
                {
                    name: 'vs',
                    value: '⚔️',
                    inline: true,
                },
                {
                    name: 'Alia',
                    value: `${botEmoji} ${botChoice.charAt(0).toUpperCase() + botChoice.slice(1)}`,
                    inline: true,
                },
            )
            .setDescription(`**${resultMessage}**`)
            .setFooter({ text: 'Play again with /rps!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info('rps command used', {
            userId: interaction.user.id,
            playerChoice,
            botChoice,
            result,
        });
    },
};
