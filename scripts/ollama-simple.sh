#!/bin/bash

# Simple Ollama setup - 1 model for 16GB systems
echo "🚀 Starting Ollama Simple (1 model)"

# Start llama3.2:latest in a new terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "ollama run llama3.2:latest"'
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    gnome-terminal -- bash -c "ollama run llama3.2:latest; exec bash"
else
    # Fallback - run in current terminal
    echo "Starting llama3.2:latest..."
    ollama run llama3.2:latest
fi

echo "✅ Simple Ollama setup started!"
echo "Models: llama3.2:latest"
