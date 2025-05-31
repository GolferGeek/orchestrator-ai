import sys
import os
import httpx
from fastapi import FastAPI, HTTPException, APIRouter, Depends, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import importlib.util
from pathlib import Path
from typing import Optional, Callable, Any, Dict, List
from functools import partial
from contextlib import asynccontextmanager
import logging
from fastapi.middleware.cors import CORSMiddleware
import uuid
import inspect

# Load environment variables from project root .env file
# Construct the path to the root .env file relative to this main.py file
# This main.py is now at apps/api/python/fastapi-v2/main.py
# Project root is 4 levels up.
_MAIN_PY_PATH = Path(__file__).resolve()
_PROJECT_ROOT_FOR_DOTENV = _MAIN_PY_PATH.parents[4]
_DOTENV_PATH = _PROJECT_ROOT_FOR_DOTENV / ".env"

if _DOTENV_PATH.exists():
    load_dotenv(dotenv_path=_DOTENV_PATH)
    print(f"[V2 MAIN_PY_DEBUG] Loaded .env from: {_DOTENV_PATH}")
else:
    print(f"[V2 MAIN_PY_DEBUG] WARNING: Root .env file NOT FOUND at {_DOTENV_PATH}. Using system env vars or defaults.")

# Import shared constants for cleaner imports and centralized configuration
from apps.api.v2.fastapi.shared.constants import (
    A2A_PROTOCOL_MODULE, APP_TITLE, APP_DESCRIPTION, APP_VERSION,
    AUTH_PREFIX, SESSIONS_PREFIX, MCP_PREFIX, AGENTS_PREFIX,
    AUTH_TAG, SESSIONS_TAG, MCP_TAG,
    CORS_ALLOW_ORIGINS, CORS_ALLOW_CREDENTIALS, CORS_ALLOW_METHODS, CORS_ALLOW_HEADERS,
    AGENTS_DIRECTORY, BASE_DIRECTORY, MAIN_FILE,
    EXCLUDED_DIR_PREFIXES, EXCLUDED_DIRS,
    AGENTS_MODULE_BASE,
    DEFAULT_HOST, DEFAULT_PORT, DEFAULT_ENV_PORT_VAR,
    API_RUNNING_MESSAGE, HEALTH_STATUS_HEALTHY, HEALTH_STATUS_OK,
    ERROR_MESSAGE_KEY,
    OPENAI_API_KEY_VAR, LOG_LEVEL_VAR, DEFAULT_LOG_LEVEL,
    NOT_FOUND_MESSAGE, NOT_IN_OS_ENVIRON
)

# Configure logging with a more structured approach
def setup_logging():
    # Get log level from environment variable, default to WARNING
    log_level_str = os.getenv(LOG_LEVEL_VAR, DEFAULT_LOG_LEVEL).upper()
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

# Adjusted imports to use shared contracts from the v2 generated types
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import (
    TaskSendParams, Message, Task, TaskStatus, TaskState, TextPart, 
    ErrorCode as A2AErrorCode, AgentCard # A2AJSONRPCError is a Pydantic model, not an Exception
)
from apps.api.v2.fastapi.a2a_protocol.task_store import TaskStoreService
from apps.api.v2.fastapi.llm.openai_service import OpenAIService
from apps.api.v2.fastapi.core.config import settings, Settings
from apps.api.v2.fastapi.core.db import get_supabase_client, get_current_supabase_client, get_anon_supabase_client, get_current_supabase_service_client
from supabase import Client as SupabaseClient # Import directly

# Import auth dependencies with fallback
try:
    from apps.api.v2.fastapi.auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user
    from apps.api.v2.fastapi.shared.auth_utils import oauth2_scheme
    logger.debug("Successfully imported auth dependencies")
except ImportError as e:
    logger.warning(f"Failed to import auth dependencies: {e}. Using fallback.")
    # Create minimal fallback functions for testing/development
    async def get_current_authenticated_user():
        return {"id": "test-user", "role": "authenticated"}
    async def get_supabase_client_as_current_user():
        return get_supabase_client()

