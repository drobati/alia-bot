# alia-bot

Discord bot for arrakis.

## usage

Running this locally as a dev currently requires a bot token. I followed this [discordjs guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html).

Set an environmental variable `BOT_TOKEN`, and node will use it upon `npm start` to run the bot.

## setup

So far I've had mild success with `npm i`. Usually libsodium or something fails, but those dependencies aren't required.

## test

`npm test` will start Jest runner.

`npm run lint` will start eslint.

## goals

-   to recreate hayt with as much parity as possible
-   possible architecture might include smaller services making up the full bot.
-   80% unit test coverage
