import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

// Collection of jokes organized by category
const JOKES = {
    general: [
        { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
        { setup: "Why did the scarecrow win an award?", punchline: "He was outstanding in his field!" },
        { setup: "I told my wife she was drawing her eyebrows too high.", punchline: "She looked surprised." },
        { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
        { setup: "What do you call a fake noodle?", punchline: "An impasta!" },
        { setup: "Why did the bicycle fall over?", punchline: "Because it was two-tired!" },
        { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear!" },
        { setup: "Why can't you give Elsa a balloon?", punchline: "Because she will let it go!" },
        { setup: "What do you call a fish without eyes?", punchline: "A fsh!" },
        { setup: "Why did the math book look so sad?", punchline: "Because it had too many problems." },
    ],
    programming: [
        { setup: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" },
        { setup: "A SQL query walks into a bar, walks up to two tables and asks...", punchline: "Can I join you?" },
        { setup: "Why do Java developers wear glasses?", punchline: "Because they can't C#!" },
        { setup: "What's a programmer's favorite hangout place?", punchline: "Foo Bar!" },
        { setup: "Why was the JavaScript developer sad?", punchline: "Because he didn't Node how to Express himself!" },
        {
            setup: "How many programmers does it take to change a light bulb?",
            punchline: "None, that's a hardware problem!",
        },
        { setup: "Why do programmers always mix up Halloween and Christmas?", punchline: "Because Oct 31 = Dec 25!" },
        { setup: "What's a programmer's favorite place to hang out?", punchline: "The Foo Bar!" },
        { setup: "Why did the developer go broke?", punchline: "Because he used up all his cache!" },
        { setup: "What do you call 8 hobbits?", punchline: "A hobbyte!" },
    ],
    animals: [
        { setup: "What do you call a sleeping dinosaur?", punchline: "A dino-snore!" },
        { setup: "Why don't elephants use computers?", punchline: "They're afraid of the mouse!" },
        { setup: "What do you call a dog that does magic?", punchline: "A Labracadabrador!" },
        { setup: "Why do cows wear bells?", punchline: "Because their horns don't work!" },
        { setup: "What do you call a fish that wears a bowtie?", punchline: "So-fish-ticated!" },
        {
            setup: "Why do seagulls fly over the sea?",
            punchline: "Because if they flew over the bay, they'd be bagels!",
        },
        { setup: "What do you call a pig that does karate?", punchline: "A pork chop!" },
        { setup: "Why don't oysters share?", punchline: "Because they're shellfish!" },
        { setup: "What do you call an alligator in a vest?", punchline: "An investigator!" },
        { setup: "Why do bees have sticky hair?", punchline: "Because they use honeycombs!" },
    ],
};

type JokeCategory = keyof typeof JOKES;
const CATEGORIES: JokeCategory[] = Object.keys(JOKES) as JokeCategory[];

const CATEGORY_EMOJIS: Record<JokeCategory, string> = {
    general: "😄",
    programming: "💻",
    animals: "🐾",
};

function getRandomJoke(category?: JokeCategory): { joke: typeof JOKES.general[0]; category: JokeCategory } {
    const selectedCategory = category || CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const jokes = JOKES[selectedCategory];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return { joke, category: selectedCategory };
}

export default {
    data: new SlashCommandBuilder()
        .setName("joke")
        .setDescription("Get a random joke")
        .addStringOption(option =>
            option
                .setName("category")
                .setDescription("The category of joke")
                .setRequired(false)
                .addChoices(
                    { name: "😄 General", value: "general" },
                    { name: "💻 Programming", value: "programming" },
                    { name: "🐾 Animals", value: "animals" },
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const categoryOption = interaction.options.getString("category") as JokeCategory | null;
        const { joke, category } = getRandomJoke(categoryOption || undefined);
        const emoji = CATEGORY_EMOJIS[category];

        const embed = new EmbedBuilder()
            .setColor(0xffcc00)
            .setTitle(`${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)} Joke`)
            .addFields(
                { name: "Setup", value: joke.setup },
                { name: "Punchline", value: `||${joke.punchline}||` },
            )
            .setFooter({ text: "Click the spoiler to reveal the punchline!" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info("joke command used", {
            userId: interaction.user.id,
            category,
        });
    },
};
