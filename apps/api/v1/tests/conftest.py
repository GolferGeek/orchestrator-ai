"""Root conftest.py for all tests"""
# import sys # REMOVED - Handled by root conftest or pytest/pdm
# from pathlib import Path # REMOVED
# import os # REMOVED
# from dotenv import load_dotenv # REMOVED - Pydantic Settings in config.py will handle .env loading

# # --- ABSOLUTELY EARLIEST DOTENV LOAD --- # REMOVED
# _project_root_for_dotenv = Path(__file__).resolve().parents[4]
# _dotenv_path = _project_root_for_dotenv / ".env"
# print(f"[CONTEST_DEBUG_ULTRA_EARLY_DOTENV] Attempting to load .env from: {_dotenv_path}")
# dotenv_loaded_successfully = load_dotenv(dotenv_path=_dotenv_path, override=True)
# print(f"[CONTEST_DEBUG_ULTRA_EARLY_DOTENV] load_dotenv success: {dotenv_loaded_successfully}. TEST_API_SECRET_KEY from os.environ after load: {os.getenv('TEST_API_SECRET_KEY')}")
# # --- END ABSOLUTELY EARLIEST DOTENV LOAD ---

import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock
import httpx
from uuid import uuid4 # For generating mock UUIDs

# --- Path Setup --- REMOVED (should be handled by pytest discovering root conftest or pdm)
# _current_file_path = Path(__file__).resolve()
# _project_root = _current_file_path.parents[4] 
# if str(_project_root) not in sys.path:
#     sys.path.insert(0, str(_project_root))
# --- End Path Setup ---

# Now, imports from 'apps' should work
from fastapi.testclient import TestClient
from apps.api.v1.main import app # Main FastAPI app instance for V1
from apps.api.v1.auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user, TEST_API_KEY_HEADER
from apps.api.v1.auth.schemas import SupabaseAuthUser
from supabase import Client as SupabaseClient
# This import is critical. When it runs, Pydantic's Settings will initialize.
# If the root conftest.py has successfully loaded .env into os.environ by then,
# Pydantic should pick up TEST_API_SECRET_KEY.
from apps.api.v1.core.config import settings # Assuming core is also under v1

# def pytest_configure(config): # REMOVED - .env loading handled by root conftest
#     """Configure test environment before any test modules are imported."""
#     project_root_calculated = Path("/Users/golfergeek/projects/golfergeek/orchestrator-ai")
#     if str(project_root_calculated) not in sys.path:
#         sys.path.insert(0, str(project_root_calculated))

#     # Ensure critical env var for tests is present, can be set by .env or OS environment
#     # Pydantic settings will have loaded OPENAI_API_KEY from .env if present.
#     # This is a fallback if it's not in .env and some test utility (not using Settings directly) needs it.
#     if not settings.OPENAI_API_KEY:
#         print("[CONTEST_WARN] OPENAI_API_KEY not found in settings after Pydantic load. Setting a dummy key for tests.")
#         # Set it in os.environ so if other parts of code use os.getenv directly for this, they get it.
#         # Pydantic's settings object itself won't re-evaluate based on this os.environ change post-instantiation.
#         if not os.getenv("OPENAI_API_KEY"):
#             os.environ["OPENAI_API_KEY"] = "test-openai-api-key-dummy-from-conftest"
#     
#     config.addinivalue_line("markers", "e2e: marks tests as end-to-end tests")

# --- Test User Data ---
TEST_USER_ID = uuid.uuid4()
TEST_USER_EMAIL = "testuser@example.com"

# --- Mock Implementations for Dependencies ---
def mock_get_current_authenticated_user() -> SupabaseAuthUser:
    # print(f"[CONTEST_MOCK] mock_get_current_authenticated_user called, returning user {TEST_USER_ID}")
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

