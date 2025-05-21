# apps/api/agents/hr/hr_assistant/main.py
import logging # Added for logging

import httpx # For http_client dependency
from fastapi import APIRouter, Depends, HTTPException

from apps.api.a2a_protocol.task_store import TaskStoreService # TaskAndHistory removed
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams, # Changed from TaskRequestBody
    Task,
    JSONRPCError # Kept for now, though ideal base class behavior might make it redundant
)
# from ....core.config import settings # Not directly used in metrics/main.py for agent-specific logic
from apps.api.shared.mcp.mcp_client import MCPClient # Specific errors handled by base
from apps.api.main import get_original_http_client # Import the http_client provider
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService # Import the new base class

# Agent specific metadata
HR_AGENT_ID = "hr-assistant-agent-v1"
HR_AGENT_NAME = "HR Assistant Agent"
HR_AGENT_DESCRIPTION = "Provides assistance with HR-related queries and tasks by leveraging an MCP."
HR_AGENT_VERSION = "0.1.0"
HR_MCP_TARGET_AGENT_ID = "hr_assistant_agent" # Changed from knowledge_agent_hr_domain
HR_CONTEXT_FILE_NAME = "hr_assistant_agent.md"
HR_PRIMARY_CAPABILITY_NAME = "query_hr_information"
HR_PRIMARY_CAPABILITY_DESCRIPTION = "Answers HR-related questions by relaying them to an MCP, using HR context."

# Configure logging
logger = logging.getLogger(__name__)
# Example: Set to DEBUG for more verbose output during development
# logger.setLevel(logging.DEBUG) 
# if not logger.hasHandlers():
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


class HRAssistantService(MCPContextAgentBaseService):
    """HR Assistant Agent Service that queries the MCP for context-aware responses."""

    # Class attributes for MCPContextAgentBaseService to use
    agent_id: str = HR_AGENT_ID
    agent_name: str = HR_AGENT_NAME
    agent_description: str = HR_AGENT_DESCRIPTION
    agent_version: str = HR_AGENT_VERSION
    mcp_target_agent_id: str = HR_MCP_TARGET_AGENT_ID
    context_file_name: str = HR_CONTEXT_FILE_NAME
    primary_capability_name: str = HR_PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = HR_PRIMARY_CAPABILITY_DESCRIPTION
    department_name: str = "hr" # Set department directly

    def __init__(self, **kwargs):
        # mcp_client can be passed via kwargs if a specific instance is needed,
        # otherwise the base class will instantiate one.
        # department_name is now a class attribute.
        super().__init__(**kwargs)
        # Logger is initialized in the base class

    async def get_agent_card(self) -> AgentCard:
        """Provides the agent's capabilities and metadata."""
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            version=self.agent_version,
            description=self.agent_description,
            a2a_protocol_version="0.1.0", # Standard A2A version
            type="specialized",
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ],
            endpoints=[f"/agents/{self.department_name}/{self.agent_name.lower().replace(' ', '_')}/tasks"]
        )


# Create an APIRouter instance for the HR Assistant Agent
agent_router = APIRouter(
    prefix=f"/agents/{HRAssistantService.department_name}/{HRAssistantService.agent_name.lower().replace(' ', '_')}", # Dynamic prefix
    tags=[f"{HRAssistantService.agent_name}"]
)

# Dependency for the service
def get_hr_assistant_service( # Made synchronous as per FastAPI best practices for dependencies unless explicitly async
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client),
    mcp_client: MCPClient = Depends(MCPClient) # Allow specific MCP client if needed
) -> HRAssistantService:
    return HRAssistantService(
        task_store=task_store,
        http_client=http_client,
        mcp_client=mcp_client
        # department_name is now a class attribute, agent_name taken from class attr by base
    )


@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: HRAssistantService = Depends(get_hr_assistant_service)
):
    """Returns the agent's card, describing its capabilities and metadata."""
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task) # Ensure Task model is used for response
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: HRAssistantService = Depends(get_hr_assistant_service)
):
    """
    Receives a task request, processes it using the HRAssistantService (via base_agent.handle_task_send),
    and returns the resulting task object.
    This endpoint now delegates to the base class's handle_task_send method,
    which orchestrates task creation, status updates, and calls the overridden process_message.
    """
    # Log the incoming request details safely
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"{HRAssistantService.agent_name} /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        # Delegate to the base service's task handling logic
        # handle_task_send will call our overridden process_message internally.
        task_response = await service.handle_task_send(params=task_request)
        if not task_response: # Should ideally not happen if base class is robust
            logger.error(f"{HRAssistantService.agent_name} /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")

        logger.info(f"{HRAssistantService.agent_name} /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
        return task_response
    except HTTPException: # Re-raise HTTPExceptions explicitly
        raise
    except Exception as e: # Catch any other unexpected error from handle_task_send or above
        logger.error(f"{HRAssistantService.agent_name} /tasks endpoint: Unexpected error during task processing for task ID {task_request.id}: {e}", exc_info=True)
        # This path implies handle_task_send itself failed catastrophically, not just an error within process_message.
        # It's better to raise an HTTPException than to try and construct a Task here, as the state is unknown.
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred during task processing: {str(e)}")

# Example of how another route might use the task store for GETting a task
# @agent_router.get("/tasks/{task_id}", response_model=Task)
# async def get_task_route(
#     task_id: str,
#     service: HRAssistantService = Depends(get_hr_assistant_service)
# ):
#     task_and_history = await service.task_store.get_task(task_id)
#     if not task_and_history:
#         raise HTTPException(status_code=404, detail="Task not found")
#     return task_and_history.task

# The .well-known/agent.json should ideally be generated from the AgentCard dynamically
# or be a static file that is kept in sync.
# For now, the AgentCard endpoint serves this purpose for A2A.
# The old get_hr_assistant_agent_discovery can be removed.

# To make this agent discoverable by the main FastAPI app, 
# this router needs to be imported and included by the application instance
# in a higher-level file (e.g., apps/api/main.py or similar).

# print("[hr_assistant/main.py] HR Assistant Agent Refactored and Loaded.")
