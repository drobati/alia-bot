import { ToolName } from '../utils/question-types';
import { mathTool } from './math';
import { serverMemberTool } from './serverMember';
import { timeDateTool } from './timeDate';
import { Tool } from './types';
import { weatherTool } from './weather';
import { wikipediaTool } from './wikipedia';

export const TOOLS: Record<ToolName, Tool> = {
    wikipedia: wikipediaTool,
    weather: weatherTool,
    math: mathTool,
    time_date: timeDateTool,
    server_member: serverMemberTool,
};
