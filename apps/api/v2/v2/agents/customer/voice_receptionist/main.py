# apps/api/agents/customer/voice_receptionist/main.py
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

AGENT_ID = "voice_receptionist_agent"
AGENT_NAME = "VoiceConnect"
AGENT_DESCRIPTION = "Your AI assistant for simulating a voice receptionist, directing calls, and providing basic company information."
AGENT_VERSION = "0.1.0"
COMPANY_NAME = "Golfer Geek" # As per markdown context example

class VoiceReceptionistService(A2AAgentBaseService):
    """Voice Receptionist Agent Service that simulates voice call interactions."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()
        # Conceptual company info from markdown
        self.company_info = {
            "hours": "Monday to Friday, from 9 AM to 5 PM Eastern Time.",
            "address": "Our main office is at 123 Main Street.",
            "website": "You can find more information at www.golfergeek.com"
        }

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="customer_interface", 
            endpoints=[f"/agents/customer/voice_receptionist/tasks"], 
            capabilities=[
                AgentCapability(
                    name="simulate_voice_reception", 
                    description="Simulates voice receptionist, routes calls conceptually, provides company info."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by simulating a voice receptionist interaction."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root") and hasattr(part.root, "text"):
                input_text = part.root.text
            elif hasattr(part, "text"): 
                 input_text = part.text
            elif isinstance(part, dict) and "text" in part: 
                 input_text = part["text"]

        self.logger.info(f"VoiceReceptionistService (task {task_id}): Processing caller utterance: '{input_text}'")
        
        response_text = f"Thank you for calling {COMPANY_NAME}. How may I direct your call? (This is VoiceConnect, a conceptual assistant.)"

        if isinstance(input_text, str) and input_text.lower() not in ["[empty message]", "hi", "hello", "hey"]:
            lower_input = input_text.lower()

            if "sales" in lower_input:
                response_text = f"Certainly. Connecting you to the Sales Department now. Please hold. (This is VoiceConnect, a conceptual transfer.)"
            elif "support" in lower_input or "customer service" in lower_input:
                response_text = f"Okay. Connecting you to Customer Support. Please hold. (This is VoiceConnect, a conceptual transfer.)"
            elif "hr" in lower_input or "human resources" in lower_input or "benefits" in lower_input:
                response_text = f"For inquiries about HR, I can connect you to the HR Department. Please hold while I transfer you. (This is VoiceConnect, a conceptual transfer.)"
            elif "business hours" in lower_input or "are you open" in lower_input or "office open" in lower_input:
                hours_response = self.company_info["hours"]
                if "saturday" in lower_input or "sunday" in lower_input or "weekend" in lower_input:
                    response_text = f"{hours_response} We are closed on Saturdays and Sundays. (This is VoiceConnect, a conceptual assistant.)"
                else:
                    response_text = f"Our business hours are {hours_response} (This is VoiceConnect, a conceptual assistant.)"
            elif "address" in lower_input or "location" in lower_input:
                response_text = f"{self.company_info['address']} (This is VoiceConnect, a conceptual assistant.)"
            elif "website" in lower_input:
                response_text = f"{self.company_info['website']} (This is VoiceConnect, a conceptual assistant.)"
            elif "leave a message" in lower_input:
                person_name = "the person you were trying to reach"
                # Basic attempt to extract a name if provided after "for"
                if " for " in lower_input:
                    try:
                        name_part = lower_input.split(" for ", 1)[1]
                        # Take first few words as potential name, avoid overly long captures
                        person_name = " ".join(name_part.split()[:3]).strip("?.,!")
                    except IndexError:
                        pass 
                response_text = f"{person_name.title()} is currently unavailable (conceptually). I can take a message. Could I please have your name, company, phone number, and a brief message? (This is VoiceConnect, a conceptual assistant.)"
            else: # Default if no specific keyword match but not a simple greeting
                 response_text = f"How may I direct your call regarding '{input_text}'? You can ask for Sales, Support, HR, or general company information. (This is VoiceConnect, a conceptual assistant.)"
        elif input_text == "[empty message]": # Handles the case where the initial message processing results in [empty message]
            pass # Keeps the default greeting

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[voice_receptionist_agent/main.py] Loaded. VoiceReceptionistService defined.") 