import { Context } from '../src/utils/types';

export default {
    name: 'messageReactionAdd',
    async execute(reaction: any, user: any, context: Context) {
        try {
            // Skip bot reactions and partial reactions
            if (user.bot) {return;}
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    context.log.error('Failed to fetch reaction', { error });
                    return;
                }
            }

            // Check if this is a reaction to a poll message
            const poll = await context.tables.Poll.findOne({
                where: {
                    message_id: reaction.message.id,
                    is_active: true,
                },
            });

            if (!poll) {return;}

            // Check if poll has expired
            if (new Date() > new Date(poll.expires_at)) {
                await context.tables.Poll.update(
                    { is_active: false },
                    { where: { id: poll.id } },
                );
                return;
            }

            // Validate that the emoji is one of the poll options
            const pollOptions = JSON.parse(poll.options);
            const validEmojis = pollOptions.map((_: any, index: number) => getEmojiForIndex(index));

            if (!validEmojis.includes(reaction.emoji.name)) {return;}

            // Store or update the vote
            const optionIndex = validEmojis.indexOf(reaction.emoji.name);

            await context.tables.PollVote.upsert({
                poll_id: poll.id,
                user_id: user.id,
                option_index: optionIndex,
                voted_at: new Date(),
            });

            context.log.info('Poll vote recorded', {
                pollId: poll.id,
                userId: user.id,
                optionIndex: optionIndex,
                emoji: reaction.emoji.name,
            });

        } catch (error) {
            context.log.error('Error handling poll reaction', { error, userId: user.id });
        }
    },
};

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '❓';
}