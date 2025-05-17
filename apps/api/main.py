import sys # Add sys import
import os # os is already imported, ensure it's here
import httpx # Ensure httpx is imported at the module level

print(f"--- DIAGNOSTIC INFO START ---")
print(f"Python executable being used: {sys.executable}")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
print(f"Current working directory: {os.getcwd()}")
try:
    print("Attempting to import httpx_sse...")
    import httpx_sse
    print(f"Successfully imported httpx_sse. Version: {getattr(httpx_sse, '__version__', 'unknown')}")
    print(f"httpx_sse location: {httpx_sse.__file__}")
    
    print("Attempting to import httpx directly after httpx_sse...")
    import httpx
    print(f"Successfully imported httpx. Version: {getattr(httpx, '__version__', 'unknown')}")
    print(f"httpx location: {httpx.__file__}")

    if hasattr(httpx.Response, 'aiter_sse'):
        print("IMMEDIATELY AFTER IMPORTS: httpx.Response HAS aiter_sse attribute.")
    else:
        print("IMMEDIATELY AFTER IMPORTS: httpx.Response DOES NOT HAVE aiter_sse attribute.")
except ImportError as e:
    print(f"Failed to import httpx_sse or httpx: {e}")
except Exception as e:
    print(f"An unexpected error occurred during httpx_sse/httpx import diagnostics: {e}")

try:
    import tiktoken
    print(f"Successfully imported tiktoken. Version: {getattr(tiktoken, '__version__', 'unknown')}")
    print(f"tiktoken location: {tiktoken.__file__}")
except ImportError as e:
    print(f"Failed to import tiktoken: {e}")
except Exception as e:
    print(f"An unexpected error occurred during tiktoken import diagnostics: {e}")

print(f"--- DIAGNOSTIC INFO END ---")

from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import importlib.util
from pathlib import Path
from typing import Optional, Callable, Any
from functools import partial
from contextlib import asynccontextmanager
import logging # Import the logging module

# Configure basic logging for the application
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Adjusted imports to be relative to the apps.api package
from .a2a_protocol.task_store import TaskStoreService
from .a2a_protocol.types import JSONRPCError, ErrorCode, AgentCard, Task
from .llm.openai_service import OpenAIService
from .core.config import settings

# Import the MCP router from its new location
from .shared.mcp.mcp_routes import mcp_router

# Load environment variables from .env file - still okay at module level
load_dotenv()

# --- Global/Shared Service Instances (Originals) ---
# These are the defaults if no overrides are in place.
_original_task_store_service_instance = TaskStoreService()
_original_openai_service_instance: Optional[OpenAIService] = None
if settings.OPENAI_API_KEY:
    _original_openai_service_instance = OpenAIService(api_key=settings.OPENAI_API_KEY)
    print(f"[MAIN_FACTORY_GLOBALS] Original OpenAIService created: {_original_openai_service_instance}")
else:
    print("[MAIN_FACTORY_GLOBALS] Warning: OPENAI_API_KEY not found. Original OpenAIService is None.")

_original_http_client_instance: Optional[httpx.AsyncClient] = None # Will be managed by app state via lifespan

# --- Original Provider Functions (Defaults) ---
def get_original_task_store_service() -> TaskStoreService:
    print("[MAIN_FACTORY_PROVIDER] get_original_task_store_service CALLED")
    return _original_task_store_service_instance

def get_original_openai_service() -> Optional[OpenAIService]:
    print(f"[MAIN_FACTORY_PROVIDER] get_original_openai_service CALLED, returning: {_original_openai_service_instance}")
    return _original_openai_service_instance

def get_original_http_client() -> httpx.AsyncClient:
    # This should ideally be managed per app instance's lifespan
    # For tests, this specific function will be overridden anyway by the test client.
    # For the real app, it's created/managed by the app's lifespan.
    global _original_http_client_instance
    if _original_http_client_instance is None or _original_http_client_instance.is_closed:
        # This global instance is problematic for tests and per-app instances.
        # The app.state.http_client managed by lifespan is preferred.
        # For tests, this provider is overridden anyway.
        # For the main app, the lifespan will create one on app.state.
        # This function might only be called if something outside an app context tries to get it BEFORE app startup.
        print("[MAIN_FACTORY_PROVIDER] Original HTTP client is None or closed, creating new for global fallback.")
        _original_http_client_instance = httpx.AsyncClient()
    print(f"[MAIN_FACTORY_PROVIDER] get_original_http_client CALLED, returning: {_original_http_client_instance}")
    return _original_http_client_instance

