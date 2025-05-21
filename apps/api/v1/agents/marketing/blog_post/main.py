# apps/api/agents/marketing/blog_post/main.py
import httpx # Needed for http_client dependency for base class
import logging # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException # Add FastAPI imports
from fastapi import Path as FastAPIPath # Add this import for Path parameter validation
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from pathlib import Path

from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams, # For task route
    Task,            # For task route response
    JSONRPCError    # For error handling in task route
)
# Import the new MCPClient and its exceptions
from apps.api.v1.shared.mcp.mcp_client import MCPClient # MCPError etc are handled by base class now
from apps.api.v1.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.v1.a2a_protocol.task_store import TaskStoreService # Needed for base class
from apps.api.v1.main import get_original_http_client, get_original_task_store_service # Modified: Added get_original_task_store_service

# Define Agent specific constants
AGENT_ID: str = "blog-post-agent-v1"
AGENT_NAME: str = "blog_post" 
AGENT_DESCRIPTION: str = "Creates high-quality blog posts for marketing purposes."
AGENT_VERSION: str = "0.1.0" 
MCP_TARGET_AGENT_ID: str = AGENT_NAME
CONTEXT_FILE_NAME: str = "blog_post_agent.md"
PRIMARY_CAPABILITY_NAME: str = "query_blog_post_via_mcp"
PRIMARY_CAPABILITY_DESCRIPTION: str = "Creates high-quality blog posts by relaying queries to an MCP."

# Configure logging
logger = logging.getLogger(__name__)

class BlogPostAgentService(MCPContextAgentBaseService):
    """
    Blog Post Agent Service that queries an MCP for context-aware responses.
    It leverages MCPContextAgentBaseService for handling message processing.
    """
    agent_id: str = AGENT_ID
    agent_name: str = AGENT_NAME 
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    department_name: str = "marketing" 
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = PRIMARY_CAPABILITY_DESCRIPTION

    # The custom __init__ is removed. Context loading is handled by llm_mcp.py
    # based on mcp_target_agent_id.

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="specialized", 
            endpoints=[f"/agents/{self.department_name}/{self.agent_name.lower().replace(' ', '_')}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

agent_router = APIRouter(
    prefix=f"/agents/{BlogPostAgentService.department_name}/{BlogPostAgentService.agent_name.lower().replace(' ', '_')}",
    tags=[f"{BlogPostAgentService.agent_name}"] 
)

async def get_blog_post_agent_service(
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(get_original_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> BlogPostAgentService:
    return BlogPostAgentService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: BlogPostAgentService = Depends(get_blog_post_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: BlogPostAgentService = Depends(get_blog_post_agent_service)
):
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Blog Post Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Blog Post Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Blog Post Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error: 
        logger.error(f"Blog Post Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException: 
        raise
    except Exception as e:
        logger.error(f"Blog Post Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}") 

@agent_router.get("/tasks/{task_id}", response_model=Optional[Task], summary="Get Task Status and Result")
async def get_task_status_route(
    task_id: str = FastAPIPath(..., title="Task ID", description="The unique identifier of the task to retrieve."),
    service: BlogPostAgentService = Depends(get_blog_post_agent_service)
):
    logger.info(f"Blog Post Agent /tasks/{{task_id}} GET endpoint received request for task ID: {task_id}")
    task = await service.handle_task_get(task_id=task_id)
    if not task:
        logger.warning(f"Task {task_id} not found for GET request to Blog Post Agent.")
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found for Blog Post Agent.")
    logger.info(f"Blog Post Agent returning task {task_id} with status {task.status.state}")
    return task 