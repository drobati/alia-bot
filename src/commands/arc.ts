import {
    EmbedBuilder,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import metaforge, {
    ArcItem,
    RARITY_COLORS,
    ARC_EVENT_TYPES,
    ARC_MAPS,
} from '../lib/apis/metaforge';
import { Context } from '../types';
import {
    parseEventTypes,
    parseMaps,
    parseWarnMinutes,
} from '../models/arcEventSubscription';

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

    if (item.flavor_text) {
        embed.addFields([{ name: 'Used In', value: item.flavor_text, inline: false }]);
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
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const itemName = interaction.options.getString('item', true);
    const notes = interaction.options.getString('notes');
    const userId = interaction.user.id;
    const username = interaction.user.username;

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
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const itemName = interaction.options.getString('item', true);
    const userId = interaction.user.id;

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

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.user.id;
    const showFound = interaction.options.getBoolean('show_found') ?? false;

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
            const emptyMsg = showFound
                ? 'Your wishlist is empty. Use `/arc need` to add items!'
                : 'You have no items needed. Use `/arc need` to add items ' +
                  'or `/arc mywishlist show_found:true` to see found items.';
            await interaction.reply({ content: emptyMsg, ephemeral: true });
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

// ============================================================
// Event Timer Handlers
// ============================================================

async function handleEventsSubscribe(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const eventType = interaction.options.getString('event');
    const map = interaction.options.getString('map');
    const warnAtInput = interaction.options.getString('warn_at') || '15';
    const notifyDm = interaction.options.getBoolean('dm') ?? false;
    const notifyChannel = interaction.options.getBoolean('channel') ?? true;

    // Parse warning minutes
    const warnMinutes = warnAtInput
        .split(',')
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => !isNaN(n) && n > 0 && n <= 1440); // Max 24 hours

    if (warnMinutes.length === 0) {
        await interaction.reply({
            content: 'Invalid warning time format. Use comma-separated minutes (e.g., "15,30,60").',
            ephemeral: true,
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Check if user already has a subscription
        const existing = await context.tables.ArcEventSubscription.findOne({
            where: {
                guild_id: guildId,
                user_id: userId,
            },
        });

        const eventTypes = eventType ? JSON.stringify([eventType]) : null;
        const maps = map ? JSON.stringify([map]) : null;
        const warnMinutesJson = JSON.stringify(warnMinutes);

        if (existing) {
            // Update existing subscription
            await existing.update({
                event_types: eventTypes,
                maps: maps,
                warn_minutes: warnMinutesJson,
                notify_dm: notifyDm,
                notify_channel: notifyChannel,
                active: true,
            });

            context.log.info({
                userId,
                guildId,
                eventType,
                map,
                warnMinutes,
                category: 'arc',
            }, 'Updated ARC event subscription');
        } else {
            // Create new subscription
            await context.tables.ArcEventSubscription.create({
                guild_id: guildId,
                user_id: userId,
                username: username,
                event_types: eventTypes,
                maps: maps,
                warn_minutes: warnMinutesJson,
                notify_dm: notifyDm,
                notify_channel: notifyChannel,
                active: true,
            });

            context.log.info({
                userId,
                guildId,
                eventType,
                map,
                warnMinutes,
                category: 'arc',
            }, 'Created ARC event subscription');
        }

        // Build confirmation embed
        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Event Subscription ' + (existing ? 'Updated' : 'Created'))
            .setDescription('You will receive notifications for ARC Raiders events.')
            .addFields([
                {
                    name: 'Events',
                    value: eventType || 'All events',
                    inline: true,
                },
                {
                    name: 'Maps',
                    value: map || 'All maps',
                    inline: true,
                },
                {
                    name: 'Warn Before',
                    value: warnMinutes.map((m: number) => `${m} min`).join(', '),
                    inline: true,
                },
                {
                    name: 'Channel',
                    value: notifyChannel ? 'Yes' : 'No',
                    inline: true,
                },
                {
                    name: 'DM',
                    value: notifyDm ? 'Yes' : 'No',
                    inline: true,
                },
            ])
            .setFooter({ text: 'Use /arc events unsubscribe to remove this subscription' });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ err: error, userId, guildId, category: 'arc' },
            'Error creating event subscription');
        await interaction.editReply({
            content: 'An error occurred while creating your subscription. Please try again.',
        });
    }
}

async function handleEventsUnsubscribe(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.user.id;

    try {
        const deleted = await context.tables.ArcEventSubscription.destroy({
            where: {
                guild_id: guildId,
                user_id: userId,
            },
        });

        if (deleted > 0) {
            await interaction.reply({
                content: 'Your event subscription has been removed.',
                ephemeral: true,
            });

            context.log.info({
                userId,
                guildId,
                category: 'arc',
            }, 'Removed ARC event subscription');
        } else {
            await interaction.reply({
                content: 'You do not have an active event subscription.',
                ephemeral: true,
            });
        }
    } catch (error) {
        context.log.error({ err: error, userId, guildId, category: 'arc' },
            'Error removing event subscription');
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleEventsList(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const userId = interaction.user.id;

    try {
        const subscription = await context.tables.ArcEventSubscription.findOne({
            where: {
                guild_id: guildId,
                user_id: userId,
            },
        });

        if (!subscription) {
            await interaction.reply({
                content: 'You do not have an event subscription. ' +
                    'Use `/arc events subscribe` to create one.',
                ephemeral: true,
            });
            return;
        }

        const eventTypes = parseEventTypes(subscription.event_types);
        const maps = parseMaps(subscription.maps);
        const warnMinutes = parseWarnMinutes(subscription.warn_minutes);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('Your ARC Event Subscription')
            .addFields([
                {
                    name: 'Status',
                    value: subscription.active ? 'Active' : 'Paused',
                    inline: true,
                },
                {
                    name: 'Events',
                    value: eventTypes ? eventTypes.join(', ') : 'All events',
                    inline: true,
                },
                {
                    name: 'Maps',
                    value: maps ? maps.join(', ') : 'All maps',
                    inline: true,
                },
                {
                    name: 'Warn Before',
                    value: warnMinutes.map(m => `${m} min`).join(', '),
                    inline: true,
                },
                {
                    name: 'Channel Notifications',
                    value: subscription.notify_channel ? 'Enabled' : 'Disabled',
                    inline: true,
                },
                {
                    name: 'DM Notifications',
                    value: subscription.notify_dm ? 'Enabled' : 'Disabled',
                    inline: true,
                },
            ])
            .setFooter({ text: 'Use /arc events subscribe to update settings' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        context.log.error({ err: error, userId, guildId, category: 'arc' },
            'Error fetching event subscription');
        await interaction.reply({
            content: 'An error occurred. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleEventsUpcoming(interaction: any, context: Context) {
    const hours = interaction.options.getInteger('hours') || 2;
    const filterMap = interaction.options.getString('map');
    const filterEvent = interaction.options.getString('event');

    await interaction.deferReply();

    try {
        const eventsGrouped = await metaforge.getEventsGroupedByMap(hours);

        if (eventsGrouped.size === 0) {
            await interaction.editReply({
                content: `No events found in the next ${hours} hour(s).`,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xff6b35)
            .setTitle(`Upcoming Events (Next ${hours} Hour${hours > 1 ? 's' : ''})`)
            .setFooter({ text: 'Use /arc events subscribe to get notifications' });

        for (const [map, events] of eventsGrouped) {
            // Apply map filter
            if (filterMap && map.toLowerCase() !== filterMap.toLowerCase()) {
                continue;
            }

            // Filter events and format
            const filteredEvents = events.filter(e => {
                if (filterEvent && e.name.toLowerCase() !== filterEvent.toLowerCase()) {
                    return false;
                }
                return true;
            });

            if (filteredEvents.length === 0) { continue; }

            const eventList = filteredEvents
                .slice(0, 5) // Limit per map
                .map(e => {
                    const timestamp = Math.floor(e.startTime / 1000);
                    const now = Date.now();
                    const status = e.startTime <= now ? '(Active)' : '';
                    return `- **${e.name}** ${status} <t:${timestamp}:R>`;
                })
                .join('\n');

            embed.addFields([{
                name: map,
                value: eventList || 'No events',
                inline: false,
            }]);
        }

        // Check if any fields were added
        if (embed.data.fields?.length === 0) {
            await interaction.editReply({
                content: 'No events match your filters.',
            });
            return;
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ err: error, category: 'arc' }, 'Error fetching upcoming events');
        await interaction.editReply({
            content: 'An error occurred while fetching events. The API may be temporarily unavailable.',
        });
    }
}

async function handleEventsConfig(interaction: any, context: Context) {
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    // Check admin permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({
            content: 'You need the "Manage Server" permission to configure event settings.',
            ephemeral: true,
        });
        return;
    }

    const channel = interaction.options.getChannel('channel');
    const allowChannel = interaction.options.getBoolean('allow_channel');
    const allowDm = interaction.options.getBoolean('allow_dm');

    // If no options provided, show current config
    if (channel === null && allowChannel === null && allowDm === null) {
        try {
            const config = await context.tables.ArcEventConfig.findOne({
                where: { guild_id: guildId },
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('ARC Event Configuration')
                .addFields([
                    {
                        name: 'Announcement Channel',
                        value: config?.announcement_channel_id
                            ? `<#${config.announcement_channel_id}>`
                            : 'Not set',
                        inline: true,
                    },
                    {
                        name: 'Channel Announcements',
                        value: config?.allow_channel_announcements !== false ? 'Allowed' : 'Disabled',
                        inline: true,
                    },
                    {
                        name: 'DM Notifications',
                        value: config?.allow_dm_notifications !== false ? 'Allowed' : 'Disabled',
                        inline: true,
                    },
                ])
                .setFooter({ text: 'Use options to update configuration' });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        } catch (error) {
            context.log.error({ err: error, guildId, category: 'arc' },
                'Error fetching event config');
            await interaction.reply({
                content: 'An error occurred. Please try again.',
                ephemeral: true,
            });
            return;
        }
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Get or create config
        let config = await context.tables.ArcEventConfig.findOne({
            where: { guild_id: guildId },
        });

        const updates: any = {};

        if (channel !== null) {
            updates.announcement_channel_id = channel.id;
        }
        if (allowChannel !== null) {
            updates.allow_channel_announcements = allowChannel;
        }
        if (allowDm !== null) {
            updates.allow_dm_notifications = allowDm;
        }

        if (config) {
            await config.update(updates);
        } else {
            config = await context.tables.ArcEventConfig.create({
                guild_id: guildId,
                announcement_channel_id: channel?.id || null,
                allow_channel_announcements: allowChannel ?? true,
                allow_dm_notifications: allowDm ?? true,
            });
        }

        context.log.info({
            guildId,
            updates,
            category: 'arc',
        }, 'Updated ARC event config');

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Configuration Updated')
            .addFields([
                {
                    name: 'Announcement Channel',
                    value: config.announcement_channel_id
                        ? `<#${config.announcement_channel_id}>`
                        : 'Not set',
                    inline: true,
                },
                {
                    name: 'Channel Announcements',
                    value: config.allow_channel_announcements ? 'Allowed' : 'Disabled',
                    inline: true,
                },
                {
                    name: 'DM Notifications',
                    value: config.allow_dm_notifications ? 'Allowed' : 'Disabled',
                    inline: true,
                },
            ]);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ err: error, guildId, category: 'arc' },
            'Error updating event config');
        await interaction.editReply({
            content: 'An error occurred. Please try again.',
        });
    }
}

// Main command export
export default {
    data: new SlashCommandBuilder()
        .setName('arc')
        .setDescription('ARC Raiders item lookup, wishlist, and event tracking')
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
                .setRequired(false)))
        // Event timer subcommands
        .addSubcommandGroup(group => group
            .setName('events')
            .setDescription('ARC Raiders event timer and notifications')
            .addSubcommand(subcommand => subcommand
                .setName('subscribe')
                .setDescription('Subscribe to event notifications')
                .addStringOption(option => option
                    .setName('event')
                    .setDescription('Filter to specific event type (leave empty for all)')
                    .setRequired(false)
                    .setAutocomplete(true))
                .addStringOption(option => option
                    .setName('map')
                    .setDescription('Filter to specific map (leave empty for all)')
                    .setRequired(false)
                    .setAutocomplete(true))
                .addStringOption(option => option
                    .setName('warn_at')
                    .setDescription('Minutes before event to warn (comma-separated, e.g., "15,30,60")')
                    .setRequired(false))
                .addBooleanOption(option => option
                    .setName('dm')
                    .setDescription('Send DM notifications')
                    .setRequired(false))
                .addBooleanOption(option => option
                    .setName('channel')
                    .setDescription('Send channel notifications (default: true)')
                    .setRequired(false)))
            .addSubcommand(subcommand => subcommand
                .setName('unsubscribe')
                .setDescription('Remove your event subscription'))
            .addSubcommand(subcommand => subcommand
                .setName('list')
                .setDescription('Show your event subscription settings'))
            .addSubcommand(subcommand => subcommand
                .setName('upcoming')
                .setDescription('Show upcoming events')
                .addIntegerOption(option => option
                    .setName('hours')
                    .setDescription('Hours ahead to show (default: 2, max: 24)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(24))
                .addStringOption(option => option
                    .setName('map')
                    .setDescription('Filter to specific map')
                    .setRequired(false)
                    .setAutocomplete(true))
                .addStringOption(option => option
                    .setName('event')
                    .setDescription('Filter to specific event type')
                    .setRequired(false)
                    .setAutocomplete(true)))
            .addSubcommand(subcommand => subcommand
                .setName('config')
                .setDescription('Configure event notification settings (Admin only)')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Set the announcement channel')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false))
                .addBooleanOption(option => option
                    .setName('allow_channel')
                    .setDescription('Allow channel announcements')
                    .setRequired(false))
                .addBooleanOption(option => option
                    .setName('allow_dm')
                    .setDescription('Allow DM notifications')
                    .setRequired(false)))),

    async execute(interaction: any, context: Context) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();

        // Handle events subcommand group
        if (subcommandGroup === 'events') {
            switch (subcommand) {
                case 'subscribe':
                    await handleEventsSubscribe(interaction, context);
                    break;
                case 'unsubscribe':
                    await handleEventsUnsubscribe(interaction, context);
                    break;
                case 'list':
                    await handleEventsList(interaction, context);
                    break;
                case 'upcoming':
                    await handleEventsUpcoming(interaction, context);
                    break;
                case 'config':
                    await handleEventsConfig(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: 'Unknown events subcommand.',
                        ephemeral: true,
                    });
            }
            return;
        }

        // Handle regular subcommands
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
        const searchValue = focusedOption.value.toLowerCase();

        // Handle event type autocomplete
        if (focusedOption.name === 'event') {
            const filtered = ARC_EVENT_TYPES
                .filter(event => event.toLowerCase().includes(searchValue))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(event => ({ name: event, value: event })),
            );
            return;
        }

        // Handle map autocomplete
        if (focusedOption.name === 'map') {
            const filtered = ARC_MAPS
                .filter(map => map.toLowerCase().includes(searchValue))
                .slice(0, 25);

            await interaction.respond(
                filtered.map(map => ({ name: map, value: map })),
            );
            return;
        }

        // Handle item name autocomplete
        if (focusedOption.name === 'name' || focusedOption.name === 'item') {
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
                                name.toLowerCase().includes(searchValue),
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
                if (focusedOption.value.length < 2) {
                    await interaction.respond([]);
                    return;
                }

                const items = await metaforge.searchItems(focusedOption.value, 25);

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
