import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import metaforge, { ArcItem, RARITY_COLORS } from '../lib/apis/metaforge';
import { Context } from '../types';

// Helper to create item embed
function createItemEmbed(item: ArcItem): EmbedBuilder {
    const color = RARITY_COLORS[item.rarity] || 0x808080;
    const stats = metaforge.formatItemStats(item);

    const embed = new EmbedBuilder()
        .setTitle(`${item.name}`)
        .setColor(color)
        .setDescription(item.description || 'No description available')
        .addFields([
            { name: 'Type', value: item.item_type || 'Unknown', inline: true },
            { name: 'Rarity', value: item.rarity || 'Unknown', inline: true },
            { name: 'Value', value: item.value?.toString() || 'N/A', inline: true },
        ]);

    if (item.weight) {
        embed.addFields([{ name: 'Weight', value: item.weight.toString(), inline: true }]);
    }

    if (item.loot_area) {
        embed.addFields([{ name: 'Found In', value: item.loot_area, inline: true }]);
    }

    if (item.workbench) {
        embed.addFields([{ name: 'Workbench', value: item.workbench, inline: true }]);
    }

    if (stats.length > 0) {
        embed.addFields([{ name: 'Stats', value: stats.join('\n'), inline: false }]);
    }

    if (item.icon) {
        embed.setThumbnail(item.icon);
    }

    embed.setFooter({ text: 'Data from metaforge.app/arc-raiders' });

    return embed;
}

// Subcommand handlers
async function handleItem(interaction: any, context: Context) {
    const itemName = interaction.options.getString('name', true);

    await interaction.deferReply();

    try {
        const item = await metaforge.getItemByName(itemName);

        if (!item) {
            await interaction.editReply({
                content: `Item "${itemName}" not found. Try using autocomplete for suggestions.`,
            });
            return;
        }

        const embed = createItemEmbed(item);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ err: error, itemName, category: 'arc' }, 'Error fetching item');
        await interaction.editReply({
            content: 'An error occurred while fetching item data. Please try again later.',
        });
    }
}

async function handleNeed(interaction: any, context: Context) {
    const itemName = interaction.options.getString('item', true);
    const notes = interaction.options.getString('notes');
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const username = interaction.user.username;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Validate item exists in API
        const item = await metaforge.getItemByName(itemName);
        const actualItemName = item?.name || itemName;
        const itemId = item?.id || null;

        // Check if item already in wishlist
        const existing = await context.tables.ArcWishlist.findOne({
            where: {
                guild_id: guildId,
                user_id: userId,
                item_name: actualItemName,
            },
        });

        if (existing) {
            if (existing.status === 'needed') {
                await interaction.editReply({
                    content: `**${actualItemName}** is already on your wishlist.`,
                });
                return;
            }

            // Re-add previously found item
            await existing.update({
                status: 'needed',
                notes: notes || existing.notes,
                found_at: undefined,
            });

            await interaction.editReply({
                content: `**${actualItemName}** has been re-added to your wishlist.`,
            });
            return;
        }

        // Create new wishlist entry
        await context.tables.ArcWishlist.create({
            guild_id: guildId,
            user_id: userId,
            username: username,
            item_name: actualItemName,
            item_id: itemId || undefined,
            status: 'needed',
            notes: notes || undefined,
        });

        context.log.info({
            userId,
            guildId,
            itemName: actualItemName,
            category: 'arc',
        }, 'Item added to wishlist');

        await interaction.editReply({
            content: `**${actualItemName}** has been added to your wishlist!`,
        });
    } catch (error) {
        context.log.error({ err: error, itemName, category: 'arc' }, 'Error adding item to wishlist');
        await interaction.editReply({
            content: 'An error occurred while adding the item. Please try again later.',
        });
    }
}

