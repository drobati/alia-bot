import axios from "axios";
import { oneLineTrim } from "common-tags";
import { first, get } from "lodash";

const createToken = async (client_id: any, secret: any, model: any) => {
    const record = await model.findOne({ where: { key: 'TOKEN' } });
    try {
        const response = await axios.post(oneLineTrim`
            https://id.twitch.tv/oauth2/token
            ?client_id=${client_id}
            &client_secret=${secret}
            &grant_type=client_credentials
        `);
        // * data has { access_token, expires_in, token_type }
        if (!record) {
            await model.create({ key: 'TOKEN', value: response.data.access_token });
        } else {
            await record.update({ key: 'TOKEN', value: response.data.access_token });
        }
    } catch (error) {
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        throw error.response;
    }
};

const renewToken = async (model: any) => {
    const clientId = await model.findOne({ where: { key: 'CLIENT_ID' } });
    const clientSecret = await model.findOne({ where: { key: 'CLIENT_SECRET' } });

    return await createToken(clientId.get('value'), clientSecret.get('value'), model);
};

interface User {
    id: string;
    login: string;
    display_name: string;
    type: string;
    broadcaster_type: string;
    description: string;
    profile_image_url: string;
    offline_image_url: string;
    view_count: number;
    email: string;
}

/**
 * Get user data from Twitch API
 * @param username
 * @param model
 * @returns {Promise<User>}
 */
const getUser = async (username: any, model: any): Promise<User> => {
    const token = await model.findOne({ where: { key: 'TOKEN' } });
    const response = await axios.get(
        oneLineTrim`
            https://api.twitch.tv/helix/users
            ?login=${username}
        `,
        {
            headers: {
                Authorization: 'Bearer ' + token.get('value'),
            },
        },
    );
    const users = response.data.data;
    return first(users) as User;
};

const setWebhook = async ({
    userId,
    mode,
    leaseTime,
}: any, model: any, log: any) => {
    const address = await model.findOne({ where: { key: 'ADDRESS' } });
    const clientId = await model.findOne({ where: { key: 'CLIENT_ID' } });
    try {
        const response = await axios.post(
            oneLineTrim`
                https://api.twitch.tv/helix/webhooks/hub
            `,
            {
                'hub.callback': `http://${address.get('value')}/api/webhook`,
                'hub.mode': mode,
                'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
                'hub.lease_seconds': leaseTime,
            },
            {
                headers: {
                    'Client-ID': clientId.get('value'),
                    'Content-Type': 'application/json',
                },
            },
        );
        return response.data;
    } catch (error) {
        log.error(error);
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        throw error.response;
    }
};

const validateToken = async (token: any) => {
    try {
        return await axios.get(
            oneLineTrim`
            https://id.twitch.tv/oauth2/validate
        `,
            {
                headers: { Authorization: 'OAuth ' + token },
            },
        );
    } catch (error) {
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        throw error.response;
    }
};

const validateSubscription = async (token: any) => {
    try {
        const response = await axios.get(
            oneLineTrim`
                https://api.twitch.tv/helix/webhooks/subscriptions
            `,
            {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            },
        );
        return response.data;
    } catch (error) {
        // @ts-expect-error TS(2571): Object is of type 'unknown'.
        throw error.response;
    }
};

export default {
    createToken,
    renewToken,
    validateToken,
    validateSubscription,
    getUser,
    getUserId: async (username: any, model: any) => get(await getUser(username, model), 'id'),
    setWebhook,
};
