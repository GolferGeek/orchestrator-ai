#!/bin/bash

# Add/run a single Ollama model
if [ -z "$1" ]; then
    echo "❌ Error: Please specify a model name"
    echo "Usage: npm run ollama:add <model-name>"
    echo "Example: npm run ollama:add qwen3:8b"
    exit 1
fi

MODEL_NAME="$1"
echo "🚀 Starting Ollama model: $MODEL_NAME"

# Start the model in a new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Opening new terminal for $MODEL_NAME..."
    osascript -e "tell app \"Terminal\" to do script \"ollama run $MODEL_NAME\""
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Opening new terminal for $MODEL_NAME..."
    gnome-terminal -- bash -c "ollama run $MODEL_NAME; exec bash" &
else
    # Fallback - run in background
    echo "Starting $MODEL_NAME in background..."
    ollama run "$MODEL_NAME" &
fi

echo "✅ Started $MODEL_NAME"
echo ""
echo "Check status with: ollama ps"
