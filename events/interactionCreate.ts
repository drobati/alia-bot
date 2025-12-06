import {
    CommandInteraction, Events, Interaction, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, EmbedBuilder, GuildMember,
} from "discord.js";
import { Command, Context, BotEvent, ExtendedClient } from "../src/utils/types";

const interactionCreateEventHandler: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, context: Context) {
        const { log } = context;

        // Log ALL incoming interactions for debugging
        log.info('Interaction received', {
            type: interaction.type,
            commandName: interaction.isChatInputCommand() ? interaction.commandName : 'N/A',
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
        });

        // Handle button interactions for polls
        if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
            await handlePollVote(interaction, context);
            return;
        }

        // Handle button interactions for member votes
        if (interaction.isButton() && interaction.customId.startsWith('memberVote_')) {
            await handleMemberVote(interaction, context);
            return;
        }

        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
            log.error(`Interaction type ${interaction.type}} is not a chat input command or autocomplete`);
            return;
        }

        const command = (interaction.client as ExtendedClient).commands
            .get(interaction.commandName) as Command | undefined;

        if (!command) {
            log.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            if (interaction.isAutocomplete()) {
                if (command && command.autocomplete) {
                    log.info(`Autocompleting ${interaction.commandName}`);
                    await command.autocomplete(interaction, context);
                } else {
                    log.error(`Autocomplete command not found for ${interaction.commandName}`);
                }
            }
            else if (interaction.isCommand()) {
                log.info(`Executing ${interaction.commandName}`);
                await command.execute(interaction, context);
            }
        } catch (error) {
            log.error(error);
            if (interaction instanceof CommandInteraction) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                }
            } else {
                log.error('Interaction type does not support replied or deferred properties.');
            }
        }
    },
};

async function handlePollVote(interaction: any, context: Context) {
    try {
        // Parse button custom ID: poll_vote_{pollId}_{optionIndex}
        const parts = interaction.customId.split('_');
        if (parts.length !== 4) {return;}

        const pollId = parts[2];
        const optionIndex = parseInt(parts[3]);

        // Find the poll
        const poll = await context.tables.Poll.findOne({
            where: {
                poll_id: pollId,
                is_active: true,
            },
        });

        if (!poll) {
            await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
            return;
        }

        // Check if poll has expired
        if (new Date() > new Date(poll.expires_at)) {
            await context.tables.Poll.update(
                { is_active: false },
                { where: { id: poll.id } },
            );
            await interaction.reply({ content: 'This poll has expired.', ephemeral: true });
            return;
        }

        // Store or update the vote
        await context.tables.PollVote.upsert({
            poll_id: poll.id,
            user_id: interaction.user.id,
            option_index: optionIndex,
            voted_at: new Date(),
        });

        // Get updated vote counts
        const votes = await context.tables.PollVote.findAll({
            where: { poll_id: poll.id },
            attributes: ['option_index', [context.sequelize.fn('COUNT', context.sequelize.col('user_id')), 'count']],
            group: ['option_index'],
            raw: true,
        });

        const options = JSON.parse(poll.options);
        const voteCounts = new Map<number, number>();
        votes.forEach((vote: any) => {
            voteCounts.set(vote.option_index, parseInt(vote.count));
        });

        // Update button labels with new vote counts
        const voteButtons = options.map((option: string, index: number) => {
            const emoji = getEmojiForIndex(index);
            const count = voteCounts.get(index) || 0;
            return new ButtonBuilder()
                .setCustomId(`poll_vote_${pollId}_${index}`)
                .setLabel(`${emoji} ${count}`)
                .setStyle(ButtonStyle.Secondary);
        });

        // Create action rows
        const actionRows = [];
        for (let i = 0; i < voteButtons.length; i += 5) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(voteButtons.slice(i, i + 5));
            actionRows.push(row);
        }

        // Update the original message with new vote counts
        await interaction.update({
            components: actionRows,
        });

        context.log.info('Poll vote recorded and buttons updated', {
            pollId: poll.id,
            userId: interaction.user.id,
            optionIndex: optionIndex,
        });

    } catch (error) {
        context.log.error('Error handling poll vote', { error, userId: interaction.user.id });
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while recording your vote.', ephemeral: true });
        }
    }
}

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '❓';
}

