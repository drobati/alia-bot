# Pull base image from stock node image.
FROM node:11.9.0

# Maintainer
MAINTAINER Derek Robati <derek.robati@gmail.com>

# Make app directory
RUN mkdir /opt/app

# Add the current working folder to the /opt/src dir
ADD . /opt/app

# Set the current working directory to the new mapped folder.
WORKDIR /opt/app

# Install package.json
RUN npm i

# Start the app
CMD [ "node", "app.js" ]