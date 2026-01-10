import { createContext, createInteraction } from '../utils/testHelpers';
import translateCommand from './translate';

// Mock OpenAI
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
    chat: {
        completions: {
            create: jest.fn().mockResolvedValue({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            translatedText: 'Hola mundo',
                            detectedLanguage: 'English',
                            confidence: 'high',
                        }),
                    },
                }],
            }),
        },
    },
})));

describe('commands/translate', () => {
    let interaction: any;
    let context: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        interaction.guildId = 'test-guild-id';
        interaction.user = { id: 'test-user-id' };
        interaction.deferred = false;
        interaction.deferReply = jest.fn().mockResolvedValue(undefined);
        interaction.editReply = jest.fn().mockResolvedValue(undefined);
    });

    describe('command data', () => {
        it('should have correct name and description', () => {
            expect(translateCommand.data.name).toBe('translate');
            expect(translateCommand.data.description).toContain('Translate');
        });

        it('should have text and help subcommands', () => {
            const json = translateCommand.data.toJSON();
            expect(json.options).toHaveLength(2);
            const subcommandNames = json.options?.map((opt: any) => opt.name) || [];
            expect(subcommandNames).toContain('text');
            expect(subcommandNames).toContain('help');
        });

        it('should have required text and to options for text subcommand', () => {
            const json = translateCommand.data.toJSON() as any;
            const textSubcommand = json.options?.find((opt: any) => opt.name === 'text');
            expect(textSubcommand).toBeDefined();

            const textOption = textSubcommand?.options?.find((opt: any) => opt.name === 'text');
            const toOption = textSubcommand?.options?.find((opt: any) => opt.name === 'to');

            expect(textOption?.required).toBe(true);
            expect(toOption?.required).toBe(true);
        });

        it('should have optional from option for text subcommand', () => {
            const json = translateCommand.data.toJSON() as any;
            const textSubcommand = json.options?.find((opt: any) => opt.name === 'text');
            const fromOption = textSubcommand?.options?.find((opt: any) => opt.name === 'from');

            expect(fromOption).toBeDefined();
            expect(fromOption?.required).toBe(false);
        });
    });

    describe('help subcommand', () => {
        it('should display help information', async () => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('help');

            await translateCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: expect.stringContaining('Translation Help'),
                        }),
                    }),
                ]),
                ephemeral: true,
            });
        });

        it('should show supported languages', async () => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('help');

            await translateCommand.execute(interaction, context);

            const replyCall = interaction.reply.mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const languagesField = embed.data.fields?.find(
                (f: any) => f.name === 'Supported Languages',
            );

            expect(languagesField).toBeDefined();
            expect(languagesField.value).toContain('English');
            expect(languagesField.value).toContain('Spanish');
        });
    });

    describe('text subcommand', () => {
        beforeEach(() => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('text');
        });

        it('should translate text successfully', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Hello world';}
                    if (name === 'to') {return 'Spanish';}
                    if (name === 'from') {return null;}
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: 'Translation',
                        }),
                    }),
                ]),
            });
        });

        it('should defer reply while processing', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Test message';}
                    if (name === 'to') {return 'French';}
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalled();
        });

        it('should resolve language shortcuts', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Hello';}
                    if (name === 'to') {return 'es';}  // Shortcut for Spanish
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalled();
            expect(context.log.info).toHaveBeenCalledWith(
                'Translation completed',
                expect.objectContaining({
                    targetLanguage: 'Spanish',
                }),
            );
        });

        it('should accept full language names', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Hello';}
                    if (name === 'to') {return 'German';}
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(context.log.info).toHaveBeenCalledWith(
                'Translation completed',
                expect.objectContaining({
                    targetLanguage: 'German',
                }),
            );
        });

        it('should handle source language specification', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Bonjour';}
                    if (name === 'to') {return 'English';}
                    if (name === 'from') {return 'French';}
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalled();
        });

        it('should log successful translations', async () => {
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Test message';}
                    if (name === 'to') {return 'Japanese';}
                    return null;
                });

            await translateCommand.execute(interaction, context);

            expect(context.log.info).toHaveBeenCalledWith(
                'Translation completed',
                expect.objectContaining({
                    userId: 'test-user-id',
                    targetLanguage: 'Japanese',
                }),
            );
        });
    });

    describe('autocomplete', () => {
        it('should filter languages based on input', async () => {
            const autocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue('spa'),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            await translateCommand.autocomplete(autocompleteInteraction as any);

            expect(autocompleteInteraction.respond).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Spanish (es)', value: 'Spanish' }),
                ]),
            );
        });

        it('should return all languages for empty input', async () => {
            const autocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue(''),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            await translateCommand.autocomplete(autocompleteInteraction as any);

            expect(autocompleteInteraction.respond).toHaveBeenCalled();
            const responseArgs = autocompleteInteraction.respond.mock.calls[0][0];
            expect(responseArgs.length).toBeGreaterThan(0);
        });

        it('should limit results to 25 items', async () => {
            const autocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue(''),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            await translateCommand.autocomplete(autocompleteInteraction as any);

            const responseArgs = autocompleteInteraction.respond.mock.calls[0][0];
            expect(responseArgs.length).toBeLessThanOrEqual(25);
        });

        it('should be case insensitive', async () => {
            const autocompleteInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue('FRENCH'),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            await translateCommand.autocomplete(autocompleteInteraction as any);

            expect(autocompleteInteraction.respond).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'French (fr)', value: 'French' }),
                ]),
            );
        });
    });

    describe('error handling', () => {
        it('should log errors when translation fails', async () => {
            interaction.options.getSubcommand = jest.fn().mockReturnValue('text');
            interaction.options.getString = jest.fn()
                .mockImplementation((name: string) => {
                    if (name === 'text') {return 'Test';}
                    if (name === 'to') {return 'Spanish';}
                    return null;
                });

            // Force an error by making deferReply throw
            interaction.deferReply = jest.fn().mockRejectedValue(new Error('Discord API Error'));

            await translateCommand.execute(interaction, context);

            expect(context.log.error).toHaveBeenCalledWith(
                'Translation failed',
                expect.objectContaining({
                    error: 'Discord API Error',
                }),
            );
        });
    });
});
