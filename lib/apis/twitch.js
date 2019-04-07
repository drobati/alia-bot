const axios = require('axios');
const { oneLineTrim } = require('common-tags');
const { first, get, toLength } = require('lodash');

const getUser = async (username, token) => {
    try {
        const response = axios.get(
            oneLineTrim`
                https://api.twitch.tv/helix/users
                ?login=${username}
            `,
            {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            }
        );
        const users = response.data.data;
        if (toLength(users) > 1) {
            throw 'More then one user.';
        } else if (toLength(users) < 1) {
            throw 'No user.';
        } else {
            return first(users);
        }
    } catch (error) {
        throw error.response;
    }
};

module.exports = {
    createToken: async (client_id, secret) => {
        try {
            const response = await axios.post(oneLineTrim`
                https://id.twitch.tv/oauth2/token
                ?client_id=${client_id}
                &client_secret=${secret}
                &grant_type=client_credentials
            `);
            // * data has { access_token, expires_in, token_type }
            return response.data.access_token;
        } catch (error) {
            throw error.response;
        }
    },
    validateToken: async token => {
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
    },
    webhook: async ({ userId, mode, leaseTime, myAddress, clientId }) => {
        try {
            const response = await axios.post(
                oneLineTrim`
                    https://api.twitch.tv/helix/webhooks/hub
                `,
                {
                    headers: { 'Client-ID': clientId, 'Content-Type': 'application/json' },
                    data: {
                        'hub.callback': `http://${myAddress}/api/webhook`,
                        'hub.mode': mode,
                        'hub.topic': `https://api.twitch.tv/helix/streams?user_id=${userId}`,
                        'hub.lease_seconds': leaseTime,
                    },
                }
            );
            return response.data;
        } catch (error) {
            throw error.response;
        }
    },
    validateSubscription: async token => {
        try {
            const response = axios.get(
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
    },
    getUser: getUser,
    getUserId: (username, token) => get(getUser(username, token), 'id'),
};
