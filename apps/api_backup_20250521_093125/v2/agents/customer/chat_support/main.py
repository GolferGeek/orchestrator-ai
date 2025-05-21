from datetime import datetime, timezone
from typing import Optional, Any

from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
# Assuming settings might be used later, correct path would be:
# from apps.api.core.config import settings 
from apps.api.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError # Corrected import path

# Define Agent specific constants
AGENT_ID = "chat_support_agent"
AGENT_NAME = "chat_support"
AGENT_DESCRIPTION = "Customer support chat agent that assists users with product questions, account issues, and technical problems. This agent should be used whenever a user wants to speak with customer support."
AGENT_VERSION = "1.0.0"
MCP_TARGET_AGENT_ID = AGENT_NAME
CONTEXT_FILE_NAME = "chat_support_agent.md"
PRIMARY_CAPABILITY_NAME = "handle_support_inquiries"
PRIMARY_CAPABILITY_DESCRIPTION = "Provides helpful support to customers with various inquiries and issues including account problems, product usage, and technical issues."

class ChatSupportService(MCPContextAgentBaseService):
    """
    Chat Support Agent Service using MCPContextAgentBaseService.
    This allows the agent to use the markdown context file for responses.
    """
    agent_id: str = AGENT_ID
    agent_name: str = AGENT_NAME
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = PRIMARY_CAPABILITY_DESCRIPTION
    department_name: str = "customer"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.mcp_client = MCPClient()

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="customer_support",
            endpoints=[f"/agents/{self.department_name}/{self.agent_name}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

# print(f"[chat_support_agent/main.py] Loaded. ChatSupportService defined.") 