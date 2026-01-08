import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { Context } from "../types";
import {
    parseColor,
    getColorInfo,
    getContrastRatio,
    getWcagLevel,
    getComplementary,
    getAnalogous,
    getTriadic,
    getSplitComplementary,
    getRandomColor,
    rgbToHex,
    rgbToInt,
    isLightColor,
    RGB,
} from "../utils/colorUtils";

type PaletteType = 'complementary' | 'analogous' | 'triadic' | 'split';

const PALETTE_CHOICES: { name: string; value: PaletteType }[] = [
    { name: 'Complementary', value: 'complementary' },
    { name: 'Analogous', value: 'analogous' },
    { name: 'Triadic', value: 'triadic' },
    { name: 'Split Complementary', value: 'split' },
];

function createColorEmbed(rgb: RGB, title: string): EmbedBuilder {
    const info = getColorInfo(rgb);
    const whiteContrast = getContrastRatio(rgb, { r: 255, g: 255, b: 255 });
    const blackContrast = getContrastRatio(rgb, { r: 0, g: 0, b: 0 });

    const embed = new EmbedBuilder()
        .setColor(rgbToInt(rgb))
        .setTitle(title)
        .addFields(
            {
                name: 'Hex',
                value: `\`${info.hex.toUpperCase()}\``,
                inline: true,
            },
            {
                name: 'RGB',
                value: `\`rgb(${info.rgb.r}, ${info.rgb.g}, ${info.rgb.b})\``,
                inline: true,
            },
            {
                name: 'HSL',
                value: `\`hsl(${info.hsl.h}, ${info.hsl.s}%, ${info.hsl.l}%)\``,
                inline: true,
            },
            {
                name: 'Contrast with White',
                value: `${whiteContrast.toFixed(2)}:1 (${getWcagLevel(whiteContrast)})`,
                inline: true,
            },
            {
                name: 'Contrast with Black',
                value: `${blackContrast.toFixed(2)}:1 (${getWcagLevel(blackContrast)})`,
                inline: true,
            },
            {
                name: 'Type',
                value: isLightColor(rgb) ? 'Light' : 'Dark',
                inline: true,
            },
        )
        .setTimestamp();

    return embed;
}

function createPaletteEmbed(
    baseRgb: RGB,
    paletteType: PaletteType,
): EmbedBuilder {
    let colors: RGB[];
    let description: string;

    switch (paletteType) {
        case 'complementary':
            colors = [baseRgb, getComplementary(baseRgb)];
            description = 'Colors opposite each other on the color wheel.';
            break;
        case 'analogous':
            colors = getAnalogous(baseRgb);
            description = 'Colors adjacent to each other on the color wheel.';
            break;
        case 'triadic':
            colors = getTriadic(baseRgb);
            description = 'Three colors equally spaced on the color wheel.';
            break;
        case 'split':
            colors = getSplitComplementary(baseRgb);
            description = 'Base color plus two colors adjacent to its complement.';
            break;
        default:
            colors = [baseRgb];
            description = 'Color palette';
    }

    const paletteDisplay = colors
        .map(c => `\`${rgbToHex(c).toUpperCase()}\``)
        .join(' → ');

    const typeName = PALETTE_CHOICES.find(c => c.value === paletteType)?.name || paletteType;

    const embed = new EmbedBuilder()
        .setColor(rgbToInt(baseRgb))
        .setTitle(`${typeName} Palette`)
        .setDescription(description)
        .addFields(
            {
                name: 'Colors',
                value: paletteDisplay,
                inline: false,
            },
            {
                name: 'Base Color',
                value: `\`${rgbToHex(baseRgb).toUpperCase()}\``,
                inline: true,
            },
            {
                name: 'Color Count',
                value: `${colors.length}`,
                inline: true,
            },
        )
        .setTimestamp();

    // Add individual color details
    colors.forEach((color, index) => {
        const hex = rgbToHex(color).toUpperCase();
        const label = index === 0 ? 'Base' : `Color ${index + 1}`;
        embed.addFields({
            name: label,
            value: `${hex}`,
            inline: true,
        });
    });

    return embed;
}