async function handleMemberVote(interaction: any, context: Context) {
    try {
        // Parse button custom ID: memberVote_{action}_{voteId}
        const parts = interaction.customId.split('_');
        if (parts.length !== 3) {
            return;
        }

        const action = parts[1]; // 'approve' or 'reject'
        const voteId = parts[2];

        // Find the vote
        const vote = await context.tables.MemberVote.findOne({
            where: {
                vote_id: voteId,
                status: 'pending',
            },
        });

        if (!vote) {
            await interaction.reply({ content: 'This vote is no longer active.', ephemeral: true });
            return;
        }

        // Check if vote has expired
        if (new Date() > new Date(vote.expires_at)) {
            await context.tables.MemberVote.update(
                { status: 'expired' },
                { where: { id: vote.id } },
            );
            await interaction.reply({ content: 'This vote has expired.', ephemeral: true });
            return;
        }

        // Get config for this guild
        const config = await context.tables.MemberVotingConfig.findOne({
            where: { guild_id: vote.guild_id },
        });

        if (!config) {
            await interaction.reply({ content: 'Voting configuration not found.', ephemeral: true });
            return;
        }

        const userId = interaction.user.id;
        let approveVoters: string[] = vote.approve_voters || [];
        let rejectVoters: string[] = vote.reject_voters || [];

        // Check if user has already voted
        const hasVotedApprove = approveVoters.includes(userId);
        const hasVotedReject = rejectVoters.includes(userId);

        // Prevent voting for yourself
        if (userId === vote.member_id) {
            await interaction.reply({
                content: 'You cannot vote on your own membership application.',
                ephemeral: true,
            });
            return;
        }

        // Handle vote change or new vote
        if (action === 'approve') {
            if (hasVotedApprove) {
                // Remove vote (toggle off)
                approveVoters = approveVoters.filter((id: string) => id !== userId);
            } else {
                // Add approve vote, remove reject if exists
                rejectVoters = rejectVoters.filter((id: string) => id !== userId);
                approveVoters.push(userId);
            }
        } else if (action === 'reject') {
            if (hasVotedReject) {
                // Remove vote (toggle off)
                rejectVoters = rejectVoters.filter((id: string) => id !== userId);
            } else {
                // Add reject vote, remove approve if exists
                approveVoters = approveVoters.filter((id: string) => id !== userId);
                rejectVoters.push(userId);
            }
        }

        // Update the vote record
        await context.tables.MemberVote.update(
            {
                approve_voters: approveVoters,
                reject_voters: rejectVoters,
            },
            { where: { id: vote.id } },
        );

        // Check if threshold reached
        const approveCount = approveVoters.length;
        const rejectCount = rejectVoters.length;
        const votesRequired = config.votes_required;

        let voteResolved = false;
        let voteResult: 'approved' | 'rejected' | null = null;

        if (approveCount >= votesRequired) {
            voteResolved = true;
            voteResult = 'approved';
        } else if (rejectCount >= votesRequired) {
            voteResolved = true;
            voteResult = 'rejected';
        }

        // Update buttons with new vote counts
        const approveButton = new ButtonBuilder()
            .setCustomId(`memberVote_approve_${voteId}`)
            .setLabel(`Approve (${approveCount})`)
            .setStyle(voteResolved ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(voteResolved);

        const rejectButton = new ButtonBuilder()
            .setCustomId(`memberVote_reject_${voteId}`)
            .setLabel(`Reject (${rejectCount})`)
            .setStyle(voteResolved ? ButtonStyle.Secondary : ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(voteResolved);

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(approveButton, rejectButton);

        // If vote resolved, handle role assignment and update embed
        if (voteResolved && voteResult) {
            // Update vote status in database
            await context.tables.MemberVote.update(
                {
                    status: voteResult,
                    resolved_at: new Date(),
                },
                { where: { id: vote.id } },
            );

            // Try to assign/handle role if approved
            if (voteResult === 'approved') {
                try {
                    const guild = interaction.guild;
                    const member = await guild.members.fetch(vote.member_id) as GuildMember;
                    const role = await guild.roles.fetch(config.approved_role_id);

                    if (role && member) {
                        await member.roles.add(role);
                        context.log.info('Role assigned to approved member', {
                            memberId: vote.member_id,
                            roleId: config.approved_role_id,
                            voteId: vote.vote_id,
                        });
                    }
                } catch (roleError) {
                    context.log.error('Failed to assign role to approved member', {
                        error: roleError,
                        memberId: vote.member_id,
                        voteId: vote.vote_id,
                    });
                }
            }

            // Update the embed to show resolution
            const originalEmbed = interaction.message.embeds[0];
            const resolvedEmbed = new EmbedBuilder(originalEmbed.data)
                .setColor(voteResult === 'approved' ? '#00ff00' : '#ff0000')
                .setTitle(voteResult === 'approved' ? 'Member Approved' : 'Member Rejected')
                .addFields({
                    name: 'Result',
                    value: voteResult === 'approved'
                        ? `✅ Approved with ${approveCount} votes`
                        : `❌ Rejected with ${rejectCount} votes`,
                    inline: false,
                });

            await interaction.update({
                embeds: [resolvedEmbed],
                components: [actionRow],
            });

            context.log.info('Member vote resolved', {
                voteId: vote.vote_id,
                memberId: vote.member_id,
                result: voteResult,
                approveCount,
                rejectCount,
            });
        } else {
            // Just update the buttons
            await interaction.update({
                components: [actionRow],
            });

            context.log.info('Member vote recorded', {
                voteId: vote.vote_id,
                voterId: userId,
                action,
                approveCount,
                rejectCount,
            });
        }

    } catch (error) {
        context.log.error('Error handling member vote', { error, userId: interaction.user.id });
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while recording your vote.', ephemeral: true });
        }
    }
}

export default interactionCreateEventHandler;
