from datetime import datetime, timezone
from typing import Optional
# No longer need os, httpx, json directly here as MCPClient handles it
# from pathlib import Path # MCPClient doesn't need this from here

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
from ....core.config import settings
# Import the new MCPClient and its exceptions
from ....shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

AGENT_VERSION = "0.1.0"
# MCP_METRICS_AGENT_URL is now encapsulated within MCPClient or its usage

class MetricsService(A2AAgentBaseService):
    """Metrics Agent Service that queries the MCP for context-aware responses using MCPClient."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # MCP_BASE_URL could come from settings if it needs to be configurable
        self.mcp_client = MCPClient() # Default base URL http://localhost:8000/mcp

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id="metrics-agent-v1",
            name="Metrics Agent",
            description="Provides business metrics and analytics by querying a central MCP.",
            version=AGENT_VERSION,
            type="specialized",
            endpoints=["/agents/business/metrics/tasks"],
            capabilities=[
                AgentCapability(name="query_metrics_via_mcp", description="Answers questions about business metrics by relaying them to an MCP.")
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None # Pass session_id to MCPClient if used
    ) -> Message:
        """Process a message by sending the query to the MCP via MCPClient."""
        
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

        self.logger.info(f"MetricsService (task {task_id}): Relaying query to MCP via MCPClient: '{input_text}'")
        response_text = ""

        try:
            # Use the MCPClient to get the aggregated response
            # agent_id for this service is "metrics_agent"
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id="metrics_agent", 
                user_query=input_text,
                session_id=session_id
            )
            self.logger.info(f"MetricsService (task {task_id}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"MetricsService (task {task_id}): MCPClient Connection Error: {e_conn}")
            response_text = f"Connection Error: Could not connect to the metrics processing service (MCP). Please ensure it's running."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"MetricsService (task {task_id}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the metrics processing service (MCP) timed out."
        except MCPError as e_mcp:
            self.logger.error(f"MetricsService (task {task_id}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error from metrics processing service (MCP): {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"MetricsService (task {task_id}): Unexpected error using MCPClient: {str(e_generic)}")
            response_text = f"An unexpected error occurred while trying to reach the metrics processing service (MCP)."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# agent_router import is still commented out as MetricsService handles /tasks
# print(f"[metrics/main.py] Loaded. MetricsService now uses MCPClient.") 