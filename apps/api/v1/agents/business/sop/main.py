import logging
import httpx # For http_client dependency
from fastapi import APIRouter, Depends, HTTPException

from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart, # Needed for isinstance check in process_tasks_route
    TaskSendParams, # For task route
    Task            # For task route response
    # Message removed, JSONRPCError removed (assuming base/FastAPI handles)
)
# Assuming settings might be used later, correct path would be:
from apps.api.v1.core.config import settings 
from apps.api.v1.shared.mcp.mcp_client import MCPClient # Specific errors handled by base
from apps.api.v1.agents.base.mcp_context_agent_base import MCPContextAgentBaseService # Import the new base class
from apps.api.v1.a2a_protocol.task_store import TaskStoreService # Needed for base class
from apps.api.v1.main import get_original_http_client # Needed for base class

AGENT_ID = "sop_agent"
AGENT_NAME = "ProcedurePro"
AGENT_DESCRIPTION = "Your guide for navigating and understanding Standard Operating Procedures (SOPs)."
AGENT_VERSION = "0.1.0"
CONTEXT_FILE_NAME = "sop_agent.md"
MCP_TARGET_AGENT_ID = "sop_agent" # Changed from knowledge_agent_sop_domain
SOP_PRIMARY_CAPABILITY_NAME = "query_sop_knowledge"
SOP_PRIMARY_CAPABILITY_DESCRIPTION = "Answers questions and explains steps based on conceptual SOPs."

logger = logging.getLogger(__name__)

class SopService(MCPContextAgentBaseService):
    """SOP Agent Service that provides information based on conceptual Standard Operating Procedures."""
    # Class attributes for MCPContextAgentBaseService and A2AAgentBaseService
    agent_id: str = AGENT_ID 
    agent_name: str = AGENT_NAME
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    department_name: str = "business"

    # Specific to MCPContextAgentBaseService
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = SOP_PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = SOP_PRIMARY_CAPABILITY_DESCRIPTION

    def __init__(
        self,
        task_store: TaskStoreService,
        http_client: httpx.AsyncClient,
        mcp_client: MCPClient
    ):
        # All necessary identifying attributes (agent_name, department_name, context_file_name, mcp_target_agent_id)
        # are now class attributes. MCPContextAgentBaseService.__init__ is designed
        # to pick up agent_name and department_name from class attributes if not passed as params.
        # It also accesses self.context_file_name and self.mcp_target_agent_id directly.
        super().__init__(
            task_store=task_store,
            http_client=http_client,
            mcp_client=mcp_client
            # agent_name and department_name will be resolved by the base class
        )

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            a2a_protocol_version="0.1.0",
            type="instructional",
            endpoints=[f"/agents/{self.department_name}/{self.agent_name.lower().replace(' ', '_')}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

    # process_message is now inherited from MCPContextAgentBaseService
    # The old hardcoded SOP logic needs to be moved to markdown_context/sop_agent.md

# print(f"[sop_agent/main.py] Loaded. SopService refactored to use MCPContextAgentBaseService.")

# Create an APIRouter instance for the SOP Agent
agent_router = APIRouter(
    prefix=f"/agents/{SopService.department_name}/{SopService.agent_name.lower().replace(' ', '_')}",
    tags=[f"{SopService.agent_name}"]
)

# Dependency for the service
async def get_sop_service(
    mcp_client: MCPClient = Depends(lambda: MCPClient()),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> SopService:
    return SopService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: SopService = Depends(get_sop_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: SopService = Depends(get_sop_service)
):
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and hasattr(task_request.message.parts[0], 'root') and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"SOP Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        task_response = await service.handle_task_send(params=task_request)
        if not task_response:
            logger.error(f"SOP Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
        
        logger.info(f"SOP Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
        return task_response
    except HTTPException: # Re-raise HTTPExceptions explicitly
        raise
    except Exception as e: # Catch any other unexpected error
        logger.error(f"SOP Agent /tasks endpoint: Unexpected error during task processing for task ID {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred during task processing: {str(e)}") 