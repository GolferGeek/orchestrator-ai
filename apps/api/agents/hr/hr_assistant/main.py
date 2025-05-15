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
AGENT_ID = "hr-assistant-agent-v1"
AGENT_NAME = "HR Assistant Agent"
AGENT_DESCRIPTION = "Provides assistance with HR-related queries and tasks by leveraging an MCP."
AGENT_VERSION = "0.1.0"
# This constant defines which specific agent on the MCP this HR agent talks to.
# It's assumed the MCP knows an agent by this ID (e.g., "knowledge_agent_hr_domain")
# that is primed with or has access to the HR knowledge base (hr_assistant_agent.md or equivalent).
MCP_TARGET_AGENT_ID_FOR_HR_QUERIES = "knowledge_agent_hr_domain" 
HR_CONTEXT_FILE_NAME = "hr_assistant_agent.md" # Define the context file name

# Configure logging
logger = logging.getLogger(__name__)
# Example: Set to DEBUG for more verbose output during development
# logger.setLevel(logging.DEBUG) 
# if not logger.hasHandlers():
# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


class HRAssistantService(MCPContextAgentBaseService):
    """HR Assistant Agent Service that queries the MCP for context-aware responses."""

    def __init__(
        self, 
        mcp_client: MCPClient, # Specific to this service
        task_store: TaskStoreService, # From base
        http_client: httpx.AsyncClient, # From base
        # agent_name is handled by base, mcp_target_agent_id and context_file_name are new
    ):
        super().__init__(
            task_store=task_store,
            http_client=http_client,
            agent_name=AGENT_NAME, # Pass the constant
            mcp_client=mcp_client,
            mcp_target_agent_id=MCP_TARGET_AGENT_ID_FOR_HR_QUERIES,
            context_file_name=HR_CONTEXT_FILE_NAME
        )
        # Logger is initialized in the base class with AGENT_NAME

    async def get_agent_card(self) -> AgentCard:
        """Provides the agent's capabilities and metadata."""
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            version=AGENT_VERSION,
            description=AGENT_DESCRIPTION,
            a2a_protocol_version="0.1.0",
            type="specialized",
            capabilities=[
                AgentCapability(
                    name="query_hr_info_via_mcp",
                    description="Answers HR-related questions by relaying them to an MCP, using HR context."
                )
            ],
            endpoints=[f"/agents/hr/hr_assistant/tasks"]
        )

    # process_message is now inherited from MCPContextAgentBaseService
    # load_context (formerly load_hr_context) is now inherited from MCPContextAgentBaseService

# Create an APIRouter instance for the HR Assistant Agent
agent_router = APIRouter(
    prefix="/agents/hr/hr_assistant", # Prefix for all routes in this agent
    tags=["HR Assistant Agent"]        # Tag for API documentation
)

# Dependency for the service
async def get_hr_assistant_service(
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client) # Use the explicit provider
) -> HRAssistantService:
    # Configure logger for the service instance if not already configured globally or in base class
    # service_logger = logging.getLogger(HRAssistantService.__name__)
    # if not service_logger.hasHandlers():
    #     # Basic config, adjust as per project logging strategy
    #     logging.basicConfig(level=logging.INFO) 
    # service_logger.info("HRAssistantService instance created with MCPClient.")
    return HRAssistantService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
        # agent_name, mcp_target_agent_id, and context_file_name are set in HRAssistantService.__init__
        # using constants when calling super().__init__
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
    logger.info(f"HR Assistant /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        # Delegate to the base service's task handling logic
        # handle_task_send will call our overridden process_message internally.
        task_response = await service.handle_task_send(params=task_request)
        if not task_response: # Should ideally not happen if base class is robust
            logger.error(f"HR Assistant /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")

        logger.info(f"HR Assistant /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
        return task_response
    except HTTPException: # Re-raise HTTPExceptions explicitly
        raise
    except Exception as e: # Catch any other unexpected error from handle_task_send or above
        logger.error(f"HR Assistant /tasks endpoint: Unexpected error during task processing for task ID {task_request.id}: {e}", exc_info=True)
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

# print("[hr_assistant/main.py] HR Assistant Agent (A2A Compliant with MCPClient) Loaded.")