from apps.api.v2.fastapi.auth.schemas import SupabaseAuthUser 
from apps.api.v2.fastapi.sessions.schemas import SessionCreate, SessionResponse, SessionListResponse # Assuming these are needed from sessions

# Import the MCP router from its new location
from apps.api.v2.fastapi.shared.mcp.mcp_routes import mcp_router
from apps.api.v2.fastapi.auth.routes import router as auth_router # Import the new auth router
from apps.api.v2.fastapi.sessions.routes import router as sessions_router # Import the new sessions router

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
        openai_key = getattr(settings, OPENAI_API_KEY_VAR, None) if hasattr(settings, OPENAI_API_KEY_VAR) else None
        print(f"[GET_ORIG_OPENAI_DEBUG] Attempting to check settings.{OPENAI_API_KEY_VAR}: '{openai_key[:5] if openai_key else 'NOT_FOUND'}'")
        if openai_key: # Check again, in case it was called before lifespan init
            print("[GET_ORIG_OPENAI_DEBUG] Key found, attempting to create a fallback instance. THIS IS UNEXPECTED if lifespan ran.")
            # Fallback, ideally lifespan should have created it.
            # Avoid creating multiple, this is more for a direct call scenario before lifespan has run.
            # If this path is hit regularly, review call order.
            return OpenAIService(api_key=openai_key) 
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
    agent_main_py_path: Path,
    module_base_path_str: str,
    tags: list[str],
    category_name: str,
    agent_name_override: Optional[str] = None,
    openai_service_provider: Callable[[], Optional[OpenAIService]] = get_original_openai_service,
    http_client_provider: Callable[[], httpx.AsyncClient] = get_original_http_client,
    task_store_provider: Callable[[], TaskStoreService] = get_original_task_store_service,
    supabase_client_provider: Callable[[], Optional[SupabaseClient]] = get_original_supabase_client
):
    # agent_identifier is used for logging and potentially for module naming if spec_from_file_location needs a unique name part
    # If it's a parent agent, its identifier is just the category. If child, category_agent.
    agent_identifier_for_module_name = agent_name_override if agent_name_override else agent_module_dir.name
    effective_agent_name_for_prefix = agent_name_override if agent_name_override else agent_module_dir.name

    module_logger = logging.getLogger(f"agent_loader.{category_name}.{agent_identifier_for_module_name}")
    module_logger.debug(f"Processing agent module: {agent_identifier_for_module_name} from {agent_main_py_path}")

    # Use module_base_path_str directly as it's the full Python path for the module
    # spec_from_file_location requires a unique module name, module_base_path_str should be unique.
    spec = importlib.util.spec_from_file_location(module_base_path_str, agent_main_py_path)
    if not (spec and spec.loader):
        module_logger.warning(f"Could not create spec for {agent_main_py_path} with module name {module_base_path_str}")
        return

    module = importlib.util.module_from_spec(spec)
    # Make sure __package__ is set correctly for relative imports within the loaded module to work.
    # It should be the parent package path. For ...agents.business.main, package is ...agents.business
    # For ...agents.business.metrics.main, package is ...agents.business.metrics
    module.__package__ = module_base_path_str

    try:
        spec.loader.exec_module(module)
        module_logger.info(f"Successfully executed module {module_base_path_str} from {agent_main_py_path}")
    except Exception as e:
        module_logger.error(f"Error executing module {module_base_path_str} from {agent_main_py_path}: {e}", exc_info=True)
        return
    
    router_to_include = getattr(module, 'agent_router', None)

    if router_to_include and isinstance(router_to_include, APIRouter):
        # Determine the API prefix
        # If agent_name_override is present (e.g. "business"), it's a parent agent for that category.
        # Its path is /agents/category_name, e.g. /agents/business
        if agent_name_override:
            base_prefix = f"{AGENTS_PREFIX}/{category_name}"
            module_logger.info(f"Including PARENT agent router for {category_name}.{agent_name_override} with prefix: {base_prefix}")
        else:
            # It's a child agent, path is /agents/category_name/agent_name
            # agent_module_dir.name here is the actual child agent's folder name (e.g., "metrics")
            base_prefix = f"{AGENTS_PREFIX}/{category_name}/{agent_module_dir.name}"
            module_logger.info(f"Including CHILD agent router for {category_name}.{agent_module_dir.name} with prefix: {base_prefix}")
        
        try:
            app_to_configure.include_router(router_to_include, prefix=base_prefix, tags=tags)
            module_logger.info(f"Successfully included router for {module_base_path_str} with prefix {base_prefix}")
        except Exception as e_include:
            module_logger.error(f"Error including router for {module_base_path_str} with prefix {base_prefix}: {e_include}", exc_info=True)
    else:
        module_logger.warning(f"No 'agent_router' (APIRouter instance) found in {module_base_path_str} at {agent_main_py_path}")

