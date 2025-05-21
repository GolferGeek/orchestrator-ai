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

from fastapi import FastAPI, HTTPException, APIRouter, Depends, status # MODIFIED: Added status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import importlib.util
from pathlib import Path
from typing import Optional, Callable, Any, Dict # Added Dict
from functools import partial
from contextlib import asynccontextmanager
import logging # Import the logging module
from fastapi.middleware.cors import CORSMiddleware
import uuid # For new session ID generation

# Configure basic logging for the application
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Use absolute imports
from apps.api.v1.a2a_protocol.task_store import TaskStoreService
from apps.api.v1.a2a_protocol.types import (
    TaskSendParams, Message, Task, TaskStatus, TaskState, TextPart, 
    AgentCard, ErrorCode as A2AErrorCode, JSONRPCError as A2AJSONRPCError
)
from apps.api.v1.llm.openai_service import OpenAIService
from apps.api.v1.core.config import settings
from apps.api.v1.core.db import get_supabase_client, get_current_supabase_client, get_anon_supabase_client, get_current_supabase_service_client
from supabase import Client as SupabaseClient
from apps.api.v1.auth.dependencies import get_current_authenticated_user, get_supabase_client_as_current_user, oauth2_scheme
from apps.api.v1.auth.schemas import SupabaseAuthUser
from apps.api.v1.sessions.schemas import SessionCreate, SessionResponse, SessionListResponse

# Import the MCP router
from apps.api.v1.shared.mcp.mcp_routes import mcp_router
from apps.api.v1.auth.routes import router as auth_router
from apps.api.v1.sessions.routes import router as sessions_router

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

_original_supabase_client_instance: Optional[SupabaseClient] = None
if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY: # Use ANON_KEY for general client
    _original_supabase_client_instance = get_supabase_client() # Uses settings internally
else:
    print("[MAIN_FACTORY_GLOBALS] Supabase credentials not found. Original SupabaseClient is None.")

_original_http_client_instance: Optional[httpx.AsyncClient] = None # Will be managed by app state via lifespan

# --- Original Provider Functions (Defaults) ---
def get_original_task_store_service() -> TaskStoreService:
    print("[MAIN_FACTORY_PROVIDER] get_original_task_store_service CALLED")
    return _original_task_store_service_instance

def get_original_openai_service() -> Optional[OpenAIService]:
    print(f"[MAIN_FACTORY_PROVIDER] get_original_openai_service CALLED, returning: {_original_openai_service_instance}")
    return _original_openai_service_instance

