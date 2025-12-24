import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import { checkOwnerPermission } from '../utils/permissions';

export default {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Manage bot server membership (Owner only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all servers the bot is in'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Make the bot leave a specific server')
                .addStringOption(option =>
                    option
                        .setName('guild_id')
                        .setDescription('The ID of the server to leave')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: any, context: Context) {
        const { log } = context;

        try {
            // Check if user is bot owner
            await checkOwnerPermission(interaction, context);

            const subcommand = interaction.options.getSubcommand();
            const client = interaction.client;

            if (subcommand === 'list') {
                const guilds = client.guilds.cache;

                if (guilds.size === 0) {
                    await interaction.reply({
                        content: 'The bot is not in any servers.',
                        ephemeral: true,
                    });
                    return;
                }

                const guildList = guilds.map((guild: any) => {
                    const memberCount = guild.memberCount;
                    return `- **${guild.name}** (ID: \`${guild.id}\`) - ${memberCount} members`;
                }).join('\n');

                await interaction.reply({
                    content: `**Servers (${guilds.size}):**\n${guildList}`,
                    ephemeral: true,
                });

                log.info('Listed all servers', {
                    userId: interaction.user.id,
                    serverCount: guilds.size,
                });

            } else if (subcommand === 'leave') {
                const guildId = interaction.options.getString('guild_id');
                const targetGuild = client.guilds.cache.get(guildId);

                if (!targetGuild) {
                    await interaction.reply({
                        content: `Bot is not in a server with ID \`${guildId}\`.`,
                        ephemeral: true,
                    });
                    return;
                }

                const guildName = targetGuild.name;

                await interaction.deferReply({ ephemeral: true });

                try {
                    await targetGuild.leave();

                    await interaction.followUp({
                        content: `Successfully left server **${guildName}** (\`${guildId}\`).`,
                        ephemeral: true,
                    });

                    log.info('Bot left server via command', {
                        userId: interaction.user.id,
                        username: interaction.user.username,
                        guildId: guildId,
                        guildName: guildName,
                    });

                } catch (error) {
                    await interaction.followUp({
                        content: `Failed to leave server: ${error instanceof Error ?
                            error.message : 'Unknown error'}`,
                        ephemeral: true,
                    });

                    log.error('Failed to leave server via command', {
                        userId: interaction.user.id,
                        guildId: guildId,
                        error: error,
                    });
                }
            }

        } catch (error) {
            // Handle authorization errors
            if (error instanceof Error && error.message.startsWith('Unauthorized')) {
                log.warn('Unauthorized server command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing server command', {
                userId: interaction.user.id,
                error: error,
            });

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            if (interaction.deferred) {
                await interaction.followUp({
                    content: `An error occurred: ${errorMessage}`,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: `An error occurred: ${errorMessage}`,
                    ephemeral: true,
                });
            }
        }
    },

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'guild_id') {
            const client = interaction.client;
            const guilds = client.guilds.cache;
            const searchValue = focusedOption.value.toLowerCase();

            const filtered = guilds
                .filter((guild: any) =>
                    guild.name.toLowerCase().includes(searchValue) ||
                    guild.id.includes(searchValue)
                )
                .first(25);

            await interaction.respond(
                filtered.map((guild: any) => ({
                    name: `${guild.name} (${guild.memberCount} members)`,
                    value: guild.id,
                }))
            );
        }
    },
};
