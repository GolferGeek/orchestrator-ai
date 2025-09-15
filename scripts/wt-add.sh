#!/bin/bash

# Script to add a new Windows Terminal tab with port-based naming
# Usage: ./scripts/wt-add.sh
# Reads ports from .env file

# Load environment variables to get ports
if [ -f ".env" ]; then
    # Extract API_PORT from .env
    API_PORT=$(grep "^API_PORT=" .env | cut -d '=' -f2)
    WEB_PORT=$(grep "^WEB_PORT=" .env | cut -d '=' -f2)
    
    if [ -z "$API_PORT" ] || [ -z "$WEB_PORT" ]; then
        echo "Error: API_PORT and WEB_PORT must be defined in .env file"
        echo "Please add:"
        echo "API_PORT=9000"
        echo "WEB_PORT= 9001"
        exit 1
    fi
else
    echo "Error: .env file not found"
    echo "Please create .env file with API_PORT and WEB_PORT defined"
    exit 1
fi

# Tab name with port from .env
TAB_NAME="Orch-port-${API_PORT}"

# Get current directory name (for worktree identification)
CURRENT_DIR=$(basename "$PWD")

echo "Starting environment with API_PORT=${API_PORT}, WEB_PORT=${WEB_PORT}"

# Check if we're using Windows Terminal
if command -v wt.exe &> /dev/null; then
    echo "Opening new Windows Terminal tab: ${TAB_NAME}"
    wt.exe -w 0 new-tab --title "${TAB_NAME}" -d "$PWD" bash -c "./start-dev-local.sh"
elif command -v wt &> /dev/null; then
    echo "Opening new Windows Terminal tab: ${TAB_NAME}"
    wt -w 0 new-tab --title "${TAB_NAME}" -d "$PWD" bash -c "./start-dev-local.sh"
else
    echo "Windows Terminal not found. Setting terminal title instead..."
    # For other terminals, try to set the title
    echo -e "\033]0;${TAB_NAME}\007"
    ./start-dev-local.sh
fi