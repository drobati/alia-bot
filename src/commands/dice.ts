import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    EmbedBuilder,
} from "discord.js";
import { Op } from "sequelize";
import { Context } from "../types";

// Default configuration
const DEFAULT_MAX_DICE = 100;
const DEFAULT_SHOW_INDIVIDUAL_THRESHOLD = 10;

// Dice notation regex: XdY[+/-Z][modifiers]
// Modifiers: ! (exploding), k/d (keep/drop), r (reroll), </> (success/failure)
const DICE_NOTATION_REGEX = /^(\d+)d(\d+|F)([+-]\d+)?(\S*)$/i;

interface RollModifiers {
    explode: boolean;
    keepHigh?: number;
    keepLow?: number;
    dropHigh?: number;
    dropLow?: number;
    // eslint-disable-next-line no-unused-vars
    rerollFunc: (value: number, checkBoundary?: boolean) => boolean;
    rerollOnce: boolean;
    // eslint-disable-next-line no-unused-vars
    successFunc?: (value: number) => boolean;
}

interface RollResult {
    rolls: number[];
    total: number | string;
    modifier: number;
    modifiedTotal: number | string;
    notation: string;
    isFudge: boolean;
    successCount?: number;
}

// Parse modifier string from dice notation
function parseModifiers(data: string | undefined): RollModifiers {
    const result: RollModifiers = {
        explode: false,
        rerollFunc: () => false,
        rerollOnce: false,
    };

    if (!data) {
        return result;
    }

    let remaining = data;

    while (remaining.length > 0) {
        switch (remaining[0]) {
            case '!': {
                result.explode = true;
                remaining = remaining.slice(1);
                break;
            }
            case 'd': {
                const match = remaining.match(/^d([lh])?(\d+)/);
                if (match) {
                    const count = parseInt(match[2], 10);
                    if (match[1] === 'h') {
                        result.dropHigh = count;
                    } else {
                        result.dropLow = count;
                    }
                    remaining = remaining.slice(match[0].length);
                } else {
                    remaining = remaining.slice(1);
                }
                break;
            }
            case 'k': {
                const match = remaining.match(/^k([lh])?(\d+)/);
                if (match) {
                    const count = parseInt(match[2], 10);
                    if (match[1] === 'l') {
                        result.keepLow = count;
                    } else {
                        result.keepHigh = count;
                    }
                    remaining = remaining.slice(match[0].length);
                } else {
                    remaining = remaining.slice(1);
                }
                break;
            }
            case 'r': {
                const match = remaining.match(/^r(o)?(<|>)(\d+)/);
                if (match) {
                    const rerollValue = parseInt(match[3], 10);
                    result.rerollOnce = match[1] === 'o';
                    if (match[2] === '<') {
                        result.rerollFunc = (x: number) => x <= rerollValue;
                    } else {
                        result.rerollFunc = (x: number) => x >= rerollValue;
                    }
                    remaining = remaining.slice(match[0].length);
                } else {
                    remaining = remaining.slice(1);
                }
                break;
            }
            case '>':
            case '<': {
                const match = remaining.match(/^(<|>)(\d+)/);
                if (match) {
                    const threshold = parseInt(match[2], 10);
                    if (match[1] === '>') {
                        result.successFunc = (x: number) => x >= threshold;
                    } else {
                        result.successFunc = (x: number) => x <= threshold;
                    }
                    remaining = remaining.slice(match[0].length);
                } else {
                    remaining = remaining.slice(1);
                }
                break;
            }
            default:
                remaining = remaining.slice(1);
        }
    }

    return result;
}

// Roll a single die
function rollOne(sides: number, modifiers: RollModifiers): number {
    let result = 1 + Math.floor(Math.random() * sides);

    // Skip rerolling if it would cause infinite loop
    if (modifiers.rerollFunc(1, false) && modifiers.rerollFunc(sides, false)) {
        return result;
    }

    while (modifiers.rerollFunc(result)) {
        result = 1 + Math.floor(Math.random() * sides);
        if (modifiers.rerollOnce) {
            break;
        }
    }

    return result;
}

// Handle exploding dice
function explode(results: number[], sides: number, modifiers: RollModifiers): number[] {
    if (results.length === 0) {
        return [];
    }

    const newResults: number[] = [];
    for (const result of results) {
        if (result === sides) {
            newResults.push(rollOne(sides, modifiers));
        }
    }

    return results.concat(explode(newResults, sides, modifiers));
}

