# Pull base image from stock node image.
FROM node:16

# Make app directory
RUN mkdir /opt/app

# Add the current working folder to the /opt/src dir
# TODO: Clean this up, theres a bunch of stuff that doesn't need to be included.
ADD . /opt/app

# Set the current working directory to the new mapped folder.
WORKDIR /opt/app

# Install package.json
RUN npm i

# Expose Twitch Webhooks
EXPOSE 8080

# Start the app
CMD npm start