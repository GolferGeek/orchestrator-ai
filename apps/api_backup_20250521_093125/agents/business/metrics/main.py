import httpx # Needed for http_client dependency for base class
import logging # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException # Add FastAPI imports
from typing import Optional

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
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService # Needed for base class
from apps.api.main import get_original_http_client # Needed for base class

# Define Agent specific constants
AGENT_ID: str = "metrics-agent-v1"
AGENT_NAME: str = "metrics" # Standardized to directory name
AGENT_DESCRIPTION: str = "Provides business metrics and analytics by querying a central MCP."
AGENT_VERSION: str = "1.0.0" # Standardized version
# This should be the target agent on the MCP that this Metrics Agent queries.
MCP_TARGET_AGENT_ID: str = AGENT_NAME # MODIFIED: Use AGENT_NAME for consistency with llm_mcp.py context loading
CONTEXT_FILE_NAME: str = "metrics_agent.md"
PRIMARY_CAPABILITY_NAME: str = "query_business_metrics"
PRIMARY_CAPABILITY_DESCRIPTION: str = "Answers questions about business metrics by relaying them to an MCP."

# Configure logging
logger = logging.getLogger(__name__)

class MetricsService(MCPContextAgentBaseService):
    """
    Metrics Agent Service that queries an MCP for context-aware responses.
    It leverages MCPContextAgentBaseService for handling message processing.
    """
    agent_id: str = AGENT_ID
    agent_name: str = AGENT_NAME # This will be used by base class for router if not overridden
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    department_name: str = "business" # Added class attribute
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = PRIMARY_CAPABILITY_DESCRIPTION

    def __init__(self, **kwargs):
        # department_name is now a class attribute.
        # agent_name will also be picked up from class attribute by the base if not passed.
        # MCPContextAgentBaseService.__init__ expects task_store, http_client, and optional mcp_client.
        # Other kwargs are passed through.
        super().__init__(**kwargs) # Rely on base class to pick up agent_name and department_name
        # Any other specific initializations for MetricsService can go here.

    # Optional: Override get_agent_card if specific customizations are needed
    # beyond what the base class provides from the constants.
    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="specialized", # As per original agent
            # Use dynamic name for the path segment
            endpoints=[f"/agents/{self.department_name}/{self.agent_name.lower().replace(' ', '_')}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

    # process_message and load_context are inherited from MCPContextAgentBaseService

# agent_router import is still commented out as MetricsService handles /tasks
# print(f"[metrics/main.py] Loaded. MetricsService now uses MCPClient.")

# Create an APIRouter instance for the Metrics Agent
# Make prefix fully dynamic based on class attributes
agent_router = APIRouter(
    prefix=f"/agents/{MetricsService.department_name}/{MetricsService.agent_name.lower().replace(' ', '_')}",
    tags=[f"{MetricsService.agent_name}"] # Use class attribute for tag consistency
)

# Dependency for the service
async def get_metrics_agent_service(
    # MCPClient can be a simple dependency if its __init__ has defaults or gets config from settings
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> MetricsService:
    # department_name is now a class attribute and will be picked up by base class
    # agent_name is also picked by base class from class attribute
    return MetricsService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: MetricsService = Depends(get_metrics_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: MetricsService = Depends(get_metrics_agent_service)
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