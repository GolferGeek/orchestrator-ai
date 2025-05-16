# apps/api/agents/productivity/meetings/main.py
import httpx  # Needed for http_client dependency for base class
import logging  # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException  # Add FastAPI imports

from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams,  # For task route
    Task,  # For task route response
    JSONRPCError  # For error handling in task route
)
# Import the MCPClient and base service
from ....shared.mcp.mcp_client import MCPClient
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService  # Needed for base class
from apps.api.main import get_original_http_client  # Needed for base class

AGENT_VERSION = "0.1.0"
AGENT_ID = "meetings-agent-v1"
AGENT_NAME = "Meetings Agent"
AGENT_DESCRIPTION = "Assists with meeting scheduling, summaries, and related productivity tasks by querying a central MCP."
CONTEXT_FILE_NAME = "meetings_agent.md"
# This is the ID of the agent on the MCP that this Meetings Agent will query.
# For now, assuming it queries a specific "knowledge_agent_productivity" on the MCP.
MCP_TARGET_AGENT_ID = "knowledge_agent_productivity"

# Configure logging
logger = logging.getLogger(__name__)

class MeetingsAgentService(MCPContextAgentBaseService):
    """Meetings Agent Service that queries the MCP for context-aware responses using MCPClient."""

    def __init__(
        self,
        task_store: TaskStoreService,
        http_client: httpx.AsyncClient,
        mcp_client: MCPClient
    ):
        super().__init__(
            task_store=task_store,
            http_client=http_client,
            agent_name=AGENT_NAME,
            mcp_client=mcp_client,
            mcp_target_agent_id=MCP_TARGET_AGENT_ID,
            context_file_name=CONTEXT_FILE_NAME
        )

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="specialized",
            endpoints=[f"/agents/productivity/meetings/tasks"],
            capabilities=[
                AgentCapability(name="query_meetings_via_mcp", description="Answers questions about meetings by relaying them to an MCP.")
            ]
        )

# Create an APIRouter instance for the Meetings Agent
agent_router = APIRouter( # Changed from router to agent_router for consistency
    prefix="/agents/productivity/meetings",
    tags=["Meetings Agent"]
)

# Dependency for the service
async def get_meetings_agent_service(
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> MeetingsAgentService:
    return MeetingsAgentService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: MeetingsAgentService = Depends(get_meetings_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams,
    service: MeetingsAgentService = Depends(get_meetings_agent_service)
):
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Meetings Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Meetings Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Meetings Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error:
        logger.error(f"Meetings Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException: # Re-raise known HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Meetings Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}")

# The existing "/" route can be removed or adapted.
# For now, it's removed as /agent-card provides agent info.
# If a simple health check is needed, it can be added back.

# The .well-known/agent.json route needs to be updated or handled differently.
# Per rule 001-mono-repo-structure, it should exist.
# We will make this route dynamically return the agent card content for now.
@agent_router.get("/.well-known/agent.json", response_model=AgentCard) # Response model to ensure consistency
async def get_meetings_agent_discovery_well_known( # Renamed for clarity
    service: MeetingsAgentService = Depends(get_meetings_agent_service)
):
    # This directly returns the AgentCard model, which should be A2A compatible.
    # If a different structure is strictly needed for .well-known/agent.json,
    # this would need adjustment.
    return await service.get_agent_card()

# Add other agent-specific endpoints and logic here, if any, using the agent_router 