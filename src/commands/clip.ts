import {
    SlashCommandBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    CommandInteraction,
    MessageContextMenuCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const CLIPS_PER_PAGE = 10;
const EMBED_COLOR = 0xFFD700; // Gold

// Context menu command: right-click → Apps → "Save Clip"
export const contextMenu = {
    data: new ContextMenuCommandBuilder()
        .setName('Save Clip')
        .setType(ApplicationCommandType.Message),

    async execute(interaction: MessageContextMenuCommandInteraction, context: Context) {
        const message = interaction.targetMessage;

        if (!message.content || message.content.trim().length === 0) {
            await interaction.reply({ content: "Can't clip messages without text content.", ephemeral: true });
            return;
        }

        if (!interaction.guildId) {
            await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
            return;
        }

        try {
            const [clip, created] = await context.tables.Clip.findOrCreate({
                where: { guild_id: interaction.guildId, message_id: message.id },
                defaults: {
                    guild_id: interaction.guildId,
                    channel_id: message.channelId,
                    message_id: message.id,
                    message_content: message.content,
                    message_author_id: message.author.id,
                    message_author_username: message.author.displayName || message.author.username,
                    clipped_by_id: interaction.user.id,
                    clipped_by_username: interaction.user.displayName || interaction.user.username,
                    message_timestamp: message.createdAt,
                },
            });

            if (!created) {
                await interaction.reply({ content: 'This message is already clipped!', ephemeral: true });
                return;
            }

            const preview = message.content.length > 100
                ? message.content.substring(0, 100) + '...'
                : message.content;

            await interaction.reply({
                content: `Clipped! 📎\n> ${preview}`,
                ephemeral: true,
            });

            context.log.info({
                category: 'clip',
                clipId: clip.id,
                guildId: interaction.guildId,
                clippedBy: interaction.user.id,
            }, 'Message clipped');
        } catch (error) {
            context.log.error({ error, category: 'clip' }, 'Failed to save clip');
            await interaction.reply({ content: 'Failed to save clip. Try again later.', ephemeral: true });
        }
    },
};

// Slash command: /clip random | list | delete
export default {
    data: new SlashCommandBuilder()
        .setName('clip')
        .setDescription('Browse saved clips from this server')
        .addSubcommand(sub =>
            sub.setName('random')
                .setDescription('Show a random clip'),
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List saved clips')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('Filter clips by who said it')
                        .setRequired(false),
                )
                .addIntegerOption(opt =>
                    opt.setName('page')
                        .setDescription('Page number')
                        .setMinValue(1)
                        .setRequired(false),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a clip')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('Clip ID to delete')
                        .setRequired(true),
                ),
        ),

    async execute(interaction: CommandInteraction, context: Context) {
        if (!interaction.isChatInputCommand()) {return;}

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'random':
                await handleRandom(interaction, context);
                break;
            case 'list':
                await handleList(interaction, context);
                break;
            case 'delete':
                await handleDelete(interaction, context);
                break;
        }
    },
};

function buildClipEmbed(clip: any): EmbedBuilder {
    const messageUrl = `https://discord.com/channels/` +
        `${clip.guild_id}/${clip.channel_id}/${clip.message_id}`;

    const description = `"${clip.message_content}"\n\n` +
        `— <@${clip.message_author_id}> in <#${clip.channel_id}>\n` +
        `[Jump to message](${messageUrl})`;

    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`📎 Clip #${clip.id}`)
        .setDescription(description)
        .setTimestamp(new Date(clip.message_timestamp))
        .setFooter({ text: `Clipped by ${clip.clipped_by_username}` });
}

async function handleRandom(interaction: CommandInteraction, context: Context) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const count = await context.tables.Clip.count({ where: { guild_id: interaction.guildId } });

    if (count === 0) {
        await interaction.reply({
            content: 'No clips saved yet! Right-click a message → Apps → Save Clip to get started.',
            ephemeral: true,
        });
        return;
    }

    const randomOffset = Math.floor(Math.random() * count);
    const clips = await context.tables.Clip.findAll({
        where: { guild_id: interaction.guildId },
        limit: 1,
        offset: randomOffset,
    });

    if (clips.length === 0) {
        await interaction.reply({ content: 'No clips found.', ephemeral: true });
        return;
    }

    await interaction.reply({ embeds: [buildClipEmbed(clips[0])] });
}

async function handleList(interaction: CommandInteraction, context: Context) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const user = interaction.options.getUser('user');
    const page = (interaction.options.getInteger('page') || 1) - 1;

    const where: any = { guild_id: interaction.guildId };
    if (user) {
        where.message_author_id = user.id;
    }

    const total = await context.tables.Clip.count({ where });

    if (total === 0) {
        const msg = user
            ? `No clips found for ${user.displayName || user.username}.`
            : 'No clips saved yet! Right-click a message → Apps → Save Clip to get started.';
        await interaction.reply({ content: msg, ephemeral: true });
        return;
    }

    const totalPages = Math.ceil(total / CLIPS_PER_PAGE);
    const safePage = Math.min(page, totalPages - 1);

    const clips = await context.tables.Clip.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: CLIPS_PER_PAGE,
        offset: safePage * CLIPS_PER_PAGE,
    });

    const lines = clips.map(clip => {
        const preview = clip.message_content.length > 80
            ? clip.message_content.substring(0, 80) + '...'
            : clip.message_content;
        return `**#${clip.id}** "${preview}" — <@${clip.message_author_id}>`;
    });

    const title = user
        ? `📎 Clips by ${user.displayName || user.username}`
        : '📎 Server Clips';

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(title)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${safePage + 1}/${totalPages} · ${total} clips total` });

    await interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction: CommandInteraction, context: Context) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const clipId = interaction.options.getInteger('id', true);

    const clip = await context.tables.Clip.findOne({
        where: { id: clipId, guild_id: interaction.guildId },
    });

    if (!clip) {
        await interaction.reply({ content: `Clip #${clipId} not found.`, ephemeral: true });
        return;
    }

    // Only the clipper or the quoted person can delete
    const userId = interaction.user.id;
    if (clip.clipped_by_id !== userId && clip.message_author_id !== userId) {
        await interaction.reply({
            content: 'You can only delete clips you saved or clips of your own messages.',
            ephemeral: true,
        });
        return;
    }

    await clip.destroy();

    await interaction.reply({ content: `Clip #${clipId} deleted.`, ephemeral: true });

    context.log.info({
        category: 'clip',
        clipId,
        deletedBy: userId,
        guildId: interaction.guildId,
    }, 'Clip deleted');
}
