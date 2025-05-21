# apps/api/agents/system/orchestrator/main.py
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, Optional

# Corrected import for get_task_store_service
from apps.api.a2a_protocol.task_store import TaskStoreService 
from apps.api.main import get_original_task_store_service as get_task_store_service
from apps.api.a2a_protocol.types import TaskSendParams, Task, AgentCard

# Corrected import for get_openai_service
from apps.api.llm.openai_service import OpenAIService
from apps.api.main import get_original_openai_service as get_openai_service

# Corrected import for http_client dependency
from apps.api.main import get_original_http_client as get_http_client 
import httpx # For type hinting http_client

# Import and expose the service class
from apps.api.agents.system.orchestrator.service import OrchestratorAgentService
# Expose the service class in the module's namespace for the agent loader
OrchestratorService = OrchestratorAgentService  # This is what the agent loader looks for

# Import Supabase client and dependency
from supabase import Client as SupabaseClient
from apps.api.auth.dependencies import get_supabase_client_as_current_user # For user-specific client

# Define the Agent ID and Name (can be moved to a constants file or use service attributes)
ORCHESTRATOR_AGENT_ID = OrchestratorAgentService.agent_id
ORCHESTRATOR_AGENT_NAME = OrchestratorAgentService.agent_name # Path name
ORCHESTRATOR_DISPLAY_NAME = OrchestratorAgentService.display_name # UI name
ORCHESTRATOR_DEPARTMENT = OrchestratorAgentService.department_name

# Create an APIRouter for this agent, named agent_router for auto-discovery
agent_router = APIRouter(tags=[ORCHESTRATOR_DISPLAY_NAME])

# Dependency provider for the new OrchestratorAgentService
def get_agent_service(
    task_store: TaskStoreService = Depends(get_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_http_client),
    openai_service: OpenAIService = Depends(get_openai_service),
    supabase_client: Optional[SupabaseClient] = Depends(get_supabase_client_as_current_user) # Make it optional if history is not always needed or can be handled
) -> OrchestratorAgentService:
    """Dependency to get an instance of OrchestratorAgentService."""
    return OrchestratorAgentService(
        task_store=task_store,
        http_client=http_client,
        openai_service=openai_service,
        supabase_client=supabase_client
        # agent_name and department_name will be taken from class attributes by default
    )

# --- Standard A2A Endpoints ---

