# Before you run this $BOT_TOKEN should echo the token
docker build -t alia-bot/discord-bot:latest --build-arg BOT_TOKEN --build-arg DB_HOST .