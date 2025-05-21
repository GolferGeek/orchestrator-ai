from fastapi import APIRouter
from datetime import datetime, timezone
from typing import Optional

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
from ....core.config import settings
from ....shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

router = APIRouter()

@router.get("/")
async def competitors_root():
    return {"agent": "competitors", "message": "Competitors agent is active"}

@router.get("/.well-known/agent.json")
async def get_competitors_agent_discovery():
    return {
        "name": "Competitors Agent",
        "description": "Gathers and analyzes information about competitors.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Competitors agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 

AGENT_VERSION = "0.1.0"
AGENT_ID = "competitors-agent-v1"
AGENT_NAME = "Competitors Agent"
AGENT_DESCRIPTION = "Gathers and analyzes information about competitors, their products, market positioning, and activities."

class CompetitorsService(A2AAgentBaseService):
    """Competitors Agent Service that queries the MCP for context-aware responses about competitors."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()
        self.agent_id_for_mcp = "competitors_agent"  # Matches the markdown context file name

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="specialized",
            endpoints=[f"/agents/external/{self.agent_name}/tasks"],
            capabilities=[
                AgentCapability(
                    name="query_competitor_info",
                    description="Retrieves and analyzes information about competitors, their products, and market positioning."
                ),
                AgentCapability(
                    name="compare_competitors",
                    description="Compares features and capabilities between different competitors and our offerings."
                ),
                AgentCapability(
                    name="track_competitor_updates",
                    description="Monitors and reports on recent competitor activities and updates."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by querying competitor information via MCPClient."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root"):
                part_content = part.root
            else:
                part_content = part
            
            if hasattr(part_content, "text"):
                input_text = part_content.text
            elif isinstance(part_content, dict) and "text" in part_content:
                input_text = part_content["text"]

        self.logger.info(f"CompetitorsService (task {task_id}): Processing query via MCPClient: '{input_text}'")
        response_text = ""

        try:
            # Use MCPClient to get competitor information
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=self.agent_id_for_mcp,
                user_query=input_text,
                session_id=session_id
            )
            self.logger.info(f"CompetitorsService (task {task_id}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"CompetitorsService (task {task_id}): MCPClient Connection Error: {e_conn}")
            response_text = "Connection Error: Could not connect to the competitor information service. Please try again later."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"CompetitorsService (task {task_id}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the competitor information service timed out. Please try again."
        except MCPError as e_mcp:
            self.logger.error(f"CompetitorsService (task {task_id}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error retrieving competitor information: {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"CompetitorsService (task {task_id}): Unexpected error: {str(e_generic)}")
            response_text = "An unexpected error occurred while retrieving competitor information."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        ) 