#!/bin/bash
# Quick script to kill process on port 8080

PORT=${1:-8080}
echo "Killing process on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Port $PORT is now free"
else
    echo "ℹ️  No process found on port $PORT"
fi

