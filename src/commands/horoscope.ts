import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Context } from '../utils/types';
import { HoroscopeGenerator } from '../utils/horoscopeGenerator';
import { ZodiacUtil } from '../utils/zodiacUtil';

export default {
    data: new SlashCommandBuilder()
        .setName('horoscope')
        .setDescription('Get your personalized horoscope reading')
        .addStringOption(option =>
            option
                .setName('sign')
                .setDescription('Your zodiac sign (e.g., Aries, Cancer, Leo)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of horoscope reading')
                .setRequired(false)
                .addChoices(
                    { name: '⭐ Daily Reading', value: 'daily' },
                    { name: '💖 Love & Relationships', value: 'love' },
                    { name: '💼 Career & Money', value: 'career' },
                    { name: '🍀 Lucky Numbers & Colors', value: 'lucky' },
                    { name: '📅 Weekly Overview', value: 'weekly' },
                    { name: '📆 Monthly Forecast', value: 'monthly' },
                ))
        .addStringOption(option =>
            option
                .setName('period')
                .setDescription('Time period for reading')
                .setRequired(false)
                .addChoices(
                    { name: 'Today', value: 'today' },
                    { name: 'Tomorrow', value: 'tomorrow' },
                    { name: 'This Week', value: 'this-week' },
                    { name: 'Next Week', value: 'next-week' },
                    { name: 'This Month', value: 'this-month' },
                ))
        .addBooleanOption(option =>
            option
                .setName('private')
                .setDescription('Keep your horoscope private (default: public)')
                .setRequired(false)),

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'sign') {
            try {
                const input = focusedOption.value.toLowerCase();
                const suggestions = await ZodiacUtil.getSignSuggestions(input);

                await interaction.respond(suggestions.slice(0, 25));
            } catch (error) {
                context.log.error('Horoscope autocomplete error', { error });
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;

        try {
            await interaction.deferReply({
                ephemeral: interaction.options.getBoolean('private') || false,
            });

            const userInput = interaction.options.getString('sign');
            const type = interaction.options.getString('type') || 'daily';
            const period = interaction.options.getString('period') || 'today';
            const isPrivate = interaction.options.getBoolean('private') || false;

            // Validate zodiac sign input
            const normalizedSign = userInput!.toLowerCase();
            const zodiacInfo = ZodiacUtil.getZodiacInfo(normalizedSign);

            // Check if it's a valid sign by comparing with known signs
            const validSigns = ZodiacUtil.getAllSigns();
            if (!validSigns.includes(normalizedSign) &&
                !validSigns.some(sign => ZodiacUtil.getZodiacInfo(sign).sign.toLowerCase() === normalizedSign)) {
                const validSignNames = validSigns.map(s => ZodiacUtil.getZodiacInfo(s).sign).join(', ');
                await interaction.editReply({
                    content: `❌ "${userInput}" is not a valid zodiac sign. Please choose from: ${validSignNames}`,
                });
                return;
            }

            const zodiacSign = zodiacInfo.sign.toLowerCase();

            // Generate horoscope
            const horoscopeData = await HoroscopeGenerator.generate({
                sign: zodiacSign,
                type,
                period,
                userId: interaction.user.id,
                guildId: interaction.guild?.id,
            }, context);

            // Update user preferences and stats
            await updateUserStats(interaction, zodiacSign, type, context);

            // Create response embed
            const embed = await createHoroscopeEmbed(horoscopeData, zodiacSign, type, period);

            await interaction.editReply({
                embeds: [embed],
            });

            log.info('Horoscope command executed', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: interaction.guild?.id,
                sign: zodiacSign,
                type,
                period,
                isPrivate,
            });

        } catch (error) {
            log.error('Horoscope command failed', {
                userId: interaction.user.id,
                error: error,
            });

            const errorMessage = '🔮 The cosmic energies are disrupted. Please try again in a moment.';

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

/* async function createSignSelectionEmbed(): Promise<EmbedBuilder> {
    return new EmbedBuilder()
        .setTitle('🔮 Welcome to Your Personal Horoscope!')
        .setDescription(
            'Please provide your zodiac sign to get your reading:\n\n' +
            '**Examples:**\n' +
            '• `/horoscope sign:Aries`\n' +
            '• `/horoscope sign:cancer type:love`\n' +
            '• `/horoscope sign:Leo period:tomorrow`\n\n' +
            '**All Zodiac Signs:**\n' +
            '♈ Aries (Mar 21-Apr 19) • ♉ Taurus (Apr 20-May 20)\n' +
            '♊ Gemini (May 21-Jun 20) • ♋ Cancer (Jun 21-Jul 22)\n' +
            '♌ Leo (Jul 23-Aug 22) • ♍ Virgo (Aug 23-Sep 22)\n' +
            '♎ Libra (Sep 23-Oct 22) • ♏ Scorpio (Oct 23-Nov 21)\n' +
            '♐ Sagittarius (Nov 22-Dec 21) • ♑ Capricorn (Dec 22-Jan 19)\n' +
            '♒ Aquarius (Jan 20-Feb 18) • ♓ Pisces (Feb 19-Mar 20)',
        )
        .setColor(0x9966FF)
        .setFooter({ text: 'Your preferences will be saved for future readings!' });
} */

async function createHoroscopeEmbed(
    horoscopeData: any,
    sign: string,
    type: string,
    period: string,
): Promise<EmbedBuilder> {
    const zodiacInfo = ZodiacUtil.getZodiacInfo(sign);
    const typeEmoji = getTypeEmoji(type);
    const periodText = getPeriodText(period);

    const embed = new EmbedBuilder()
        .setTitle(`${zodiacInfo.emoji} ${typeEmoji} ${sign.charAt(0).toUpperCase() + sign.slice(1)} ${periodText}`)
        .setDescription(`*${horoscopeData.content}*`)
        .setColor(zodiacInfo.colors[0])
        .setTimestamp()
        .addFields([
            {
                name: '🎨 Lucky Color',
                value: horoscopeData.luckyColor,
                inline: true,
            },
            {
                name: '🔢 Lucky Numbers',
                value: horoscopeData.luckyNumbers,
                inline: true,
            },
            {
                name: '💫 Cosmic Mood',
                value: horoscopeData.mood,
                inline: true,
            },
        ]);

    if (horoscopeData.compatibility && type === 'love') {
        embed.addFields([{
            name: '💝 Most Compatible',
            value: horoscopeData.compatibility,
            inline: false,
        }]);
    }

    if (horoscopeData.advice) {
        embed.addFields([{
            name: '⭐ Cosmic Advice',
            value: horoscopeData.advice,
            inline: false,
        }]);
    }

    embed.setFooter({
        text: `Element: ${zodiacInfo.element} • Planet: ${zodiacInfo.planet} • Generated by the stars ✨`,
    });

    return embed;
}

async function updateUserStats(
    interaction: ChatInputCommandInteraction,
    sign: string,
    type: string,
    context: Context,
): Promise<void> {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id || null;

        // Update or create user preferences
        await context.tables.HoroscopeUser.upsert({
            userId,
            guildId,
            zodiacSign: sign,
            preferredType: type,
            lastReadDate: new Date(),
            totalReads: context.sequelize.literal('COALESCE(total_reads, 0) + 1') as any,
        } as any);

        // Update command usage stats for global bot analytics
        const statsKey = `command_usage_horoscope`;
        await context.tables.Config.upsert({
            key: statsKey,
            value: String(Number((await context.tables.Config.findOne({
                where: { key: statsKey },
            }))?.value || 0) + 1),
        });

        // Track horoscope type usage
        const typeStatsKey = `horoscope_type_${type}`;
        await context.tables.Config.upsert({
            key: typeStatsKey,
            value: String(Number((await context.tables.Config.findOne({
                where: { key: typeStatsKey },
            }))?.value || 0) + 1),
        });

    } catch (error) {
        context.log.error('Failed to update user horoscope stats', { error });
        // Don't throw - stats failure shouldn't break the command
    }
}

function getTypeEmoji(type: string): string {
    const emojis = {
        daily: '⭐',
        love: '💖',
        career: '💼',
        lucky: '🍀',
        weekly: '📅',
        monthly: '📆',
    };
    return emojis[type as keyof typeof emojis] || '🔮';
}

function getPeriodText(period: string): string {
    const texts = {
        today: 'Today',
        tomorrow: 'Tomorrow',
        'this-week': 'This Week',
        'next-week': 'Next Week',
        'this-month': 'This Month',
    };
    return texts[period as keyof typeof texts] || 'Reading';
}