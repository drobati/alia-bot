import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";

interface TriviaQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    category: string;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
    // Science
    {
        question: "What is the chemical symbol for gold?",
        options: ["Go", "Au", "Ag", "Gd"],
        correctIndex: 1,
        category: "Science",
    },
    {
        question: "What planet is known as the Red Planet?",
        options: ["Venus", "Jupiter", "Mars", "Saturn"],
        correctIndex: 2,
        category: "Science",
    },
    {
        question: "What is the hardest natural substance on Earth?",
        options: ["Gold", "Iron", "Diamond", "Platinum"],
        correctIndex: 2,
        category: "Science",
    },
    {
        question: "How many bones are in the adult human body?",
        options: ["186", "206", "226", "256"],
        correctIndex: 1,
        category: "Science",
    },
    // History
    {
        question: "In what year did World War II end?",
        options: ["1943", "1944", "1945", "1946"],
        correctIndex: 2,
        category: "History",
    },
    {
        question: "Who was the first President of the United States?",
        options: ["Thomas Jefferson", "John Adams", "Benjamin Franklin", "George Washington"],
        correctIndex: 3,
        category: "History",
    },
    {
        question: "The Great Wall of China was primarily built to protect against invasions from which group?",
        options: ["Mongols", "Japanese", "Koreans", "Russians"],
        correctIndex: 0,
        category: "History",
    },
    {
        question: "What ancient wonder was located in Alexandria, Egypt?",
        options: ["Hanging Gardens", "Colossus", "Lighthouse", "Mausoleum"],
        correctIndex: 2,
        category: "History",
    },
    // Geography
    {
        question: "What is the largest ocean on Earth?",
        options: ["Atlantic", "Indian", "Arctic", "Pacific"],
        correctIndex: 3,
        category: "Geography",
    },
    {
        question: "What is the capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correctIndex: 2,
        category: "Geography",
    },
    {
        question: "Which country has the most natural lakes?",
        options: ["USA", "Russia", "Canada", "Brazil"],
        correctIndex: 2,
        category: "Geography",
    },
    {
        question: "What is the smallest country in the world?",
        options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"],
        correctIndex: 1,
        category: "Geography",
    },
    // Entertainment
    {
        question: "What year was the first Harry Potter book published?",
        options: ["1995", "1997", "1999", "2001"],
        correctIndex: 1,
        category: "Entertainment",
    },
    {
        question: "Who directed the movie 'Jurassic Park'?",
        options: ["James Cameron", "Steven Spielberg", "George Lucas", "Ridley Scott"],
        correctIndex: 1,
        category: "Entertainment",
    },
    {
        question: "What is the best-selling video game of all time?",
        options: ["Tetris", "Minecraft", "GTA V", "Wii Sports"],
        correctIndex: 1,
        category: "Entertainment",
    },
    {
        question: "Which band performed 'Bohemian Rhapsody'?",
        options: ["The Beatles", "Led Zeppelin", "Queen", "Pink Floyd"],
        correctIndex: 2,
        category: "Entertainment",
    },
    // Technology
    {
        question: "What does 'HTTP' stand for?",
        options: [
            "HyperText Transfer Protocol",
            "High Tech Transfer Protocol",
            "HyperText Technical Process",
            "High Transfer Text Protocol",
        ],
        correctIndex: 0,
        category: "Technology",
    },
    {
        question: "Who founded Microsoft?",
        options: ["Steve Jobs", "Bill Gates & Paul Allen", "Mark Zuckerberg", "Larry Page"],
        correctIndex: 1,
        category: "Technology",
    },
    {
        question: "What year was the iPhone first released?",
        options: ["2005", "2006", "2007", "2008"],
        correctIndex: 2,
        category: "Technology",
    },
    {
        question: "What does 'CPU' stand for?",
        options: [
            "Central Processing Unit",
            "Computer Personal Unit",
            "Central Program Utility",
            "Computer Processing Unit",
        ],
        correctIndex: 0,
        category: "Technology",
    },
];

const CATEGORY_EMOJIS: Record<string, string> = {
    Science: "🔬",
    History: "📜",
    Geography: "🌍",
    Entertainment: "🎬",
    Technology: "💻",
};

const OPTION_LETTERS = ["A", "B", "C", "D"];

function getRandomQuestion(): TriviaQuestion {
    return TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
}

function shuffleOptions(question: TriviaQuestion): { shuffledOptions: string[]; newCorrectIndex: number } {
    const indices = [0, 1, 2, 3];
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const shuffledOptions = indices.map(i => question.options[i]);
    const newCorrectIndex = indices.indexOf(question.correctIndex);

    return { shuffledOptions, newCorrectIndex };
}

export default {
    data: new SlashCommandBuilder()
        .setName("trivia")
        .setDescription("Test your knowledge with a trivia question"),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const question = getRandomQuestion();
        const { shuffledOptions, newCorrectIndex } = shuffleOptions(question);
        const emoji = CATEGORY_EMOJIS[question.category] || "❓";
        const correctLetter = OPTION_LETTERS[newCorrectIndex];

        const optionsText = shuffledOptions
            .map((opt, i) => `**${OPTION_LETTERS[i]}.** ${opt}`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`${emoji} ${question.category} Trivia`)
            .setDescription(`**${question.question}**\n\n${optionsText}`)
            .addFields({
                name: "Answer",
                value: `||${correctLetter}. ${shuffledOptions[newCorrectIndex]}||`,
            })
            .setFooter({ text: "Click the spoiler to reveal the answer!" })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        context.log.info("trivia command used", {
            userId: interaction.user.id,
            category: question.category,
        });
    },
};
