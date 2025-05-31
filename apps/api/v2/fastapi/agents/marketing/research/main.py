# Research Agent Main Module
# TODO: Implement research agent functionality

import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, Dict, Any, List

from apps.api.v2.shared.contracts.generated.python.a2a_protocol import (
    TextPart,
    TaskSendParams,
    Task,
    JSONRPCError
)
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import (
    AgentCard,
    AgentCapability
)
from ....shared.mcp.mcp_client import MCPClient
from ...base.mcp_context_agent_base import MCPContextAgentBaseService  # Assuming a base service
from ....a2a_protocol.task_store import TaskStoreService
from ....main import get_original_task_store_service as get_task_store_service, get_original_http_client

# Import or define the service for this agent
# from .service import ResearchAgentService # Assuming you'll create this

logger = logging.getLogger(__name__)

RESEARCH_AGENT_ID = "research-agent-v1"
RESEARCH_AGENT_NAME = "research"
RESEARCH_DISPLAY_NAME = "Marketing Research Agent"
RESEARCH_DEPARTMENT = "marketing"

agent_router = APIRouter(
    tags=[RESEARCH_DISPLAY_NAME]
)

# Placeholder for ResearchAgentService - you'll need to implement this
class ResearchAgentService(MCPContextAgentBaseService):
    agent_id: str = RESEARCH_AGENT_ID
    agent_name: str = RESEARCH_AGENT_NAME
    display_name: str = RESEARCH_DISPLAY_NAME
    agent_description: str = "Performs market research and analysis."
    agent_version: str = "1.0.0"
    department_name: str = RESEARCH_DEPARTMENT
    
    CONTEXT_FILE_NAME: Optional[str] = "market_research_agent.md" # Or the correct one
    MCP_TARGET_AGENT_ID: Optional[str] = "research_backend" # Example, adjust as needed

    def __init__(self, task_store: TaskStoreService, http_client: httpx.AsyncClient, mcp_client: MCPClient, **kwargs: Any):
        super().__init__(
            task_store=task_store, 
            http_client=http_client, 
            mcp_client=mcp_client, # Pass mcp_client
            agent_name=self.agent_name, 
            department_name=self.department_name,
            **kwargs
        )
        self.logger.info(f"{self.display_name} initialized.")

    async def get_agent_card(self) -> AgentCard:
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="context", 
            endpoints=[f"{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability(name="conduct_market_analysis", description="Conducts market analysis on specific topics."),
            AgentCapability(name="competitor_research", description="Researches competitor activities and strategies.")
        ]

    async def execute_agent_task(self, message: TextPart, task_id: str, session_id: Optional[str] = None) -> str:
        # Actual implementation will go here, for now, a placeholder
        user_query = message.text
        self.logger.info(f"Research agent executing task: {user_query}")
        # This would typically call self.mcp_client.query_agent_aggregate(...)
        return f"Research complete for: {user_query}. Results: [Placeholder]"


def get_mcp_client_dependency(http_client: httpx.AsyncClient = Depends(get_original_http_client)) -> MCPClient:
    return MCPClient(http_client=http_client)

def get_agent_service(
    task_store: TaskStoreService = Depends(get_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_original_http_client),
    mcp_client: MCPClient = Depends(get_mcp_client_dependency)
) -> ResearchAgentService:
    return ResearchAgentService(
        task_store=task_store,
        http_client=http_client,
        mcp_client=mcp_client
    )

@agent_router.post("/tasks", response_model=Task, summary="Send a task to Research Agent")
async def send_task_to_research_agent(
    params: TaskSendParams,
    service: ResearchAgentService = Depends(get_agent_service)
):
    return await service.handle_task_send(params)

@agent_router.get("/agent-card", response_model=AgentCard, summary="Get Research Agent Card")
async def get_research_agent_card(
    service: ResearchAgentService = Depends(get_agent_service)
):
    return await service.get_agent_card()

@agent_router.get("/.well-known/agent.json", response_model=Dict[str, Any], summary="A2A Discovery for Research Agent", include_in_schema=False)
async def get_research_agent_discovery(
    service: ResearchAgentService = Depends(get_agent_service)
):
    return await service.get_a2a_agent_card_discovery_format() 