# Pull base image from stock node image.
FROM node:24

# Set the working directory in the container
WORKDIR /opt/app

# Copy package.json and package-lock.json (or yarn.lock if you use Yarn) to the working directory
COPY . .

# Install dependencies
RUN npm install

# Compile TypeScript to JavaScript
RUN npm run build

# Expose the port the app runs on
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
