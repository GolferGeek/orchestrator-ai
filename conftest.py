# /Users/golfergeek/projects/golfergeek/orchestrator-ai/conftest.py
import os
from pathlib import Path
from dotenv import load_dotenv
import sys

print("[ROOT_CONFTEST_DEBUG] Root conftest.py loaded.")

# Define project root relative to this conftest.py file
# This conftest.py is at the project root.
PROJECT_ROOT = Path(__file__).resolve().parent
DOTENV_PATH = PROJECT_ROOT / ".env"

print(f"[ROOT_CONFTEST_DEBUG] Attempting to load .env from: {DOTENV_PATH}")
if DOTENV_PATH.exists():
    load_dotenv(dotenv_path=DOTENV_PATH, override=True)
    print(f"[ROOT_CONFTEST_DEBUG] SUCCESS: .env file loaded from {DOTENV_PATH}.")
    print(f"[ROOT_CONFTEST_DEBUG] TEST_API_SECRET_KEY from os.environ after load: {os.getenv('TEST_API_SECRET_KEY')}")
else:
    print(f"[ROOT_CONFTEST_DEBUG] WARNING: .env file NOT FOUND at {DOTENV_PATH}.")

# You can put other project-wide pytest hooks or fixtures here if needed.
# For example, ensuring the project root is in sys.path if necessary,
# though PDM/pytest usually handle this if tests are run from the root.
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
    print(f"[ROOT_CONFTEST_DEBUG] Inserted PROJECT_ROOT ({PROJECT_ROOT}) into sys.path.") 