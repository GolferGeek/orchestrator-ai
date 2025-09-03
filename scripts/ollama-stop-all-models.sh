#!/bin/bash

# Stop all running Ollama models
echo "🛑 Stopping all Ollama models..."

# Kill all ollama run processes
OLLAMA_PIDS=$(ps aux | grep "ollama run" | grep -v grep | awk '{print $2}')

if [ -z "$OLLAMA_PIDS" ]; then
    echo "ℹ️  No Ollama run processes found"
else
    echo "Found Ollama processes: $OLLAMA_PIDS"
    echo $OLLAMA_PIDS | xargs kill 2>/dev/null
    echo "✅ Stopped all Ollama run processes"
fi

# Wait a moment for cleanup
sleep 2

# Check what's still loaded
echo ""
echo "Current status:"
ollama ps
