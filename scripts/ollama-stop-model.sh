#!/bin/bash

# Stop a running Ollama model (without deleting the downloaded files)
if [ -z "$1" ]; then
    echo "❌ Error: Please specify a model name"
    echo "Usage: npm run ollama:remove <model-name>"
    echo "Example: npm run ollama:remove qwen3:8b"
    echo "Note: This stops the model but keeps the downloaded files"
    exit 1
fi

MODEL_NAME="$1"
echo "🛑 Stopping Ollama model: $MODEL_NAME"

# Find and stop any running instances of this model
echo "Looking for running instances of $MODEL_NAME..."
RUNNING_PIDS=$(ps aux | grep "ollama run $MODEL_NAME" | grep -v grep | awk '{print $2}')

if [ ! -z "$RUNNING_PIDS" ]; then
    echo "Found running processes: $RUNNING_PIDS"
    echo $RUNNING_PIDS | xargs kill 2>/dev/null
    sleep 2
    echo "✅ Successfully stopped $MODEL_NAME"
else
    echo "ℹ️  No running instances of $MODEL_NAME found"
fi

echo ""
echo "Current status:"
ollama ps
