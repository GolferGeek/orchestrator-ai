from datetime import datetime, timezone
from typing import Optional

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
# Assuming settings are in a similar location relative to this agent
from apps.api.core.config import settings 
# Import the MCPClient and its exceptions from the shared location
from apps.api.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

AGENT_VERSION = "0.1.0"

class MarketResearchService(A2AAgentBaseService):
    """Market Research Agent Service that queries the MCP for context-aware responses using MCPClient."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Initialize MCPClient. The base URL can be configured via settings if needed,
        # otherwise MCPClient uses its default.
        self.mcp_client = MCPClient() 

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id="market-research-agent-v1", # Should match agent.json
            name="Market Research Agent",   # Should match agent.json
            description="Provides market research and analysis by querying a central MCP.", # Should match agent.json
            version=AGENT_VERSION,
            type="specialized", # Should match agent.json
            endpoints=["/agents/external/market_research/tasks"], # Should match agent.json
            capabilities=[
                AgentCapability(
                    name="query_market_research_via_mcp", # Should match agent.json
                    description="Answers questions and provides market research data by relaying them to an MCP." # Should match agent.json
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by sending the query to the MCP via MCPClient."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            # Handle potential nesting of 'root' if TextPart is wrapped
            if hasattr(part, "root"):
                part_content = part.root
            else:
                part_content = part
            
            # Extract text attribute, checking if part_content is a dict or object
            if hasattr(part_content, "text"):
                input_text = part_content.text
            elif isinstance(part_content, dict) and "text" in part_content:
                input_text = part_content["text"]


        self.logger.info(f"MarketResearchService (task {task_id}): Relaying query to MCP via MCPClient: '{input_text}'")
        response_text = ""

        try:
            # Use the MCPClient to get the aggregated response
            # agent_id for this service will be "market_research_agent"
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id="market_research_agent", 
                user_query=input_text,
                session_id=session_id # Pass session_id to MCPClient
            )
            self.logger.info(f"MarketResearchService (task {task_id}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"MarketResearchService (task {task_id}): MCPClient Connection Error: {e_conn}")
            response_text = f"Connection Error: Could not connect to the market research processing service (MCP). Please ensure it's running."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"MarketResearchService (task {task_id}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the market research processing service (MCP) timed out."
        except MCPError as e_mcp:
            self.logger.error(f"MarketResearchService (task {task_id}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error from market research processing service (MCP): {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"MarketResearchService (task {task_id}): Unexpected error using MCPClient: {str(e_generic)}")
            response_text = f"An unexpected error occurred while trying to reach the market research processing service (MCP)."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# This print statement can be useful for confirming the module is loaded during startup.
# print(f"[market_research/main.py] Loaded. MarketResearchService now uses MCPClient.") 