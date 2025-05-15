from datetime import datetime, timezone
from typing import Optional, Any

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
# Assuming settings might be used later, correct path would be:
# from ....core.config import settings 
from ....shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError # Corrected import path

AGENT_ID = "sop_agent"
AGENT_NAME = "ProcedurePro"
AGENT_DESCRIPTION = "Your guide for navigating and understanding Standard Operating Procedures (SOPs)."
AGENT_VERSION = "0.1.0"

class SopService(A2AAgentBaseService):
    """SOP Agent Service that provides information based on conceptual Standard Operating Procedures."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="instructional", 
            endpoints=[f"/agents/business/sop/tasks"],
            capabilities=[
                AgentCapability(
                    name="query_sop_knowledge", 
                    description="Answers questions and explains steps based on conceptual SOPs."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by simulating SOP guidance based on conceptual knowledge."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root") and hasattr(part.root, "text"):
                input_text = part.root.text
            elif hasattr(part, "text"): 
                 input_text = part.text
            elif isinstance(part, dict) and "text" in part: 
                 input_text = part["text"]

        self.logger.info(f"SOPService (task {task_id}): Processing query: '{input_text}'")
        
        response_text = f"ProcedurePro received: '{input_text}'. Standard SOP guidance will be provided here."

        if isinstance(input_text, str) and input_text != "[empty message]":
            lower_input = input_text.lower()
            if "employee onboarding" in lower_input and "first step" in lower_input:
                response_text = "According to the conceptual Employee Onboarding SOP, Step 1 is: HR sends the welcome packet."
            elif "expense report" in lower_input and "deadline" in lower_input:
                response_text = "Based on the conceptual Expense Report SOP, all expense reports must be submitted via the XpensePro portal by the 5th of the following month."
            elif ("computer" in lower_input and "broken" in lower_input) or ("it support" in lower_input and "urgent" in lower_input):
                response_text = "For urgent IT issues like a broken computer, the conceptual IT Support Request SOP suggests calling the IT Helpdesk at x1234. For non-urgent issues, you would submit a ticket through the ServiceDesk portal."
            elif "receipt" in lower_input and ("$10" in lower_input or "coffee" in lower_input):
                response_text = "The conceptual Expense Report SOP states that receipts are required for all expenses over $25. So, for a $10 coffee, a receipt might not be strictly required based on that specific rule, but it's always good practice to keep them."
            elif "expense report" in lower_input:
                 response_text = "Regarding expense reports (based on conceptual SOP): Submit via XpensePro by the 5th of the following month. Receipts are needed for expenses over $25. Approved reports are reimbursed in 7 business days."
            elif "it support" in lower_input:
                 response_text = "For IT support (based on conceptual SOP): Urgent issues, call IT Helpdesk at x1234. Non-urgent, submit a ticket via ServiceDesk portal (help.company.com). Provide employee ID, issue description, and error messages."
            elif "employee onboarding" in lower_input:
                response_text = "The conceptual Employee Onboarding SOP includes: Step 1: HR sends welcome packet. Step 2: Manager schedules introductory meetings. Step 3: IT provisions equipment and access within 48 hours."
            else:
                response_text = f"ProcedurePro received: '{input_text}'. I can provide guidance on conceptual SOPs like Employee Onboarding, Expense Reports, and IT Support. How can I help with those?"

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[sop_agent/main.py] Loaded. SOPService defined.") 