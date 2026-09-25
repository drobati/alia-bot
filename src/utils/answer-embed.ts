import { EmbedBuilder } from 'discord.js';
import { ToolAnswer } from '../tools/types';

const EMBED_COLOR = 0x5865f2;
const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4096;

function clamp(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

/**
 * Every tool answer goes through here, so the source is cited identically and
 * no tool invents its own layout.
 */
export function buildAnswerEmbed(answer: ToolAnswer): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(clamp(answer.title, MAX_TITLE))
        .setDescription(clamp(answer.body, MAX_DESCRIPTION))
        .setFooter({ text: `Source: ${answer.sourceLabel}` });

    if (answer.url) {
        embed.setURL(answer.url);
    }
    return embed;
}
