# apps/api/agents/customer/email_triage/main.py
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
# from apps.api.core.config import settings 
from apps.api.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

AGENT_ID = "email_triage_agent"
AGENT_NAME = "TriagePro"
AGENT_DESCRIPTION = "Your AI assistant for conceptually triaging incoming emails, categorizing them, and suggesting next steps or assignments."
AGENT_VERSION = "0.1.0"

class EmailTriageService(A2AAgentBaseService):
    """Email Triage Agent Service that conceptually triages emails."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="operational_support", 
            endpoints=[f"/agents/customer/email_triage/tasks"],
            capabilities=[
                AgentCapability(
                    name="triage_conceptual_email", 
                    description="Analyzes conceptual email details to suggest category, priority, and next actions."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by simulating email triage based on conceptual knowledge."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root") and hasattr(part.root, "text"):
                input_text = part.root.text
            elif hasattr(part, "text"): 
                 input_text = part.text
            elif isinstance(part, dict) and "text" in part: 
                 input_text = part["text"]

        self.logger.info(f"EmailTriageService (task {task_id}): Processing conceptual email details: '{input_text}'")
        
        category = "General Inquiry"
        priority = "Medium"
        suggested_action = "Review and assign manually."
        sentiment = "Neutral"

        if isinstance(input_text, str) and input_text != "[empty message]":
            lower_input = input_text.lower()

            if "invoice overdue" in lower_input and ("accounting@client.com" in lower_input or "client.com" in lower_input):
                category = "Invoice Question/Billing Issue"
                priority = "High"
                suggested_action = "Forward to your accounting department or the team member responsible for accounts receivable for that client."
                sentiment = "Urgent/Negative (potential issue)"
            elif "cannot access my account" in lower_input or "locked out" in lower_input:
                category = "Support Request"
                priority = "High"
                suggested_action = "Escalate to Tier 2 Support, Flag for immediate follow-up."
                sentiment = "Urgent, Negative"
            elif "question about your enterprise plan" in lower_input or "enterprise features" in lower_input:
                category = "Sales Inquiry"
                priority = "Medium (potential high value)"
                suggested_action = "Assign to Senior Sales Rep for Enterprise Accounts."
                sentiment = "Inquisitive"
            elif "partnership opportunities" in lower_input:
                category = "Business Development Inquiry/Partnership Proposal"
                priority = "Medium"
                suggested_action = "Route to your business development team or a manager responsible for strategic partnerships."
                sentiment = "Neutral/Positive"
            elif "job application" in lower_input or "resume attached" in lower_input:
                category = "Job Application"
                priority = "Medium"
                suggested_action = "Forward to HR/Recruiting department."
                sentiment = "Neutral"
            elif "spam" in lower_input or ("unsubscribe" in lower_input and "opt-out" in lower_input): 
                category = "Spam (potential)"
                priority = "Low"
                suggested_action = "Flag for review or mark as spam if confident. Do not click links."
                sentiment = "Suspicious/Neutral"
            
            response_text = (
                f"Conceptual Triage for email details '{input_text}':\n"
                f"- Category: {category}\n"
                f"- Priority: {priority}\n"
                f"- Suggested Action: {suggested_action}\n"
                f"- Conceptual Sentiment: {sentiment}\n"
                f"(This is TriagePro, providing a conceptual analysis. I am not accessing real email systems.)"
            )
        elif input_text == "[empty message]":
             response_text = f"TriagePro ready. Please provide conceptual email details (like subject, sender, or body snippet) for triage. (I am not accessing real email systems.)"
        else:
            response_text = f"TriagePro received invalid input format: {input_text}. Please provide conceptual email details as text. (I am not accessing real email systems.)"

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[email_triage_agent/main.py] Loaded. EmailTriageService defined.") 