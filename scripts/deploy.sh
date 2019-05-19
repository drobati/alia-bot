# Kill currently running app
forever stop ../index.js

# This file will be sourced.
source /root/load_bot_token

# Get latest from master
git pull

# Reinstall dependencies
npm ci

# Start app
forever start -o out.log -e err.log ../index.js

