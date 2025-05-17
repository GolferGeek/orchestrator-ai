# apps/api/agents/business/invoice/main.py
from typing import Optional

from apps.api.agents.base.mcp_context_agent_base import MCPContextAgentBaseService
from apps.api.a2a_protocol.types import AgentCard, AgentCapability # Keep if get_agent_card is customized

# Define Agent specific constants
AGENT_ID: str = "invoice-agent-v1" # From existing code
AGENT_NAME: str = "invoice" # Standardized to directory name
AGENT_DESCRIPTION: str = "Manages invoicing, billing queries, and provides invoice-related information by interacting with an MCP."
AGENT_VERSION: str = "1.0.0" # Standardized version
MCP_TARGET_AGENT_ID: str = "invoice_mcp_target" # Placeholder, to be configured as needed
CONTEXT_FILE_NAME: str = "invoice_agent.md" # Standardized context file name
PRIMARY_CAPABILITY_NAME: str = "query_invoice_information"
PRIMARY_CAPABILITY_DESCRIPTION: str = "Answers questions about invoices and billing by relaying them to an MCP."

class InvoiceService(MCPContextAgentBaseService):
    """
    Invoice Agent Service that queries an MCP for context-aware responses.
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
        # MCPClient is initialized in the base class (MCPContextAgentBaseService)
        # Any other specific initializations for InvoiceService can go here.

    # The get_agent_card method can be inherited from MCPContextAgentBaseService
    # if the default implementation using the class constants is sufficient.
    # If customization is needed (e.g., different type, more capabilities),
    # it can be overridden here like this:
    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=self.agent_id,
            name=self.agent_name,
            description=self.agent_description,
            version=self.agent_version,
            type="specialized", # Existing type
            endpoints=[f"/agents/{self.department_name}/{self.agent_name}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                )
                # Add other capabilities if any
            ]
        )

    # process_message is now handled by MCPContextAgentBaseService
    # async def process_message( ... ) -> ... :
    #     ...

# The main application loader (apps/api/main.py) will instantiate InvoiceService
# and create A2A-compliant endpoints based on MCPContextAgentBaseService.

# print(f"[invoice_agent/main.py] Loaded. InvoiceService defined. Conforms to A2A base service pattern.") 