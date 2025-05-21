# apps/api/agents/customer/voice_summary/main.py
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

AGENT_ID = "voice_summary_agent"
AGENT_NAME = "SummaryScribe"
AGENT_DESCRIPTION = "Your AI assistant for creating concise summaries from conceptual voice interaction transcripts or notes."
AGENT_VERSION = "0.1.0"

class VoiceSummaryService(A2AAgentBaseService):
    """Voice Summary Agent Service that creates summaries from conceptual voice interaction transcripts or notes."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="utility", # Or "information_processing"
            endpoints=[f"/agents/customer/voice_summary/tasks"],
            capabilities=[
                AgentCapability(
                    name="summarize_conceptual_voice_interaction", 
                    description="Creates a structured summary from conceptual voice interaction transcripts or notes."
                )
            ]
        )

    def _parse_input_for_summary_details(self, text: str) -> dict:
        """A very basic parser to extract details for summarization from text."""
        details = {
            "caller": "(Not specified)",
            "date_time": "(Not specified, assumed current)",
            "primary_issue": "(Could not determine from input)",
            "key_points": [],
            "outcome": "(Not specified)",
            "action_items": []
        }
        lower_text = text.lower()

        # Simplistic keyword-based extraction - this would be much more robust with NLP in a real agent
        if "caller:" in lower_text:
            details["caller"] = text[lower_text.find("caller:")+7:].split("\n")[0].strip()
        elif "from" in lower_text: # e.g. "Tom from Beta Inc."
            try:
                name_part = lower_text.split("from")[0].strip()
                if name_part and len(name_part.split()) < 4 : # Avoid capturing long sentences
                    details["caller"] = name_part.title()
                company_part = lower_text.split("from")[1].split("called")[0].strip().split()[0].strip(".?!,")
                if company_part:
                     details["caller"] += f" ({company_part.title()})"
            except Exception: pass
        
        if "issue:" in lower_text:
            details["primary_issue"] = text[lower_text.find("issue:")+6:].split("\n")[0].strip()
        elif "order #" in lower_text or "order number" in lower_text:
            details["primary_issue"] = "Inquiry about an order."
        # This specific check for password issues should be independent or checked after generic 'issue:'
        # If 'issue:' captured something, let's see if it's a password issue and refine it.
        
        # Refined check for password issue, can override a generic 'issue:' capture
        if "password" in lower_text and ("reset" in lower_text or "can't log in" in lower_text or "login issue" in lower_text):
            details["primary_issue"] = "Password/Login Issue."
        elif "pricing" in lower_text or "demo request" in lower_text: # This was an elif, ensure it remains logically correct
            details["primary_issue"] = "Sales Inquiry (Pricing/Demo)."

        if "delayed" in lower_text and "order" in lower_text:
            details["key_points"].append("Order is delayed.")
        if "update on when" in lower_text or "expected delivery" in lower_text:
            details["key_points"].append("Needs update on expected delivery date.")
        if "callback requested" in lower_text or "call me back" in lower_text:
            details["key_points"].append("Callback requested.")
        if "escalated to tier 2" in lower_text:
            details["outcome"] = "Escalated to Tier 2."
            details["key_points"].append("Issue escalated to Tier 2 after basic troubleshooting.")
        elif "issue resolved" in lower_text:
            details["outcome"] = "Issue resolved."
        elif "message taken" in lower_text or "voicemail received" in lower_text:
            details["outcome"] = "Message taken/Voicemail logged."

        # Simplistic action item extraction
        if "call back" in lower_text and "sales team" in lower_text:
            details["action_items"].append("Call back to discuss pricing/demo - (Sales Team, This Week)")
        elif "check status of order" in lower_text:
             details["action_items"].append("Check status of order - (Support Team, ASAP)")

        if not details["key_points"] and details["primary_issue"] != "(Could not determine from input)":
            details["key_points"].append(details["primary_issue"])
        if not details["key_points"]:
            details["key_points"].append("(No specific key points extracted from input)")

        return details

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by creating a summary from conceptual voice interaction text."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root") and hasattr(part.root, "text"):
                input_text = part.root.text
            elif hasattr(part, "text"): 
                 input_text = part.text
            elif isinstance(part, dict) and "text" in part: 
                 input_text = part["text"]

        self.logger.info(f"VoiceSummaryService (task {task_id}): Processing text for summarization: '{input_text}'")
        
        response_text = "SummaryScribe received text. Please provide a conceptual transcript or notes for summarization."

        if input_text == "[empty message]":
            response_text = "SummaryScribe ready. Please provide the conceptual transcript or notes from the voice interaction you'd like summarized. (I work with text input only.)"
        elif isinstance(input_text, str) and input_text not in ["summarize this:", "summarize this voicemail:"]:
            summary_details = self._parse_input_for_summary_details(input_text)
            
            summary_lines = [
                f"- Caller: {summary_details['caller']}",
                f"- Date/Time: {summary_details['date_time']}",
                f"- Primary Issue/Reason: {summary_details['primary_issue']}",
                f"- Key Points Discussed:"
            ]
            for point in summary_details["key_points"]:
                summary_lines.append(f"  - {point}")
            summary_lines.append(f"- Outcome/Resolution: {summary_details['outcome']}")
            if summary_details["action_items"]:
                summary_lines.append(f"- Action Items:")
                for item in summary_details["action_items"]:
                    summary_lines.append(f"  - {item}")
            
            response_text = "Okay, here's a conceptual summary based on the provided text:\n" + "\n".join(summary_lines) + "\n(This is SummaryScribe, providing a conceptual summary from text.)"
        elif input_text != "[empty message]":
             response_text = f"SummaryScribe ready. Please provide the conceptual transcript or notes from the voice interaction you'd like summarized. (I work with text input only.)"


        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[voice_summary_agent/main.py] Loaded. VoiceSummaryService defined.") 