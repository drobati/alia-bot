import { createContext, createInteraction } from "../utils/testHelpers";
import qrcodeCommand from "./qrcode";
import qrcode from "qrcode";

jest.mock('qrcode');

describe('commands/qrcode', () => {
    let interaction: any, context: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        qrcode.toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,aGVsbG8=');
    });

    it('should respond with QR code for a valid URL', async () => {
        interaction.options.getString.mockReturnValue('https://google.com');

        await qrcodeCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            files: expect.any(Array),
        }));
        expect(qrcode.toDataURL).toHaveBeenCalledWith('https://google.com');
    });

    it('should handle URLs without protocol', async () => {
        interaction.options.getString.mockReturnValue('google.com');

        await qrcodeCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            files: expect.any(Array),
        }));
        expect(qrcode.toDataURL).toHaveBeenCalledWith('https://google.com');
    });

    it('should respond with error for invalid URL', async () => {
        interaction.options.getString.mockReturnValue('invalid-url');

        await qrcodeCommand.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Please provide a valid URL.',
            ephemeral: true,
        });
    });
});
