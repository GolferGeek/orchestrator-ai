import httpx # Needed for http_client dependency for base class
import logging # For logger configuration if needed
from fastapi import APIRouter, Depends, HTTPException, status # Added status
from typing import Optional, Dict, Any, List
import os
import re

from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    TextPart,
    TaskSendParams, # For task route
    Task,            # For task route response
    JSONRPCError    # For error handling in task route
)
# Import the new MCPClient and its exceptions
from apps.api.shared.mcp.mcp_client import MCPClient # Ensure MCPClient is imported
from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService
from apps.api.main import get_original_task_store_service as get_task_store_service, get_original_http_client
from pydantic import BaseModel, Field

# Import the new service
from apps.api.agents.business.metrics.service import MetricsAgentService

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

# A2A Agent Card Model for /well-known/agent.json endpoint
class A2AAgentCard(BaseModel):
    """A2A protocol agent card model that follows the well-known/agent.json specification"""
    name: str
    display_name: str
    description: str
    capabilities: List[str]
    limitations: List[str] = Field(default_factory=list)
    routing: Dict[str, str] = Field(default_factory=dict)
    api_version: str = "1.0.0"
    auth_requirements: Optional[Dict[str, Any]] = None
    schema_version: str = "a2a-v1"
    
# Define Agent constants from the NEW service class for router setup
METRICS_AGENT_ID = MetricsAgentService.agent_id
METRICS_AGENT_NAME = MetricsAgentService.agent_name
METRICS_DISPLAY_NAME = MetricsAgentService.display_name
METRICS_DEPARTMENT = MetricsAgentService.department_name

# This is the single, correct router for this agent module.
agent_router = APIRouter(
    tags=[METRICS_DISPLAY_NAME]
)

# New dependency provider for MCPClient
def get_mcp_client_dependency(http_client: httpx.AsyncClient = Depends(get_original_http_client)) -> MCPClient:
    return MCPClient(http_client=http_client)

# Corrected dependency provider for the new MetricsAgentService
def get_agent_service(
    task_store: TaskStoreService = Depends(get_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_original_http_client), # This http_client is for MetricsAgentService itself
    mcp_client: MCPClient = Depends(get_mcp_client_dependency) # Use the new provider
) -> MetricsAgentService:
    """Dependency to get an instance of MetricsAgentService."""
    return MetricsAgentService(
        task_store=task_store,
        http_client=http_client,
        mcp_client=mcp_client # Pass it to the service constructor
    )

# --- Standard A2A Endpoints using the new MetricsAgentService ---

@agent_router.post(
    "/tasks",
    response_model=Task,
    summary=f"Send a task to the {METRICS_DISPLAY_NAME}",
    description=f"Accepts a task request for {METRICS_DISPLAY_NAME} and returns the task result.",
    status_code=status.HTTP_200_OK
)
async def send_task_to_metrics_agent(
    params: TaskSendParams,
    service: MetricsAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for sending tasks to the Metrics agent."""
    return await service.handle_task_send(params)

@agent_router.get(
    "/tasks/{task_id}",
    response_model=Optional[Task],
    summary=f"Get task status from {METRICS_DISPLAY_NAME}",
    description=f"Retrieves the status and result for a task ID processed by {METRICS_DISPLAY_NAME}."
)
async def get_metrics_agent_task_status(
    task_id: str,
    service: MetricsAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for retrieving a task from the Metrics agent."""
    task = await service.handle_task_get(task_id)
    if task is None:
        # To explicitly return 404 if task is not found:
        # raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        pass # Current behavior: 200 OK with null body
    return task

@agent_router.delete(
    "/tasks/{task_id}",
    response_model=Dict[str, Any],
    summary=f"Cancel a task for {METRICS_DISPLAY_NAME}",
    description=f"Requests cancellation of an ongoing task by ID for {METRICS_DISPLAY_NAME}."
)
async def cancel_metrics_agent_task(
    task_id: str,
    service: MetricsAgentService = Depends(get_agent_service)
):
    """A2A-compliant endpoint for cancelling a task for the Metrics agent."""
    return await service.handle_task_cancel(task_id)

@agent_router.get(
    "/agent-card",
    response_model=AgentCard,
    summary=f"Get Agent Card for {METRICS_DISPLAY_NAME}",
    description=f"Retrieves the capabilities and metadata of {METRICS_DISPLAY_NAME}."
)
async def get_metrics_agent_card(
    service: MetricsAgentService = Depends(get_agent_service)
):
    """Endpoint to get the agent card for the Metrics agent."""
    return await service.get_agent_card()

@agent_router.get(
    "/.well-known/agent.json",
    response_model=Dict[str, Any], 
    summary=f"Get A2A Discovery Information for {METRICS_DISPLAY_NAME}",
    description=f"Provides agent information in A2A discovery format for {METRICS_DISPLAY_NAME}.",
    include_in_schema=False 
)
async def get_metrics_agent_discovery_info(
    service: MetricsAgentService = Depends(get_agent_service)
):
    """Endpoint for A2A agent discovery.
    Returns the .well-known/agent.json structure.
    """
    return await service.get_a2a_agent_card_discovery_format()

# Old MetricsService class and related A2AAgentCard model (previously here) are removed.
# Old get_metrics_agent_service (that instantiated the old service) is removed.
# Ensure all old code that was below this point is now gone. 