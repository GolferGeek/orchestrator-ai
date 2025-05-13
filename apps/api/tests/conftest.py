import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import httpx
from typing import AsyncGenerator, Optional, Tuple
from unittest.mock import AsyncMock
import inspect
import sys

# Import the app factory and the ORIGINAL provider functions (for keys in dependency_overrides)
from ..main import create_app, get_original_openai_service, get_original_http_client, get_original_task_store_service, FastAPI, load_agent_services
from ..llm.openai_service import OpenAIService
from ..a2a_protocol.task_store import TaskStoreService

@pytest_asyncio.fixture(scope="session")
def event_loop():
    print("[CONFTEST_EVENT_LOOP] Creating session event loop")
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    print("[CONFTEST_EVENT_LOOP] Closing session event loop")
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def mock_openai_service_session_scope() -> AsyncMock:
    print("[CONFTEST_MOCK_PROVIDER] Creating mock_openai_service_session_scope")
    mock = AsyncMock(spec=OpenAIService)
    mock.decide_orchestration_action.return_value = {
        "action": "respond_directly", 
        "response_text": "LLM mock: Default direct response from session scope."
    }
    return mock

@pytest_asyncio.fixture(scope="function")
async def client_and_app(
    mock_openai_service_session_scope: AsyncMock
) -> AsyncGenerator[Tuple[AsyncClient, FastAPI], None]:
    print("[CONFTEST_CLIENT_FIXTURE] Creating new app instance using factory.")
    test_app = create_app() # Create a fresh app instance for each test function
    print(f"[CONFTEST_CLIENT_FIXTURE] New test_app created: {id(test_app)}")

    # Create an AsyncClient to be used for the test
    test_client = AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver")
    print(f"[CONFTEST_CLIENT_FIXTURE] Test client created: {test_client} for app {id(test_app)}")
    
    def override_get_openai_service() -> Optional[OpenAIService]:
        print(f"[CONFTEST_OVERRIDE] override_get_openai_service CALLED for app {id(test_app)}, returning mock: {mock_openai_service_session_scope}")
        return mock_openai_service_session_scope
    
    def override_get_http_client() -> httpx.AsyncClient:
        print(f"[CONFTEST_OVERRIDE] override_get_http_client CALLED for app {id(test_app)}, returning test client: {test_client}")
        return test_client # This ensures agent services use the test client with the correct base_url
    
    # Apply overrides to the test app instance
    test_app.dependency_overrides[get_original_openai_service] = override_get_openai_service
    test_app.dependency_overrides[get_original_http_client] = override_get_http_client
    print(f"[CONFTEST_CLIENT_FIXTURE] Applied dependency_overrides to test_app {id(test_app)}: {test_app.dependency_overrides}")

    # Create and store http_client on app.state (similar to what lifespan does)
    test_app.state.http_client = test_client
    print(f"[CONFTEST_CLIENT_FIXTURE] Set app.state.http_client: {test_app.state.http_client}")
    
    # Manually load agent services since the lifespan isn't automatically triggered in tests
    print(f"[CONFTEST_CLIENT_FIXTURE] Manually loading agent services for app {id(test_app)}")
    load_agent_services(app_to_configure=test_app)
    print(f"[CONFTEST_CLIENT_FIXTURE] Agent services loaded for app {id(test_app)}")
    
    # Diagnostic code to print details about OrchestratorService and its methods
    print("[CONFTEST_DIAGNOSTIC] Looking for OrchestratorService in app routes...")
    for route in test_app.routes:
        if hasattr(route, "endpoint") and route.path and "/orchestrator/" in route.path:
            try:
                if hasattr(route.endpoint, "__self__"):
                    endpoint_obj = route.endpoint.__self__
                    print(f"[CONFTEST_DIAGNOSTIC] Found endpoint {route.path} with object: {endpoint_obj.__class__.__name__}")
                    
                    # Check if this looks like our OrchestratorService
                    if endpoint_obj.__class__.__name__ == "OrchestratorService":
                        print(f"[CONFTEST_DIAGNOSTIC] Found OrchestratorService at {route.path}")
                        
                        # Check if handle_task_send is actually implemented in OrchestratorService
                        from inspect import getmro
                        mro = getmro(endpoint_obj.__class__)
                        
                        # Get method resolution order (inheritance hierarchy)
                        print(f"[CONFTEST_DIAGNOSTIC] Method Resolution Order: {[cls.__name__ for cls in mro]}")
                        
                        # Find where handle_task_send is defined
                        for cls in mro:
                            if "handle_task_send" in cls.__dict__:
                                print(f"[CONFTEST_DIAGNOSTIC] handle_task_send is defined in {cls.__name__}")
                                break
                        
                        # Print methods that are overridden in OrchestratorService
                        orchestrator_methods = set(endpoint_obj.__class__.__dict__.keys()) - set(["__module__", "__doc__"])
                        print(f"[CONFTEST_DIAGNOSTIC] Methods defined in OrchestratorService: {orchestrator_methods}")
                        
                        # Check the handle_task_send method specifically
                        if hasattr(endpoint_obj, "handle_task_send"):
                            handle_method = getattr(endpoint_obj, "handle_task_send")
                            # Where is this method defined?
                            mod_name = handle_method.__module__
                            print(f"[CONFTEST_DIAGNOSTIC] handle_task_send method from module: {mod_name}")
                        break
            except Exception as e:
                print(f"[CONFTEST_DIAGNOSTIC] Error inspecting route: {e}")
        
    try:
        yield test_client, test_app
    finally:
        print(f"[CONFTEST_CLIENT_FIXTURE] Cleaning up client for test_app {id(test_app)}")
        await test_client.aclose()
        if hasattr(test_app.state, 'http_client') and test_app.state.http_client and not test_app.state.http_client.is_closed:
            await test_app.state.http_client.aclose() 