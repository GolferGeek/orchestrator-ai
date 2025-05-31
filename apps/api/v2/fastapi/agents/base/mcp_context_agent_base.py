import httpx
from typing import Optional, List, Dict, Any
import logging

from ...a2a_protocol.task_store import TaskStoreService
from ...a2a_protocol.unified_agent_service import A2AUnifiedAgentService
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import Message, TextPart
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import AgentCard, AgentCapability
from ...shared.mcp.mcp_client import MCPClient


class MCPContextAgentBaseService(A2AUnifiedAgentService):
    # --- Class Attributes (to be overridden by subclasses) ---
    agent_id: str = "base-mcp-context-agent"
    agent_name: str = "base_mcp_context" # Path-friendly name
    display_name: str = "Base MCP Context Agent"
    agent_description: str = "Base class for agents that use MCP and context files."
    agent_version: str = "1.0.0"
    department_name: str = "system" # Default department

    primary_capability_name: str = "base_mcp_query"
    primary_capability_description: str = "Handles queries via MCP using context."
    
    is_sticky: bool = False
    sticky_duration: int = 30

    CONTEXT_FILE_NAME: Optional[str] = None
    MCP_TARGET_AGENT_ID: Optional[str] = None

    def __init__(self, 
                 task_store: TaskStoreService, 
                 http_client: httpx.AsyncClient,
                 mcp_client: MCPClient, # Added mcp_client
                 agent_name: Optional[str] = None, # Allow override
                 department_name: Optional[str] = None, # Allow override
                 **kwargs: Any):
        
        # Use provided or class-defined agent_name and department_name
        effective_agent_name = agent_name if agent_name is not None else self.agent_name
        effective_department_name = department_name if department_name is not None else self.department_name
        
        super().__init__(
            task_store=task_store, 
            http_client=http_client,
            agent_name=effective_agent_name,
            department_name=effective_department_name,
            **kwargs
        )
        self.mcp_client = mcp_client # Store the mcp_client
        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.__class__.__name__}")
        self.logger.info(f"{self.display_name} ({self.agent_id}) initialized with MCPClient.")
        # Context loading logic would go here if needed universally

    async def get_agent_card(self) -> AgentCard:
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="context_mcp", # Indicate it's an MCP context agent
            endpoints=[f"{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    def get_capabilities(self) -> List[AgentCapability]:
        # Subclasses should override this
        return [
            AgentCapability(
                name=self.primary_capability_name,
                description=self.primary_capability_description
            )
        ]

    async def execute_agent_task(self, message: Message, task_id: str, session_id: Optional[str] = None) -> str:
        # Placeholder - subclasses must implement actual MCP interaction
        self.logger.info(f"Base MCPContextAgent {self.agent_id} received task {task_id}.")
        
        user_query = ""
        if message.parts and isinstance(message.parts[0].root, TextPart):
            user_query = message.parts[0].root.text
        
        if not user_query:
            return "No query provided."

        if not self.MCP_TARGET_AGENT_ID:
            return "MCP_TARGET_AGENT_ID not configured for this agent."

        try:
            # Example of calling MCP - subclasses will refine this
            response = await self.mcp_client.query_agent_aggregate(
                agent_id=self.MCP_TARGET_AGENT_ID,
                user_query=user_query,
                session_id=session_id,
                # context_override=self.agent_context_content # If context is pre-loaded
            )
            return response
        except Exception as e:
            self.logger.error(f"Error in MCPContextAgentBaseService execute_agent_task: {e}")
            return f"Error processing task: {e}" 