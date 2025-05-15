import httpx # Needed for http_client dependency for base class
import logging # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException # Add FastAPI imports

from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams, # For task route
    Task,            # For task route response
    JSONRPCError    # For error handling in task route
)
# Import the new MCPClient and its exceptions
from ....shared.mcp.mcp_client import MCPClient # MCPError etc are handled by base class now
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService # Import the new base class
from apps.api.a2a_protocol.task_store import TaskStoreService # Needed for base class
from apps.api.main import get_original_http_client # Needed for base class

AGENT_VERSION = "0.1.0"
# MCP_METRICS_AGENT_URL is now encapsulated within MCPClient or its usage

AGENT_ID = "metrics-agent-v1" # Defined from previous get_agent_card
AGENT_NAME = "Metrics Agent"   # Defined from previous get_agent_card
AGENT_DESCRIPTION = "Provides business metrics and analytics by querying a central MCP." # Defined from previous get_agent_card
CONTEXT_FILE_NAME = "metrics_agent.md" # Assuming this is the context file for metrics agent
# This is the ID of the agent on the MCP that this Metrics Agent will query.
# Based on the previous code, it seemed like it was querying an agent named "metrics_agent" on MCP.
# If this is not a separate agent but rather the context for this agent to use with a general knowledge agent,
# this might need to be adjusted (e.g., "knowledge_agent_business_domain").
# For now, assuming it queries a specific "metrics_agent" on the MCP.
MCP_TARGET_AGENT_ID = "metrics_agent"

# Configure logging
logger = logging.getLogger(__name__)

class MetricsAgentService(MCPContextAgentBaseService): # Renamed for clarity and consistency
    """Metrics Agent Service that queries the MCP for context-aware responses using MCPClient."""

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
        # Logger is initialized in the base class with AGENT_NAME

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="specialized",
            endpoints=["/agents/business/metrics/tasks"],
            capabilities=[
                AgentCapability(name="query_metrics_via_mcp", description="Answers questions about business metrics by relaying them to an MCP.")
            ]
        )

    # process_message and load_context are inherited from MCPContextAgentBaseService

# agent_router import is still commented out as MetricsService handles /tasks
# print(f"[metrics/main.py] Loaded. MetricsService now uses MCPClient.")

# Create an APIRouter instance for the Metrics Agent
agent_router = APIRouter(
    prefix="/agents/business/metrics",
    tags=["Metrics Agent"]
)

# Dependency for the service
async def get_metrics_agent_service(
    # MCPClient can be a simple dependency if its __init__ has defaults or gets config from settings
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> MetricsAgentService:
    return MetricsAgentService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: MetricsAgentService = Depends(get_metrics_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: MetricsAgentService = Depends(get_metrics_agent_service)
):
    # Log the incoming request details safely
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Metrics Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        # Delegate to the base service's task handling logic
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Metrics Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Metrics Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error: # JSONRPCError might need to be imported from a2a_protocol.types
        logger.error(f"Metrics Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        # Ensure TaskStatus, TaskState, uuid are imported if creating Task object directly
        # For now, assume base class handles error and returns appropriate Task or raises HTTPEx
        # Re-raise for now, or convert to HTTPException. Base class should ideally handle this.
        # Actually, let's copy the error handling from HR assistant for consistency if base class doesn't fully shield this.
        # It seems the base class handle_task_send *should* return a Task object even in error cases, or raise HTTPException.
        # The HR assistant one has robust error handling *after* calling handle_task_send which might be for JSONRPC that slips through.
        # The A2AAgentBaseService.handle_task_send *does* wrap process_message in a try-except that should convert to TaskStatus.FAILED.
        # So, the extensive error handling below might be redundant if base class works perfectly.
        # Let's keep it simpler first and rely on base class, then add if tests show issues.
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException: # Re-raise known HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Metrics Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}") 