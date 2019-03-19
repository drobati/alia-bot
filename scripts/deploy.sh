# Kill currently running app
forever stop ../index.js

# This file will be sourced.
source /root/load_bot_token

# Get latest from master
git pull

# Reinstall dependencies
# Note: Might not be necessary yet. Looking into it.
#npm ci

# Start app
forever start ../index.js