def get_original_supabase_client() -> Optional[SupabaseClient]:
    print(f"[MAIN_FACTORY_PROVIDER] get_original_supabase_client CALLED, returning: {_original_supabase_client_instance}")
    return _original_supabase_client_instance

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
    task_store_provider: Callable[[], TaskStoreService] = get_original_task_store_service,
    supabase_client_provider: Callable[[], Optional[SupabaseClient]] = get_original_supabase_client # Added supabase_client_provider
):
    logger = logging.getLogger(f"agent_loader.{agent_module_dir.name}")
    logger.info(f"Processing agent module: {agent_module_dir.name}")
    agent_main_py = agent_module_dir / "main.py"
    # module_name is constructed by load_agent_services to be relative to apps.api
    module_name = module_base_path_str 

    spec = importlib.util.spec_from_file_location(module_name, agent_main_py)
    if not (spec and spec.loader):
        logger.warning(f"Could not create spec for {agent_main_py} with module name {module_name}")
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

    if agent_module_dir.name == "orchestrator": # DEBUG for orchestrator
        print(f"DEBUG_ORCH: Orchestrator module found. Service class candidate: {agent_service_class_name_candidate}")
        actual_class_name = "NOT_FOUND"
        if hasattr(module, agent_service_class_name_candidate):
            actual_class_name = getattr(module, agent_service_class_name_candidate).__name__
        print(f"DEBUG_ORCH: Actual service class name from module: {actual_class_name}")

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
                
                init_params: Dict[str, Any] = {
                    "task_store": current_task_store,
                    "http_client": current_http_client,
                    "agent_name": agent_module_dir.name # agent_name is needed for these dynamically routed services
                }

                # Add department_name if the agent is in a category (department)
                if category_name:
                    init_params["department_name"] = category_name
                
                # Special handling for OrchestratorService to inject dependencies
                if agent_service_class.__name__ == "OrchestratorService":
                    if agent_module_dir.name == "orchestrator": print(f"DEBUG_ORCH: Matched {agent_service_class.__name__} for dependency injection.") # DEBUG
                    current_openai_service = openai_service_provider()
                    if current_openai_service:
                        init_params["openai_service"] = current_openai_service
                    
                    current_supabase_client_instance = supabase_client_provider() # Get Supabase client
                    if current_supabase_client_instance:
                        init_params["supabase_client"] = current_supabase_client_instance
                        if agent_module_dir.name == "orchestrator": print(f"DEBUG_ORCH: Supabase client injected for OrchestratorService.") # DEBUG
                    else:
                        if agent_module_dir.name == "orchestrator": print(f"DEBUG_ORCH: Warning: Supabase client is None for Orchestrator.") # DEBUG
                
                if agent_module_dir.name == "orchestrator": print(f"DEBUG_ORCH: Initializing {agent_service_class.__name__} instance...") # DEBUG
                agent_service_instance = agent_service_class(**init_params)
                if agent_module_dir.name == "orchestrator": # DEBUG for orchestrator
                    print(f"DEBUG_ORCH: {agent_service_class.__name__} instance created: {type(agent_service_instance)}")
                    print(f"DEBUG_ORCH: hasattr(get_agent_card): {hasattr(agent_service_instance, 'get_agent_card')}")
                    print(f"DEBUG_ORCH: hasattr(handle_task_send for generic path): {hasattr(agent_service_instance, 'handle_task_send')}")
                    print(f"DEBUG_ORCH: Is actual class OrchestratorService: {agent_service_class.__name__ == 'OrchestratorService'}")

                router = APIRouter()
                base_prefix = f"/agents/{category_name}/{agent_module_dir.name}" if category_name else f"/agents/{agent_module_dir.name}"

                # --- Route for /tasks ---
                if agent_service_class.__name__ == "OrchestratorService":
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Matched OrchestratorService for custom /tasks POST route.") # DEBUG
                    
                    # Create a new session if one is not provided or if it's an invalid format
                    # This logic is now being centralized here before calling process_message
                    async def create_new_db_session_if_needed(
                        user_id: str, 
                        session_name: Optional[str] = None,
                        db_client: SupabaseClient = Depends(get_current_supabase_client) # Use standard client
                    ) -> str: # returns session_id
                        if db_client is None:
                            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database client not available for session creation")
                        try:
                            session_data_to_insert = {"user_id": user_id, "name": name}
                            if session_name: session_data_to_insert["name"] = session_name

                            response = db_client.table("sessions").insert(session_data_to_insert).execute()
                            if response.data and len(response.data) > 0:
                                new_session_id = str(response.data[0]['id'])
                                logger.info(f"Created new session {new_session_id} for user {user_id}")
                                return new_session_id
                            else:
                                logger.error(f"Failed to create session or retrieve ID for user {user_id}. DB Response: {response}")
                                raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not create new session.")
                        except Exception as e:
                            logger.error(f"Error creating new session for user {user_id}: {e}", exc_info=True)
                            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error processing session.")

                    async def orchestrator_task_handler(
                        params: TaskSendParams,
                        current_user: SupabaseAuthUser = Depends(get_current_authenticated_user),
                        user_supabase_client: SupabaseClient = Depends(get_supabase_client_as_current_user),
                        current_task_store: TaskStoreService = Depends(get_original_task_store_service),
                        anon_supabase_client: SupabaseClient = Depends(get_anon_supabase_client)
                    ):
                        user_id = str(current_user.id)
                        effective_session_id = params.session_id

                        # Ensure task exists in the store before processing
                        # The A2AAgentBaseService.handle_task_send usually does this.
                        # We need to replicate or call it here for the custom handler.
                        logger.info(f"Orchestrator task handler: Ensuring task {params.id} for user {user_id} exists in store.")
                        task_and_history = await current_task_store.create_or_get_task(
                            task_id=params.id,
                            request_message=params.message,
                            session_id=effective_session_id, # Pass current session_id
                            metadata=params.metadata
                        )
                        if not task_and_history or not task_and_history.task:
                            logger.error(f"Orchestrator task handler: Failed to create or get task {params.id} in store.")
                            raise HTTPException(500, detail="Failed to initialize task in store.")
                        
                        # Ensure task_id in params is updated if a new one was generated by store
                        params.id = task_and_history.task.id
                        logger.info(f"Orchestrator task handler: Task {params.id} ready. Current state: {task_and_history.task.status.state}")

                        # If task is already in a final state, perhaps return it directly (optional, depends on desired behavior)
                        if task_and_history.task.status.state in [TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELED]:
                            logger.info(f"Orchestrator task handler: Task {params.id} already in final state {task_and_history.task.status.state}. Returning current task data.")
                            return task_and_history.task # Return the existing final task
                        
                        # Update task to WORKING if it's PENDING
                        if task_and_history.task.status.state == TaskState.PENDING:
                            await current_task_store.update_task_status(
                                params.id, 
                                TaskState.WORKING,
                                status_update_message=agent_service_instance._create_text_message("Orchestrator processing task.")
                            )

                        if not effective_session_id: # No session_id provided by client
                            logger.info(f"Orchestrator task for user {user_id}: No session_id provided, creating new session.")
                            supabase_client_for_session = anon_supabase_client
                            if not supabase_client_for_session:
                                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DB client unavailable for session creation.")

                            try:
                                # Corrected logic for session_name_from_message
                                session_name_from_message = "New Chat" # Default session name
                                if params.message and params.message.parts:
                                    first_part_model = params.message.parts[0]
                                    if hasattr(first_part_model, 'root') and isinstance(first_part_model.root, TextPart):
                                        session_name_from_message = first_part_model.root.text[:50]
                                
                                new_session_data = {
                                    "user_id": user_id,
                                    "session_name": session_name_from_message,
                                    "metadata": {"created_by": "orchestrator", "task_id": str(params.id)}
                                }
                                # ... (rest of session creation logic) ...
                            except Exception as e:
                                logger.error(f"Error creating new session for user {user_id}: {e}", exc_info=True)
                                raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Error processing session.")

                        elif not isinstance(effective_session_id, str) or not len(effective_session_id) == 36: # Basic UUID check
                            logger.warning(f"Orchestrator task for user {user_id}: Invalid session_id format '{effective_session_id}'. Creating new session.")
                            supabase_client_for_session = None
                            async for client_gen in get_current_supabase_client(): 
                                supabase_client_for_session = client_gen
                                break
                            if not supabase_client_for_session:
                                 raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "DB client unavailable for session creation.")
                            
                            # Corrected logic for session_name_from_message
                            session_name_from_message = "New Chat" # Default session name
                            if params.message and params.message.parts:
                                first_part_model = params.message.parts[0]
                                if hasattr(first_part_model, 'root') and isinstance(first_part_model.root, TextPart):
                                    session_name_from_message = first_part_model.root.text[:50]
                            
                            effective_session_id = await create_new_db_session_if_needed(user_id, session_name_from_message, supabase_client_for_session)
                            params.session_id = effective_session_id


                        # Now call the original process_message with user_id and guaranteed session_id
                        # The OrchestratorService instance itself has its own supabase_client for history.
                        # THIS NEEDS TO BE CHANGED: process_message must use the user_supabase_client for history
                        response_message = await agent_service_instance.process_message(
                            message=params.message,
                            task_id=params.id, # This should be the incoming task_id
                            session_id=effective_session_id,
                            user_id=user_id,
                            # We need to pass user_supabase_client here, or OrchestratorService.process_message needs to get it
                            # For now, let's assume OrchestratorService.process_message will be refactored to accept it
                            # or its instantiation of SupabaseChatMessageHistory is changed.
                            # Option A: Pass it to process_message
                            db_client_for_history=user_supabase_client 
                        )
                        # Construct and return Task object
                        # This part needs to align with A2AAgentBaseService.handle_task_send's final response structure
                        # For now, just return the message, base service will wrap it in Task
                        # Ensure session_id_used in metadata for base service to pick up
                        response_message.metadata = response_message.metadata or {}
                        response_message.metadata["session_id_used"] = effective_session_id
                        
                        # Simulate Task structure for response_model=Task
                        # This should ideally be handled by a refactored A2AAgentBaseService.handle_task_send
                        # or a shared utility. For now, a minimal Task-like dict.
                        # This is a temporary shim. A2AAgentBaseService.handle_task_send is the one returning Task.
                        # The route here should just return what process_message returns, and the base service
                        # handle_task_send (if it were called directly) would create the Task.
                        # The dynamic routing bypasses the base handle_task_send directly for this custom handler.

                        # The route for Orchestrator will now directly return the Task
                        # This custom handler now has to do what A2ABaseService.handle_task_send would do
                        # in terms of creating the final Task object.

                        # Update task in store after processing
                        logger.info(f"Orchestrator task handler: Attempting to update task {params.id} to COMPLETED.")
                        completed_task_data = await current_task_store.update_task_status(
                            params.id,
                            TaskState.COMPLETED, 
                            response_message=response_message,
                            status_update_message=agent_service_instance._create_text_message("Task completed by orchestrator.")
                        )
                        if not completed_task_data or not completed_task_data.task:
                            raise HTTPException(500, detail="Failed to finalize task in store.")
                        
                        # Ensure session_id is correctly set on the final task object by handle_task_send logic
                        # The metadata["session_id_used"] helps if OrchestratorService itself wants to update it
                        # but A2AAgentBaseService.handle_task_send is the one that populates Task.session_id
                        # Since we are bypassing the base class's handle_task_send, we must ensure it here.
                        completed_task_data.task.session_id = effective_session_id # Ensure it!
                        if completed_task_data.task.response_message:
                            completed_task_data.task.response_message.metadata = completed_task_data.task.response_message.metadata or {}
                            completed_task_data.task.response_message.metadata["session_id_used"] = effective_session_id


                        return completed_task_data.task


                    router.add_api_route("/tasks", orchestrator_task_handler, methods=["POST"], response_model=Task, tags=tags)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added custom /tasks POST route for orchestrator.") # DEBUG
                    logger.info("Added authenticated /tasks route for OrchestratorService")
                else: # For other agents
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: DID NOT match OrchestratorService for custom /tasks POST, would use generic if this branch was hit for orchestrator (it shouldn't).") # DEBUG
                    router.add_api_route("/tasks", agent_service_instance.handle_task_send, methods=["POST"], response_model=Task, tags=tags)
                
                if hasattr(agent_service_instance, "get_agent_card"):
                    router.add_api_route("/agent-card", agent_service_instance.get_agent_card, methods=["GET"], response_model=AgentCard, tags=tags)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added /agent-card route.") # DEBUG
                else: # DEBUG
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: OrchestratorService instance does NOT have get_agent_card.") # DEBUG

                if hasattr(agent_service_instance, "handle_task_get"):
                    router.add_api_route(f"/tasks/{{task_id}}", agent_service_instance.handle_task_get, methods=["GET"], response_model=Optional[Task], tags=tags)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added /tasks/{task_id} GET route.") # DEBUG
                else: # DEBUG
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: OrchestratorService instance does NOT have handle_task_get.") # DEBUG
                
                if hasattr(agent_service_instance, "handle_task_cancel"):
                    router.add_api_route(f"/tasks/{{task_id}}", agent_service_instance.handle_task_cancel, methods=["DELETE"], response_model=dict, tags=tags)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added /tasks/{task_id} DELETE route.") # DEBUG
                else: # DEBUG
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: OrchestratorService instance does NOT have handle_task_cancel.") # DEBUG
                
                if hasattr(module, "get_agent_discovery") and callable(getattr(module, "get_agent_discovery")):
                    router.add_api_route("/.well-known/agent.json", getattr(module, "get_agent_discovery"), methods=["GET"], tags=tags, include_in_schema=False)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added /.well-known/agent.json route from module.get_agent_discovery.") # DEBUG
                elif hasattr(agent_service_instance, "get_agent_card"): 
                    router.add_api_route("/.well-known/agent.json", agent_service_instance.get_agent_card, methods=["GET"], response_model=AgentCard, tags=tags, include_in_schema=False)
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Added /.well-known/agent.json route from service.get_agent_card.") # DEBUG
                else: # DEBUG
                    if agent_module_dir.name == "orchestrator": print("DEBUG_ORCH: Orchestrator module/service does NOT have a .well-known/agent.json provider.") # DEBUG


                if router.routes:
                    if agent_module_dir.name == "orchestrator":
                        print(f"DEBUG_ORCH: Router has routes. Including ORCHESTRATOR router with prefix: {base_prefix}")
                    app_to_configure.include_router(router, prefix=base_prefix, tags=tags)
                    logger.info(f"Included service-based router for {agent_module_dir.name} using {agent_service_class_name_candidate}")
                else: # router.routes is empty
                    if agent_module_dir.name == "orchestrator":
                        print(f"DEBUG_ORCH: Router has NO routes. Not including orchestrator router.") # THIS IS KEY

            except Exception as e:
                if agent_module_dir.name == "orchestrator": # DEBUG
                    print(f"DEBUG_ORCH: EXCEPTION during orchestrator service processing: {e}")
                logger.error(f"Error processing agent module {agent_module_dir.name} for {agent_service_class_name_candidate}: {e}", exc_info=True)
        else: # service class not found
            if agent_module_dir.name == "orchestrator": # DEBUG
                print(f"DEBUG_ORCH: Orchestrator service class '{agent_service_class_name_candidate}' not found in module.")
            logger.warning(f"No agent_router or service class candidate found in {agent_main_py}")

def load_agent_services(app_to_configure: FastAPI):
    logger = logging.getLogger("load_agent_services")
    logger.info(f"Called for app: {id(app_to_configure)}. Overrides: {app_to_configure.dependency_overrides}")
    agents_base_dir = Path(__file__).parent / "agents"

    actual_openai_provider = app_to_configure.dependency_overrides.get(get_original_openai_service, get_original_openai_service)
    actual_http_client_provider = app_to_configure.dependency_overrides.get(get_original_http_client, get_original_http_client)
    actual_task_store_provider = app_to_configure.dependency_overrides.get(get_original_task_store_service, get_original_task_store_service)
    actual_supabase_client_provider = app_to_configure.dependency_overrides.get(get_original_supabase_client, get_original_supabase_client)
    
    logger.info(f"Resolved openai_provider: {actual_openai_provider.__name__}")
    logger.info(f"Resolved supabase_client_provider: {actual_supabase_client_provider.__name__}")

    for agent_category_dir in agents_base_dir.iterdir():
        if agent_category_dir.is_dir() and (agent_category_dir / "__init__.py").exists():
            shared_providers = {
                "openai_service_provider": actual_openai_provider,
                "http_client_provider": actual_http_client_provider,
                "task_store_provider": actual_task_store_provider,
                "supabase_client_provider": actual_supabase_client_provider
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

# --- Lifespan Context Manager (CORSMiddleware removed from here) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print(f"[LIFESPAN_MANAGER] Startup for app {id(app)}.")
    app.state.http_client = httpx.AsyncClient()
    print(f"[LIFESPAN_MANAGER] Created app.state.http_client: {app.state.http_client} for app {id(app)}")

    print(f"[LIFESPAN_MANAGER] Loading agent services for app {id(app)}.")
    load_agent_services(app_to_configure=app) # Keep agent loading here if it depends on app state or other lifespan resources
    print(f"[LIFESPAN_MANAGER] Agent services loaded for app {id(app)}.")
    
    yield # Application is running
    
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

    # --- Add CORSMiddleware here, after app creation and before routers/routes ---
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # "http://localhost:8100", # If using ionic serve
    ]

    new_app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print(f"[CREATE_APP] Added CORSMiddleware for app {id(new_app)}.")
    # --- End CORS section ---

    # --- Include Shared Utility Routers ---
    new_app.include_router(mcp_router)
    print(f"[CREATE_APP] Included shared MCP router for app {id(new_app)}.")

    # --- Include Auth Router ---
    new_app.include_router(auth_router)
    print(f"[CREATE_APP] Included auth router for app {id(new_app)}.")

    # --- Include Sessions Router ---
    new_app.include_router(sessions_router)
    print(f"[CREATE_APP] Included sessions router for app {id(new_app)}.")

    # --- Load Agent Services (Moved to lifespan if they need lifespan resources, or can be here if not) ---
    # If load_agent_services does NOT depend on app.state.http_client being ready,
    # it could potentially be called here too. But keeping it in lifespan is safer
    # if agent initialization might need a live http_client or other stateful resources.
    # The current structure where load_agent_services is called from lifespan seems fine if
    # agent services or routers depend on the http_client being available from app.state.
    # However, if agent routers are static and don't need the live http_client for their definition,
    # they could also be loaded here. For now, your lifespan loading is okay.

    @new_app.exception_handler(A2AJSONRPCError)
    async def jsonrpc_exception_handler(request: Any, exc: A2AJSONRPCError):
        # Create content based on available attributes in JSONRPCError
        content = {
            "code": exc.code.value if hasattr(exc, "code") else A2AErrorCode.InternalError.value
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
        error_content = {"code": A2AErrorCode.InternalError.value, "message": exc.detail}
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