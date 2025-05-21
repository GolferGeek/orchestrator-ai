"""Email Triage Agent for triaging and managing emails."""

import httpx  # Needed for http_client dependency for base class
import logging  # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException  # Add FastAPI imports
from typing import Optional, Dict, Any, List

from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams,  # For task route
    Task,            # For task route response
    JSONRPCError,    # For error handling in task route
    Message
)
# Import the MCPClient and base service class
from apps.api.shared.mcp.mcp_client import MCPClient
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService  # Needed for base class
from apps.api.main import get_original_http_client  # Needed for base class

# Constants for the agent
AGENT_ID = "email-triage-v1"
AGENT_NAME = "email_triage"  # Standardized to directory name
AGENT_DESCRIPTION = "Helps triage and prioritize emails, categorize them, and suggest appropriate actions."
AGENT_VERSION = "1.0.0"
# This should be the target agent on the MCP that this Email Triage Agent queries
MCP_TARGET_AGENT_ID = AGENT_NAME  # Use AGENT_NAME for consistency with llm_mcp.py context loading
CONTEXT_FILE_NAME = "email_triage_agent.md"
PRIMARY_CAPABILITY_NAME = "email_triage"
PRIMARY_CAPABILITY_DESCRIPTION = "Helps categorize, prioritize, and manage emails."

# Configure logging
logger = logging.getLogger(__name__)

class EmailTriageService(MCPContextAgentBaseService):
    """
    Email Triage Agent Service that handles email management tasks.
    It leverages MCPContextAgentBaseService for handling message processing.
    """
    agent_id: str = AGENT_ID
    agent_name: str = AGENT_NAME
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    department_name: str = "productivity"  # Added class attribute
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = PRIMARY_CAPABILITY_DESCRIPTION

    def __init__(self, **kwargs):
        # department_name is now a class attribute.
        # agent_name will also be picked up from class attribute by the base if not passed.
        # MCPContextAgentBaseService.__init__ expects task_store, http_client, and optional mcp_client.
        # Other kwargs are passed through.
        super().__init__(**kwargs)  # Rely on base class to pick up agent_name and department_name
        # Any additional initialization for EmailTriageService can go here.

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="utility", 
            # Use dynamic name for the path segment
            endpoints=[f"/agents/{self.department_name}/{self.agent_name.lower().replace(' ', '_')}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

# Create an APIRouter instance for the Email Triage Agent
# Make prefix fully dynamic based on class attributes
agent_router = APIRouter(
    prefix=f"/agents/{EmailTriageService.department_name}/{EmailTriageService.agent_name.lower().replace(' ', '_')}",
    tags=[f"{EmailTriageService.agent_name}"]  # Use class attribute for tag consistency
)

# Dependency for the service
async def get_email_triage_agent_service(
    # MCPClient can be a simple dependency if its __init__ has defaults or gets config from settings
    mcp_client: MCPClient = Depends(MCPClient),
    task_store: TaskStoreService = Depends(TaskStoreService),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> EmailTriageService:
    # department_name is now a class attribute and will be picked up by base class
    # agent_name is also picked by base class from class attribute
    return EmailTriageService(
        mcp_client=mcp_client,
        task_store=task_store,
        http_client=http_client
    )

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_agent_card_route(
    service: EmailTriageService = Depends(get_email_triage_agent_service)
):
    return await service.get_agent_card()

@agent_router.post("/tasks", response_model=Task)
async def process_tasks_route(
    task_request: TaskSendParams, 
    service: EmailTriageService = Depends(get_email_triage_agent_service)
):
    # Log the incoming request details safely
    log_input_text = "No text part found or text part is empty."
    if task_request.message.parts and isinstance(task_request.message.parts[0].root, TextPart):
        log_input_text = task_request.message.parts[0].root.text[:100]
    logger.info(f"Email Triage Agent /tasks endpoint received task request ID: {task_request.id} with input: {log_input_text}")

    try:
        # Delegate to the base service's task handling logic
        task_response = await service.handle_task_send(params=task_request)
        if task_response:
            logger.info(f"Email Triage Agent /tasks endpoint successfully processed task {task_request.id}. Returning Task object. Final state: {task_response.status.state}")
            return task_response
        else:
            logger.error(f"Email Triage Agent /tasks endpoint: handle_task_send returned None for task {task_request.id}. This is unexpected.")
            raise HTTPException(status_code=500, detail="Task processing failed to return a valid task object.")
    except JSONRPCError as rpc_error:
        logger.error(f"Email Triage Agent /tasks endpoint: JSONRPCError for task {task_request.id}: {rpc_error.message}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Task processing error: {rpc_error.message}")
    except HTTPException:  # Re-raise known HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Email Triage Agent /tasks endpoint: Unexpected error for task {task_request.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error during task processing: {str(e)}")

# Export the agent_service for compatibility with agent loading system
agent_service = EmailTriageService 