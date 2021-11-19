# Pull base image from stock node image.
FROM node:16

# Make app directory
RUN mkdir /opt/app

# Add the current working folder to the /opt/src dir
ADD . /opt/app

# Set the current working directory to the new mapped folder.
WORKDIR /opt/app

# Install package.json
RUN npm i

# Start the app
CMD npm start