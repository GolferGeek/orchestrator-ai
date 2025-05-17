# apps/api/agents/marketing/calendar/main.py
import httpx 
import logging 
from fastapi import APIRouter, Depends, HTTPException

from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams, 
    Task,            
    JSONRPCError    
)
from ....shared.mcp.mcp_client import MCPClient 
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService 
from apps.api.a2a_protocol.task_store import TaskStoreService 
from apps.api.main import get_original_http_client

AGENT_VERSION = "0.1.0"

AGENT_ID = "marketing-calendar-v1" 
AGENT_NAME = "Marketing Calendar Agent"
AGENT_DESCRIPTION = "Assists with managing marketing calendar events, scheduling, and queries, using an LLM for natural language understanding via MCP."
CONTEXT_FILE_NAME = "calendar_agent.md"
MCP_TARGET_AGENT_ID = "generic-language-processor-v1" 
PRIMARY_CAPABILITY_NAME = "manage_marketing_calendar_via_mcp"

logger = logging.getLogger(__name__)

class CalendarAgentService(MCPContextAgentBaseService):
    """Marketing Calendar Agent Service using MCPContextAgentBaseService."""

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
            endpoints=[f"/agents/marketing/calendar/tasks"],
            capabilities=[
                AgentCapability(
                    name=PRIMARY_CAPABILITY_NAME, 
                    description="Manages marketing calendar events, scheduling, and queries via MCP."
                )
            ]
        )

agent_router = APIRouter(
    prefix="/agents/marketing/calendar",
    tags=["Marketing Calendar Agent"]
)

async def get_calendar_agent_service(
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> CalendarAgentService:
    return CalendarAgentService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: CalendarAgentService = Depends(get_calendar_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: CalendarAgentService = Depends(get_calendar_agent_service)
):
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Calendar Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Calendar Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Calendar Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error:
        logger.error(f"Calendar Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException: 
        raise
    except Exception as e:
        logger.error(f"Calendar Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}")

