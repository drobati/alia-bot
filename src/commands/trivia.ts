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

interface TriviaQuestion {
    question: string;
    options: string[];
    correctIndex: number;
    category: string;
}

// Track active trivia games to prevent duplicates and store votes
// Key: channelId, Value: game state
interface TriviaGame {
    correctIndex: number;
    correctAnswer: string;
    votes: Map<string, { optionIndex: number; username: string }>; // userId -> choice
    messageId: string;
}

export const activeGames: Map<string, TriviaGame> = new Map();

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
const TRIVIA_DURATION_SECONDS = 30;

// Fun messages for winners
const WINNER_MESSAGES = [
    "Big brain energy right here!",
    "Somebody's been reading encyclopedias!",
    "Einstein would be proud!",
    "Galaxy brain moment!",
    "The trivia gods smile upon you!",
];

// Fun roasts for losers
const LOSER_MESSAGES = [
    "Did you even try?",
    "Google exists, you know...",
    "Smooth brain energy detected.",
    "Your teachers are disappointed.",
    "Maybe stick to multiple choice... oh wait.",
    "At least you're consistent... consistently wrong.",
];

// Messages for when nobody participates
const NO_PARTICIPATION_MESSAGES = [
    "Nobody played? Cowards, all of you.",
    "The silence is deafening...",
    "I guess trivia isn't cool anymore.",
    "Hello? Is anyone out there?",
];

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

export default {
    data: new SlashCommandBuilder()
        .setName("trivia")
        .setDescription("Test your knowledge with a trivia question - 30 seconds to vote!"),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const channelId = interaction.channelId;

        // Check if there's already an active game in this channel
        if (activeGames.has(channelId)) {
            await interaction.reply({
                content: "There's already a trivia game in progress in this channel! Wait for it to finish.",
                ephemeral: true,
            });
            return;
        }

        const question = getRandomQuestion();
        const { shuffledOptions, newCorrectIndex } = shuffleOptions(question);
        const emoji = CATEGORY_EMOJIS[question.category] || "❓";
        const gameId = generateGameId();

        // Create the game state
        const game: TriviaGame = {
            correctIndex: newCorrectIndex,
            correctAnswer: shuffledOptions[newCorrectIndex],
            votes: new Map(),
            messageId: '',
        };
        activeGames.set(channelId, game);

        const optionsText = shuffledOptions
            .map((opt, i) => `**${OPTION_LETTERS[i]}.** ${opt}`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle(`${emoji} ${question.category} Trivia`)
            .setDescription(`**${question.question}**\n\n${optionsText}`)
            .addFields({
                name: "Time Remaining",
                value: `⏱️ ${TRIVIA_DURATION_SECONDS} seconds`,
            })
            .setFooter({ text: "Click a button to vote! Results in 30 seconds." })
            .setTimestamp();

        // Create answer buttons
        const buttons = shuffledOptions.map((_, index) =>
            new ButtonBuilder()
                .setCustomId(`trivia_vote_${gameId}_${index}`)
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

        context.log.info("trivia game started", {
            userId: interaction.user.id,
            category: question.category,
            gameId,
            channelId,
        });

        // Set up button collector for 30 seconds
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: TRIVIA_DURATION_SECONDS * 1000,
        });

        collector.on('collect', async buttonInteraction => {
            // Parse the button customId: trivia_vote_{gameId}_{optionIndex}
            const parts = buttonInteraction.customId.split('_');
            if (parts.length !== 4) {
                return;
            }

            const optionIndex = parseInt(parts[3]);
            const userId = buttonInteraction.user.id;
            const username = buttonInteraction.user.displayName || buttonInteraction.user.username;

            // Check if user already voted
            const existingVote = game.votes.get(userId);
            if (existingVote) {
                // Update their vote
                existingVote.optionIndex = optionIndex;
                await buttonInteraction.reply({
                    content: `Vote changed to **${OPTION_LETTERS[optionIndex]}**!`,
                    ephemeral: true,
                });
            } else {
                // New vote
                game.votes.set(userId, { optionIndex, username });
                await buttonInteraction.reply({
                    content: `Vote recorded for **${OPTION_LETTERS[optionIndex]}**!`,
                    ephemeral: true,
                });
            }

            context.log.info("trivia vote recorded", {
                userId,
                optionIndex,
                gameId,
            });
        });

        collector.on('end', async () => {
            // Clean up the game state
            activeGames.delete(channelId);

            // Calculate results
            const winners: string[] = [];
            const losers: string[] = [];
            const voteCounts: number[] = [0, 0, 0, 0];

            for (const [, vote] of game.votes) {
                voteCounts[vote.optionIndex]++;
                if (vote.optionIndex === newCorrectIndex) {
                    winners.push(vote.username);
                } else {
                    losers.push(vote.username);
                }
            }

            // Build results embed
            const resultsEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle(`${emoji} Trivia Results - ${question.category}`)
                .setDescription(`**${question.question}**\n\n` +
                    shuffledOptions.map((opt, i) => {
                        const isCorrect = i === newCorrectIndex;
                        const marker = isCorrect ? "✅" : "❌";
                        const count = voteCounts[i];
                        return `${marker} **${OPTION_LETTERS[i]}.** ${opt} - ${count} vote${count !== 1 ? 's' : ''}`;
                    }).join("\n"))
                .setTimestamp();

            // Add winners field
            if (winners.length > 0) {
                resultsEmbed.addFields({
                    name: "🏆 Winners",
                    value: `${winners.join(", ")}\n*${getRandomMessage(WINNER_MESSAGES)}*`,
                });
            }

            // Add losers field with roast
            if (losers.length > 0) {
                resultsEmbed.addFields({
                    name: "💀 Wrong Answers Only",
                    value: `${losers.join(", ")}\n*${getRandomMessage(LOSER_MESSAGES)}*`,
                });
            }

            // Nobody played
            if (game.votes.size === 0) {
                resultsEmbed.addFields({
                    name: "😶 No Participants",
                    value: getRandomMessage(NO_PARTICIPATION_MESSAGES),
                });
            }

            // Disable the buttons
            const disabledButtons = shuffledOptions.map((_, index) => {
                const isCorrect = index === newCorrectIndex;
                return new ButtonBuilder()
                    .setCustomId(`trivia_ended_${gameId}_${index}`)
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
                context.log.error("Failed to edit trivia results message", { error, gameId });
            }

            context.log.info("trivia game ended", {
                gameId,
                channelId,
                totalVotes: game.votes.size,
                winnersCount: winners.length,
                losersCount: losers.length,
            });
        });
    },
};
