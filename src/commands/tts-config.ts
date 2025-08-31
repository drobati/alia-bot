import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import config from 'config';

function isOwner(userId: string): boolean {
    const ownerId = config.get<string>('owner');
    return userId === ownerId;
}

async function checkOwnerPermission(interaction: any): Promise<void> {
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({
            content: '❌ This command is restricted to the bot owner only.',
            ephemeral: true,
        });
        throw new Error('Unauthorized: User is not bot owner');
    }
}

const TTS_CONFIG_KEYS = {
    DEFAULT_VOICE: 'tts_default_voice',
    MAX_LENGTH: 'tts_max_length',
    RATE_LIMIT_COOLDOWN: 'tts_rate_limit_cooldown',
    ALLOWED_USERS: 'tts_allowed_users', // Future feature for allowing specific users
    AUTO_JOIN: 'tts_auto_join', // Future feature for auto-joining user's channel
};

const VOICE_CHOICES = [
    { name: 'Alloy (Neutral)', value: 'alloy' },
    { name: 'Echo (Male)', value: 'echo' },
    { name: 'Fable (British Male)', value: 'fable' },
    { name: 'Onyx (Deep Male)', value: 'onyx' },
    { name: 'Nova (Female)', value: 'nova' },
    { name: 'Shimmer (Soft Female)', value: 'shimmer' },
];

async function handleSetDefaultVoice(interaction: any, context: Context): Promise<void> {
    const voice = interaction.options.getString('voice');

    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.upsert(
            { key: TTS_CONFIG_KEYS.DEFAULT_VOICE, value: voice },
            { transaction },
        );
    });

    await interaction.reply({
        content: `✅ Default TTS voice set to **${voice}**`,
        ephemeral: true,
    });
}

async function handleSetMaxLength(interaction: any, context: Context): Promise<void> {
    const maxLength = interaction.options.getInteger('max_length');

    if (maxLength < 1 || maxLength > 4096) {
        await interaction.reply({
            content: '❌ Max length must be between 1 and 4096 characters.',
            ephemeral: true,
        });
        return;
    }

    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.upsert(
            { key: TTS_CONFIG_KEYS.MAX_LENGTH, value: maxLength.toString() },
            { transaction },
        );
    });

    await interaction.reply({
        content: `✅ TTS max text length set to **${maxLength}** characters`,
        ephemeral: true,
    });
}

async function handleShowConfig(interaction: any, context: Context): Promise<void> {
    const configs = await context.tables.Config.findAll({
        where: {
            key: Object.values(TTS_CONFIG_KEYS),
        },
    });

    const configMap = new Map(configs.map((config: any) => [config.key, config.value]));

    const defaultVoice = configMap.get(TTS_CONFIG_KEYS.DEFAULT_VOICE) || 'alloy';
    const maxLength = configMap.get(TTS_CONFIG_KEYS.MAX_LENGTH) || '4096';
    const rateLimitCooldown = configMap.get(TTS_CONFIG_KEYS.RATE_LIMIT_COOLDOWN) || '5';

    const status = context.voiceService ?
        (context.voiceService.isConnectedToVoice(interaction.guild.id) ? '🟢 Connected' : '🔴 Disconnected') :
        '🔴 Not initialized';

    const configText = [
        '**📢 TTS Configuration**',
        '',
        `**Voice Status:** ${status}`,
        `**Default Voice:** ${defaultVoice}`,
        `**Max Text Length:** ${maxLength} characters`,
        `**Rate Limit Cooldown:** ${rateLimitCooldown} seconds`,
        '',
        '*Use `/tts-config set-voice` and `/tts-config set-max-length` to modify settings.*',
    ].join('\n');

    await interaction.reply({
        content: configText,
        ephemeral: true,
    });
}

async function handleResetConfig(interaction: any, context: Context): Promise<void> {
    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.destroy({
            where: {
                key: Object.values(TTS_CONFIG_KEYS),
            },
            transaction,
        });
    });

    await interaction.reply({
        content: '✅ All TTS configuration has been reset to defaults.',
        ephemeral: true,
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('tts-config')
        .setDescription('Configure TTS settings (Owner only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show current TTS configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-voice')
                .setDescription('Set the default TTS voice')
                .addStringOption(option =>
                    option
                        .setName('voice')
                        .setDescription('Voice to use as default')
                        .setRequired(true)
                        .addChoices(...VOICE_CHOICES)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-max-length')
                .setDescription('Set maximum text length for TTS')
                .addIntegerOption(option =>
                    option
                        .setName('max_length')
                        .setDescription('Maximum characters (1-4096)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(4096)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset all TTS configuration to defaults')),

    async execute(interaction: any, context: Context) {
        const { log } = context;

        try {
            // Check if user is bot owner
            await checkOwnerPermission(interaction);

            const subcommand = interaction.options.getSubcommand();

            log.info('TTS config command executed', {
                userId: interaction.user.id,
                username: interaction.user.username,
                subcommand: subcommand,
            });

            switch (subcommand) {
                case 'show':
                    await handleShowConfig(interaction, context);
                    break;
                case 'set-voice':
                    await handleSetDefaultVoice(interaction, context);
                    break;
                case 'set-max-length':
                    await handleSetMaxLength(interaction, context);
                    break;
                case 'reset':
                    await handleResetConfig(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown subcommand',
                        ephemeral: true,
                    });
            }

        } catch (error) {
            // Handle authorization errors
            if (error instanceof Error && error.message.startsWith('Unauthorized')) {
                log.warn('Unauthorized TTS config command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing tts-config command', {
                userId: interaction.user.id,
                error: error,
            });

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            try {
                await interaction.reply({
                    content: `❌ An error occurred: ${errorMessage}`,
                    ephemeral: true,
                });
            } catch {
                // Interaction might already be replied to
                try {
                    await interaction.followUp({
                        content: `❌ An error occurred: ${errorMessage}`,
                        ephemeral: true,
                    });
                } catch {
                    // Log the error if we can't send any response
                    log.error('Failed to send error response for tts-config command');
                }
            }
        }
    },
};