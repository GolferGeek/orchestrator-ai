#!/bin/bash
# Set the Python path to include the project root
export PYTHONPATH="$PWD:$PYTHONPATH"

echo "Python path set to: $PYTHONPATH"

# Run the FastAPI server
cd apps/api/v1
uvicorn main:app --reload
