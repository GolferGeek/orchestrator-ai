#!/usr/bin/env python3
import os
import sys

# Add the project root and current directory to the path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.abspath('.'))

# Import the actual app
from main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("start:app", host="0.0.0.0", port=8000, reload=True) 