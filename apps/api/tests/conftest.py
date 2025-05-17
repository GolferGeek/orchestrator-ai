"""Root conftest.py for all tests"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import pytest

def pytest_configure(config):
    """Configure test environment before any test modules are imported."""
    project_root = Path(__file__).resolve().parents[3]
    if str(project_root) not in sys.path:
        sys.path.append(str(project_root))

    load_dotenv()
    if not os.getenv("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = "test-api-key-dummy"  # Dummy value for tests

    """Register custom markers."""
    config.addinivalue_line("markers", "e2e: marks tests as end-to-end tests") 