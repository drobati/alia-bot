import axios from "axios";
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
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

const COCKTAIL_API_URL = "https://www.thecocktaildb.com/api/json/v1/1/random.php";

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

const drinkCommand = {
    data: new SlashCommandBuilder()
        .setName("drink")
        .setDescription("Guess the cocktail! Shows ingredients and image with the name hidden."),

    async execute(interaction: ChatInputCommandInteraction, { log }: Context) {
        try {
            await interaction.deferReply();

            const response = await axios.get<CocktailResponse>(COCKTAIL_API_URL, {
                headers: { "User-Agent": "Alia Discord Bot" },
            });

            const drinks = response.data.drinks;
            if (!drinks || drinks.length === 0) {
                return await interaction.editReply("Could not fetch a drink at this time.");
            }

            const drink = drinks[0];
            const ingredients = getIngredients(drink);

            const ingredientsList = ingredients
                .map((ing, i) => `${i + 1}. ${ing}`)
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle("🍹 Guess the Cocktail!")
                .setDescription("Can you guess this drink from its ingredients?")
                .setImage(drink.strDrinkThumb)
                .addFields(
                    {
                        name: "📋 Ingredients",
                        value: ingredientsList || "No ingredients listed",
                        inline: false,
                    },
                    {
                        name: "🥃 Glass",
                        value: drink.strGlass || "Unknown",
                        inline: true,
                    },
                    {
                        name: "📁 Category",
                        value: drink.strCategory || "Unknown",
                        inline: true,
                    },
                    {
                        name: "🍸 Type",
                        value: drink.strAlcoholic || "Unknown",
                        inline: true,
                    },
                    {
                        name: "🎯 Answer",
                        value: `||${drink.strDrink}||`,
                        inline: false,
                    },
                )
                .setFooter({ text: "Click the spoiler to reveal the drink name!" })
                .setTimestamp();

            log.info("drink command used", {
                drinkId: drink.idDrink,
                drinkName: drink.strDrink,
                userId: interaction.user.id,
            });

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            log.error({ error }, "Error fetching cocktail");

            if (interaction.deferred) {
                return await interaction.editReply("Sorry, I could not fetch a drink at this time.");
            }
            return await interaction.reply("Sorry, I could not fetch a drink at this time.");
        }
    },
};

export default drinkCommand;
