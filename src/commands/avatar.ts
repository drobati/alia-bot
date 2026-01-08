import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    User,
    GuildMember,
} from "discord.js";
import { Context } from "../types";

const IMAGE_SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096] as const;
type ImageSize = typeof IMAGE_SIZES[number];

function getAvatarEmbed(
    user: User,
    guildMember: GuildMember | null,
    requestedBy: User,
): EmbedBuilder {
    const globalAvatarUrl = user.displayAvatarURL({ size: 4096, extension: 'png' });
    const guildAvatarUrl = guildMember?.displayAvatarURL({ size: 4096, extension: 'png' }) ?? null;

    const hasGuildAvatar = guildMember && guildAvatarUrl && guildAvatarUrl !== globalAvatarUrl;

    const embed = new EmbedBuilder()
        .setColor(user.accentColor || 0x5865F2)
        .setTitle(`${user.displayName}'s Avatar`)
        .setImage(hasGuildAvatar ? guildAvatarUrl : globalAvatarUrl)
        .setTimestamp();

    // Build size links
    const sizeLinksPng = IMAGE_SIZES.filter(s => s >= 128).map(size =>
        `[${size}](${user.displayAvatarURL({ size: size as ImageSize, extension: 'png' })})`,
    ).join(' | ');

    const sizeLinksWebp = IMAGE_SIZES.filter(s => s >= 128).map(size =>
        `[${size}](${user.displayAvatarURL({ size: size as ImageSize, extension: 'webp' })})`,
    ).join(' | ');

    let description = `**PNG:** ${sizeLinksPng}\n**WebP:** ${sizeLinksWebp}`;

    if (hasGuildAvatar) {
        const guildSizeLinksPng = IMAGE_SIZES.filter(s => s >= 128).map(size =>
            `[${size}](${guildMember.displayAvatarURL({ size: size as ImageSize, extension: 'png' })})`,
        ).join(' | ');

        description = `**Server Avatar**\n**PNG:** ${guildSizeLinksPng}\n\n` +
            `**Global Avatar**\n**PNG:** ${sizeLinksPng}`;

        embed.setThumbnail(globalAvatarUrl);
    }

    embed.setDescription(description);

    if (requestedBy.id !== user.id) {
        embed.setFooter({ text: `Requested by ${requestedBy.username}` });
    }

    return embed;
}

function getServerIconEmbed(
    interaction: ChatInputCommandInteraction,
): EmbedBuilder | null {
    const guild = interaction.guild;

    if (!guild) {
        return null;
    }

    const iconUrl = guild.iconURL({ size: 4096, extension: 'png' });

    if (!iconUrl) {
        return null;
    }

    const sizeLinksPng = IMAGE_SIZES.filter(s => s >= 128).map(size =>
        `[${size}](${guild.iconURL({ size: size as ImageSize, extension: 'png' })})`,
    ).join(' | ');

    const sizeLinksWebp = IMAGE_SIZES.filter(s => s >= 128).map(size =>
        `[${size}](${guild.iconURL({ size: size as ImageSize, extension: 'webp' })})`,
    ).join(' | ');

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${guild.name}'s Server Icon`)
        .setDescription(`**PNG:** ${sizeLinksPng}\n**WebP:** ${sizeLinksWebp}`)
        .setImage(iconUrl)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.username}` });

    return embed;
}

async function getBannerEmbed(
    user: User,
    requestedBy: User,
): Promise<EmbedBuilder | null> {
    // Fetch full user to get banner
    const fetchedUser = await user.fetch(true);
    const bannerUrl = fetchedUser.bannerURL({ size: 4096, extension: 'png' });

    if (!bannerUrl) {
        return null;
    }

    const sizeLinksPng = IMAGE_SIZES.filter(s => s >= 256).map(size =>
        `[${size}](${fetchedUser.bannerURL({ size: size as ImageSize, extension: 'png' })})`,
    ).join(' | ');

    const sizeLinksWebp = IMAGE_SIZES.filter(s => s >= 256).map(size =>
        `[${size}](${fetchedUser.bannerURL({ size: size as ImageSize, extension: 'webp' })})`,
    ).join(' | ');

    const embed = new EmbedBuilder()
        .setColor(fetchedUser.accentColor || 0x5865F2)
        .setTitle(`${user.displayName}'s Banner`)
        .setDescription(`**PNG:** ${sizeLinksPng}\n**WebP:** ${sizeLinksWebp}`)
        .setImage(bannerUrl)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

    if (requestedBy.id !== user.id) {
        embed.setFooter({ text: `Requested by ${requestedBy.username}` });
    }

    return embed;
}

const avatarCommand = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Display user avatars and server icons')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Display a user\'s avatar')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to get the avatar of (defaults to yourself)')
                        .setRequired(false),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Display the server icon'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('banner')
                .setDescription('Display a user\'s profile banner (requires Nitro)')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to get the banner of (defaults to yourself)')
                        .setRequired(false),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'user': {
                    const targetUser: User = interaction.options.getUser('user') || interaction.user;
                    const guildMember = interaction.guild?.members.cache.get(targetUser.id) || null;

                    const embed = getAvatarEmbed(targetUser, guildMember, interaction.user);
                    await interaction.reply({ embeds: [embed] });

                    context.log.info('avatar user command used', {
                        userId: interaction.user.id,
                        targetUserId: targetUser.id,
                    });
                    break;
                }

                case 'server': {
                    const embed = getServerIconEmbed(interaction);

                    if (!embed) {
                        await interaction.reply({
                            content: 'This server does not have an icon set.',
                            ephemeral: true,
                        });
                        return;
                    }

                    await interaction.reply({ embeds: [embed] });

                    context.log.info('avatar server command used', {
                        userId: interaction.user.id,
                        guildId: interaction.guild?.id,
                    });
                    break;
                }

                case 'banner': {
                    await interaction.deferReply();

                    const targetUser: User = interaction.options.getUser('user') || interaction.user;
                    const embed = await getBannerEmbed(targetUser, interaction.user);

                    if (!embed) {
                        const msg = `${targetUser.displayName} does not have a profile banner.` +
                            ' Banners require Discord Nitro.';
                        await interaction.editReply({ content: msg });
                        return;
                    }

                    await interaction.editReply({ embeds: [embed] });

                    context.log.info('avatar banner command used', {
                        userId: interaction.user.id,
                        targetUserId: targetUser.id,
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
            context.log.error({ error }, 'Error in avatar command');

            const errorMessage = 'An error occurred while fetching the avatar.';

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

export default avatarCommand;
