import axios from "axios";
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

interface CocktailResponse {
    drinks: Drink[] | null;
}

interface Drink {
    idDrink: string;
    strDrink: string;
    strDrinkThumb: string;
    strInstructions: string;
    strGlass: string;
    strCategory: string;
    strAlcoholic: string;
    strIngredient1: string | null;
    strIngredient2: string | null;
    strIngredient3: string | null;
    strIngredient4: string | null;
    strIngredient5: string | null;
    strIngredient6: string | null;
    strIngredient7: string | null;
    strIngredient8: string | null;
    strIngredient9: string | null;
    strIngredient10: string | null;
    strIngredient11: string | null;
    strIngredient12: string | null;
    strIngredient13: string | null;
    strIngredient14: string | null;
    strIngredient15: string | null;
    strMeasure1: string | null;
    strMeasure2: string | null;
    strMeasure3: string | null;
    strMeasure4: string | null;
    strMeasure5: string | null;
    strMeasure6: string | null;
    strMeasure7: string | null;
    strMeasure8: string | null;
    strMeasure9: string | null;
    strMeasure10: string | null;
    strMeasure11: string | null;
    strMeasure12: string | null;
    strMeasure13: string | null;
    strMeasure14: string | null;
    strMeasure15: string | null;
}

interface DrinkGame {
    correctIndex: number;
    correctDrink: string;
    votes: Map<string, { optionIndex: number; username: string }>;
    messageId: string;
}

export const activeGames: Map<string, DrinkGame> = new Map();

const COCKTAIL_API_URL = "https://www.thecocktaildb.com/api/json/v1/1/random.php";
const GAME_DURATION_SECONDS = 45;
const OPTION_LETTERS = ["A", "B", "C", "D"];

// Fun messages for winners
const WINNER_MESSAGES = [
    "Somebody knows their drinks!",
    "Are you a bartender?",
    "Cheers to you, mixologist!",
    "You've clearly done some research... at the bar.",
    "Professional taster right here!",
];

// Fun roasts for losers
const LOSER_MESSAGES = [
    "Stick to water, maybe?",
    "Have you ever been to a bar?",
    "That's... not even close.",
    "I think you need more practice. For science.",
    "Did you just guess randomly?",
    "Time to expand your cocktail horizons!",
];

// Messages for when nobody participates
const NO_PARTICIPATION_MESSAGES = [
    "Nobody playing? More drinks for me then!",
    "I guess everyone's already at the bar...",
    "Too sober to guess? Fair enough.",
    "The cocktails are getting lonely...",
];