// Roll multiple dice
function roll(diceCount: number, sides: number, modifiers: RollModifiers): number[] {
    let results = Array.from({ length: diceCount }, () => rollOne(sides, modifiers));

    if (modifiers.explode) {
        results = explode(results, sides, modifiers);
    }

    // Sort for keep/drop operations
    results.sort((a, b) => a - b);

    if (modifiers.dropLow !== undefined) {
        results = results.slice(modifiers.dropLow);
    }
    if (modifiers.dropHigh !== undefined) {
        results = results.slice(0, -modifiers.dropHigh);
    }
    if (modifiers.keepLow !== undefined) {
        results = results.slice(0, modifiers.keepLow);
    }
    if (modifiers.keepHigh !== undefined) {
        results = results.slice(-modifiers.keepHigh);
    }

    return results;
}

// Roll fudge dice (-1, 0, +1)
function rollFudge(count: number): number[] {
    return Array.from({ length: count }, () => Math.floor(Math.random() * 3) - 1);
}

// Format fudge result
function formatFudgeResult(value: number): string {
    if (value > 0) {
        return '+';
    }
    if (value < 0) {
        return '-';
    }
    return '0';
}

// Parse and execute dice notation
function parseDiceNotation(
    notation: string,
    maxDice: number,
): RollResult | string {
    const match = notation.match(DICE_NOTATION_REGEX);

    if (!match) {
        return "Invalid dice notation. Use format like `2d6`, `4d6+2`, `2d20k1`, or `4dF`.";
    }

    const diceCount = parseInt(match[1], 10);
    const sidesStr = match[2];
    const modifierStr = match[3];
    const metaModifiers = match[4];

    if (diceCount > maxDice) {
        return `I'm not going to roll more than ${maxDice} dice for you.`;
    }

    if (diceCount < 1) {
        return "You need to roll at least one die.";
    }

    const modifier = modifierStr ? parseInt(modifierStr, 10) : 0;
    const modifiers = parseModifiers(metaModifiers);

    // Handle fudge dice
    if (sidesStr.toLowerCase() === 'f') {
        const rolls = rollFudge(diceCount);
        const total = rolls.reduce((a, b) => a + b, 0);
        return {
            rolls,
            total,
            modifier,
            modifiedTotal: total + modifier,
            notation,
            isFudge: true,
        };
    }

    const sides = parseInt(sidesStr, 10);

    if (sides < 2) {
        return "You want to roll dice with less than two sides. Wow.";
    }

    const rolls = roll(diceCount, sides, modifiers);

    if (modifiers.successFunc) {
        const successCount = rolls.filter(r => modifiers.successFunc!(r)).length;
        return {
            rolls,
            total: successCount,
            modifier,
            modifiedTotal: successCount + modifier,
            notation,
            isFudge: false,
            successCount,
        };
    }

    const total = rolls.reduce((a, b) => a + b, 0);
    return {
        rolls,
        total,
        modifier,
        modifiedTotal: total + modifier,
        notation,
        isFudge: false,
    };
}

// Format roll result for display
function formatRollResult(result: RollResult, showThreshold: number): string {
    const { rolls, total, modifier, modifiedTotal, isFudge, successCount } = result;

    let rollsDisplay: string;
    if (isFudge) {
        rollsDisplay = rolls.map(formatFudgeResult).join(', ');
    } else if (rolls.length <= showThreshold) {
        if (rolls.length > 2) {
            const last = rolls[rolls.length - 1];
            const rest = rolls.slice(0, -1);
            rollsDisplay = `${rest.join(', ')}, and ${last}`;
        } else if (rolls.length === 2) {
            rollsDisplay = `${rolls[0]} and ${rolls[1]}`;
        } else {
            rollsDisplay = rolls[0]?.toString() || '0';
        }
    } else {
        rollsDisplay = 'a handful of dice';
    }

    let response: string;
    if (successCount !== undefined) {
        const successText = successCount === 1 ? 'success' : 'successes';
        response = rolls.length === 1
            ? `I rolled a ${successCount === 1 ? 'success' : 'failure'}.`
            : `I rolled ${rollsDisplay}, making **${successCount} ${successText}**.`;
    } else if (rolls.length === 1) {
        response = `I rolled a **${total}**.`;
    } else if (rolls.length <= showThreshold) {
        response = `I rolled ${rollsDisplay}, making **${total}**.`;
    } else {
        response = `I rolled ${rollsDisplay}, making **${total}**.`;
    }

    if (modifier !== 0) {
        const op = modifier > 0 ? '+' : '-';
        response += ` With the modifier, ${total} ${op} ${Math.abs(modifier)} = **${modifiedTotal}**.`;
    }

    return response;
}