def load_agent_services(app_to_configure: FastAPI):
    logger.debug("Starting agent services loading process")
    agents_base_dir = Path(__file__).parent / AGENTS_DIRECTORY
    
    if not agents_base_dir.exists():
        logger.warning(f"Agents directory not found at {agents_base_dir}")
        return
    
    # Process each category (department) directory
    for category_dir in agents_base_dir.iterdir():
        if not category_dir.is_dir() or any(category_dir.name.startswith(prefix) for prefix in EXCLUDED_DIR_PREFIXES) or category_dir.name in EXCLUDED_DIRS:
            continue
        
        category_name = category_dir.name
        logger.debug(f"Processing category directory: {category_name}")

        # 1. Check for a parent agent (main.py directly in the category folder)
        parent_agent_main_py = category_dir / MAIN_FILE
        if parent_agent_main_py.exists():
            logger.info(f"Found parent agent main.py in category: {category_name}")
            # Parent agent's module name is effectively the category itself for routing purposes
            # The module path for import needs to be correct
            parent_module_base_path = f"{AGENTS_MODULE_BASE}.{category_name}"
            # Use process_agent_module, but agent_name for prefix calculation will be category_name
            # We pass agent_module_dir as category_dir and agent_name_override as category_name
            process_agent_module(
                app_to_configure=app_to_configure,
                agent_module_dir=category_dir, # The directory containing main.py is the category_dir
                agent_main_py_path=parent_agent_main_py, # Pass the direct path to main.py
                module_base_path_str=parent_module_base_path,
                # For parent, prefix uses only category, no sub-agent name
                # The process_agent_module will need adjustment to handle this, or we construct prefix here
                # For a parent agent like 'business', its prefix is /agents/business
                # The tags can just be the category name
                tags=[category_name.capitalize()],
                category_name=category_name, # Pass category_name
                agent_name_override=category_name # Indicates this is a category-level (parent) agent
            )

        # 2. Process each child agent directory within the category
        for agent_dir in category_dir.iterdir():
            if not agent_dir.is_dir() or any(agent_dir.name.startswith(prefix) for prefix in EXCLUDED_DIR_PREFIXES) or agent_dir.name in EXCLUDED_DIRS:
                continue
            
            # Skip if agent_dir is actually the main.py file we just processed for a parent
            if agent_dir.name == MAIN_FILE: # This check might be redundant if iterdir only gives dirs
                continue
            
            # This is for child agents, e.g., agents/business/metrics/main.py
            child_agent_main_py = agent_dir / MAIN_FILE
            if not child_agent_main_py.exists():
                logger.debug(f"No main.py in child agent directory: {agent_dir}, skipping.")
                continue

            agent_name = agent_dir.name
            logger.debug(f"Processing child agent: {agent_name} in category {category_name}")
            
            # Module base path for child agent: apps.api.v2.fastapi.agents.category_name.agent_name
            child_module_base_path = f"{AGENTS_MODULE_BASE}.{category_name}.{agent_name}"
            
            process_agent_module(
                app_to_configure=app_to_configure,
                agent_module_dir=agent_dir, # The specific child agent's directory
                agent_main_py_path=child_agent_main_py, # Pass the direct path to main.py
                module_base_path_str=child_module_base_path,
                tags=[category_name.capitalize(), agent_name.capitalize()],
                category_name=category_name, # Pass category_name
                agent_name_override=None # No override, use agent_dir.name
            )
    logger.info("Finished agent services loading process.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("FastAPI application lifespan startup.")
    global _original_openai_service_instance
    print(f"[LIFESPAN_PRINT_DEBUG] Initializing _original_openai_service_instance. Checking settings.{OPENAI_API_KEY_VAR}.")
    effective_openai_key = os.getenv(OPENAI_API_KEY_VAR) # Try os.getenv first
    if not effective_openai_key and hasattr(settings, OPENAI_API_KEY_VAR): # Fallback to pydantic settings
        effective_openai_key = getattr(settings, OPENAI_API_KEY_VAR)
    
    key_preview = effective_openai_key[:5] if effective_openai_key else NOT_FOUND_MESSAGE
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
    print(f"[CREATE_APP_PRINT_DEBUG] At create_app start. Checking os.environ for OPENAI_API_KEY (first 5): '{os.getenv(OPENAI_API_KEY_VAR, NOT_IN_OS_ENVIRON)[:5]}'")
    if hasattr(settings, OPENAI_API_KEY_VAR):
        openai_key = getattr(settings, OPENAI_API_KEY_VAR)
        print(f"[CREATE_APP_PRINT_DEBUG] Pydantic settings.OPENAI_API_KEY (first 5): '{openai_key[:5] if openai_key else 'EMPTY_OR_NONE'}'")
    else:
        print(f"[CREATE_APP_PRINT_DEBUG] Pydantic settings has NO {OPENAI_API_KEY_VAR} attribute.")
    logger.debug("Creating FastAPI application")
    
    new_app = FastAPI(
        title=APP_TITLE,
        description=APP_DESCRIPTION,
        version=APP_VERSION,
        lifespan=lifespan
    )
    
    # Configure CORS
    new_app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,  # TODO: Configure this properly for production
        allow_credentials=CORS_ALLOW_CREDENTIALS,
        allow_methods=CORS_ALLOW_METHODS,
        allow_headers=CORS_ALLOW_HEADERS,
    )
    logger.debug("Configured CORS middleware")

    # Include routers
    new_app.include_router(auth_router, prefix=AUTH_PREFIX, tags=[AUTH_TAG])
    new_app.include_router(sessions_router, prefix=SESSIONS_PREFIX, tags=[SESSIONS_TAG])
    new_app.include_router(mcp_router, prefix=MCP_PREFIX, tags=[MCP_TAG])
    logger.debug("Included base routers")

    # Load agent services
    load_agent_services(new_app)
    logger.debug("Loaded agent services")

    # Note: A2AJSONRPCError is a Pydantic model, not an Exception, so we can't register it as an exception handler
    # If needed, create a proper Exception class that wraps A2AJSONRPCError
    
    @new_app.exception_handler(HTTPException)
    async def http_exception_handler(request: Any, exc: HTTPException):
        logger.warning(f"HTTP exception occurred: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {ERROR_MESSAGE_KEY: exc.detail}}
        )

    @new_app.get("/")
    async def read_root():
        return {ERROR_MESSAGE_KEY: API_RUNNING_MESSAGE}

    @new_app.get("/health")
    async def health_check():
        return {"status": HEALTH_STATUS_HEALTHY}

    @new_app.options("/health")
    async def health_check_options():
        return {"status": HEALTH_STATUS_OK}

    logger.info("FastAPI application created successfully")
    return new_app

# Global app instance for normal execution (e.g., uvicorn main:app)
app = create_app()
print(f"[MAIN_MODULE] Global 'app' instance created: {id(app)}")

if __name__ == "__main__":
    import uvicorn
    # Uvicorn will use the global 'app' instance
    uvicorn.run("main:app", host=DEFAULT_HOST, port=int(os.getenv(DEFAULT_ENV_PORT_VAR, DEFAULT_PORT)), reload=True) 