#!/bin/bash

# Navigate to the API directory
cd "$(dirname "$0")/../apps/api" || exit

# Check if virtual environment exists, if not create it
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Start the API
echo "Starting API server..."
python3 start.py

# Deactivate when done
deactivate 