# --- Agent Loading Logic ---
def process_agent_module(
    app_to_configure: FastAPI, # Added app_to_configure
    agent_module_dir: Path,
    module_base_path_str: str, # This will now be like ".agents.category.agentname"
    tags: list[str],
    category_name: Optional[str] = None,
    openai_service_provider: Callable[[], Optional[OpenAIService]] = get_original_openai_service,
    http_client_provider: Callable[[], httpx.AsyncClient] = get_original_http_client,
    task_store_provider: Callable[[], TaskStoreService] = get_original_task_store_service
):
    print(f"[PROCESS_AGENT_MODULE] For {agent_module_dir.name}: using openai_provider: {openai_service_provider.__name__}, http_client_provider: {http_client_provider.__name__}")
    agent_main_py = agent_module_dir / "main.py"
    # module_name is constructed by load_agent_services to be relative to apps.api
    module_name = module_base_path_str 

    spec = importlib.util.spec_from_file_location(module_name, agent_main_py)
    if not (spec and spec.loader):
        print(f"[PROCESS_AGENT_MODULE] Warning: Could not create spec for {agent_main_py} with module name {module_name}")
        return

    # To use relative imports within the dynamically loaded agent module itself (if it needs to import from its siblings or parent within apps.api.agents)
    # its __name__ should be set correctly. import_module does this better.
    # For now, let's assume agent main.py uses absolute imports from apps.api or careful relative ones.
    module = importlib.util.module_from_spec(spec)
    # Set package for relative imports if agent modules use them, relative to apps.api
    # The package for apps.api.agents.orchestrator.main would be apps.api.agents.orchestrator
    module.__package__ = module_name.rsplit('.', 1)[0] if '.' in module_name else 'apps.api'

    spec.loader.exec_module(module)

    # Attempt to include a router defined as 'agent_router' in the module or its 'routes' submodule
    router_to_include = None
    if hasattr(module, 'agent_router') and isinstance(module.agent_router, APIRouter):
        router_to_include = module.agent_router
        print(f"[PROCESS_AGENT_MODULE] Found 'agent_router' in {module_name}")
    elif hasattr(module, 'routes') and hasattr(module.routes, 'agent_router') and isinstance(module.routes.agent_router, APIRouter):
        router_to_include = module.routes.agent_router
        print(f"[PROCESS_AGENT_MODULE] Found 'agent_router' in {module_name}.routes")

    # Determine the conventional service class name regardless of router presence
    # This is needed for logging/warning even if a router is used.
    parts = agent_module_dir.name.split('_')
    camel_cased_parts = [part.title() for part in parts]
    agent_service_class_name_candidate = "".join(camel_cased_parts) + "Service"
    if not hasattr(module, agent_service_class_name_candidate) and hasattr(module, "AgentService"): # Fallback
        agent_service_class_name_candidate = "AgentService"

    if router_to_include:
        app_to_configure.include_router(router_to_include)
        print(f"[PROCESS_AGENT_MODULE] Included agent_router from {agent_module_dir.name}")
        # Log if a service class by convention also exists, as we are preferring the router
        if hasattr(module, agent_service_class_name_candidate):
            print(f"[PROCESS_AGENT_MODULE] Info: Module {agent_module_dir.name} has an agent_router. Service class '{agent_service_class_name_candidate}' also found but its routes are NOT being dynamically generated by the loader as router is preferred.")
    else:
        # No module-level 'agent_router' found, so try to find and use a service class by convention
        print(f"[PROCESS_AGENT_MODULE] No agent_router found in {agent_module_dir.name}. Attempting service-based routing.")
        if hasattr(module, agent_service_class_name_candidate):
            agent_service_class = getattr(module, agent_service_class_name_candidate)
            try:
                current_task_store = task_store_provider()
                current_http_client = http_client_provider()
                
                init_params = {
                    "task_store": current_task_store,
                    "http_client": current_http_client,
                    "agent_name": agent_module_dir.name # agent_name is needed for these dynamically routed services
                }

                # Add department_name if the agent is in a category (department)
                if category_name:
                    init_params["department_name"] = category_name
                
                if agent_service_class.__name__ == "OrchestratorService":
                    current_openai_service = openai_service_provider()
                    if current_openai_service:
                        init_params["openai_service"] = current_openai_service
                
                agent_service_instance = agent_service_class(**init_params)

                router = APIRouter()
                base_prefix = f"/agents/{category_name}/{agent_module_dir.name}" if category_name else f"/agents/{agent_module_dir.name}"

                if hasattr(agent_service_instance, "get_agent_card"):
                    router.add_api_route("/agent-card", agent_service_instance.get_agent_card, methods=["GET"], response_model=AgentCard, tags=tags)
                if hasattr(agent_service_instance, "handle_task_send"):
                    router.add_api_route("/tasks", agent_service_instance.handle_task_send, methods=["POST"], response_model=Task, tags=tags)
                if hasattr(agent_service_instance, "handle_task_get"):
                    router.add_api_route(f"/tasks/{{task_id}}", agent_service_instance.handle_task_get, methods=["GET"], response_model=Optional[Task], tags=tags)
                if hasattr(agent_service_instance, "handle_task_cancel"):
                    router.add_api_route(f"/tasks/{{task_id}}", agent_service_instance.handle_task_cancel, methods=["DELETE"], response_model=dict, tags=tags)
                
                if hasattr(module, "get_agent_discovery") and callable(getattr(module, "get_agent_discovery")):
                    router.add_api_route("/.well-known/agent.json", getattr(module, "get_agent_discovery"), methods=["GET"], tags=tags, include_in_schema=False)
                elif hasattr(agent_service_instance, "get_agent_card"): # Fallback to service's agent_card for well-known
                    router.add_api_route("/.well-known/agent.json", agent_service_instance.get_agent_card, methods=["GET"], response_model=AgentCard, tags=tags, include_in_schema=False)

                if router.routes:
                    app_to_configure.include_router(router, prefix=base_prefix, tags=tags)
                    print(f"[PROCESS_AGENT_MODULE] Included service-based router for {agent_module_dir.name} using {agent_service_class_name_candidate}")

            except Exception as e:
                print(f"[PROCESS_AGENT_MODULE] Error for {agent_module_dir.name} (during service-based route setup for {agent_service_class_name_candidate}): {e}")
                import traceback
                traceback.print_exc()
        else:
            # This case means no agent_router and no identifiable service class by convention
            print(f"[PROCESS_AGENT_MODULE] Warning: No agent_router and no service class ('{agent_service_class_name_candidate}' or 'AgentService') found in {agent_main_py}. No routes loaded for this agent module.")