async function handleWanted(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;
    const page = interaction.options.getInteger('page') || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        const { count, rows: items } = await context.tables.ArcWishlist.findAndCountAll({
            where: {
                guild_id: guildId,
                status: 'needed',
            },
            limit,
            offset,
            order: [['item_name', 'ASC']],
        });

        if (items.length === 0) {
            await interaction.reply({
                content: 'No items are currently wanted in this server. Use `/arc need` to add items!',
            });
            return;
        }

        const totalPages = Math.ceil(count / limit);

        // Group items by user
        const itemsByUser: Record<string, string[]> = {};
        for (const item of items) {
            const key = item.username || `<@${item.user_id}>`;
            if (!itemsByUser[key]) {
                itemsByUser[key] = [];
            }
            itemsByUser[key].push(item.item_name);
        }

        let description = '';
        for (const [user, userItems] of Object.entries(itemsByUser)) {
            description += `**${user}:** ${userItems.join(', ')}\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle('Wanted Items - ARC Raiders')
            .setColor(0xff6b35)
            .setDescription(description)
            .setFooter({
                text: `Page ${page}/${totalPages} | ${count} total items | Data from metaforge.app/arc-raiders`,
            });

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ err: error, guildId, category: 'arc' }, 'Error fetching wanted items');
        await interaction.reply({
            content: 'An error occurred while fetching wanted items.',
            ephemeral: true,
        });
    }
}

async function handleFound(interaction: any, context: Context) {
    const itemName = interaction.options.getString('item', true);
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        const existing = await context.tables.ArcWishlist.findOne({
            where: {
                guild_id: guildId,
                user_id: userId,
                item_name: itemName,
            },
        });

        if (!existing) {
            await interaction.reply({
                content: `**${itemName}** is not on your wishlist.`,
                ephemeral: true,
            });
            return;
        }

        if (existing.status === 'found') {
            await interaction.reply({
                content: `**${itemName}** is already marked as found.`,
                ephemeral: true,
            });
            return;
        }

        await existing.update({
            status: 'found',
            found_at: new Date(),
        });

        context.log.info({
            userId,
            guildId,
            itemName,
            category: 'arc',
        }, 'Item marked as found');

        await interaction.reply({
            content: `Congratulations! **${itemName}** has been marked as found!`,
        });
    } catch (error) {
        context.log.error({ err: error, itemName, category: 'arc' }, 'Error marking item as found');
        await interaction.reply({
            content: 'An error occurred. Please try again later.',
            ephemeral: true,
        });
    }
}

async function handleMyWishlist(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const showFound = interaction.options.getBoolean('show_found') ?? false;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        const whereClause: any = {
            guild_id: guildId,
            user_id: userId,
        };

        if (!showFound) {
            whereClause.status = 'needed';
        }

        const items = await context.tables.ArcWishlist.findAll({
            where: whereClause,
            order: [['status', 'ASC'], ['item_name', 'ASC']],
        });

        if (items.length === 0) {
            await interaction.reply({
                content: showFound
                    ? 'Your wishlist is empty. Use `/arc need` to add items!'
                    : 'You have no items needed. Use `/arc need` to add items or `/arc mywishlist show_found:true` to see found items.',
                ephemeral: true,
            });
            return;
        }

        const neededItems = items.filter((i: any) => i.status === 'needed');
        const foundItems = items.filter((i: any) => i.status === 'found');

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s ARC Raiders Wishlist`)
            .setColor(0xff6b35);

        if (neededItems.length > 0) {
            const neededList = neededItems
                .map((i: any) => {
                    const notes = i.notes ? ` _(${i.notes})_` : '';
                    return `- ${i.item_name}${notes}`;
                })
                .join('\n');
            embed.addFields([{
                name: `Needed (${neededItems.length})`,
                value: neededList.substring(0, 1024),
                inline: false,
            }]);
        }

        if (showFound && foundItems.length > 0) {
            const foundList = foundItems
                .map((i: any) => `~~${i.item_name}~~`)
                .join('\n');
            embed.addFields([{
                name: `Found (${foundItems.length})`,
                value: foundList.substring(0, 1024),
                inline: false,
            }]);
        }

        embed.setFooter({ text: 'Data from metaforge.app/arc-raiders' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        context.log.error({ err: error, userId, category: 'arc' }, 'Error fetching wishlist');
        await interaction.reply({
            content: 'An error occurred while fetching your wishlist.',
            ephemeral: true,
        });
    }
}

// Main command export
export default {
    data: new SlashCommandBuilder()
        .setName('arc')
        .setDescription('ARC Raiders item lookup and wishlist management')
        .addSubcommand(subcommand => subcommand
            .setName('item')
            .setDescription('Look up item details from MetaForge')
            .addStringOption(option => option
                .setName('name')
                .setDescription('Item name to look up')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand
            .setName('need')
            .setDescription('Add an item to your wishlist')
            .addStringOption(option => option
                .setName('item')
                .setDescription('Item name to add')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption(option => option
                .setName('notes')
                .setDescription('Optional notes about the item')
                .setRequired(false)))
        .addSubcommand(subcommand => subcommand
            .setName('wanted')
            .setDescription('Show all wanted items across all users in the server')
            .addIntegerOption(option => option
                .setName('page')
                .setDescription('Page number')
                .setRequired(false)
                .setMinValue(1)))
        .addSubcommand(subcommand => subcommand
            .setName('found')
            .setDescription('Mark an item as found/complete')
            .addStringOption(option => option
                .setName('item')
                .setDescription('Item to mark as found')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand(subcommand => subcommand
            .setName('mywishlist')
            .setDescription('Show your personal wishlist')
            .addBooleanOption(option => option
                .setName('show_found')
                .setDescription('Include found items in the list')
                .setRequired(false))),

    async execute(interaction: any, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'item':
                await handleItem(interaction, context);
                break;
            case 'need':
                await handleNeed(interaction, context);
                break;
            case 'wanted':
                await handleWanted(interaction, context);
                break;
            case 'found':
                await handleFound(interaction, context);
                break;
            case 'mywishlist':
                await handleMyWishlist(interaction, context);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
        }
    },

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();

        if (focusedOption.name === 'name' || focusedOption.name === 'item') {
            const searchValue = focusedOption.value;

            // For 'found' subcommand, search user's wishlist
            if (subcommand === 'found') {
                const guildId = interaction.guild?.id;
                const userId = interaction.user.id;

                if (guildId) {
                    try {
                        const items = await context.tables.ArcWishlist.findAll({
                            where: {
                                guild_id: guildId,
                                user_id: userId,
                                status: 'needed',
                            },
                            order: [['item_name', 'ASC']],
                        });

                        const filtered = items
                            .map((i: any) => i.item_name)
                            .filter((name: string) =>
                                name.toLowerCase().includes(searchValue.toLowerCase()),
                            )
                            .slice(0, 25);

                        await interaction.respond(
                            filtered.map((name: string) => ({
                                name,
                                value: name,
                            })),
                        );
                        return;
                    } catch {
                        await interaction.respond([]);
                        return;
                    }
                }
            }

            // For other subcommands, search MetaForge API
            try {
                if (searchValue.length < 2) {
                    await interaction.respond([]);
                    return;
                }

                const items = await metaforge.searchItems(searchValue, 25);

                await interaction.respond(
                    items.map(item => ({
                        name: `${item.name} (${item.rarity})`,
                        value: item.name,
                    })),
                );
            } catch {
                await interaction.respond([]);
            }
        }
    },
};