const colorCommand = {
    data: new SlashCommandBuilder()
        .setName('color')
        .setDescription('Color conversion, palettes, and accessibility tools')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get information about a color')
                .addStringOption(option =>
                    option
                        .setName('color')
                        .setDescription('Color in hex (#ff0000), RGB (255,0,0), or HSL (hsl(0,100%,50%))')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('palette')
                .setDescription('Generate a color palette')
                .addStringOption(option =>
                    option
                        .setName('color')
                        .setDescription('Base color in hex (#ff0000) or RGB (255,0,0)')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of palette to generate')
                        .setRequired(true)
                        .addChoices(...PALETTE_CHOICES),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('random')
                .setDescription('Generate a random color'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('contrast')
                .setDescription('Check contrast ratio between two colors')
                .addStringOption(option =>
                    option
                        .setName('color1')
                        .setDescription('First color (foreground)')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('color2')
                        .setDescription('Second color (background)')
                        .setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'info': {
                    const colorInput = interaction.options.getString('color', true);
                    const rgb = parseColor(colorInput);

                    if (!rgb) {
                        await interaction.reply({
                            content: 'Invalid color format. Use hex (#ff0000), ' +
                                'RGB (255,0,0), or HSL (hsl(0,100%,50%)).',
                            ephemeral: true,
                        });
                        return;
                    }

                    const embed = createColorEmbed(rgb, 'Color Information');
                    await interaction.reply({ embeds: [embed] });

                    context.log.info('color info command used', {
                        userId: interaction.user.id,
                        color: rgbToHex(rgb),
                    });
                    break;
                }

                case 'palette': {
                    const colorInput = interaction.options.getString('color', true);
                    const paletteType = interaction.options.getString('type', true) as PaletteType;
                    const rgb = parseColor(colorInput);

                    if (!rgb) {
                        await interaction.reply({
                            content: 'Invalid color format. Use hex (#ff0000) or RGB (255,0,0).',
                            ephemeral: true,
                        });
                        return;
                    }

                    const embed = createPaletteEmbed(rgb, paletteType);
                    await interaction.reply({ embeds: [embed] });

                    context.log.info('color palette command used', {
                        userId: interaction.user.id,
                        color: rgbToHex(rgb),
                        paletteType,
                    });
                    break;
                }

                case 'random': {
                    const rgb = getRandomColor();
                    const embed = createColorEmbed(rgb, 'Random Color');
                    await interaction.reply({ embeds: [embed] });

                    context.log.info('color random command used', {
                        userId: interaction.user.id,
                        color: rgbToHex(rgb),
                    });
                    break;
                }

                case 'contrast': {
                    const color1Input = interaction.options.getString('color1', true);
                    const color2Input = interaction.options.getString('color2', true);
                    const rgb1 = parseColor(color1Input);
                    const rgb2 = parseColor(color2Input);

                    if (!rgb1 || !rgb2) {
                        await interaction.reply({
                            content: 'Invalid color format. Use hex (#ff0000) or RGB (255,0,0).',
                            ephemeral: true,
                        });
                        return;
                    }

                    const ratio = getContrastRatio(rgb1, rgb2);
                    const level = getWcagLevel(ratio);

                    const embed = new EmbedBuilder()
                        .setColor(rgbToInt(rgb1))
                        .setTitle('Contrast Ratio')
                        .addFields(
                            {
                                name: 'Foreground',
                                value: `\`${rgbToHex(rgb1).toUpperCase()}\``,
                                inline: true,
                            },
                            {
                                name: 'Background',
                                value: `\`${rgbToHex(rgb2).toUpperCase()}\``,
                                inline: true,
                            },
                            {
                                name: 'Contrast Ratio',
                                value: `**${ratio.toFixed(2)}:1**`,
                                inline: true,
                            },
                            {
                                name: 'WCAG Level',
                                value: level,
                                inline: true,
                            },
                            {
                                name: 'Normal Text',
                                value: ratio >= 4.5 ? 'Pass' : 'Fail',
                                inline: true,
                            },
                            {
                                name: 'Large Text',
                                value: ratio >= 3 ? 'Pass' : 'Fail',
                                inline: true,
                            },
                        )
                        .setDescription(
                            ratio >= 4.5
                                ? 'This combination passes WCAG AA for normal text.'
                                : ratio >= 3
                                    ? 'This combination only passes WCAG AA for large text (18pt+).'
                                    : 'This combination does not meet WCAG accessibility standards.',
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });

                    context.log.info('color contrast command used', {
                        userId: interaction.user.id,
                        color1: rgbToHex(rgb1),
                        color2: rgbToHex(rgb2),
                        ratio,
                    });
                    break;
                }

                default:
                    await interaction.reply({
                        content: 'Unknown subcommand.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            context.log.error({ error }, 'Error in color command');

            const errorMessage = 'An error occurred while processing the color command.';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

export default colorCommand;
