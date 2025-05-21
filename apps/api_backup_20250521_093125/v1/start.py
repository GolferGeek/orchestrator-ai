#!/usr/bin/env python3
import os
import sys

# Add the project root to the path
# Correctly identify the project root (two levels up from apps/api)
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
print(f"[{__file__}] Project root added to sys.path: {project_root}")
print(f"[{__file__}] Current sys.path: {sys.path}")

# Adding the current directory (apps/api) is usually not needed if project_root is correct
# and imports are structured as `from shared...` or `from apps.api...`
# However, keeping it for now if it serves other purposes in your setup.
sys.path.insert(0, os.path.abspath('.')) # This refers to apps/api when start.py is run

# Import the actual app
from apps.api.main import app # This should now work as main.py can find shared.

if __name__ == "__main__":
    print(f"[{__file__}] Attempting to start Uvicorn with app: {app}")
    import uvicorn
    uvicorn.run("start:app", host="0.0.0.0", port=8000, reload=True) 