@agent_router.post(
    "/tasks",
    response_model=Task,
    summary=f"Send a task to the {ORCHESTRATOR_DISPLAY_NAME}",
    description=f"Accepts a task request, processes it via the {ORCHESTRATOR_DISPLAY_NAME}, and returns the task result.",
    status_code=status.HTTP_200_OK # A2A spec usually expects 200 OK for task submission, with status in body
)
async def send_task_to_orchestrator(
    params: TaskSendParams,
    service: OrchestratorAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for sending tasks to the Orchestrator agent."""
    # The user_id for chat history should ideally be extracted from authenticated user context
    # and passed into handle_task_send if needed, or handled by SupabaseChatMessageHistory with user-scoped client.
    # For now, OrchestratorAgentService's execute_agent_task tries to find it.
    # If user_id is reliably available from auth dependency, it can be added to params.message.metadata here.
    # Example: params.message.metadata = params.message.metadata or {}; params.message.metadata["user_id"] = current_user.id
    
    # Ensure the task_id is set for the request. A2AUnifiedAgentService will also handle this.
    # params.id = params.id or str(uuid.uuid4()) # This should be handled by Pydantic default_factory or client
    
    return await service.handle_task_send(params)

@agent_router.get(
    "/tasks/{task_id}",
    response_model=Optional[Task], # Task can be None if not found
    summary=f"Get the status and result of a task from the {ORCHESTRATOR_DISPLAY_NAME}",
    description=f"Retrieves the current status and result for a given task ID processed by the {ORCHESTRATOR_DISPLAY_NAME}.",
    responses={
        status.HTTP_200_OK: {"description": "Task found and returned."},
        status.HTTP_404_NOT_FOUND: {"description": "Task not found."} # Though base service might return Task=None with 200
    }
)
async def get_orchestrator_task_status(
    task_id: str,
    service: OrchestratorAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for retrieving a task from the Orchestrator agent."""
    task = await service.handle_task_get(task_id)
    if task is None:
        # Consistent with how other agents might handle "not found"
        # However, A2AUnifiedAgentService.handle_task_get returns Optional[Task]
        # and the route itself expects Optional[Task]. So FastAPI will handle 200 with null body if task is None.
        # If a 404 is strictly required for task not found, logic here or in base service would need adjustment.
        # For now, aligning with Optional[Task] response model.
        pass # FastAPI will return 200 OK with null body if task is None
    return task

@agent_router.delete(
    "/tasks/{task_id}",
    response_model=Dict[str, Any],
    summary=f"Cancel a task being processed by the {ORCHESTRATOR_DISPLAY_NAME}",
    description=f"Requests cancellation of an ongoing task by its ID for the {ORCHESTRATOR_DISPLAY_NAME}.",
)
async def cancel_orchestrator_task(
    task_id: str,
    service: OrchestratorAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for cancelling a task for the Orchestrator agent."""
    return await service.handle_task_cancel(task_id)

@agent_router.get(
    "/agent-card",
    response_model=AgentCard,
    summary=f"Get the Agent Card for the {ORCHESTRATOR_DISPLAY_NAME}",
    description=f"Retrieves the capabilities and metadata of the {ORCHESTRATOR_DISPLAY_NAME}.",
)
async def get_orchestrator_agent_card(
    service: OrchestratorAgentService = Depends(get_agent_service)
):
    """Endpoint to get the agent card for the Orchestrator agent."""
    return await service.get_agent_card() # Uses the method from OrchestratorAgentService

@agent_router.get(
    "/.well-known/agent.json",
    response_model=Dict[str, Any], # A2A discovery format is a generic JSON dict
    summary=f"Get A2A Discovery Information for the {ORCHESTRATOR_DISPLAY_NAME}",
    description=f"Provides agent information in the A2A discovery format for the {ORCHESTRATOR_DISPLAY_NAME}.",
    include_in_schema=False # Often .well-known paths are excluded from OpenAPI schema
)
async def get_orchestrator_agent_card_discovery(
    service: OrchestratorAgentService = Depends(get_agent_service)
):
    """Endpoint for A2A agent discovery, returning .well-known/agent.json format."""
    return await service.get_a2a_agent_card_discovery_format()

# The old OrchestratorService class (previously in this file) is now removed
# as its functionality is superseded by OrchestratorAgentService and A2AUnifiedAgentService.
# Any utility methods from the old class that are NOT A2A protocol or core agent logic
# would need to be moved to appropriate utility modules if still needed.
# Based on the previous content of this file, most of it was related to A2A handling or
# the core processing logic now in OrchestratorAgentService.
# The specific _discover_available_agents logic is now in A2AUnifiedAgentService.
# Stickiness logic is also in A2AUnifiedAgentService.
# Chat history interaction is now more localized within OrchestratorAgentService.execute_agent_task.

# We can still keep a simple .well-known/agent.json for basic discovery if needed,
# or let the dynamic loader in main.py create one from get_agent_card.
# For example, if you want a very specific one:
# async def get_agent_discovery():
#     return {
#         "name": "Orchestrator Agent (Discovery)",
#         "description": "Main orchestrator, A2A compliant.",
#         "a2a_protocol_version": AGENT_VERSION,
#         "endpoints": [
#             {
#                 "path": "/agent-card", # Points to the full agent card
#                 "methods": ["GET"],
#                 "description": "Get full agent capabilities and metadata."
#             },
#             {
#                 "path": "/tasks",
#                 "methods": ["POST"],
#                 "description": "Send a task to the agent."
#             }
#         ]
#     } 