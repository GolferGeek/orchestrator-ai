# apps/api/agents/productivity/meetings/main.py
from typing import Optional

from apps.api.v1.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.v1.a2a_protocol.types import AgentCard, AgentCapability # For get_agent_card customization

# Define Agent specific constants
AGENT_ID: str = "meetings-agent-v1"
AGENT_NAME: str = "meetings" # Standardized to directory name
AGENT_DESCRIPTION: str = "Assists with meeting scheduling, summaries, and related productivity tasks by querying a central MCP."
AGENT_VERSION: str = "1.0.0" # Standardized version
MCP_TARGET_AGENT_ID: str = "knowledge_agent_productivity" # As per existing code
CONTEXT_FILE_NAME: str = "meetings_agent.md"
PRIMARY_CAPABILITY_NAME: str = "query_meeting_information"
PRIMARY_CAPABILITY_DESCRIPTION: str = "Answers questions about meetings and assists with scheduling by relaying them to an MCP."

class MeetingsService(MCPContextAgentBaseService):
    """
    Meetings Agent Service that queries an MCP for context-aware responses.
    It leverages MCPContextAgentBaseService for handling message processing.
    """
    agent_id: str = AGENT_ID
    agent_name: str = AGENT_NAME
    agent_description: str = AGENT_DESCRIPTION
    agent_version: str = AGENT_VERSION
    mcp_target_agent_id: str = MCP_TARGET_AGENT_ID
    context_file_name: str = CONTEXT_FILE_NAME
    primary_capability_name: str = PRIMARY_CAPABILITY_NAME
    primary_capability_description: str = PRIMARY_CAPABILITY_DESCRIPTION

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Any other specific initializations for MeetingsService can go here.

    # Optional: Override get_agent_card if specific customizations are needed
    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="specialized", # As per original agent
            endpoints=[f"/agents/{self.department_name}/{self.agent_name}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
            ]
        )

# All APIRouter, route handlers, and service factory functions are removed.
# The main application loader in apps/api/main.py will handle this. 