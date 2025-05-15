"""Root conftest.py for all tests"""
import os
from dotenv import load_dotenv

def pytest_configure(config):
    """Configure test environment before any test modules are imported."""
    # Load environment variables from .env file if it exists
    load_dotenv()
    
    # Set default test environment variables if not already set
    if not os.getenv("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = "test-api-key-dummy"  # Dummy value for tests 