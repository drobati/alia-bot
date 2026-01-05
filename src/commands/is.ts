import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Context } from "../types";

export default {
    data: new SlashCommandBuilder()
        .setName('is')
        .setDescription('Describe your friends with roles and labels.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('add')
            .setDescription('Add a description to a user.')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('The user to describe')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('description')
                .setDescription('The description to add (e.g., "a badass guitarist")')
                .setRequired(true)
                .setMaxLength(255)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('remove')
            .setDescription('Remove a description from a user.')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('The user to remove description from')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('description')
                .setDescription('The description to remove')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('who')
            .setDescription('See what descriptions a user has.')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('The user to look up')
                .setRequired(true))),

    async autocomplete(interaction: any, context: Context) {
        const { tables, log } = context;
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'description') {
            try {
                const user = interaction.options.get('user');
                const guildId = interaction.guildId;

                if (!user?.value || !guildId) {
                    return await interaction.respond([]);
                }

                // Get all descriptions for this user in this guild
                const descriptions = await tables.UserDescriptions.findAll({
                    where: {
                        guild_id: guildId,
                        user_id: user.value,
                    },
                    limit: 25,
                });

                const focusedValue = focusedOption.value.toLowerCase();
                const choices = descriptions
                    .filter((d: any) => d.description.toLowerCase().includes(focusedValue))
                    .map((d: any) => ({
                        name: d.description.length > 100
                            ? d.description.substring(0, 97) + '...'
                            : d.description,
                        value: d.description,
                    }));

                await interaction.respond(choices.slice(0, 25));
            } catch (error) {
                log.error({ error }, 'Error in /is autocomplete');
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;

        try {
            switch (interaction.options.getSubcommand()) {
                case 'add':
                    await addDescription(interaction, context);
                    break;
                case 'remove':
                    await removeDescription(interaction, context);
                    break;
                case 'who':
                    await whoIs(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: "I don't recognize that command.",
                        ephemeral: true,
                    });
            }
        } catch (error) {
            log.error({ error }, 'Error executing /is command');
            if (!interaction.replied) {
                await interaction.reply({
                    content: "Sorry, there was an error processing your request.",
                    ephemeral: true,
                });
            }
        }
    },
};

const addDescription = async (interaction: ChatInputCommandInteraction, context: Context) => {
    const { tables } = context;
    const user = interaction.options.getUser('user', true);
    const description = interaction.options.getString('description', true).trim();
    const guildId = interaction.guildId;
    const creatorId = interaction.user.id;

    if (!guildId) {
        return await interaction.reply({
            content: "This command can only be used in a server.",
            ephemeral: true,
        });
    }

    // Check if this exact description already exists
    const existing = await tables.UserDescriptions.findOne({
        where: {
            guild_id: guildId,
            user_id: user.id,
            description: description,
        },
    });

    if (existing) {
        return await interaction.reply({
            content: `I already know that ${user.displayName} is ${description}.`,
            ephemeral: true,
        });
    }

    // Add the description
    await tables.UserDescriptions.create({
        guild_id: guildId,
        user_id: user.id,
        description: description,
        creator_id: creatorId,
    });

    // Check if describing themselves
    if (user.id === interaction.user.id) {
        await interaction.reply(`Ok, you are ${description}.`);
    } else {
        await interaction.reply(`Ok, ${user.displayName} is ${description}.`);
    }
};

const removeDescription = async (interaction: ChatInputCommandInteraction, context: Context) => {
    const { tables } = context;
    const user = interaction.options.getUser('user', true);
    const description = interaction.options.getString('description', true).trim();
    const guildId = interaction.guildId;

    if (!guildId) {
        return await interaction.reply({
            content: "This command can only be used in a server.",
            ephemeral: true,
        });
    }

    // Prevent users from removing their own descriptions (unless they're the creator)
    // Actually, let's allow anyone to remove descriptions for fun
    const existing = await tables.UserDescriptions.findOne({
        where: {
            guild_id: guildId,
            user_id: user.id,
            description: description,
        },
    });

    if (!existing) {
        return await interaction.reply({
            content: `${user.displayName} isn't ${description}.`,
            ephemeral: true,
        });
    }

    await existing.destroy();
    await interaction.reply(`Ok, ${user.displayName} is no longer ${description}.`);
};

const whoIs = async (interaction: ChatInputCommandInteraction, context: Context) => {
    const { tables } = context;
    const user = interaction.options.getUser('user', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return await interaction.reply({
            content: "This command can only be used in a server.",
            ephemeral: true,
        });
    }

    const descriptions = await tables.UserDescriptions.findAll({
        where: {
            guild_id: guildId,
            user_id: user.id,
        },
        order: [['created_at', 'DESC']],
    });

    if (descriptions.length === 0) {
        // Check if asking about the bot
        if (user.id === interaction.client.user?.id) {
            return await interaction.reply("The best. 😎");
        }
        return await interaction.reply(`${user.displayName}? Nothing to me.`);
    }

    // Format the descriptions
    const descList = descriptions.map((d: any) => d.description);

    // Use semicolons if any description contains commas
    const joiner = descList.some((d: string) => d.includes(',')) ? '; ' : ', ';
    const formattedList = descList.join(joiner);

    await interaction.reply(`${user.displayName} is ${formattedList}.`);
};
