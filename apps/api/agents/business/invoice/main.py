# apps/api/agents/business/invoice/main.py
from datetime import datetime, timezone
from typing import Optional

# Removed FastAPI imports for APIRouter, Body, Request, Response, Depends, HTTPException, etc.
# as A2AAgentBaseService and the main app loader will handle routing.

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService # Corrected import
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    # TaskRequestBody, TaskResponseBody are typically handled by base_agent or main loader
    TextPart
)
from ....core.config import settings # Corrected import path if settings are used
from ....shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError # Corrected import path

AGENT_VERSION = "0.1.0"
AGENT_ID = "invoice-agent-v1" # Matches .well-known/agent.json if it exists, or define here
AGENT_NAME = "Invoice Agent"

class InvoiceService(A2AAgentBaseService):
    """Invoice Agent Service that queries the MCP for context-aware responses using MCPClient."""

    def __init__(self, *args, **kwargs):
        # Ensure agent_name is passed if not automatically handled by superclass from module name
        # The main loader (process_agent_module) passes agent_name based on directory.
        super().__init__(*args, **kwargs) 
        self.mcp_client = MCPClient()
        # agent_id for MCP can be derived from self.agent_name or a constant
        self.agent_id_for_mcp = "invoice_agent" # Ensure this matches markdown context if used for MCP

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description="Manages invoicing, billing queries, and provides invoice-related information based on context.",
            version=AGENT_VERSION,
            type="specialized",
            endpoints=[f"/agents/business/{self.agent_name}/tasks"], # Dynamically use self.agent_name if it's set to 'invoice' by loader
            capabilities=[
                AgentCapability(
                    name="query_invoice_info_via_mcp", 
                    description="Answers questions about invoices and billing by relaying them to an MCP."
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
            part_content = message.parts[0].root if hasattr(message.parts[0], "root") else message.parts[0]
            if hasattr(part_content, "text"):
                input_text = part_content.text
            elif isinstance(part_content, dict) and "text" in part_content:
                input_text = part_content["text"]

        self.logger.info(f"InvoiceService (task {task_id}, agent: {self.agent_name}): Relaying query to MCP (target_agent_id: {self.agent_id_for_mcp}) via MCPClient: '{input_text}'")
        response_text = ""

        try:
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=self.agent_id_for_mcp, 
                user_query=input_text,
                session_id=session_id
            )
            self.logger.info(f"InvoiceService (task {task_id}, agent: {self.agent_name}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"InvoiceService (task {task_id}, agent: {self.agent_name}): MCPClient Connection Error: {e_conn}")
            response_text = f"Connection Error: Could not connect to the invoicing processing service (MCP). Please ensure it's running."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"InvoiceService (task {task_id}, agent: {self.agent_name}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the invoicing processing service (MCP) timed out."
        except MCPError as e_mcp:
            self.logger.error(f"InvoiceService (task {task_id}, agent: {self.agent_name}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error from invoicing processing service (MCP): {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"InvoiceService (task {task_id}, agent: {self.agent_name}): Unexpected error using MCPClient: {str(e_generic)}")
            response_text = f"An unexpected error occurred while trying to reach the invoicing processing service (MCP)."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# All custom router definitions and related FastAPI specific dependencies are removed.
# The main application loader (apps/api/main.py) will instantiate InvoiceService 
# and create A2A-compliant endpoints (/tasks, /.well-known/agent.json) based on it.

# print(f"[invoice_agent/main.py] Loaded. InvoiceService defined. Conforms to A2A base service pattern.") 