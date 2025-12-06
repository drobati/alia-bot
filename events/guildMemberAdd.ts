import {
    Events, GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel,
} from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';

function generateShortId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

const guildMemberAddEvent: BotEvent = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember, context: Context) {
        const { tables, log } = context;

        log.info('New member joined', {
            memberId: member.id,
            username: member.user.username,
            guildId: member.guild.id,
            guildName: member.guild.name,
        });

        try {
            // Check if member voting is enabled for this guild
            const config = await tables.MemberVotingConfig.findOne({
                where: {
                    guild_id: member.guild.id,
                    enabled: true,
                },
            });

            if (!config) {
                log.debug('Member voting not enabled for guild', { guildId: member.guild.id });
                return;
            }

            // Check for existing pending vote for this member
            const existingVote = await tables.MemberVote.findOne({
                where: {
                    member_id: member.id,
                    guild_id: member.guild.id,
                    status: 'pending',
                },
            });

            if (existingVote) {
                log.info('Pending vote already exists for member', {
                    memberId: member.id,
                    voteId: existingVote.vote_id,
                });
                return;
            }

            // Get the voting channel
            const votingChannel = await member.guild.channels.fetch(config.voting_channel_id).catch(() => null);

            if (!votingChannel || !(votingChannel instanceof TextChannel)) {
                log.error('Voting channel not found or not a text channel', {
                    votingChannelId: config.voting_channel_id,
                    guildId: member.guild.id,
                });
                return;
            }

            // Generate unique vote ID
            let voteId: string;
            let attempts = 0;
            do {
                voteId = generateShortId();
                attempts++;
                if (attempts > 10) {
                    throw new Error('Failed to generate unique vote ID');
                }
            } while (await tables.MemberVote.findOne({ where: { vote_id: voteId } }));

            // Calculate expiration time
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + config.vote_duration_hours);

            // Get the role name for display
            const approvedRole = await member.guild.roles.fetch(config.approved_role_id).catch(() => null);

            // Create the voting embed
            const memberAge = Math.round((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('New Member Requires Approval')
                .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                .setDescription(`A new member has joined and needs community approval to access the server.`)
                .addFields(
                    { name: 'Member', value: `${member.user.tag}`, inline: true },
                    { name: 'Account Age', value: `${memberAge} days`, inline: true },
                    { name: 'User ID', value: `\`${member.id}\``, inline: true },
                    { name: 'Votes Required', value: `${config.votes_required} approvals`, inline: true },
                    { name: 'Role if Approved', value: approvedRole ? `${approvedRole}` : 'Unknown', inline: true },
                    { name: 'Expires', value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`, inline: true },
                    { name: 'Vote ID', value: `\`${voteId}\``, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: 'Click a button below to cast your vote' });

            // Create voting buttons
            const approveButton = new ButtonBuilder()
                .setCustomId(`memberVote_approve_${voteId}`)
                .setLabel('Approve (0)')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const rejectButton = new ButtonBuilder()
                .setCustomId(`memberVote_reject_${voteId}`)
                .setLabel('Reject (0)')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌');

            const actionRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(approveButton, rejectButton);

            // Send the voting message
            const voteMessage = await votingChannel.send({
                embeds: [embed],
                components: [actionRow],
            });

            // Store the vote in database
            await tables.MemberVote.create({
                vote_id: voteId,
                member_id: member.id,
                member_username: member.user.tag,
                guild_id: member.guild.id,
                message_id: voteMessage.id,
                approve_voters: [],
                reject_voters: [],
                status: 'pending',
                expires_at: expiresAt,
            });

            log.info('Member vote created', {
                voteId,
                memberId: member.id,
                memberUsername: member.user.tag,
                guildId: member.guild.id,
                messageId: voteMessage.id,
                expiresAt: expiresAt.toISOString(),
            });

        } catch (error) {
            log.error('Error handling new member for voting', {
                error,
                memberId: member.id,
                guildId: member.guild.id,
            });
        }
    },
};

export default guildMemberAddEvent;