@pytest.fixture(scope="session")
def mock_supabase_client() -> MagicMock:
    # print("[CONTEST_MOCK] mock_supabase_client fixture creating MagicMock for SupabaseClient")
    mock_client = MagicMock(spec=SupabaseClient)
    mock_client.auth = MagicMock()

    # --- Mock for session creation ---
    mock_session_insert_execute_response = MagicMock()
    # Simulate what Supabase returns after a successful insert: a list with one dict
    mock_session_data = {
        "id": str(uuid4()),
        "user_id": TEST_USER_ID, # Use the defined TEST_USER_ID
        "name": None, # Matches SessionCreate default
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    mock_session_insert_execute_response.data = [mock_session_data]
    mock_session_insert_execute_response.error = None
    mock_session_insert_execute_response.count = 1

    # --- Generic mock for other operations (can be refined as needed) ---
    mock_generic_execute_response = MagicMock()
    mock_generic_execute_response.data = [] 
    mock_generic_execute_response.error = None
    mock_generic_execute_response.count = 0

    # --- Table method mock ---
    # This function will be called when mock_client.table("some_name") is invoked.
    # It allows us to return different mocks based on the table name.
    def table_side_effect(table_name: str):
        # print(f"[CONTEST_MOCK] mock_client.table('{table_name}') called.")
        mock_table_operations = MagicMock() # Represents the chainable methods like .select(), .insert()
        
        if table_name == "sessions":
            # Specific mock for "sessions" table's insert().execute()
            mock_table_operations.insert.return_value.execute.return_value = mock_session_insert_execute_response
            # Add other session operations if needed, e.g., select
            mock_table_operations.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_generic_execute_response 
        else:
            # Generic behavior for other tables
            mock_table_operations.insert.return_value.execute.return_value = mock_generic_execute_response
            mock_table_operations.select.return_value.execute.return_value = mock_generic_execute_response # covers .eq().execute() too
            mock_table_operations.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_generic_execute_response
            # Add more generic mocks as common patterns emerge

        return mock_table_operations

    mock_client.table.side_effect = table_side_effect
    
    return mock_client

# --- Pytest Fixtures ---
@pytest.fixture
def client() -> TestClient: # Existing client fixture (presumably for unauthenticated calls)
    # print("[CONTEST_FIXTURE] client fixture creating TestClient")
    app.dependency_overrides.clear()
    return TestClient(app)

@pytest.fixture(scope="function")
async def authenticated_client(mock_supabase_client: MagicMock) -> httpx.AsyncClient:
    """Provides a TestClient that authenticates using MOCKED user details via dependency override."""
    # print(f"[CONTEST_FIXTURE] authenticated_client (MOCKED AUTH) fixture. Using mock_supabase_client: {id(mock_supabase_client)}")
    
    app.dependency_overrides[get_current_authenticated_user] = mock_get_current_authenticated_user
    app.dependency_overrides[get_supabase_client_as_current_user] = lambda: mock_supabase_client
    
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://testserver", follow_redirects=True) as client_instance:
        # This client relies on the MOCK get_current_authenticated_user, so API key header is not primary auth method here.
        # However, setting it won't hurt if settings.TEST_API_SECRET_KEY is available, for consistency or other checks.
        # if settings.TEST_API_SECRET_KEY:
        #     print(f"[CONTEST_FIXTURE - MOCKED AUTH] Setting {TEST_API_KEY_HEADER} for httpx.AsyncClient as a fallback/secondary.")
        #     client_instance.headers[TEST_API_KEY_HEADER] = settings.TEST_API_SECRET_KEY
        # else:
            # print("[CONTEST_FIXTURE - MOCKED AUTH] WARNING: TEST_API_SECRET_KEY not set. Not adding API key header.")
        
        yield client_instance
    
    # print("[CONTEST_FIXTURE - MOCKED AUTH] authenticated_client fixture clearing overrides after test.")
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
async def api_key_auth_client(mock_supabase_client: MagicMock) -> httpx.AsyncClient:
    """Provides an httpx.AsyncClient that authenticates using the real Test API Key mechanism.
    It does NOT override get_current_authenticated_user, allowing the actual API key check to occur.
    It still mocks the supabase client for other potential DB interactions unrelated to this auth path.
    """
    # print(f"[CONTEST_FIXTURE] api_key_auth_client (REAL API KEY AUTH) fixture. Using mock_supabase_client: {id(mock_supabase_client)}")
    # Debug print moved to the top of this message to show the value when this fixture is called.
    # print(f"[CONTEST_FIXTURE - REAL API KEY AUTH] Value of settings.TEST_API_SECRET_KEY at fixture setup: '{settings.TEST_API_SECRET_KEY}'")

    # DO NOT override get_current_authenticated_user here.
    # We WANT the real one from apps.api.v1.auth.dependencies to run its API key check.
    
    # We might still need to mock the Supabase client for other parts of the app if they are hit
    # and try to make actual Supabase calls beyond the auth check.
    app.dependency_overrides[get_supabase_client_as_current_user] = lambda: mock_supabase_client
    # Consider if get_current_supabase_client also needs mocking if it's used by the real get_current_authenticated_user path
    # For now, assume the TEST_API_KEY path in get_current_authenticated_user doesn't hit Supabase for user validation.

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://testserver", follow_redirects=True) as client_instance:
        if settings.TEST_API_SECRET_KEY:
            # print(f"[CONTEST_FIXTURE - REAL API KEY AUTH] Setting header {TEST_API_KEY_HEADER} to: {settings.TEST_API_SECRET_KEY}")
            client_instance.headers[TEST_API_KEY_HEADER] = settings.TEST_API_SECRET_KEY
        else:
            print("[CONTEST_FIXTURE - REAL API KEY AUTH] CRITICAL WARNING: TEST_API_SECRET_KEY is NOT set in test settings. API key authentication will fail.")
            # Consider pytest.fail() here if the key is essential for these tests.
        yield client_instance
    
    # print("[CONTEST_FIXTURE - REAL API KEY AUTH] api_key_auth_client fixture clearing overrides after test.")
    app.dependency_overrides.clear() # Clear only what we set, or be careful with blanket clear.

@pytest.fixture(scope="session")
def api_base_url():
    return "http://localhost:8000"  # Adjust if your v1 API runs on a different port/host 