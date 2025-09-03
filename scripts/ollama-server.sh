#!/bin/bash

# Server Ollama setup - 4 models for 128GB+ systems
echo "🚀 Starting Ollama Server (4 models)"

# Start each model in a separate terminal
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Starting llama3.2:latest..."
    osascript -e 'tell app "Terminal" to do script "ollama run llama3.2:latest"'
    sleep 2
    
    echo "Starting qwen3:8b..."
    osascript -e 'tell app "Terminal" to do script "ollama run qwen3:8b"'
    sleep 2
    
    echo "Starting gpt-oss:20b..."
    osascript -e 'tell app "Terminal" to do script "ollama run gpt-oss:20b"'
    sleep 2
    
    echo "Starting deepseek-r1:70b..."
    osascript -e 'tell app "Terminal" to do script "ollama run deepseek-r1:70b"'
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Starting llama3.2:latest..."
    gnome-terminal -- bash -c "ollama run llama3.2:latest; exec bash" &
    sleep 2
    
    echo "Starting qwen3:8b..."
    gnome-terminal -- bash -c "ollama run qwen3:8b; exec bash" &
    sleep 2
    
    echo "Starting gpt-oss:20b..."
    gnome-terminal -- bash -c "ollama run gpt-oss:20b; exec bash" &
    sleep 2
    
    echo "Starting deepseek-r1:70b..."
    gnome-terminal -- bash -c "ollama run deepseek-r1:70b; exec bash" &
    
else
    # Fallback - sequential start
    echo "Starting models sequentially..."
    ollama run llama3.2:latest &
    sleep 3
    ollama run qwen3:8b &
    sleep 3
    ollama run gpt-oss:20b &
    sleep 3
    ollama run deepseek-r1:70b &
fi

echo "✅ Server Ollama setup started!"
echo "Models: llama3.2:latest, qwen3:8b, gpt-oss:20b, deepseek-r1:70b"
echo "Estimated RAM usage: ~100GB"
