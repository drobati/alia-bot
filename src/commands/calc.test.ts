import { createContext, createInteraction } from '../utils/testHelpers';
import calcCommand from './calc';

describe('commands/calc', () => {
    let interaction: any;
    let context: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        interaction.guildId = 'test-guild-id';
        interaction.user = { id: 'test-user-id' };
    });

    describe('command data', () => {
        it('should have correct name and description', () => {
            expect(calcCommand.data.name).toBe('calc');
            expect(calcCommand.data.description).toContain('mathematical');
        });

        it('should have eval and help subcommands', () => {
            const json = calcCommand.data.toJSON();
            expect(json.options).toHaveLength(2);
            const subcommandNames = json.options?.map((opt: any) => opt.name) || [];
            expect(subcommandNames).toContain('eval');
            expect(subcommandNames).toContain('help');
        });
    });

    describe('help subcommand', () => {
        it('should display help information', async () => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('help');

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: expect.stringContaining('Calculator Help'),
                        }),
                    }),
                ]),
                ephemeral: true,
            });
        });
    });

    describe('eval subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('eval');
        });

        it('should evaluate basic arithmetic', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('2 + 2');

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            fields: expect.arrayContaining([
                                expect.objectContaining({ name: 'Expression', value: '`2 + 2`' }),
                                expect.objectContaining({ name: 'Result', value: '**4**' }),
                            ]),
                        }),
                    }),
                ]),
            });
        });

        it('should evaluate multiplication', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('6 * 7');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**42**');
        });

        it('should evaluate division', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('100 / 4');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**25**');
        });

        it('should evaluate sqrt function', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('sqrt(16)');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**4**');
        });

        it('should evaluate exponentiation', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('2^10');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**1,024**');
        });

        it('should evaluate factorial', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('5!');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**120**');
        });

        it('should evaluate trigonometric functions', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('sin(0)');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toBe('**0**');
        });

        it('should evaluate expressions with pi', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('2 * pi');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            // pi * 2 ≈ 6.283185307
            expect(resultField.value).toMatch(/\*\*6\.283/);
        });

        it('should evaluate unit conversions', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('5 inches to cm');

            await calcCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const resultField = replyCall.embeds[0].data.fields.find(
                (f: any) => f.name === 'Result',
            );
            expect(resultField.value).toContain('cm');
        });

        it('should handle invalid expressions gracefully', async () => {
            // Use unclosed parenthesis which is actually invalid
            interaction.options.getString = jest.fn().mockReturnValue('(2 + 3');

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌'),
                ephemeral: true,
            });
        });

        it('should handle unknown functions', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('unknownFunc(5)');

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌'),
                ephemeral: true,
            });
        });

        it('should reject expressions that are too long', async () => {
            const longExpression = '1+'.repeat(300) + '1';
            interaction.options.getString = jest.fn().mockReturnValue(longExpression);

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('too long'),
                ephemeral: true,
            });
        });

        it('should block disabled functions for security', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('import("fs")');

            await calcCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌'),
                ephemeral: true,
            });
        });

        it('should log successful evaluations', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('1 + 1');

            await calcCommand.execute(interaction, context);

            expect(context.log.info).toHaveBeenCalledWith(
                'Calculator expression evaluated',
                expect.objectContaining({
                    expression: '1 + 1',
                    result: '2',
                }),
            );
        });

        it('should log failed evaluations', async () => {
            interaction.options.getString = jest.fn().mockReturnValue('invalid syntax +++');

            await calcCommand.execute(interaction, context);

            expect(context.log.warn).toHaveBeenCalledWith(
                'Calculator expression failed',
                expect.objectContaining({
                    expression: 'invalid syntax +++',
                }),
            );
        });
    });
});
