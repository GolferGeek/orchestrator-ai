# apps/api/python/fastapi-v2/agents/marketing/main.py
import httpx
from fastapi import APIRouter, Depends
from typing import Dict, Any, Optional, List

from ...a2a_protocol.unified_agent_service import A2AUnifiedAgentService
from ...a2a_protocol.task_store import TaskStoreService
from ...main import get_original_task_store_service, get_original_http_client
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import TaskSendParams, Task, Message, TextPart
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import AgentCard, AgentCapability

MARKETING_AGENT_ID = "marketing-parent-agent-v1"
MARKETING_AGENT_NAME = "marketing"
MARKETING_DISPLAY_NAME = "Marketing Operations Parent Agent"
MARKETING_DEPARTMENT = "marketing"

class MarketingAgentService(A2AUnifiedAgentService):
    agent_id: str = MARKETING_AGENT_ID
    agent_name: str = MARKETING_AGENT_NAME
    display_name: str = MARKETING_DISPLAY_NAME
    agent_description: str = "Parent agent for marketing, managing sub-agents like Blog Post and Research."
    agent_version: str = "1.0.0"
    department_name: str = MARKETING_DEPARTMENT

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
            type="orchestrator",
            endpoints=[f"{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    def get_capabilities(self) -> List[AgentCapability]:
        return [
            AgentCapability(name="delegate_to_blog_post", description="Delegates content creation tasks to the Blog Post agent."),
            AgentCapability(name="delegate_to_research", description="Delegates research tasks to the Marketing Research agent.")
        ]

    async def execute_agent_task(self, message: Message, task_id: str, session_id: Optional[str] = None) -> str:
        user_query = ""
        if message.parts and isinstance(message.parts[0].root, TextPart):
            user_query = message.parts[0].root.text.lower()

        self.logger.info(f"Marketing Parent Agent received task: {user_query[:100]}")

        # Simple keyword-based routing
        if "blog" in user_query or "post" in user_query or "article" in user_query:
            target_agent_path = "marketing/blog_post"
            self.logger.info(f"Delegating to Blog Post agent: {target_agent_path}")
        elif "research" in user_query or "analyze" in user_query or "market" in user_query:
            target_agent_path = "marketing/research"
            self.logger.info(f"Delegating to Research agent: {target_agent_path}")
        else:
            # Fallback or default delegation if no keywords match
            # For now, let's try to be helpful and perhaps default to blog post or provide an error/clarification message
            # self.logger.warning(f"Could not determine target sub-agent for query: {user_query}. Consider a default or LLM routing.")
            # return "I can help with blog posts or market research. Please specify which you need."
            # Defaulting to blog post for now if unsure
            target_agent_path = "marketing/blog_post"
            self.logger.info(f"Query didn't clearly specify blog or research, defaulting to Blog Post agent: {target_agent_path}")

        return await self.delegate_to_agent(target_agent_path, user_query, task_id, session_id)

agent_router = APIRouter(tags=[MARKETING_DISPLAY_NAME])

def get_agent_service(
    task_store: TaskStoreService = Depends(get_original_task_store_service),
    http_client: httpx.AsyncClient = Depends(get_original_http_client)
) -> MarketingAgentService:
    return MarketingAgentService(task_store=task_store, http_client=http_client)

@agent_router.post("/tasks", response_model=Task)
async def send_task_to_marketing_agent(params: TaskSendParams, service: MarketingAgentService = Depends(get_agent_service)):
    return await service.handle_task_send(params)

@agent_router.get("/agent-card", response_model=AgentCard)
async def get_marketing_agent_card(service: MarketingAgentService = Depends(get_agent_service)):
    return await service.get_agent_card()

@agent_router.get("/.well-known/agent.json", response_model=Dict[str, Any], include_in_schema=False)
async def get_marketing_agent_discovery(service: MarketingAgentService = Depends(get_agent_service)):
    return await service.get_a2a_agent_card_discovery_format() 