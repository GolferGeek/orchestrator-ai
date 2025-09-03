#!/bin/bash

# Medium Ollama setup - 2 models for 32-64GB systems
echo "🚀 Starting Ollama Medium (2 models)"

# Start each model in a separate terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Starting llama3.2:latest..."
    osascript -e 'tell app "Terminal" to do script "ollama run llama3.2:latest"'
    sleep 2
    
    echo "Starting qwen3:8b..."
    osascript -e 'tell app "Terminal" to do script "ollama run qwen3:8b"'
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Starting llama3.2:latest..."
    gnome-terminal -- bash -c "ollama run llama3.2:latest; exec bash" &
    sleep 2
    
    echo "Starting qwen3:8b..."
    gnome-terminal -- bash -c "ollama run qwen3:8b; exec bash" &
    
else
    # Fallback - sequential start
    echo "Starting models sequentially..."
    ollama run llama3.2:latest &
    sleep 3
    ollama run qwen3:8b &
fi

echo "✅ Medium Ollama setup started!"
echo "Models: llama3.2:latest, qwen3:8b"
