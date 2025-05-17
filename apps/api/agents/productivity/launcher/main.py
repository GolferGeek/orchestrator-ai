# apps/api/agents/productivity/launcher/main.py
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
from ....shared.mcp.mcp_client import MCPClient 
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService # Import the new base class
from apps.api.a2a_protocol.task_store import TaskStoreService # Needed for base class
from apps.api.main import get_original_http_client # Needed for base class

AGENT_VERSION = "0.1.0"

AGENT_ID = "productivity-launcher-v1" 
AGENT_NAME = "Productivity Launcher Agent"
AGENT_DESCRIPTION = "Assists in launching other productivity-focused agents or workflows based on user requests, potentially using an LLM to understand and route these requests."
CONTEXT_FILE_NAME = "launcher_agent.md"
MCP_TARGET_AGENT_ID = "generic-language-processor-v1" # For LLM-assisted routing/understanding
PRIMARY_CAPABILITY_NAME = "launch_productivity_agent_via_mcp"

# Configure logging
logger = logging.getLogger(__name__)

class LauncherAgentService(MCPContextAgentBaseService):
    """Productivity Launcher Agent Service that uses MCPContextAgentBaseService."""

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
            type="specialized", # Or "utility" if more appropriate for a launcher
            endpoints=[f"/agents/productivity/launcher/tasks"],
            capabilities=[
                AgentCapability(
                    name=PRIMARY_CAPABILITY_NAME, 
                    description="Processes requests to launch other productivity agents or workflows, using MCP for understanding."
                )
            ]
        )

# Create an APIRouter instance for the Launcher Agent
agent_router = APIRouter(
    prefix="/agents/productivity/launcher",
    tags=["Productivity Launcher Agent"]
)

# Dependency for the service
async def get_launcher_agent_service(
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> LauncherAgentService:
    return LauncherAgentService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: LauncherAgentService = Depends(get_launcher_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: LauncherAgentService = Depends(get_launcher_agent_service)
):
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Launcher Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Launcher Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Launcher Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error:
        logger.error(f"Launcher Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException: 
        raise
    except Exception as e:
        logger.error(f"Launcher Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}") 