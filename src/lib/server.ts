/* eslint-disable no-console */
import hapi from '@hapi/hapi';
import config from "config";
import { MemeGenerator } from '../utils/memeGenerator';

export default async (client: any, channel: any, embed: any, model: any) => {
    const { Twitch_Users, Twitch_Notifications } = model;
    const server = hapi.server({
        port: config.get('webhook.port'),
    });

    // TODO: Add support for secret verification.
    server.route({
        method: 'GET',
        path: '/api/webhook',
        handler: (request: any, h: any) => {
            const challenge = request.query['hub.challenge'];
            console.log(challenge);
            h.response('success').code(200);
            return challenge;
        },
    });

    server.route({
        method: 'POST',
        path: '/api/webhook',
        handler: async (request: any, h: any) => {
            if (request.payload.data) {
                console.log(request.payload.data);
                const data = request.payload.data[0];
                // const username = request.payload.data[0].user_name;
                const id = request.payload.data[0].id;
                const notification = await Twitch_Notifications.findOne({
                    where: { notification_id: id },
                });
                if (!notification) {
                    await Twitch_Notifications.create({ notification_id: id });
                    const user = await Twitch_Users.findOne({
                        where: { twitch_id: request.payload.data[0].user_id },
                    });
                    if (user) {
                        h.response('success').code(200);
                        const discord_user = client.users.get(user.user_id.toString());
                        console.log(discord_user);
                        return channel.send(
                            embed
                                .setColor('#0099ff')
                                .setTitle(data.title)
                                .setURL('https://www.twitch.tv/' + data.user_name)
                                .setDescription(`${discord_user} is ${data.type}`),
                        );
                    }
                    h.response('success').code(200);
                    return channel.send(`Unknown discord user for ${data.user_name} on twitch.`);
                }
                // Duplicate message do nothing.
            }
            h.response('success').code(200);
            return '';
        },
    });

    // Add meme testing API endpoint
    server.route({
        method: 'POST',
        path: '/api/test-meme',
        handler: async (request: any, h: any) => {
            try {
                const { templateName, topText, bottomText } = request.payload;

                console.log(`Testing meme generation: ${templateName} with texts: "${topText}", "${bottomText}"`);

                // Find the template in database
                const template = await model.MemeTemplate.findOne({
                    where: { name: templateName, is_active: true },
                });

                if (!template) {
                    return h.response({ error: 'Template not found' }).code(404);
                }

                // Generate the meme
                const imageBuffer = await MemeGenerator.generateMeme(
                    template,
                    topText || undefined,
                    bottomText || undefined,
                );

                // Return the image
                return h.response(imageBuffer).type('image/png');

            } catch (error) {
                console.error('Meme generation error:', error);
                return h.response({
                    error: 'Failed to generate meme',
                    details: error instanceof Error ? error.message : error,
                }).code(500);
            }
        },
    });

    // Add custom meme testing API endpoint
    server.route({
        method: 'POST',
        path: '/api/test-custom-meme',
        handler: async (request: any, h: any) => {
            try {
                const { imageUrl, texts } = request.payload;

                console.log(`Testing custom meme generation: ${imageUrl} with texts:`, texts);

                // Generate the custom meme
                // Assume texts is an array [topText, bottomText] or object with topText/bottomText properties
                let topText: string | undefined;
                let bottomText: string | undefined;
                
                if (Array.isArray(texts)) {
                    topText = texts[0];
                    bottomText = texts[1];
                } else if (typeof texts === 'object' && texts !== null) {
                    topText = texts.topText;
                    bottomText = texts.bottomText;
                } else if (typeof texts === 'string') {
                    // If single string, use as topText
                    topText = texts;
                }

                const imageBuffer = await MemeGenerator.generateCustomMeme(imageUrl, topText, bottomText);

                // Return the image
                return h.response(imageBuffer).type('image/png');

            } catch (error) {
                console.error('Custom meme generation error:', error);
                return h.response({
                    error: 'Failed to generate custom meme',
                    details: error instanceof Error ? error.message : error,
                }).code(500);
            }
        },
    });

    await server.start();

    console.log('Server running at:', server.info.uri);
}
