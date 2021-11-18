# Pull base image from stock node image.
FROM node:12.18.3

# Make app directory
RUN mkdir /opt/app

# Add the current working folder to the /opt/src dir
ADD . /opt/app

# Set the current working directory to the new mapped folder.
WORKDIR /opt/app

# Install package.json
RUN npm i

ARG BOT_TOKEN

ENV BOT_TOKEN=${BOT_TOKEN}

ARG DB_HOST=localhost

ENV DB_HOST=${DB_HOST}

# Start the app
CMD [ "node", "index.js" ]