def load_agent_services(app_to_configure: FastAPI):
    print(f"[LOAD_AGENT_SERVICES] Called for app: {id(app_to_configure)}. Overrides: {app_to_configure.dependency_overrides}")
    # Path to agents directory relative to this file (apps/api/main.py)
    agents_base_dir = Path(__file__).parent / "agents"

    # Resolve actual providers by checking THIS app instance's dependency_overrides
    actual_openai_provider = app_to_configure.dependency_overrides.get(get_original_openai_service, get_original_openai_service)
    actual_http_client_provider = app_to_configure.dependency_overrides.get(get_original_http_client, get_original_http_client)
    actual_task_store_provider = app_to_configure.dependency_overrides.get(get_original_task_store_service, get_original_task_store_service)
    
    print(f"[LOAD_AGENT_SERVICES] For app {id(app_to_configure)}, resolved openai_provider: {actual_openai_provider.__name__}")
    print(f"[LOAD_AGENT_SERVICES] For app {id(app_to_configure)}, resolved http_client_provider: {actual_http_client_provider.__name__}")

    for agent_category_dir in agents_base_dir.iterdir():
        if agent_category_dir.is_dir() and (agent_category_dir / "__init__.py").exists():
            shared_providers = {
                "openai_service_provider": actual_openai_provider,
                "http_client_provider": actual_http_client_provider,
                "task_store_provider": actual_task_store_provider
            }
            # Construct module path relative to apps.api (which is effectively the current top-level package for execution via start.py)
            if agent_category_dir.name == "orchestrator":
                module_path_for_import = f"apps.api.agents.{agent_category_dir.name}.main"
                process_agent_module(app_to_configure, agent_category_dir, module_path_for_import, [agent_category_dir.name.replace('_', ' ').title()], **shared_providers)
                continue
            for agent_dir in agent_category_dir.iterdir():
                if agent_dir.is_dir() and (agent_dir / "__init__.py").exists() and (agent_dir / "main.py").exists():
                    module_path_for_import = f"apps.api.agents.{agent_category_dir.name}.{agent_dir.name}.main"
                    process_agent_module(app_to_configure, agent_dir, module_path_for_import, 
                                         [f"{agent_category_dir.name.replace('_', ' ').title()} - {agent_dir.name.replace('_', ' ').title()}"], 
                                         category_name=agent_category_dir.name, **shared_providers)

