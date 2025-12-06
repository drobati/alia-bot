import { EmbedBuilder, SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { checkOwnerPermission } from "../utils/permissions";

export default {
    data: new SlashCommandBuilder()
        .setName('member-vote')
        .setDescription('Manage member voting system for new members')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure the member voting system (owner only)')
                .addChannelOption(option =>
                    option.setName('voting_channel')
                        .setDescription('Channel where votes will be posted')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('approved_role')
                        .setDescription('Role to assign when member is approved')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('votes_required')
                        .setDescription('Number of approve votes needed (default: 3)')
                        .setMinValue(1)
                        .setMaxValue(50))
                .addIntegerOption(option =>
                    option.setName('duration_hours')
                        .setDescription('How long votes stay open in hours (default: 24)')
                        .setMinValue(1)
                        .setMaxValue(168))
                .addChannelOption(option =>
                    option.setName('welcome_channel')
                        .setDescription('Optional welcome channel to monitor')
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable the member voting system (owner only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable the member voting system (owner only)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current member voting configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pending')
                .setDescription('View all pending member votes'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('approve')
                .setDescription('Manually approve a pending member (owner only)')
                .addStringOption(option =>
                    option.setName('vote_id')
                        .setDescription('The vote ID to approve')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reject')
                .setDescription('Manually reject a pending member (owner only)')
                .addStringOption(option =>
                    option.setName('vote_id')
                        .setDescription('The vote ID to reject')
                        .setRequired(true))),

    async execute(interaction: any, context: any) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'setup':
                    await handleSetupCommand(interaction, context);
                    break;
                case 'enable':
                    await handleEnableCommand(interaction, context);
                    break;
                case 'disable':
                    await handleDisableCommand(interaction, context);
                    break;
                case 'status':
                    await handleStatusCommand(interaction, context);
                    break;
                case 'pending':
                    await handlePendingCommand(interaction, context);
                    break;
                case 'approve':
                    await handleApproveCommand(interaction, context);
                    break;
                case 'reject':
                    await handleRejectCommand(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error: any) {
            if (error.message === 'Unauthorized: User is not bot owner') {
                return; // Already handled by checkOwnerPermission
            }
            context.log.error('Error executing member-vote command', {
                error, subcommand, userId: interaction.user.id,
            });
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while executing the command.',
                    ephemeral: true,
                });
            }
        }
    },
};

async function handleSetupCommand(interaction: any, context: any) {
    await checkOwnerPermission(interaction, context);

    const votingChannel = interaction.options.getChannel('voting_channel');
    const approvedRole = interaction.options.getRole('approved_role');
    const votesRequired = interaction.options.getInteger('votes_required') || 3;
    const durationHours = interaction.options.getInteger('duration_hours') || 24;
    const welcomeChannel = interaction.options.getChannel('welcome_channel');

    // Check bot has permission to send messages in voting channel
    const botMember = interaction.guild.members.me;
    if (!votingChannel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({
            content: `I don't have permission to send messages in ${votingChannel}.`,
            ephemeral: true,
        });
        return;
    }

    // Check bot can assign the role
    if (approvedRole.position >= botMember.roles.highest.position) {
        await interaction.reply({
            content: `I cannot assign the role ${approvedRole} because it's higher than or equal to my highest role.`,
            ephemeral: true,
        });
        return;
    }

    // Upsert configuration
    await context.tables.MemberVotingConfig.upsert({
        guild_id: interaction.guildId,
        voting_channel_id: votingChannel.id,
        approved_role_id: approvedRole.id,
        votes_required: votesRequired,
        vote_duration_hours: durationHours,
        welcome_channel_id: welcomeChannel?.id || null,
        enabled: false, // Don't auto-enable on setup
    });

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Member Voting System Configured')
        .addFields(
            { name: 'Voting Channel', value: `${votingChannel}`, inline: true },
            { name: 'Approved Role', value: `${approvedRole}`, inline: true },
            { name: 'Votes Required', value: `${votesRequired}`, inline: true },
            { name: 'Vote Duration', value: `${durationHours} hours`, inline: true },
            { name: 'Welcome Channel', value: welcomeChannel ? `${welcomeChannel}` : 'Not set', inline: true },
            { name: 'Status', value: 'Disabled (use `/member-vote enable` to activate)', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'New members will trigger a vote when enabled' });

    await interaction.reply({ embeds: [embed] });

    context.log.info('Member voting configured', {
        guildId: interaction.guildId,
        votingChannelId: votingChannel.id,
        approvedRoleId: approvedRole.id,
        votesRequired,
        durationHours,
        welcomeChannelId: welcomeChannel?.id,
    });
}

