import { Tool, ToolAnswer, ToolContext } from './types';

const MAX_DESCRIPTIONS = 5;

export const serverMemberTool: Tool = {
    name: 'server_member',

    async run(_query: string, ctx: ToolContext): Promise<ToolAnswer | null> {
        void _query;
        const { message, context } = ctx;
        if (!message.guildId) {
            return null;
        }

        // Only answers about someone actually mentioned. Resolving a bare name
        // would risk answering confidently about the wrong person.
        const target = message.mentions?.users?.first();
        if (!target) {
            return null;
        }

        try {
            const rows = await context.tables.UserDescriptions.findAll({
                where: { guild_id: message.guildId, user_id: target.id },
                limit: MAX_DESCRIPTIONS,
            });
            if (!rows || rows.length === 0) {
                return null;
            }

            return {
                title: target.username,
                body: rows.map((row: { description: string }) => `• ${row.description}`).join('\n'),
                sourceLabel: 'what people told me',
            };
        } catch {
            return null;
        }
    },
};
