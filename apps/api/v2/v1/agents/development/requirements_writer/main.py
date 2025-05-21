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

AGENT_VERSION = "0.1.0"

class RequirementsWriterService(A2AAgentBaseService):
    """Requirements Writer Agent Service that queries the MCP for context-aware responses using MCPClient."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()  # Default base URL http://localhost:8000/mcp

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id="requirements-writer-agent-v1",
            name="Requirements Writer Agent",
            description="Generates and refines software requirements specifications by querying a central MCP.",
            version=AGENT_VERSION,
            type="specialized",
            endpoints=["/agents/development/requirements_writer/tasks"],
            capabilities=[
                AgentCapability(
                    name="generate_requirements",
                    description="Generates software requirements based on project descriptions and specifications."
                ),
                AgentCapability(
                    name="refine_requirements",
                    description="Refines existing requirements based on feedback and additional context."
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
            if hasattr(part, "root"):
                part_content = part.root
            else:
                part_content = part
            
            if hasattr(part_content, "text"):
                input_text = part_content.text
            elif isinstance(part_content, dict) and "text" in part_content:
                input_text = part_content["text"]

        self.logger.info(f"RequirementsWriterService (task {task_id}): Relaying query to MCP via MCPClient: '{input_text}'")
        response_text = ""

        try:
            # Use the MCPClient to get the aggregated response
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id="requirements_writer_agent",
                user_query=input_text,
                session_id=session_id
            )
            self.logger.info(f"RequirementsWriterService (task {task_id}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"RequirementsWriterService (task {task_id}): MCPClient Connection Error: {e_conn}")
            response_text = f"Connection Error: Could not connect to the requirements processing service (MCP). Please ensure it's running."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"RequirementsWriterService (task {task_id}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the requirements processing service (MCP) timed out."
        except MCPError as e_mcp:
            self.logger.error(f"RequirementsWriterService (task {task_id}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error from requirements processing service (MCP): {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"RequirementsWriterService (task {task_id}): Unexpected error using MCPClient: {str(e_generic)}")
            response_text = f"An unexpected error occurred while trying to reach the requirements processing service (MCP)."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        ) 