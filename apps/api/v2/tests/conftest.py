import pytest

@pytest.fixture(scope="session")
def api_base_url():
    return "http://localhost:8001"  # Adjust if your v2 API runs on a different port/host (e.g., 8001 for v2) 