import { SlashCommandBuilder } from 'discord.js';
import speakCommand from './speak';
import { Context } from '../utils/types';
import config from 'config';

// Mock config
jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('speak command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockVoiceService: any;
    let mockMember: any;
    let mockVoiceChannel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockVoiceChannel = {
            id: 'test-voice-channel',
            name: 'Test Voice Channel',
        };

        mockMember = {
            voice: {
                channel: mockVoiceChannel,
            },
        };

        mockVoiceService = {
            isConnectedToVoice: jest.fn(),
            joinVoiceChannel: jest.fn(),
            getUserVoiceChannel: jest.fn(),
            speakText: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-owner-id', username: 'testowner' },
            guild: { id: 'test-guild-id' },
            member: mockMember,
            reply: jest.fn(),
            deferReply: jest.fn(),
            followUp: jest.fn(),
            options: {
                getString: jest.fn(),
                getBoolean: jest.fn(),
            },
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            voiceService: mockVoiceService,
        } as any;

        mockConfig.get.mockImplementation((key: string) => {
            if (key === 'owner') {return 'test-owner-id';}
            return undefined;
        });
    });

    it('should have correct command data', () => {
        expect(speakCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(speakCommand.data.name).toBe('speak');
        expect(speakCommand.data.description).toContain('Owner only');
    });

    it('should have autocomplete handler', () => {
        expect(typeof speakCommand.autocomplete).toBe('function');
    });

    describe('autocomplete', () => {
        let mockAutocompleteInteraction: any;

        beforeEach(() => {
            mockAutocompleteInteraction = {
                options: {
                    getFocused: jest.fn(),
                },
                respond: jest.fn(),
            };
        });

        it('should return all voices when query is empty', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'voice',
                value: '',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Alloy (Neutral)', value: 'alloy' },
                { name: 'Echo (Male)', value: 'echo' },
                { name: 'Fable (British Male)', value: 'fable' },
                { name: 'Onyx (Deep Male)', value: 'onyx' },
                { name: 'Nova (Female)', value: 'nova' },
                { name: 'Shimmer (Soft Female)', value: 'shimmer' },
            ]);
        });

        it('should filter voices by name', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'voice',
                value: 'echo',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Echo (Male)', value: 'echo' },
            ]);
        });

        it('should filter voices by keywords', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'voice',
                value: 'british',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Fable (British Male)', value: 'fable' },
            ]);
        });

        it('should filter by gender keywords', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'voice',
                value: 'deep',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Onyx (Deep Male)', value: 'onyx' },
            ]);
        });

        it('should filter voices by value', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'voice',
                value: 'nov',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Nova (Female)', value: 'nova' },
            ]);
        });

        it('should return all tones when tone query is empty', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'tone',
                value: '',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Neutral (Default)', value: 'neutral' },
                { name: 'Happy/Excited', value: 'happy' },
                { name: 'Sad/Melancholy', value: 'sad' },
                { name: 'Angry/Intense', value: 'angry' },
                { name: 'Calm/Soothing', value: 'calm' },
                { name: 'Mysterious/Dark', value: 'mysterious' },
                { name: 'Dramatic/Epic', value: 'dramatic' },
                { name: 'Sarcastic/Witty', value: 'sarcastic' },
            ]);
        });

        it('should filter tones by keywords', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'tone',
                value: 'excited',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).toHaveBeenCalledWith([
                { name: 'Happy/Excited', value: 'happy' },
            ]);
        });

        it('should handle non-voice and non-tone options', async () => {
            mockAutocompleteInteraction.options.getFocused.mockReturnValue({
                name: 'text',
                value: 'hello',
            });

            await speakCommand.autocomplete(mockAutocompleteInteraction);

            expect(mockAutocompleteInteraction.respond).not.toHaveBeenCalled();
        });
    });

    it('should reject non-owner users', async () => {
        mockInteraction.user.id = 'not-owner';

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: `❌ This command is restricted to the bot owner only.\n` +
                    `**Debug Info:**\n` +
                    `Your ID: \`not-owner\`\n` +
                    `Owner ID: \`test-owner-id\`\n` +
                    `Match: ❌`,
            ephemeral: true,
        });
    });

    it('should handle missing voice service', async () => {
        mockContext.voiceService = undefined;

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Voice service not initialized. Please restart the bot.',
            ephemeral: true,
        });
    });

    it('should handle text too long', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'x'.repeat(5000);} // Too long
            if (option === 'voice') {return 'alloy';}
            if (option === 'tone') {return 'neutral';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Text is too long. Maximum length is 4096 characters.',
            ephemeral: true,
        });
    });

    it('should handle invalid voice option', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'invalid-voice';}
            if (option === 'tone') {return 'neutral';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Invalid voice option. Valid voices are: alloy, echo, fable, onyx, nova, shimmer',
            ephemeral: true,
        });
    });

    it('should handle invalid tone option', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            if (option === 'tone') {return 'invalid-tone';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Invalid tone option. Valid tones are: neutral, happy, sad, angry, calm, mysterious, dramatic, sarcastic',
            ephemeral: true,
        });
    });

    it('should handle empty text', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return '';}
            if (option === 'voice') {return 'alloy';}
            if (option === 'tone') {return 'neutral';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Please provide some text to speak.',
            ephemeral: true,
        });
    });

    it('should handle missing guild', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockInteraction.guild = null;

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
        });
    });

    it('should handle join_user with no voice channel', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true); // join_user = true
        mockVoiceService.getUserVoiceChannel.mockReturnValue(null);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ You need to be in a voice channel for me to join you.',
            ephemeral: true,
        });
    });

    it('should handle join_user with voice channel join error', async () => {
        const joinError = new Error('Join failed');
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockRejectedValue(joinError);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to join voice channel: Join failed',
            ephemeral: true,
        });
    });

    it('should handle not connected to voice', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Bot is not connected to any voice channel. Use `/join` first or set `join_user` to true.',
            ephemeral: true,
        });
    });

    it('should successfully speak text', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'nova';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockVoiceService.speakText).toHaveBeenCalledWith('Hello world', 'test-guild-id', 'nova');
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully spoke text using nova voice.',
            ephemeral: true,
        });
        expect(mockContext.log.info).toHaveBeenCalledWith(
            'TTS command completed successfully',
            expect.objectContaining({
                userId: 'test-owner-id',
                guildId: 'test-guild-id',
                textLength: 11,
                voice: 'nova',
            }),
        );
    });

    it('should successfully join and speak', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return null;} // Default to alloy
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true); // join_user = true
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockResolvedValue(undefined);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockVoiceService.joinVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
        expect(mockVoiceService.speakText).toHaveBeenCalledWith('Hello world', 'test-guild-id', 'alloy');
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully spoke text using alloy voice.',
            ephemeral: true,
        });
    });

    it('should handle TTS error', async () => {
        const ttsError = new Error('TTS failed');
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockRejectedValue(ttsError);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to speak text: TTS failed',
            ephemeral: true,
        });
        expect(mockContext.log.error).toHaveBeenCalledWith(
            'TTS command failed',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: ttsError,
            }),
        );
    });

    it('should handle general errors', async () => {
        const generalError = new Error('General error');
        mockInteraction.options.getString.mockImplementation(() => {
            throw generalError;
        });

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Unexpected error in TTS command',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: generalError,
            }),
        );
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ An unexpected error occurred while processing your request.',
            ephemeral: true,
        });
    });
});