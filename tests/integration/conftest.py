import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import httpx # Keep this for override_get_http_client type hint
from typing import AsyncGenerator, Optional, Tuple
from unittest.mock import AsyncMock

# Configure pytest-asyncio mode if not already set globally
# pytest_plugins = ["pytest_asyncio"] # pytest-asyncio is often auto-detected

# Explicitly load pytest-mock to ensure mocker fixture is available
# pytest_plugins = "pytest_mock" # MOVED TO ROOT CONFIGURE.PY

# pytestmark = pytest.mark.asyncio(loop_scope="session") # Can be set in root conftest or pytest.ini

# Import the app factory and the ORIGINAL provider functions
from apps.api.main import create_app, get_original_openai_service, get_original_http_client, get_original_task_store_service, FastAPI, load_agent_services
from apps.api.llm.openai_service import OpenAIService
# from apps.api.a2a_protocol.task_store import TaskStoreService # Not used in current fixtures

@pytest_asyncio.fixture(scope="function")
async def mock_openai_service() -> AsyncMock:
    mock = AsyncMock(spec=OpenAIService)
    mock.decide_orchestration_action.return_value = {
        "action": "respond_directly", 
        "response_text": "LLM mock: Default direct response."
    }
    return mock

@pytest_asyncio.fixture(scope="function")
async def client_and_app(
    mock_openai_service: AsyncMock
) -> AsyncGenerator[Tuple[AsyncClient, FastAPI], None]:
    test_app = create_app() 

    # Create an AsyncClient for the test
    # Use ASGITransport for FastAPI testing, base_url for convenience
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as test_client:
        
        def override_get_openai_service() -> Optional[OpenAIService]:
            return mock_openai_service
        
        def override_get_http_client() -> httpx.AsyncClient:
            # This ensures agent services (like Orchestrator) use the test client 
            # for making outbound calls to other mocked/tested agent endpoints.
            return test_client 
        
        test_app.dependency_overrides[get_original_openai_service] = override_get_openai_service
        test_app.dependency_overrides[get_original_http_client] = override_get_http_client

        # Store the test client on app.state if needed by app logic (lifespan might do this)
        # For testing, ensuring dependency override for http_client is often sufficient.
        # test_app.state.http_client = test_client 

        # Manually load agent services as lifespan might not run automatically in all test setups
        load_agent_services(app_to_configure=test_app)
        
        yield test_client, test_app
        # AsyncClient is managed by async with, so explicit aclose() might not be needed here
        # but ensure all resources are cleaned up if issues arise. 