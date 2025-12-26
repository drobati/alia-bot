import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

// Store active games per user
const activeGames = new Map<string, { target: number; attempts: number; maxAttempts: number }>();

const WIN_MESSAGES = [
    "You got it! 🎉",
    "Correct! You're a mind reader! 🧠",
    "Nailed it! 🎯",
    "Winner winner! 🏆",
    "Bingo! That's the number! ✨",
];

const LOSE_MESSAGES = [
    "Game over! Better luck next time! 😅",
    "Out of guesses! The number escaped you! 🏃",
    "So close, yet so far! Try again! 💪",
    "The number wins this round! 🎲",
];

function getRandomMessage(messages: string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
}

export default {
    data: new SlashCommandBuilder()
        .setName("guess")
        .setDescription("Play a number guessing game")
        .addSubcommand(subcommand =>
            subcommand
                .setName("start")
                .setDescription("Start a new guessing game")
                .addIntegerOption(option =>
                    option
                        .setName("max")
                        .setDescription("Maximum number (default: 100)")
                        .setMinValue(10)
                        .setMaxValue(1000)
                        .setRequired(false),
                )
                .addIntegerOption(option =>
                    option
                        .setName("attempts")
                        .setDescription("Number of attempts (default: 7)")
                        .setMinValue(3)
                        .setMaxValue(20)
                        .setRequired(false),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("number")
                .setDescription("Make a guess")
                .addIntegerOption(option =>
                    option
                        .setName("value")
                        .setDescription("Your guess")
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("quit")
                .setDescription("Quit your current game"),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (subcommand === "start") {
            // Check if user already has an active game
            if (activeGames.has(userId)) {
                const embed = new EmbedBuilder()
                    .setColor(0xff9900)
                    .setTitle("⚠️ Game Already Active")
                    .setDescription(
                        "You already have a game in progress!\n" +
                        "Use `/guess number` to make a guess or `/guess quit` to end it.",
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            const max = interaction.options.getInteger("max") || 100;
            const maxAttempts = interaction.options.getInteger("attempts") || 7;
            const target = Math.floor(Math.random() * max) + 1;

            activeGames.set(userId, { target, attempts: 0, maxAttempts });

            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("🎮 Number Guessing Game")
                .setDescription(
                    `I'm thinking of a number between **1** and **${max}**.\n` +
                    `You have **${maxAttempts}** attempts to guess it!`,
                )
                .addFields({ name: "How to Play", value: "Use `/guess number <your guess>` to make a guess!" })
                .setFooter({ text: `Good luck, ${interaction.user.username}!` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            context.log.info("guess game started", {
                userId,
                max,
                maxAttempts,
            });
        } else if (subcommand === "number") {
            const game = activeGames.get(userId);

            if (!game) {
                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("❌ No Active Game")
                    .setDescription("You don't have an active game!\nUse `/guess start` to begin a new game.")
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            const guess = interaction.options.getInteger("value", true);
            game.attempts++;

            if (guess === game.target) {
                // Winner!
                activeGames.delete(userId);

                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle("🎉 Congratulations!")
                    .setDescription(`${getRandomMessage(WIN_MESSAGES)}\n\nThe number was **${game.target}**!`)
                    .addFields({ name: "Attempts Used", value: `${game.attempts}/${game.maxAttempts}`, inline: true })
                    .setFooter({ text: "Use /guess start to play again!" })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                context.log.info("guess game won", {
                    userId,
                    target: game.target,
                    attempts: game.attempts,
                });
            } else if (game.attempts >= game.maxAttempts) {
                // Out of attempts
                activeGames.delete(userId);

                const embed = new EmbedBuilder()
                    .setColor(0xff0000)
                    .setTitle("😢 Game Over")
                    .setDescription(`${getRandomMessage(LOSE_MESSAGES)}\n\nThe number was **${game.target}**!`)
                    .addFields({ name: "Your Last Guess", value: `${guess}`, inline: true })
                    .setFooter({ text: "Use /guess start to try again!" })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

                context.log.info("guess game lost", {
                    userId,
                    target: game.target,
                    attempts: game.attempts,
                });
            } else {
                // Give hint
                const direction = guess < game.target ? "📈 Higher!" : "📉 Lower!";
                const remaining = game.maxAttempts - game.attempts;
                const urgency = remaining <= 2 ? "🔥 " : "";

                const embed = new EmbedBuilder()
                    .setColor(0xffcc00)
                    .setTitle(`${direction}`)
                    .setDescription(`Your guess: **${guess}**`)
                    .addFields({ name: "Attempts Remaining", value: `${urgency}${remaining}`, inline: true })
                    .setFooter({ text: "Keep guessing with /guess number!" })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        } else if (subcommand === "quit") {
            const game = activeGames.get(userId);

            if (!game) {
                const embed = new EmbedBuilder()
                    .setColor(0xff9900)
                    .setTitle("⚠️ No Active Game")
                    .setDescription("You don't have a game to quit!")
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            activeGames.delete(userId);

            const embed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle("👋 Game Ended")
                .setDescription(`The number was **${game.target}**.\nBetter luck next time!`)
                .setFooter({ text: "Use /guess start to play again!" })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            context.log.info("guess game quit", {
                userId,
                target: game.target,
                attempts: game.attempts,
            });
        }
    },
};
