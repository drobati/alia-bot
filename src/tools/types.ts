import { Message } from 'discord.js';
import { Context } from '../utils/types';

export interface ToolAnswer {
    title: string;
    body: string;
    /** Where the answer came from, linked in the embed when present. */
    url?: string;
    /** Shown as the source, e.g. "Wikipedia". */
    sourceLabel: string;
}

export interface ToolContext {
    message: Message;
    context: Context;
}

export interface Tool {
    name: string;
    /**
     * Returns null when the tool cannot answer: no article, a geocode miss, an
     * unparseable expression. That is not an error. The caller falls back to the
     * LLM when Alia was addressed, and to silence when she was not.
     *
     * `deps` lets a tool take an injected fetch in tests. Tools that need
     * nothing injected simply ignore it.
     */
    run(query: string, ctx: ToolContext, deps?: unknown): Promise<ToolAnswer | null>;
}
