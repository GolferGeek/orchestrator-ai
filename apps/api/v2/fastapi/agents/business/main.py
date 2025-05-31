# apps/api/python/fastapi-v2/agents/business/main.py
import httpx
from fastapi import APIRouter, Depends
from typing import Dict, Any, Optional

from ...a2a_protocol.unified_agent_service import A2AUnifiedAgentService
from ...a2a_protocol.task_store import TaskStoreService
from ...main import get_original_task_store_service, get_original_http_client
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import TaskSendParams, Task, Message, TextPart
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import AgentCard, AgentCapability

BUSINESS_AGENT_ID = "business-parent-agent-v1"
BUSINESS_AGENT_NAME = "business"
BUSINESS_DISPLAY_NAME = "Business Operations Parent Agent"
BUSINESS_DEPARTMENT = "business" # Parent agents can also belong to a department

class BusinessAgentService(A2AUnifiedAgentService):
    agent_id: str = BUSINESS_AGENT_ID
    agent_name: str = BUSINESS_AGENT_NAME
    display_name: str = BUSINESS_DISPLAY_NAME
    agent_description: str = "Parent agent for business operations, managing and delegating to sub-agents like Metrics."
    agent_version: str = "1.0.0"
    department_name: str = BUSINESS_DEPARTMENT

    def __init__(self, task_store: TaskStoreService, http_client: httpx.AsyncClient, **kwargs: Any):
        super().__init__(task_store=task_store, http_client=http_client, **kwargs)
        self.logger.info(f"{self.display_name} initialized.")

    async def get_agent_card(self) -> AgentCard:
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="orchestrator", # This parent agent acts as a focused orchestrator
            endpoints=[f"{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    def get_capabilities(self) -> list[AgentCapability]:
        return [
            AgentCapability(name="delegate_to_metrics", description="Delegates tasks to the Metrics agent."),
            # Add more capabilities if the Business parent agent itself handles some tasks
        ]

    async def execute_agent_task(self, message: Message, task_id: str, session_id: Optional[str] = None) -> str:
        user_query = ""
        if message.parts and isinstance(message.parts[0].root, TextPart):
            user_query = message.parts[0].root.text

        self.logger.info(f"Business Parent Agent received task: {user_query[:100]}")
        # For now, assume all tasks to business parent are for metrics
        # A more sophisticated version would use an LLM or keyword matching to decide
        metrics_agent_path = "business/metrics" # Path to the child agent
        self.logger.info(f"Delegating to metrics agent: {metrics_agent_path}")
        return await self.delegate_to_agent(metrics_agent_path, user_query, task_id, session_id)

agent_router = APIRouter(tags=[BUSINESS_DISPLAY_NAME])

def get_agent_service(
    task_store: TaskStoreService = Depends(get_original_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> BusinessAgentService:
    return BusinessAgentService(task_store=task_store, http_client=http_client)

@agent_router.post("/tasks", response_model=Task)
async def send_task_to_business_agent(params: TaskSendParams, service: BusinessAgentService = Depends(get_agent_service)):
    return await service.handle_task_send(params)

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_business_agent_card(service: BusinessAgentService = Depends(get_agent_service)):
    return await service.get_agent_card()

@agent_router.get("/.well-known/agent.json", response_model=Dict[str, Any], include_in_schema=False)
async def get_business_agent_discovery(service: BusinessAgentService = Depends(get_agent_service)):
    return await service.get_a2a_agent_card_discovery_format() 