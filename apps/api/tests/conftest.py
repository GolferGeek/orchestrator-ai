"""Root conftest.py for all tests"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from apps.api.main import app # Main FastAPI app instance
from apps.api.auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user, TEST_API_KEY_HEADER
from apps.api.auth.schemas import SupabaseAuthUser
from supabase import Client as SupabaseClient
from apps.api.core.config import settings # ADDED: To get TEST_API_SECRET_KEY


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

# --- Test User Data ---
TEST_USER_ID = uuid.uuid4()
TEST_USER_EMAIL = "testuser@example.com"

# --- Mock Implementations for Dependencies ---
def mock_get_current_authenticated_user() -> SupabaseAuthUser:
    print(f"[CONTEST_MOCK] mock_get_current_authenticated_user called, returning user {TEST_USER_ID}")
    # Ensure all required fields by SupabaseAuthUser are present
    # Check apps/api/auth/schemas.py for SupabaseAuthUser definition
    return SupabaseAuthUser(
        id=TEST_USER_ID,
        aud="authenticated",
        role="authenticated",
        email=TEST_USER_EMAIL,
        email_confirmed_at=datetime.now(timezone.utc),
        # phone=None, # Optional
        confirmed_at=datetime.now(timezone.utc), # Alias for email_confirmed_at or phone_confirmed_at
        last_sign_in_at=datetime.now(timezone.utc),
        app_metadata={},
        user_metadata={},
        identities=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

@pytest.fixture
def mock_supabase_client() -> MagicMock:
    """Provides a fresh MagicMock for SupabaseClient for each test that needs it."""
    print("[CONTEST_MOCK] mock_supabase_client fixture creating MagicMock for SupabaseClient")
    client = MagicMock(spec=SupabaseClient)
    # You can set up default mock behaviors here if many tests share them,
    # e.g., client.auth.get_user.return_value = ... if it were used by the overridden dep
    return client

# --- Pytest Fixtures ---
@pytest.fixture
def client() -> TestClient: # Existing client fixture (presumably for unauthenticated calls)
    print("[CONTEST_FIXTURE] client fixture creating TestClient")
    # Ensure no overrides are lingering if tests are mixed
    app.dependency_overrides.clear()
    return TestClient(app)

@pytest.fixture
def authenticated_client(mock_supabase_client: MagicMock) -> TestClient:
    """Provides a TestClient that authenticates using the Test API Key."""
    print(f"[CONTEST_FIXTURE] authenticated_client fixture preparing Test API Key auth. Using mock_supabase_client: {id(mock_supabase_client)}")
    
    # Clear any existing overrides first
    app.dependency_overrides.clear() 

    # Override get_supabase_client_as_current_user to return the MagicMock Supabase client.
    # This is still useful as even with API key auth, we might want to mock DB interactions for the resolved test user.
    app.dependency_overrides[get_supabase_client_as_current_user] = lambda: mock_supabase_client
    
    test_client = TestClient(app)
    
    if settings.TEST_API_SECRET_KEY:
        print(f"[CONTEST_FIXTURE] Setting {TEST_API_KEY_HEADER} for authenticated_client.")
        test_client.headers[TEST_API_KEY_HEADER] = settings.TEST_API_SECRET_KEY
    else:
        print("[CONTEST_FIXTURE] WARNING: TEST_API_SECRET_KEY not set in environment. Test API Key auth will not work.")
        # Optionally, raise an error or skip tests that require this if the key isn't set.
        # For now, it will proceed, and get_current_authenticated_user will deny access if JWT is also missing.

    yield test_client
    
    print("[CONTEST_FIXTURE] authenticated_client fixture clearing overrides after test.")
    app.dependency_overrides.clear() 