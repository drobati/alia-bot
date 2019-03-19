# Kill currently running app
forever stop index.js

# This file will be sourced.
source /root/load_bot_token

# Get latest from master
git pull

# Install dependencies
npm i

# Start app
forever start index.js