// Get config value with default
async function getConfigValue(
    context: Context,
    guildId: string,
    key: string,
    defaultValue: number,
): Promise<number> {
    const config = await context.tables.Config.findOne({
        where: { key: `dice_${key}_${guildId}` },
    });
    return config ? parseInt(config.value, 10) : defaultValue;
}

// Handler functions
async function handleRollCommand(
    interaction: ChatInputCommandInteraction,
    context: Context,
) {
    const notation = interaction.options.getString('notation', true);
    const guildId = interaction.guildId || 'dm';

    const maxDice = await getConfigValue(context, guildId, 'max_dice', DEFAULT_MAX_DICE);
    const showThreshold = await getConfigValue(
        context,
        guildId,
        'show_individual',
        DEFAULT_SHOW_INDIVIDUAL_THRESHOLD,
    );

    const result = parseDiceNotation(notation, maxDice);

    if (typeof result === 'string') {
        await interaction.reply({ content: result, ephemeral: true });
        return;
    }

    const response = formatRollResult(result, showThreshold);
    await interaction.reply({ content: response });
}

async function handleCoinCommand(interaction: ChatInputCommandInteraction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const emoji = result === 'Heads' ? '🪙' : '💰';

    await interaction.reply({ content: `${emoji} **${result}!**` });
}

async function handleCustomCreateCommand(
    interaction: ChatInputCommandInteraction,
    context: Context,
) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const sidesInput = interaction.options.getString('sides', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({
            content: "Custom dice can only be created in a server.",
            ephemeral: true,
        });
        return;
    }

    // Parse sides (comma-separated values)
    const sides = sidesInput.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (sides.length < 2) {
        await interaction.reply({
            content: "A die must have at least 2 sides. Separate values with commas.",
            ephemeral: true,
        });
        return;
    }

    if (sides.length > 100) {
        await interaction.reply({
            content: "A die can have at most 100 sides.",
            ephemeral: true,
        });
        return;
    }

    // Check for existing die
    const existing = await context.tables.CustomDice.findOne({
        where: { guild_id: guildId, name },
    });

    if (existing) {
        await interaction.reply({
            content: `A custom die named \`${name}\` already exists. Delete it first or choose a different name.`,
            ephemeral: true,
        });
        return;
    }

    await context.tables.CustomDice.create({
        guild_id: guildId,
        name,
        sides: JSON.stringify(sides),
        creator_id: interaction.user.id,
    });

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`🎲 Custom Die Created: ${name}`)
        .setDescription(`**Sides:** ${sides.join(', ')}`)
        .setFooter({ text: `Created by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    context.log.info('Custom die created', {
        guildId,
        name,
        sidesCount: sides.length,
        creatorId: interaction.user.id,
    });
}

async function handleCustomRollCommand(
    interaction: ChatInputCommandInteraction,
    context: Context,
) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const count = interaction.options.getInteger('count') || 1;
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({
            content: "Custom dice can only be rolled in a server.",
            ephemeral: true,
        });
        return;
    }

    if (count < 1 || count > 100) {
        await interaction.reply({
            content: "You can roll between 1 and 100 dice.",
            ephemeral: true,
        });
        return;
    }

    const die = await context.tables.CustomDice.findOne({
        where: { guild_id: guildId, name },
    });

    if (!die) {
        await interaction.reply({
            content: `No custom die named \`${name}\` found. Use \`/dice custom list\` to see available dice.`,
            ephemeral: true,
        });
        return;
    }

    const sides = JSON.parse(die.sides) as string[];
    const results = Array.from({ length: count }, () =>
        sides[Math.floor(Math.random() * sides.length)],
    );

    let response: string;
    if (count === 1) {
        response = `🎲 Rolling **${name}**: **${results[0]}**`;
    } else if (count <= 10) {
        response = `🎲 Rolling **${name}** ${count} times: ${results.join(', ')}`;
    } else {
        const summary = new Map<string, number>();
        for (const r of results) {
            summary.set(r, (summary.get(r) || 0) + 1);
        }
        const summaryStr = Array.from(summary.entries())
            .map(([val, cnt]) => `${val}: ${cnt}`)
            .join(', ');
        response = `🎲 Rolling **${name}** ${count} times:\n${summaryStr}`;
    }

    await interaction.reply({ content: response });
}

