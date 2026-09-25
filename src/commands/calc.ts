import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../utils/types";
import { formatResult, limitedEvaluate } from "../lib/calc-core";

// Get examples for the help embed
function getExamples(): string {
    return [
        '`2 + 2` → Basic arithmetic',
        '`sqrt(16)` → Square root',
        '`sin(pi/2)` → Trigonometry (radians)',
        '`log(100, 10)` → Logarithm base 10',
        '`5!` → Factorial',
        '`2^10` → Exponentiation',
        '`5 inches to cm` → Unit conversion',
        '`100 km/h to mph` → Speed conversion',
        '`abs(-5)` → Absolute value',
        '`round(3.7)` → Rounding',
    ].join('\n');
}

// Get list of supported functions
function getSupportedFunctions(): string {
    return [
        '**Arithmetic:** `+`, `-`, `*`, `/`, `^`, `%`',
        '**Roots:** `sqrt`, `cbrt`, `nthRoot`',
        '**Trig:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`',
        '**Logarithms:** `log`, `log10`, `log2`, `ln`',
        '**Other:** `abs`, `round`, `floor`, `ceil`, `factorial` (`!`)',
        '**Constants:** `pi`, `e`, `phi` (golden ratio)',
        '**Units:** Length, mass, time, temperature, and more',
    ].join('\n');
}

export default {
    data: new SlashCommandBuilder()
        .setName('calc')
        .setDescription('Evaluate mathematical expressions with advanced functions and unit conversions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('eval')
                .setDescription('Evaluate a mathematical expression')
                .addStringOption(option =>
                    option.setName('expression')
                        .setDescription('The math expression to evaluate (e.g., 2+2, sqrt(16), 5 inches to cm)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show available functions and examples')),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'help') {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('🧮 Calculator Help')
                    .addFields(
                        { name: 'Supported Functions', value: getSupportedFunctions() },
                        { name: 'Examples', value: getExamples() },
                    )
                    .setFooter({ text: 'Powered by mathjs' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // eval subcommand
            const expression = interaction.options.getString('expression', true);

            // Safety check - limit expression length
            if (expression.length > 500) {
                await interaction.reply({
                    content: 'Expression is too long. Please keep it under 500 characters.',
                    ephemeral: true,
                });
                return;
            }

            // Evaluate the expression
            const result = limitedEvaluate(expression);
            const formattedResult = formatResult(result);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🧮 Calculator')
                .addFields(
                    { name: 'Expression', value: `\`${expression}\``, inline: true },
                    { name: 'Result', value: `**${formattedResult}**`, inline: true },
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            context.log.info('Calculator expression evaluated', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                expression,
                result: formattedResult,
            });

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';

            // Provide helpful error messages
            let userMessage = 'Could not evaluate the expression.';
            if (errorMessage.includes('Undefined symbol')) {
                const symbol = errorMessage.split('Undefined symbol ')[1] || 'unknown';
                userMessage = `Unknown variable or function: ${symbol}`;
            } else if (errorMessage.includes('Unexpected end of expression')) {
                userMessage = 'Incomplete expression. Check for missing parentheses or operators.';
            } else if (errorMessage.includes('disabled')) {
                userMessage = 'This function is not allowed for security reasons.';
            } else if (errorMessage.includes('Value expected')) {
                userMessage = 'Invalid syntax. Check your expression.';
            } else {
                userMessage = `Error: ${errorMessage}`;
            }

            await interaction.reply({
                content: `❌ ${userMessage}`,
                ephemeral: true,
            });

            context.log.warn('Calculator expression failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                expression: interaction.options.getString('expression'),
                error: errorMessage,
            });
        }
    },
};