async function handleEnableCommand(interaction: any, context: any) {
    await checkOwnerPermission(interaction, context);

    const config = await context.tables.MemberVotingConfig.findOne({
        where: { guild_id: interaction.guildId },
    });

    if (!config) {
        await interaction.reply({
            content: 'Member voting has not been configured. Use `/member-vote setup` first.',
            ephemeral: true,
        });
        return;
    }

    if (config.enabled) {
        await interaction.reply({
            content: 'Member voting is already enabled.',
            ephemeral: true,
        });
        return;
    }

    await context.tables.MemberVotingConfig.update(
        { enabled: true },
        { where: { guild_id: interaction.guildId } },
    );

    await interaction.reply({
        content: 'Member voting system has been **enabled**. New members will now trigger a vote.',
        ephemeral: false,
    });

    context.log.info('Member voting enabled', { guildId: interaction.guildId });
}

async function handleDisableCommand(interaction: any, context: any) {
    await checkOwnerPermission(interaction, context);

    const config = await context.tables.MemberVotingConfig.findOne({
        where: { guild_id: interaction.guildId },
    });

    if (!config) {
        await interaction.reply({
            content: 'Member voting has not been configured.',
            ephemeral: true,
        });
        return;
    }

    if (!config.enabled) {
        await interaction.reply({
            content: 'Member voting is already disabled.',
            ephemeral: true,
        });
        return;
    }

    await context.tables.MemberVotingConfig.update(
        { enabled: false },
        { where: { guild_id: interaction.guildId } },
    );

    await interaction.reply({
        content: 'Member voting system has been **disabled**. New members will not trigger a vote.',
        ephemeral: false,
    });

    context.log.info('Member voting disabled', { guildId: interaction.guildId });
}

