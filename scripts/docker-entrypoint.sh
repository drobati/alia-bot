#!/bin/sh
set -e

echo "Running database migrations..."
npm run sequelize-cli -- db:migrate

echo "Starting application..."
exec npm start
