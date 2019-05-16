const axios = require('axios');
const { oneLineTrim } = require('common-tags');
const { first, get, size } = require('lodash');

const createToken = async (client_id, secret, model) => {
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
        throw error.response;
    }
};

const renewToken = async model => {
    const clientId = await model.findOne({ where: { key: 'CLIENT_ID' } });
    const clientSecret = await model.findOne({ where: { key: 'CLIENT_SECRET' } });

    return await createToken(clientId.get('value'), clientSecret.get('value'), model);
};

const isTokenValid = async (error, model) => {
    if (error) {
        if (error.statusText === 'Unauthorized' && error.status === 401) {
            return await renewToken(model);
        }
    } else {
        throw error;
    }
};

const getUser = async (username, model) => {
    try {
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
            }
        );
        const users = response.data.data;
        if (size(users) > 1) {
            throw { code: 1, message: 'More then one user.' };
        } else if (size(users) < 1) {
            throw { code: 1, message: 'No user.' };
        } else {
            return first(users);
        }
    } catch (error) {
        if (error.code === 1) {
            throw error;
        }
        await isTokenValid(error.response, model);
        return await getUser(username, model);
    }
};

const setWebhook = async ({ userId, mode, leaseTime }, model) => {
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
            }
        );
        return response.data;
    } catch (error) {
        console.log(error);
        throw error.response;
    }
};

const validateToken = async token => {
    try {
        const response = await axios.get(
            oneLineTrim`
            https://id.twitch.tv/oauth2/validate
        `,
            {
                headers: { Authorization: 'OAuth ' + token },
            }
        );
        // * data has { client_id, scopes }
        return response;
    } catch (error) {
        throw error.response;
    }
};

const validateSubscription = async token => {
    try {
        const response = await axios.get(
            oneLineTrim`
                https://api.twitch.tv/helix/webhooks/subscriptions
            `,
            {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            }
        );
        return response.data;
    } catch (error) {
        throw error.response;
    }
};

module.exports = {
    createToken,
    validateToken,
    validateSubscription,
    getUser,
    getUserId: async (username, model) => get(await getUser(username, model), 'id'),
    setWebhook,
};