# --- Lifespan Context Manager ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print(f"[LIFESPAN_MANAGER] Startup for app {id(app)}.")
    # Create and store http_client on app.state
    # The http_client_provider will retrieve from app.state or the override.
    app.state.http_client = httpx.AsyncClient()
    print(f"[LIFESPAN_MANAGER] Created app.state.http_client: {app.state.http_client} for app {id(app)}")

    # It's generally better to register routers directly in create_app
    # unless their setup truly depends on lifespan resources not available at app creation.
    # For shared utility routers like MCP, create_app is suitable.

    print(f"[LIFESPAN_MANAGER] Loading agent services for app {id(app)}.")
    load_agent_services(app_to_configure=app)
    print(f"[LIFESPAN_MANAGER] Agent services loaded for app {id(app)}.")
    
    yield
    
    # Shutdown logic
    print(f"[LIFESPAN_MANAGER] Shutdown for app {id(app)}.")
    if hasattr(app.state, 'http_client') and app.state.http_client and not app.state.http_client.is_closed:
        await app.state.http_client.aclose()
        print(f"[LIFESPAN_MANAGER] Closed app.state.http_client for app {id(app)}.")
    app.state.http_client = None

# --- App Factory ---
def create_app() -> FastAPI:
    print("[CREATE_APP] Factory called.")
    
    new_app = FastAPI(
        title="Orchestrator AI API",
        version="0.1.0",
        description="API for Orchestrator AI and its sub-agents.",
        lifespan=lifespan  # Use the lifespan context manager
    )
    print(f"[CREATE_APP] New app instance created: {id(new_app)}")

    # --- Include Shared Utility Routers ---
    # This is a good place for non-agent-specific utility endpoints like the MCP
    new_app.include_router(mcp_router) # MCP routes for context-based streaming
    print(f"[CREATE_APP] Included shared MCP router for app {id(new_app)}.")

    @new_app.exception_handler(JSONRPCError)
    async def jsonrpc_exception_handler(request: Any, exc: JSONRPCError):
        # Create content based on available attributes in JSONRPCError
        content = {
            "code": exc.code.value if hasattr(exc, "code") else ErrorCode.InternalError.value
        }
        
        # Add error message from either message attribute or convert error to string
        if hasattr(exc, "message"):
            content["message"] = exc.message
        else:
            content["message"] = str(exc)
            
        # Add data if available
        if hasattr(exc, "data") and exc.data is not None:
            content["data"] = exc.data
            
        return JSONResponse(status_code=400, content=content)

    @new_app.exception_handler(HTTPException)
    async def http_exception_handler(request: Any, exc: HTTPException):
        error_content = {"code": ErrorCode.InternalError.value, "message": exc.detail}
        return JSONResponse(status_code=exc.status_code, content=error_content)

    @new_app.get("/")
    async def read_root():
        return {"message": "Welcome to Orchestrator AI API"}

    @new_app.get("/health")
    async def health_check():
        return {"status": "healthy"}
        
    return new_app

# Global app instance for normal execution (e.g., uvicorn main:app)
app = create_app()
print(f"[MAIN_MODULE] Global 'app' instance created: {id(app)}")

if __name__ == "__main__":
    import uvicorn
    # Uvicorn will use the global 'app' instance
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True) 