async function handleCustomListCommand(
    interaction: ChatInputCommandInteraction,
    context: Context,
) {
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({
            content: "Custom dice can only be viewed in a server.",
            ephemeral: true,
        });
        return;
    }

    const dice = await context.tables.CustomDice.findAll({
        where: { guild_id: guildId },
        order: [['name', 'ASC']],
    });

    if (dice.length === 0) {
        await interaction.reply({
            content: "No custom dice have been created in this server yet. "
                + "Use `/dice custom create` to make one!",
            ephemeral: true,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎲 Custom Dice')
        .setDescription(dice.map((d: any) => {
            const sides = JSON.parse(d.sides) as string[];
            const sidesPreview = sides.length <= 6
                ? sides.join(', ')
                : `${sides.slice(0, 5).join(', ')}... (${sides.length} sides)`;
            return `**${d.name}**: ${sidesPreview}`;
        }).join('\n'))
        .setFooter({ text: `${dice.length} custom dice in this server` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleCustomDeleteCommand(
    interaction: ChatInputCommandInteraction,
    context: Context,
) {
    const name = interaction.options.getString('name', true).toLowerCase();
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({
            content: "Custom dice can only be deleted in a server.",
            ephemeral: true,
        });
        return;
    }

    const die = await context.tables.CustomDice.findOne({
        where: { guild_id: guildId, name },
    });

    if (!die) {
        await interaction.reply({
            content: `No custom die named \`${name}\` found.`,
            ephemeral: true,
        });
        return;
    }

    await die.destroy();

    await interaction.reply({
        content: `🗑️ Custom die \`${name}\` has been deleted.`,
        ephemeral: true,
    });

    context.log.info('Custom die deleted', {
        guildId,
        name,
        deletedBy: interaction.user.id,
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll dice with various notations and custom options')
        .addSubcommand(subcommand =>
            subcommand
                .setName('roll')
                .setDescription('Roll dice using standard notation (e.g., 2d6+3, 4d6k3, 2d20!)')
                .addStringOption(option =>
                    option.setName('notation')
                        .setDescription('Dice notation: XdY, XdY+Z, XdF, with modifiers !, k, d, r, <, >')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('coin')
                .setDescription('Flip a coin (heads or tails)'))
        .addSubcommandGroup(group =>
            group
                .setName('custom')
                .setDescription('Manage custom dice with named sides')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a custom die with named sides')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name for this die (e.g., "direction", "mood")')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('sides')
                                .setDescription('Comma-separated sides (e.g., "North, South, East, West")')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('roll')
                        .setDescription('Roll a custom die')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the custom die to roll')
                                .setRequired(true)
                                .setAutocomplete(true))
                        .addIntegerOption(option =>
                            option.setName('count')
                                .setDescription('Number of times to roll (default: 1)')
                                .setMinValue(1)
                                .setMaxValue(100)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all custom dice in this server'))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('delete')
                        .setDescription('Delete a custom die')
                        .addStringOption(option =>
                            option.setName('name')
                                .setDescription('Name of the custom die to delete')
                                .setRequired(true)
                                .setAutocomplete(true)))),

    async autocomplete(interaction: AutocompleteInteraction, context: Context) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.respond([]);
            return;
        }

        const focusedValue = interaction.options.getFocused().toLowerCase();

        const dice = await context.tables.CustomDice.findAll({
            where: {
                guild_id: guildId,
                name: { [Op.like]: `%${focusedValue}%` },
            },
            limit: 25,
        });

        const choices = dice.map((d: any) => ({
            name: d.name,
            value: d.name,
        }));

        await interaction.respond(choices);
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommandGroup === 'custom') {
                switch (subcommand) {
                    case 'create':
                        await handleCustomCreateCommand(interaction, context);
                        break;
                    case 'roll':
                        await handleCustomRollCommand(interaction, context);
                        break;
                    case 'list':
                        await handleCustomListCommand(interaction, context);
                        break;
                    case 'delete':
                        await handleCustomDeleteCommand(interaction, context);
                        break;
                }
            } else {
                switch (subcommand) {
                    case 'roll':
                        await handleRollCommand(interaction, context);
                        break;
                    case 'coin':
                        await handleCoinCommand(interaction);
                        break;
                }
            }
        } catch (error) {
            context.log.error('Error executing dice command', {
                error,
                subcommandGroup,
                subcommand,
                userId: interaction.user.id,
            });

            const message = 'An error occurred while rolling dice.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: message, ephemeral: true });
            } else {
                await interaction.reply({ content: message, ephemeral: true });
            }
        }
    },
};
