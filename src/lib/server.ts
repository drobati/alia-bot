/* eslint-disable no-console */
import hapi from '@hapi/hapi';
import config from "config";
import { Op } from 'sequelize';
import { MemeGenerator } from '../utils/memeGenerator';
import { ChartJSNodeCanvas } from "chartjs-node-canvas";

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

    // Chart generation utility function
    const generateSparkline = async (scores: any[]) => {
        const scale = 2;
        const width = 400 / scale;
        const height = 200 / scale;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

        const data = {
            labels: scores.map((score: any) => score.timestamp.toLocaleString()),
            datasets: [
                // Shadow/outline dataset (semi-transparent black outline)
                {
                    label: 'Roll Call Score Shadow',
                    data: scores.map((score: any) => score.value),
                    borderColor: 'rgba(0, 0, 0, 0.7)',
                    fill: false,
                    tension: 0.2,
                    borderWidth: 4,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                },
                // Main line dataset (bright blue line)
                {
                    label: 'Roll Call Score',
                    data: scores.map((score: any) => score.value),
                    borderColor: 'rgba(120, 200, 255, 1)', // Brighter blue for better visibility
                    fill: false,
                    tension: 0.2,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                },
            ],
        };

        const options = {
            layout: {
                padding: {
                    top: 5,
                    bottom: 5,
                    left: 5,
                    right: 5,
                },
            },
            scales: {
                x: { display: false },
                y: { display: false },
            },
            plugins: {
                legend: { display: false },
            },
            devicePixelRatio: 1,
        };

        return chartJSNodeCanvas.renderToBuffer({ type: 'line', data, options });
    };

    // Add RC graph testing API endpoint
    server.route({
        method: 'GET',
        path: '/api/test-rc-graph/{username}',
        handler: async (request: any, h: any) => {
            try {
                const username = request.params.username;
                console.log(`Testing RC graph generation for: ${username}`);

                // Fetch scores from database (same logic as rollcall command)
                const allScores = await model.RollCall.findAll({
                    where: {
                        username,
                        timestamp: { [Op.gte]: new Date(0) },
                    },
                    order: [['timestamp', 'ASC']],
                });

                // Get the most recent 10 scores (reverse to show newest first, then slice)
                const scores = allScores.slice(-10);

                if (scores.length === 0) {
                    return h.response({ error: `No scores found for ${username}` }).code(404);
                }

                console.log(`Found ${scores.length} scores for ${username}`);

                // Generate the chart
                const chartBuffer = await generateSparkline(scores);

                // Return the image
                return h.response(chartBuffer).type('image/png');

            } catch (error) {
                console.error('RC graph generation error:', error);
                return h.response({
                    error: 'Failed to generate RC graph',
                    details: error instanceof Error ? error.message : error,
                }).code(500);
            }
        },
    });

    // Add RC graph testing API endpoint with sample data
    server.route({
        method: 'GET',
        path: '/api/test-rc-graph-sample',
        handler: async (request: any, h: any) => {
            try {
                console.log('Testing RC graph generation with sample data');

                // Create sample data to test chart generation
                const sampleScores = [
                    { value: 10, timestamp: new Date('2025-08-23T11:46:05') },
                    { value: 8, timestamp: new Date('2025-08-24T10:30:00') },
                    { value: 9, timestamp: new Date('2025-08-25T09:15:00') },
                    { value: 7, timestamp: new Date('2025-08-26T14:20:00') },
                    { value: 6, timestamp: new Date('2025-08-27T16:45:00') },
                ];

                console.log(`Generated ${sampleScores.length} sample scores`);

                // Generate the chart
                const chartBuffer = await generateSparkline(sampleScores);

                // Return the image
                return h.response(chartBuffer).type('image/png');

            } catch (error) {
                console.error('RC graph generation error:', error);
                return h.response({
                    error: 'Failed to generate RC graph',
                    details: error instanceof Error ? error.message : error,
                }).code(500);
            }
        },
    });

    // Add RC score testing endpoint
    server.route({
        method: 'POST',
        path: '/api/add-rc-score',
        handler: async (request: any, h: any) => {
            try {
                const { username, score } = request.payload;
                console.log(`Adding RC score for ${username}: ${score}`);

                if (score < 0 || score > 100) {
                    return h.response({ error: 'Score must be between 0 and 100' }).code(400);
                }

                await model.RollCall.create({
                    username: username,
                    value: score,
                    timestamp: new Date(),
                });

                return h.response({ success: true, message: `Added score ${score} for ${username}` }).code(200);

            } catch (error) {
                console.error('Add RC score error:', error);
                return h.response({
                    error: 'Failed to add RC score',
                    details: error instanceof Error ? error.message : error,
                }).code(500);
            }
        },
    });

    await server.start();

    console.log('Server running at:', server.info.uri);
}
