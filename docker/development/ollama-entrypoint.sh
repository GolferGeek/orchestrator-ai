#!/bin/bash

# Start Ollama server in background
/bin/ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama server to start..."
sleep 10

# Pull specified models if they don't exist
if [ ! -z "$OLLAMA_MODELS" ]; then
    IFS=',' read -ra MODELS <<< "$OLLAMA_MODELS"
    for model in "${MODELS[@]}"; do
        echo "Checking if model $model exists..."
        if ! /bin/ollama list | grep -q "$model"; then
            echo "Pulling model $model..."
            /bin/ollama pull "$model"
        else
            echo "Model $model already exists, skipping..."
        fi
    done
fi

echo "Ollama setup complete!"

# Keep the container running
wait