async function handleStatusCommand(interaction: any, context: any) {
    const config = await context.tables.MemberVotingConfig.findOne({
        where: { guild_id: interaction.guildId },
    });

    if (!config) {
        await interaction.reply({
            content: 'Member voting has not been configured for this server. Use `/member-vote setup` to configure.',
            ephemeral: true,
        });
        return;
    }

    const votingChannel = await interaction.guild.channels.fetch(config.voting_channel_id).catch(() => null);
    const approvedRole = await interaction.guild.roles.fetch(config.approved_role_id).catch(() => null);
    const welcomeChannel = config.welcome_channel_id
        ? await interaction.guild.channels.fetch(config.welcome_channel_id).catch(() => null)
        : null;

    // Count pending votes
    const pendingCount = await context.tables.MemberVote.count({
        where: {
            guild_id: interaction.guildId,
            status: 'pending',
        },
    });

    const embed = new EmbedBuilder()
        .setColor(config.enabled ? '#00ff00' : '#ff6b6b')
        .setTitle('Member Voting Configuration')
        .addFields(
            { name: 'Status', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Voting Channel', value: votingChannel ? `${votingChannel}` : '❌ Not found', inline: true },
            { name: 'Approved Role', value: approvedRole ? `${approvedRole}` : '❌ Not found', inline: true },
            { name: 'Votes Required', value: `${config.votes_required}`, inline: true },
            { name: 'Vote Duration', value: `${config.vote_duration_hours} hours`, inline: true },
            { name: 'Welcome Channel', value: welcomeChannel ? `${welcomeChannel}` : 'Not set', inline: true },
            { name: 'Pending Votes', value: `${pendingCount}`, inline: true },
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handlePendingCommand(interaction: any, context: any) {
    const pendingVotes = await context.tables.MemberVote.findAll({
        where: {
            guild_id: interaction.guildId,
            status: 'pending',
        },
        order: [['created_at', 'DESC']],
        limit: 10,
    });

    if (pendingVotes.length === 0) {
        await interaction.reply({
            content: 'There are no pending member votes.',
            ephemeral: true,
        });
        return;
    }

    const config = await context.tables.MemberVotingConfig.findOne({
        where: { guild_id: interaction.guildId },
    });

    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Pending Member Votes')
        .setDescription(pendingVotes.map((vote: any, index: number) => {
            const approveCount = vote.approve_voters?.length || 0;
            const rejectCount = vote.reject_voters?.length || 0;
            const timeLeft = Math.round((new Date(vote.expires_at).getTime() - Date.now()) / (1000 * 60 * 60));
            const timeLeftStr = timeLeft > 0 ? `${timeLeft}h left` : 'Expired';
            return `**${index + 1}.** ${vote.member_username}\n` +
                   `Vote ID: \`${vote.vote_id}\`\n` +
                   `Votes: ✅ ${approveCount}/${config?.votes_required || 3} | ❌ ${rejectCount}\n` +
                   `⏰ ${timeLeftStr}`;
        }).join('\n\n'))
        .setFooter({ text: 'Use /member-vote approve or reject with the vote ID' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleApproveCommand(interaction: any, context: any) {
    await checkOwnerPermission(interaction, context);

    const voteId = interaction.options.getString('vote_id');

    const vote = await context.tables.MemberVote.findOne({
        where: {
            vote_id: voteId,
            guild_id: interaction.guildId,
            status: 'pending',
        },
    });

    if (!vote) {
        await interaction.reply({
            content: 'Vote not found or already resolved.',
            ephemeral: true,
        });
        return;
    }

    // Get the config to find the role
    const config = await context.tables.MemberVotingConfig.findOne({
        where: { guild_id: interaction.guildId },
    });

    if (!config) {
        await interaction.reply({
            content: 'Member voting configuration not found.',
            ephemeral: true,
        });
        return;
    }

    // Try to assign the role
    try {
        const member = await interaction.guild.members.fetch(vote.member_id);
        const role = await interaction.guild.roles.fetch(config.approved_role_id);

        if (role) {
            await member.roles.add(role);
        }

        // Update vote status
        await context.tables.MemberVote.update(
            {
                status: 'approved',
                resolved_at: new Date(),
            },
            { where: { id: vote.id } },
        );

        await interaction.reply({
            content: `Member **${vote.member_username}** has been manually approved and assigned the role.`,
            ephemeral: false,
        });

        context.log.info('Member manually approved', {
            voteId: vote.vote_id,
            memberId: vote.member_id,
            approvedBy: interaction.user.id,
        });

    } catch (error) {
        context.log.error('Failed to approve member', { error, voteId: vote.vote_id });
        await interaction.reply({
            content: 'Failed to assign role. The member may have left the server.',
            ephemeral: true,
        });
    }
}

async function handleRejectCommand(interaction: any, context: any) {
    await checkOwnerPermission(interaction, context);

    const voteId = interaction.options.getString('vote_id');

    const vote = await context.tables.MemberVote.findOne({
        where: {
            vote_id: voteId,
            guild_id: interaction.guildId,
            status: 'pending',
        },
    });

    if (!vote) {
        await interaction.reply({
            content: 'Vote not found or already resolved.',
            ephemeral: true,
        });
        return;
    }

    // Update vote status
    await context.tables.MemberVote.update(
        {
            status: 'rejected',
            resolved_at: new Date(),
        },
        { where: { id: vote.id } },
    );

    await interaction.reply({
        content: `Member **${vote.member_username}** has been manually rejected.`,
        ephemeral: false,
    });

    context.log.info('Member manually rejected', {
        voteId: vote.vote_id,
        memberId: vote.member_id,
        rejectedBy: interaction.user.id,
    });
}
