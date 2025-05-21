import sys
import os
import httpx
from fastapi import FastAPI, HTTPException, APIRouter, Depends, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import importlib.util
from pathlib import Path
from typing import Optional, Callable, Any, Dict
from functools import partial
from contextlib import asynccontextmanager
import logging
from fastapi.middleware.cors import CORSMiddleware
import uuid
import inspect

# Load environment variables first to ensure we can access log level config
load_dotenv()

# Configure logging with a more structured approach
def setup_logging():
    # Get log level from environment variable, default to WARNING
    log_level_str = os.getenv('LOG_LEVEL', 'WARNING').upper()
    log_level = getattr(logging, log_level_str, logging.WARNING)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create logger for this module
    logger = logging.getLogger('apps.api.main')
    
    # Optionally set different levels for specific loggers
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('fastapi').setLevel(logging.WARNING)
    
    # Log initial configuration and environment info at debug level
    logger.debug(f"Python executable: {sys.executable}")
    logger.debug(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
    logger.debug(f"Current working directory: {os.getcwd()}")
    
    # Log package versions at debug level
    try:
        import httpx_sse
        logger.debug(f"httpx_sse version: {getattr(httpx_sse, '__version__', 'unknown')}")
        logger.debug(f"httpx_sse location: {httpx_sse.__file__}")
        
        logger.debug(f"httpx version: {getattr(httpx, '__version__', 'unknown')}")
        logger.debug(f"httpx location: {httpx.__file__}")
        
        if hasattr(httpx.Response, 'aiter_sse'):
            logger.debug("httpx.Response has aiter_sse attribute")
        else:
            logger.debug("httpx.Response does not have aiter_sse attribute")
    except ImportError as e:
        logger.warning(f"Failed to import httpx_sse or httpx: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during httpx_sse/httpx import: {e}", exc_info=True)

    try:
        import tiktoken
        logger.debug(f"tiktoken version: {getattr(tiktoken, '__version__', 'unknown')}")
        logger.debug(f"tiktoken location: {tiktoken.__file__}")
    except ImportError as e:
        logger.warning(f"Failed to import tiktoken: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during tiktoken import: {e}", exc_info=True)
    
    return logger

# Set up logging and get logger for this module
logger = setup_logging()

# Adjusted imports to be relative to the apps.api package
from .a2a_protocol.task_store import TaskStoreService
from .a2a_protocol.types import (
    TaskSendParams, Message, Task, TaskStatus, TaskState, TextPart, 
    AgentCard, ErrorCode as A2AErrorCode, JSONRPCError as A2AJSONRPCError # Aliasing to avoid conflict if needed
)
from .llm.openai_service import OpenAIService
from .core.config import settings, Settings
from .core.db import get_supabase_client, get_current_supabase_client, get_anon_supabase_client, get_current_supabase_service_client
from supabase import Client as SupabaseClient # Import directly

# Import auth dependencies with fallback
try:
    from .auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user
    from .shared.auth_utils import oauth2_scheme
    logger.debug("Successfully imported auth dependencies")
except ImportError as e:
    logger.warning(f"Failed to import auth dependencies: {e}. Using fallback.")
    # Create minimal fallback functions for testing/development
    async def get_current_authenticated_user():
        return {"id": "test-user", "role": "authenticated"}
    async def get_supabase_client_as_current_user():
        return get_supabase_client()

from .auth.schemas import SupabaseAuthUser 
from .sessions.schemas import SessionCreate, SessionResponse, SessionListResponse # Assuming these are needed from sessions

# Import the MCP router from its new location
from .shared.mcp.mcp_routes import mcp_router
from .auth.routes import router as auth_router # Import the new auth router
from .sessions.routes import router as sessions_router # Import the new sessions router

# --- Global/Shared Service Instances (Originals) ---
# These are the defaults if no overrides are in place.
_original_task_store_service_instance = TaskStoreService()
_original_openai_service_instance: Optional[OpenAIService] = None
# if settings.OPENAI_API_KEY:
#     _original_openai_service_instance = OpenAIService(api_key=settings.OPENAI_API_KEY)
# else:
#     logger.warning("OPENAI_API_KEY not found. Original OpenAIService is None.")

_original_supabase_client_instance: Optional[SupabaseClient] = None
if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY: # Use ANON_KEY for general client
    _original_supabase_client_instance = get_supabase_client() # Uses settings internally
else:
    logger.warning("Supabase credentials not found. Original SupabaseClient is None.")

_original_http_client_instance: Optional[httpx.AsyncClient] = None # Will be managed by app state via lifespan

# --- Original Provider Functions (Defaults) ---
def get_original_task_store_service() -> TaskStoreService:
    return _original_task_store_service_instance

def get_original_openai_service() -> Optional[OpenAIService]:
    global _original_openai_service_instance
    print(f"[GET_ORIG_OPENAI_DEBUG] Inside get_original_openai_service. Accessing global _original_openai_service_instance.")
    print(f"[GET_ORIG_OPENAI_DEBUG] _original_openai_service_instance is None: {_original_openai_service_instance is None}")
    if _original_openai_service_instance is None:
        # This might happen if get_original_openai_service is called before lifespan startup, or if API key was missing during lifespan
        print(f"[GET_ORIG_OPENAI_DEBUG] Attempting to check settings.OPENAI_API_KEY: '{settings.OPENAI_API_KEY if hasattr(settings, 'OPENAI_API_KEY') else 'NOT_FOUND'}'")
        if settings.OPENAI_API_KEY: # Check again, in case it was called before lifespan init
            print("[GET_ORIG_OPENAI_DEBUG] Key found, attempting to create a fallback instance. THIS IS UNEXPECTED if lifespan ran.")
            # Fallback, ideally lifespan should have created it.
            # Avoid creating multiple, this is more for a direct call scenario before lifespan has run.
            # If this path is hit regularly, review call order.
            return OpenAIService(api_key=settings.OPENAI_API_KEY) 
        else:
            print("[GET_ORIG_OPENAI_DEBUG] No API KEY, _original_openai_service_instance remains None.")
    return _original_openai_service_instance

def get_original_supabase_client() -> Optional[SupabaseClient]:
    return _original_supabase_client_instance

def get_original_http_client() -> httpx.AsyncClient:
    global _original_http_client_instance
    if _original_http_client_instance is None or _original_http_client_instance.is_closed:
        _original_http_client_instance = httpx.AsyncClient()
    return _original_http_client_instance

# --- Agent Loading Logic ---
def process_agent_module(
    app_to_configure: FastAPI,
    agent_module_dir: Path,
    module_base_path_str: str,
    tags: list[str],
    category_name: Optional[str] = None,
    openai_service_provider: Callable[[], Optional[OpenAIService]] = get_original_openai_service,
    http_client_provider: Callable[[], httpx.AsyncClient] = get_original_http_client,
    task_store_provider: Callable[[], TaskStoreService] = get_original_task_store_service,
    supabase_client_provider: Callable[[], Optional[SupabaseClient]] = get_original_supabase_client
):
    module_logger = logging.getLogger(f"agent_loader.{agent_module_dir.name}")
    module_logger.debug(f"Processing agent module: {agent_module_dir.name}")
    
    if category_name == "business" and agent_module_dir.name == "metrics":
        module_logger.info(f"[METRICS_DEBUG] Attempting to process agent: category='{category_name}', agent_name='{agent_module_dir.name}'")
    
    agent_main_py = agent_module_dir / "main.py"
    module_name = module_base_path_str

    if not agent_main_py.exists():
        module_logger.warning(f"Could not find main.py at {agent_main_py}")
        return

    spec = importlib.util.spec_from_file_location(module_name, agent_main_py)
    if not (spec and spec.loader):
        module_logger.warning(f"Could not create spec for {agent_main_py} with module name {module_name}")
        return

    module = importlib.util.module_from_spec(spec)
    module.__package__ = module_name # module_name is already the full path like apps.api.agents.category.agent

    try:
        spec.loader.exec_module(module)
    except Exception as e:
        module_logger.error(f"Error executing module {module_name}: {e}", exc_info=True)
        if category_name == "business" and agent_module_dir.name == "metrics":
            module_logger.error(f"[METRICS_DEBUG] CRITICAL_IMPORT_ERROR: Failed to execute (import) {agent_main_py} due to: {e}")
        return # Stop processing this module if it fails to load
    
    # Log attributes for ALL successfully executed modules
    module_logger.error(f"[MODULE_LOADED_DEBUG] Successfully executed module {module_name}. Attributes: {sorted(dir(module))}")
    if hasattr(module, 'agent_router'):
        module_logger.error(f"[MODULE_LOADED_DEBUG] Module {module_name} HAS 'agent_router'.")
    else:
        module_logger.error(f"[MODULE_LOADED_DEBUG] Module {module_name} does NOT have 'agent_router'.")

    # --- Actual logic to find the router ---
    router_to_include = None
    agent_router_found_by_name = hasattr(module, 'agent_router')

    if agent_router_found_by_name and isinstance(module.agent_router, APIRouter):
        # This is the standard check
        router_to_include = module.agent_router
        module_logger.debug(f"Found 'agent_router' in {module_name} via standard check.")
    elif hasattr(module, 'routes') and hasattr(module.routes, 'agent_router') and isinstance(module.routes.agent_router, APIRouter):
        router_to_include = module.routes.agent_router
        module_logger.debug(f"Found 'agent_router' in {module_name}.routes")
    
    # Determine the conventional service class name
    parts = agent_module_dir.name.split('_')
    camel_cased_parts = [part.title() for part in parts]
    agent_service_class_name_candidate = "".join(camel_cased_parts) + "Service"
    if not hasattr(module, agent_service_class_name_candidate) and hasattr(module, "AgentService"):
        agent_service_class_name_candidate = "AgentService"

    # ALWAYS calculate the base_prefix for the agent module
    base_prefix = f"/agents/{category_name}/{agent_module_dir.name}" if category_name else f"/agents/{agent_module_dir.name}"

    if category_name == "business" and agent_module_dir.name == "metrics":
        module_logger.info(f"[METRICS_DEBUG] Calculated base_prefix: '{base_prefix}'")
        print(f"[METRICS_BOOLEAN_CHECK_DEBUG] For {module_name}: router_to_include is {router_to_include}. bool(router_to_include) is {bool(router_to_include)}")

    if router_to_include:
        print(f"[PROCESS_AGENT_PRINT_DEBUG] ENTERING 'if router_to_include' for {module_name}. router_to_include is truthy.")
        if category_name == "business" and agent_module_dir.name == "metrics":
            print(f"[METRICS_INCLUDE_PRINT_DEBUG] Before app.include_router for metrics. Prefix: {base_prefix}. Router object: {router_to_include}")
        
        try:
            app_to_configure.include_router(router_to_include, prefix=base_prefix, tags=tags)
            if category_name == "business" and agent_module_dir.name == "metrics":
                print(f"[METRICS_INCLUDE_PRINT_DEBUG] After app.include_router for metrics. SUCCESS.")
        except Exception as e_include:
            if category_name == "business" and agent_module_dir.name == "metrics":
                print(f"[METRICS_INCLUDE_PRINT_DEBUG] app.include_router for metrics FAILED: {e_include}")
            module_logger.error(f"Error including router for {module_name}: {e_include}", exc_info=True)
        
        # The check for agent_service_class_name_candidate should be outside and after this if/else on router_to_include
        # if it's meant to be an alternative. But current structure has it nested.
        # For now, assume if router_to_include is found, we don't try service-based routing for the same routes.
        # The original problematic structure was that the `else` for `if router_to_include` was being hit.

    else: # router_to_include is Falsy (None or otherwise)
        print(f"[PROCESS_AGENT_PRINT_DEBUG] router_to_include is FALSY for {module_name}. Value: {router_to_include}. Attempting service-based routing.")
        # ... (rest of the existing else block for service-based routing, which includes the CRITICAL logs for metrics)
        if hasattr(module, agent_service_class_name_candidate):
            agent_service_class = getattr(module, agent_service_class_name_candidate)
            # Prepare parameters for service instantiation
            init_params: Dict[str, Any] = {}
            sig = inspect.signature(agent_service_class.__init__)
            available_deps = {
                "task_store": task_store_provider(),
                "http_client": http_client_provider(),
                "supabase_client": supabase_client_provider(),
                # Note: openai_service is handled conditionally below
                "settings": settings # Directly pass the global settings object if type-hinted
            }

            for param_name, param in sig.parameters.items():
                if param_name == "self":
                    continue
                if param_name in available_deps:
                    init_params[param_name] = available_deps[param_name]
                # If a Pydantic settings class is type-hinted, FastAPI would normally inject it.
                # We mimic this by checking if the type annotation matches our AppSettings.
                elif param.annotation == Settings:
                     init_params[param_name] = settings # Pass the global settings object

            # Conditional injection for OrchestratorService's openai_service dependency
            if agent_service_class.__name__ == "OrchestratorAgentService" or agent_service_class_name_candidate == "OrchestratorService":
                key_to_print = settings.OPENAI_API_KEY if hasattr(settings, 'OPENAI_API_KEY') else 'NOT_FOUND'
                print(f"[ORCH_PRINT_DEBUG] In OrchestratorService init block. settings.OPENAI_API_KEY (first 5): '{key_to_print[:5] if key_to_print != 'NOT_FOUND' else 'NOT_FOUND'}'")
                current_openai_service = openai_service_provider() # This is get_original_openai_service
                print(f"[ORCH_PRINT_DEBUG] current_openai_service is None: {current_openai_service is None}")
                if current_openai_service:
                    init_params["openai_service"] = current_openai_service # Assign to existing init_params
            
            try:
                service_instance = agent_service_class(**init_params)
            except Exception as e_service_init:
                module_logger.error(f"Error initializing service {agent_service_class_name_candidate}: {e_service_init}", exc_info=True)
                if category_name == "business" and agent_module_dir.name == "metrics":
                    module_logger.error(f"[METRICS_DEBUG] CRITICAL: Failed to initialize service {agent_service_class_name_candidate} due to: {e_service_init}")
        else:
            module_logger.warning(f"No agent_router or service class candidate found in {agent_main_py}")
            if category_name == "business" and agent_module_dir.name == "metrics":
                module_logger.error(f"[METRICS_DEBUG] CRITICAL: No agent_router or service class candidate was found for metrics agent at {agent_main_py}!")

def load_agent_services(app_to_configure: FastAPI):
    logger.debug("Starting agent services loading process")
    agents_dir = Path(__file__).parent / "agents"
    
    if not agents_dir.exists():
        logger.warning(f"Agents directory not found at {agents_dir}")
        return
    
    # Process each category (department) directory
    for category_dir in agents_dir.iterdir():
        if not category_dir.is_dir() or category_dir.name.startswith('_'):
            continue
        
        # <<< TEMP MODIFICATION: Only process 'business' and 'system' categories >>>
        if category_dir.name not in ["business", "system"]:
            logger.debug(f"[TEMP_SKIP] Skipping category directory: {category_dir.name}")
            continue
        # <<< END TEMP MODIFICATION >>>
            
        logger.debug(f"Processing category directory: {category_dir.name}")
        
        # Process each agent directory within the category
        for agent_dir in category_dir.iterdir():
            if not agent_dir.is_dir() or agent_dir.name.startswith('_'):
                continue

            # <<< TEMP MODIFICATION: Further filter for specific agents >>>
            if category_dir.name == "business" and agent_dir.name != "metrics":
                logger.debug(f"[TEMP_SKIP] Skipping agent {agent_dir.name} in category {category_dir.name}")
                continue
            if category_dir.name == "system" and agent_dir.name != "orchestrator":
                logger.debug(f"[TEMP_SKIP] Skipping agent {agent_dir.name} in category {category_dir.name}")
                continue
            # <<< END TEMP MODIFICATION >>>
                
            # Construct the module path relative to apps.api
            module_base_path = f"apps.api.agents.{category_dir.name}.{agent_dir.name}"
            logger.debug(f"Processing agent: {agent_dir.name} in category {category_dir.name}")
            
            if category_dir.name == "business" and agent_dir.name == "metrics":
                print("[LOAD_AGENT_SERVICES_DEBUG] >>>>>> Calling process_agent_module for business/metrics NOW >>>>>>")

            process_agent_module(
                app_to_configure=app_to_configure,
                agent_module_dir=agent_dir,
                module_base_path_str=module_base_path,
                tags=[category_dir.name, agent_dir.name],
                category_name=category_dir.name
            )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("FastAPI application lifespan startup.")
    global _original_openai_service_instance
    print(f"[LIFESPAN_PRINT_DEBUG] Initializing _original_openai_service_instance. Checking settings.OPENAI_API_KEY.")
    effective_openai_key = os.getenv('OPENAI_API_KEY') # Try os.getenv first
    if not effective_openai_key and hasattr(settings, 'OPENAI_API_KEY'): # Fallback to pydantic settings
        effective_openai_key = settings.OPENAI_API_KEY
    
    key_preview = effective_openai_key[:5] if effective_openai_key else 'NOT_FOUND_OR_EMPTY'
    print(f"[LIFESPAN_PRINT_DEBUG] Effective OpenAI Key (first 5 chars): '{key_preview}'")

    if effective_openai_key:
        try:
            _original_openai_service_instance = OpenAIService(api_key=effective_openai_key)
            created_msg = f"[LIFESPAN_PRINT_DEBUG] _original_openai_service_instance CREATED. "
            created_msg += f"Is not None: {_original_openai_service_instance is not None}"
            print(created_msg)
        except Exception as e_openai_init:
            print(f"[LIFESPAN_PRINT_DEBUG] EXCEPTION during OpenAIService init: {e_openai_init}")
            _original_openai_service_instance = None
    else:
        _original_openai_service_instance = None
        print("[LIFESPAN_PRINT_DEBUG] _original_openai_service_instance set to None (no API key).")
    
    # ... (original http client init) ...
    global _original_http_client_instance
    _original_http_client_instance = httpx.AsyncClient()
    logger.debug("Initialized global HTTP client in lifespan")
    yield
    # Cleanup logic
    logger.info("FastAPI application lifespan shutdown.")
    if _original_http_client_instance:
        await _original_http_client_instance.aclose()
        logger.debug("Closed global HTTP client from lifespan")
    # No specific cleanup for _original_openai_service_instance unless it has an aclose method

def create_app() -> FastAPI:
    print("\n\n[CREATE_APP_DEBUG_MARKER] !!!!! EXECUTING create_app() from latest main.py !!!!!\n\n")
    print(f"[CREATE_APP_PRINT_DEBUG] At create_app start. Checking os.environ for OPENAI_API_KEY (first 5): '{os.getenv('OPENAI_API_KEY','NOT_IN_OS_ENVIRON')[:5]}'")
    if hasattr(settings, 'OPENAI_API_KEY'):
        print(f"[CREATE_APP_PRINT_DEBUG] Pydantic settings.OPENAI_API_KEY (first 5): '{settings.OPENAI_API_KEY[:5] if settings.OPENAI_API_KEY else 'EMPTY_OR_NONE'}'")
    else:
        print("[CREATE_APP_PRINT_DEBUG] Pydantic settings has NO OPENAI_API_KEY attribute.")
    logger.debug("Creating FastAPI application")
    
    new_app = FastAPI(
        title="MCP API",
        description="Multi-Agent Coordination Protocol API",
        version="1.0.0",
        lifespan=lifespan
    )
    
    # Configure CORS
    new_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # TODO: Configure this properly for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    logger.debug("Configured CORS middleware")

    # Include routers
    new_app.include_router(auth_router, prefix="/auth", tags=["auth"])
    new_app.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
    new_app.include_router(mcp_router, prefix="/mcp", tags=["mcp"])
    logger.debug("Included base routers")

    # Load agent services
    load_agent_services(new_app)
    logger.debug("Loaded agent services")

    @new_app.exception_handler(A2AJSONRPCError)
    async def jsonrpc_exception_handler(request: Any, exc: A2AJSONRPCError):
        logger.warning(f"JSONRPC error occurred: {exc}")
        error_content = {
            "code": exc.code,
            "message": exc.message,
            "data": exc.data if hasattr(exc, 'data') else None
        }
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": error_content}
        )

    @new_app.exception_handler(HTTPException)
    async def http_exception_handler(request: Any, exc: HTTPException):
        logger.warning(f"HTTP exception occurred: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"message": exc.detail}}
        )

    @new_app.get("/")
    async def read_root():
        return {"message": "MCP API is running"}

    @new_app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    logger.info("FastAPI application created successfully")
    return new_app

# Global app instance for normal execution (e.g., uvicorn main:app)
app = create_app()
print(f"[MAIN_MODULE] Global 'app' instance created: {id(app)}")

if __name__ == "__main__":
    import uvicorn
    # Uvicorn will use the global 'app' instance
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True) 