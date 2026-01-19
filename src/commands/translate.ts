import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    AutocompleteInteraction,
} from "discord.js";
import { openrouter, getModel } from "../utils/openrouter";
import { Context } from "../utils/types";

// Common language shortcuts and their full names
const LANGUAGE_MAP: Record<string, string> = {
    // Common shortcuts
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'pl': 'Polish',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'uk': 'Ukrainian',
    'cs': 'Czech',
    'el': 'Greek',
    'he': 'Hebrew',
    'id': 'Indonesian',
    'ms': 'Malay',
    'ro': 'Romanian',
    'hu': 'Hungarian',
    'fi': 'Finnish',
    'da': 'Danish',
    'no': 'Norwegian',
    // Full names (lowercase) mapped to themselves
    'english': 'English',
    'spanish': 'Spanish',
    'french': 'French',
    'german': 'German',
    'italian': 'Italian',
    'portuguese': 'Portuguese',
    'russian': 'Russian',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'chinese': 'Chinese',
    'arabic': 'Arabic',
    'hindi': 'Hindi',
    'dutch': 'Dutch',
    'swedish': 'Swedish',
    'polish': 'Polish',
    'turkish': 'Turkish',
    'vietnamese': 'Vietnamese',
    'thai': 'Thai',
    'ukrainian': 'Ukrainian',
    'czech': 'Czech',
    'greek': 'Greek',
    'hebrew': 'Hebrew',
    'indonesian': 'Indonesian',
    'malay': 'Malay',
    'romanian': 'Romanian',
    'hungarian': 'Hungarian',
    'finnish': 'Finnish',
    'danish': 'Danish',
    'norwegian': 'Norwegian',
};

// Get language choices for autocomplete
const LANGUAGE_CHOICES = [
    { name: 'English (en)', value: 'English' },
    { name: 'Spanish (es)', value: 'Spanish' },
    { name: 'French (fr)', value: 'French' },
    { name: 'German (de)', value: 'German' },
    { name: 'Italian (it)', value: 'Italian' },
    { name: 'Portuguese (pt)', value: 'Portuguese' },
    { name: 'Russian (ru)', value: 'Russian' },
    { name: 'Japanese (ja)', value: 'Japanese' },
    { name: 'Korean (ko)', value: 'Korean' },
    { name: 'Chinese (zh)', value: 'Chinese' },
    { name: 'Arabic (ar)', value: 'Arabic' },
    { name: 'Hindi (hi)', value: 'Hindi' },
    { name: 'Dutch (nl)', value: 'Dutch' },
    { name: 'Swedish (sv)', value: 'Swedish' },
    { name: 'Polish (pl)', value: 'Polish' },
    { name: 'Turkish (tr)', value: 'Turkish' },
    { name: 'Vietnamese (vi)', value: 'Vietnamese' },
    { name: 'Thai (th)', value: 'Thai' },
    { name: 'Ukrainian (uk)', value: 'Ukrainian' },
    { name: 'Greek (el)', value: 'Greek' },
];

// Resolve language shortcut to full name
function resolveLanguage(input: string): string {
    const normalized = input.toLowerCase().trim();
    return LANGUAGE_MAP[normalized] || input;
}

interface TranslationResult {
    translatedText: string;
    detectedLanguage: string;
    confidence: string;
}

// Translate text using OpenAI
async function translateText(
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
): Promise<TranslationResult> {
    const baseInstructions = `Respond in JSON format with these fields:
- translatedText: the translation
- detectedLanguage: the source language name (e.g., "English", "Spanish")
- confidence: "high", "medium", or "low" based on detection confidence`;

    const translatorRole = 'You are a professional translator.';
    const systemPrompt = sourceLanguage
        ? `${translatorRole} Translate from ${sourceLanguage} to ${targetLanguage}. ${baseInstructions}`
        : `${translatorRole} Detect language and translate to ${targetLanguage}. ${baseInstructions}`;

    const response = await openrouter.chat.completions.create({
        model: getModel(),
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
        ],
        max_tokens: 1000,
        temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
        throw new Error('No response from translation service');
    }

    return JSON.parse(content) as TranslationResult;
}

// Get supported languages list for help
function getSupportedLanguages(): string {
    const languages = [
        'English (en)', 'Spanish (es)', 'French (fr)', 'German (de)',
        'Italian (it)', 'Portuguese (pt)', 'Russian (ru)', 'Japanese (ja)',
        'Korean (ko)', 'Chinese (zh)', 'Arabic (ar)', 'Hindi (hi)',
        'And many more...',
    ];
    return languages.join(', ');
}

export default {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Translate text between languages')
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('Translate text to another language')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The text to translate')
                        .setRequired(true)
                        .setMaxLength(1000))
                .addStringOption(option =>
                    option.setName('to')
                        .setDescription('Target language (e.g., Spanish, es, French, fr)')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('from')
                        .setDescription('Source language (auto-detect if not specified)')
                        .setRequired(false)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show supported languages and usage information')),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'help') {
                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Translation Help')
                    .setDescription('Translate text between languages using AI-powered translation.')
                    .addFields(
                        {
                            name: 'Usage',
                            value: '`/translate text <text> to:<language> [from:<language>]`',
                        },
                        {
                            name: 'Supported Languages',
                            value: getSupportedLanguages(),
                        },
                        {
                            name: 'Language Shortcuts',
                            value: 'Use 2-letter codes: `en`, `es`, `fr`, `de`, `ja`, `ko`, `zh`, etc.',
                        },
                        {
                            name: 'Auto-Detection',
                            value: 'If you don\'t specify a source language, it will be automatically detected.',
                        },
                    )
                    .setFooter({ text: 'Powered by OpenRouter' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            // text subcommand
            const text = interaction.options.getString('text', true);
            const targetInput = interaction.options.getString('to', true);
            const sourceInput = interaction.options.getString('from');

            // Resolve language shortcuts
            const targetLanguage = resolveLanguage(targetInput);
            const sourceLanguage = sourceInput ? resolveLanguage(sourceInput) : undefined;

            // Defer reply since translation may take a moment
            await interaction.deferReply();

            const result = await translateText(text, targetLanguage, sourceLanguage);

            // Build confidence indicator
            const confidenceEmoji = result.confidence === 'high' ? '🟢'
                : result.confidence === 'medium' ? '🟡' : '🔴';

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Translation')
                .addFields(
                    {
                        name: `Original (${result.detectedLanguage})`,
                        value: text.length > 1000 ? text.substring(0, 997) + '...' : text,
                    },
                    {
                        name: `${targetLanguage}`,
                        value: result.translatedText.length > 1000
                            ? result.translatedText.substring(0, 997) + '...'
                            : result.translatedText,
                    },
                )
                .setFooter({
                    text: `Detection confidence: ${result.confidence} ${confidenceEmoji}`,
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            context.log.info('Translation completed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                sourceLanguage: result.detectedLanguage,
                targetLanguage,
                confidence: result.confidence,
                inputLength: text.length,
                outputLength: result.translatedText.length,
            });

        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error';

            context.log.error('Translation failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                error: errorMessage,
            });

            const replyContent = {
                content: `Failed to translate: ${errorMessage}`,
                ephemeral: true,
            };

            if (interaction.deferred) {
                await interaction.editReply(replyContent);
            } else {
                await interaction.reply(replyContent);
            }
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        const filtered = LANGUAGE_CHOICES.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue) ||
            choice.value.toLowerCase().includes(focusedValue),
        );

        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({
                name: choice.name,
                value: choice.value,
            })),
        );
    },
};