function getIngredients(drink: Drink): string[] {
    const ingredients: string[] = [];

    for (let i = 1; i <= 15; i++) {
        const ingredient = drink[`strIngredient${i}` as keyof Drink] as string | null;
        const measure = drink[`strMeasure${i}` as keyof Drink] as string | null;

        if (ingredient && ingredient.trim()) {
            const measureText = measure?.trim() ? `${measure.trim()} ` : "";
            ingredients.push(`${measureText}${ingredient.trim()}`);
        }
    }

    return ingredients;
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

async function fetchRandomDrinks(count: number): Promise<Drink[]> {
    const drinks: Drink[] = [];
    const seenIds = new Set<string>();

    // Fetch multiple drinks, ensuring no duplicates
    for (let i = 0; i < count * 2 && drinks.length < count; i++) {
        try {
            const response = await axios.get<CocktailResponse>(COCKTAIL_API_URL, {
                headers: { "User-Agent": "Alia Discord Bot" },
            });

            if (response.data.drinks && response.data.drinks.length > 0) {
                const drink = response.data.drinks[0];
                if (!seenIds.has(drink.idDrink)) {
                    seenIds.add(drink.idDrink);
                    drinks.push(drink);
                }
            }
        } catch {
            // Continue trying to fetch more drinks
        }
    }

    return drinks;
}

const drinkCommand = {
    data: new SlashCommandBuilder()
        .setName("drink")
        .setDescription("Guess the cocktail! 45 seconds to vote on the correct drink name."),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;
        const channelId = interaction.channelId;

        // Check if there's already an active game in this channel
        if (activeGames.has(channelId)) {
            await interaction.reply({
                content: "There's already a drink guessing game in progress! Wait for it to finish.",
                ephemeral: true,
            });
            return;
        }

        try {
            await interaction.deferReply();

            // Fetch 4 random drinks
            const drinks = await fetchRandomDrinks(4);

            if (drinks.length < 4) {
                return await interaction.editReply(
                    "Could not fetch enough drinks. Please try again in a moment.",
                );
            }

            // The first drink is the correct answer, others are wrong options
            const correctDrink = drinks[0];
            const ingredients = getIngredients(correctDrink);
            const gameId = generateGameId();

            // Create shuffled options
            const drinkNames = drinks.map(d => d.strDrink);
            const shuffledNames = shuffleArray(drinkNames);
            const correctIndex = shuffledNames.indexOf(correctDrink.strDrink);

            // Create the game state
            const game: DrinkGame = {
                correctIndex,
                correctDrink: correctDrink.strDrink,
                votes: new Map(),
                messageId: '',
            };
            activeGames.set(channelId, game);

            const ingredientsList = ingredients
                .map((ing, i) => `${i + 1}. ${ing}`)
                .join("\n");

            const optionsText = shuffledNames
                .map((name, i) => `**${OPTION_LETTERS[i]}.** ${name}`)
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle("🍹 Guess the Cocktail!")
                .setDescription("Can you guess this drink from its ingredients?\n\n" + optionsText)
                .setImage(correctDrink.strDrinkThumb)
                .addFields(
                    {
                        name: "📋 Ingredients",
                        value: ingredientsList || "No ingredients listed",
                        inline: false,
                    },
                    {
                        name: "🥃 Glass",
                        value: correctDrink.strGlass || "Unknown",
                        inline: true,
                    },
                    {
                        name: "📁 Category",
                        value: correctDrink.strCategory || "Unknown",
                        inline: true,
                    },
                    {
                        name: "🍸 Type",
                        value: correctDrink.strAlcoholic || "Unknown",
                        inline: true,
                    },
                    {
                        name: "⏱️ Time",
                        value: `${GAME_DURATION_SECONDS} seconds to vote!`,
                        inline: false,
                    },
                )
                .setFooter({ text: "Click a button to vote!" })
                .setTimestamp();

            // Create answer buttons
            const buttons = shuffledNames.map((name, index) =>
                new ButtonBuilder()
                    .setCustomId(`drink_vote_${gameId}_${index}`)
                    .setLabel(`${OPTION_LETTERS[index]}`)
                    .setStyle(ButtonStyle.Primary),
            );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

            const message = await interaction.editReply({
                embeds: [embed],
                components: [row],
            }) as Message;

            game.messageId = message.id;

            log.info("drink game started", {
                drinkId: correctDrink.idDrink,
                drinkName: correctDrink.strDrink,
                userId: interaction.user.id,
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
                        content: `Vote changed to **${OPTION_LETTERS[optionIndex]}. ${shuffledNames[optionIndex]}**!`,
                        ephemeral: true,
                    });
                } else {
                    game.votes.set(oddsId, { optionIndex, username });
                    await buttonInteraction.reply({
                        content: `Vote recorded for **${OPTION_LETTERS[optionIndex]}. ${shuffledNames[optionIndex]}**!`,
                        ephemeral: true,
                    });
                }

                log.info("drink vote recorded", {
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
                    .setTitle("🍹 Cocktail Results!")
                    .setDescription(`The drink was **${correctDrink.strDrink}**!\n\n` +
                        shuffledNames.map((name, i) => {
                            const isCorrect = i === correctIndex;
                            const marker = isCorrect ? "✅" : "❌";
                            const count = voteCounts[i];
                            const votes = count !== 1 ? 's' : '';
                            return `${marker} **${OPTION_LETTERS[i]}.** ${name} - ${count} vote${votes}`;
                        }).join("\n"))
                    .setThumbnail(correctDrink.strDrinkThumb)
                    .setTimestamp();

                if (winners.length > 0) {
                    resultsEmbed.addFields({
                        name: "🏆 Cocktail Connoisseurs",
                        value: `${winners.join(", ")}\n*${getRandomMessage(WINNER_MESSAGES)}*`,
                    });
                }

                if (losers.length > 0) {
                    resultsEmbed.addFields({
                        name: "🍺 Maybe Try Beer Instead",
                        value: `${losers.join(", ")}\n*${getRandomMessage(LOSER_MESSAGES)}*`,
                    });
                }

                if (game.votes.size === 0) {
                    resultsEmbed.addFields({
                        name: "😶 No Participants",
                        value: getRandomMessage(NO_PARTICIPATION_MESSAGES),
                    });
                }

                const disabledButtons = shuffledNames.map((_, index) => {
                    const isCorrect = index === correctIndex;
                    return new ButtonBuilder()
                        .setCustomId(`drink_ended_${gameId}_${index}`)
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
                    log.error("Failed to edit drink results message", { error, gameId });
                }

                log.info("drink game ended", {
                    gameId,
                    channelId,
                    correctDrink: correctDrink.strDrink,
                    totalVotes: game.votes.size,
                    winnersCount: winners.length,
                    losersCount: losers.length,
                });
            });
        } catch (error) {
            log.error({ error }, "Error starting drink game");
            activeGames.delete(channelId);

            if (interaction.deferred) {
                return await interaction.editReply("Sorry, I could not start the drink game at this time.");
            }
            return await interaction.reply("Sorry, I could not start the drink game at this time.");
        }
    },
};

export default drinkCommand;
