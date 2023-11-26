import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import twitchCommand from "./twitch";
import api from "../lib/apis/twitch";

jest.mock('../lib/apis/twitch');

describe('commands/twitch', () => {
    let interaction: any, context: any, Twitch_Users: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Twitch_Users = createTable();
        context.tables.Twitch_Users = Twitch_Users;

        // Mock API calls
        (api.getUserId as jest.Mock).mockImplementation(async (username: any) => {
            if (username === 'fake-user') {
                return 'fake-user-id';
            } else {
                return undefined;
            }
        });
        (api.setWebhook as jest.Mock).mockResolvedValue('');
    });

    it('responds to subscribe with an existing Twitch user', async () => {
        interaction.options.getSubcommand.mockReturnValue('subscribe');
        interaction.options.getString.mockReturnValue('fake-user');

        await twitchCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('Subscription started.');
        expect(Twitch_Users.create).toHaveBeenCalledWith({
            user_id: 'fake-user-id',
            twitch_id: 'fake-user-id',
            twitch_username: 'fake-user',
        });
    });

    it('responds to subscribe with a non-existent Twitch user', async () => {
        interaction.options.getSubcommand.mockReturnValue('subscribe');
        interaction.options.getString.mockReturnValue('fake-nothing');

        await twitchCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('User not found.');
    });

    it('responds to subscribe when the user is already registered', async () => {
        interaction.options.getSubcommand.mockReturnValue('subscribe');
        interaction.options.getString.mockReturnValue('fake-user');
        Twitch_Users.findOne.mockResolvedValue(true);

        await twitchCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('User is already registered.');
    });

    it('responds to unsubscribe when the user is registered', async () => {
        interaction.options.getSubcommand.mockReturnValue('unsubscribe');
        Twitch_Users.findOne.mockResolvedValue({
            twitch_id: 'fake-twitch-id',
            destroy: jest.fn().mockResolvedValue(true),
            twitch_username: 'fake-user',
        });

        await twitchCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('Unsubscribed from fake-user.');
    });

    it('responds to unsubscribe when the user is not registered', async () => {
        interaction.options.getSubcommand.mockReturnValue('unsubscribe');
        Twitch_Users.findOne.mockResolvedValue(null);

        await twitchCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('User is not subscribed.');
    });
});
