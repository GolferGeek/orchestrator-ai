import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import httpx # Keep this for override_get_http_client type hint
from typing import AsyncGenerator, Optional, Tuple
from unittest.mock import AsyncMock, MagicMock
import uuid # For TEST_USER_ID
from datetime import datetime, timezone # For SupabaseAuthUser mock
import asyncio # For awaiting coroutines

# Configure pytest-asyncio mode if not already set globally
# pytest_plugins = ["pytest_asyncio"] # pytest-asyncio is often auto-detected

# Explicitly load pytest-mock to ensure mocker fixture is available
# pytest_plugins = "pytest_mock" # MOVED TO ROOT CONFIGURE.PY

# pytestmark = pytest.mark.asyncio(loop_scope="session") # Can be set in root conftest or pytest.ini

# Import the app factory and the ORIGINAL provider functions
from apps.api.main import create_app, get_original_openai_service, get_original_http_client, get_original_task_store_service, FastAPI, load_agent_services
from apps.api.llm.openai_service import OpenAIService
from supabase import Client as SupabaseClient # Added

# Import auth dependencies and schema for overriding
from apps.api.auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user # Added
from apps.api.auth.schemas import SupabaseAuthUser # Added

# --- Test User Data (can be shared from root conftest or defined here if specific) ---
# Assuming these are defined in root conftest and accessible, or redefine if needed.
# For now, let's copy them here for clarity in this file if they aren't automatically picked up.
TEST_USER_ID = uuid.uuid4()
TEST_USER_EMAIL = "testuser_integration@example.com"

def mock_get_current_authenticated_user_for_integration() -> SupabaseAuthUser:
    print(f"[INTEGRATION_CONTEST_MOCK] mock_get_current_authenticated_user_for_integration called, returning user {TEST_USER_ID}")
    return SupabaseAuthUser(
        id=TEST_USER_ID,
        aud="authenticated",
        role="authenticated",
        email=TEST_USER_EMAIL,
        email_confirmed_at=datetime.now(timezone.utc),
        confirmed_at=datetime.now(timezone.utc),
        last_sign_in_at=datetime.now(timezone.utc),
        app_metadata={},
        user_metadata={},
        identities=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )

@pytest_asyncio.fixture(scope="function")
async def mock_user_specific_supabase_client() -> MagicMock:
    print("[INTEGRATION_CONTEST_MOCK] mock_user_specific_supabase_client fixture creating MagicMock")
    mock = MagicMock(spec=SupabaseClient)
    # Mock common chat history calls for Orchestrator
    # .select().execute() for loading history (return empty for new chats)
    mock_select_response = AsyncMock()
    mock_select_response.data = []
    mock.table.return_value.select.return_value.eq.return_value.order.return_value.execute = mock_select_response
    
    # .insert().execute() for adding messages (return new message data)
    mock_insert_response = AsyncMock()
    # Simulate what Supabase returns after an insert: usually a list with the inserted row
    mock_insert_response.data = [{"id": str(uuid.uuid4()), "user_id": str(TEST_USER_ID), "content": "mocked insert"}]
    mock.table.return_value.insert.return_value.execute = mock_insert_response
    
    yield mock
    
    # Ensure any AsyncMock coroutines are properly handled
    for name, method in mock.__dict__.items():
        if isinstance(method, AsyncMock):
            method.reset_mock()

# Helper function to await any unawaited coroutines from a mock
async def await_unawaited_coroutines(mock: AsyncMock):
    for _, args, kwargs in mock.mock_calls:
        for arg in list(args) + list(kwargs.values()):
            if asyncio.iscoroutine(arg):
                await arg

@pytest_asyncio.fixture(scope="function")
async def mock_openai_service() -> AsyncMock:
    mock = AsyncMock(spec=OpenAIService)
    # Set return value for the most commonly used method in tests
    mock.decide_orchestration_action.return_value = {
        "action": "respond_directly", 
        "response_text": "LLM mock: Default direct response."
    }
    
    # Use yield instead of return for cleanup
    yield mock
    
    # Before test teardown, ensure all coroutines are awaited
    await await_unawaited_coroutines(mock)
    
    # After each test completes, reset the mock to clear any unawaited coroutines
    mock.reset_mock()

@pytest_asyncio.fixture(scope="function")
async def client_and_app(
    mock_openai_service: AsyncMock,
    mock_user_specific_supabase_client: MagicMock # Add the new fixture
) -> AsyncGenerator[Tuple[httpx.AsyncClient, FastAPI], None]:
    test_app = create_app() 

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as test_client:
        
        def override_get_openai_service() -> Optional[OpenAIService]:
            return mock_openai_service
        
        def override_get_http_client() -> httpx.AsyncClient:
            return test_client 
        
        # Auth overrides
        test_app.dependency_overrides[get_current_authenticated_user] = mock_get_current_authenticated_user_for_integration
        test_app.dependency_overrides[get_supabase_client_as_current_user] = lambda: mock_user_specific_supabase_client
        
        test_app.dependency_overrides[get_original_openai_service] = override_get_openai_service
        test_app.dependency_overrides[get_original_http_client] = override_get_http_client

        load_agent_services(app_to_configure=test_app)
        
        yield test_client, test_app
        
        test_app.dependency_overrides.clear() # Clear all overrides 