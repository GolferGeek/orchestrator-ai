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

AGENT_ID = "chat_support_agent"
AGENT_NAME = "ChatChampion"
AGENT_DESCRIPTION = "Your AI assistant for handling conceptual real-time chat support interactions with customers."
AGENT_VERSION = "0.1.0"

class ChatSupportService(A2AAgentBaseService):
    """Chat Support Agent Service that simulates customer chat interactions."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.mcp_client = MCPClient()

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            type="customer_support", 
            endpoints=[f"/agents/customer/chat_support/tasks"],
            capabilities=[
                AgentCapability(
                    name="simulate_chat_support", 
                    description="Simulates a customer support chat, offers conceptual solutions and troubleshooting."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by simulating a chat support interaction based on conceptual knowledge."""
        
        input_text = "[empty message]"
        if message.parts:
            part = message.parts[0]
            if hasattr(part, "root") and hasattr(part.root, "text"):
                input_text = part.root.text
            elif hasattr(part, "text"): 
                 input_text = part.text
            elif isinstance(part, dict) and "text" in part: 
                 input_text = part["text"]

        self.logger.info(f"ChatSupportService (task {task_id}): Processing customer query: '{input_text}'")
        
        # Default opening if it's the start of a conversation or a generic input
        # This is a very simplified state management. A real chat agent would need more.
        response_text = f"Hello! Thanks for contacting support. How can I help you today? (I am ChatChampion, a conceptual assistant.)"

        # Simulated chat logic based on markdown_context/chat_support_agent.md
        if isinstance(input_text, str) and input_text != "[empty message]":
            lower_input = input_text.lower()
            
            if "can't log in" in lower_input or "login issue" in lower_input:
                response_text = "I'm sorry to hear you're having trouble logging in. To help me understand, are you seeing any specific error messages? (This is ChatChampion, a conceptual assistant.)"
                # Further simulated conversation based on the markdown example:
                if "invalid credentials" in lower_input:
                    response_text = "Okay, 'Invalid credentials' usually means the email or password isn't matching what we have on file. Have you tried resetting your password recently using the 'Forgot Password' link on the login page? (This is ChatChampion, a conceptual assistant.)"
                elif "didn't get reset email" in lower_input or "no reset email" in lower_input:
                     response_text = "Hmm, let's check a couple of things. Could you please confirm the email address you're using to log in and also check your spam/junk folder for the reset email, just in case? Since I am a conceptual assistant, I can't actually check systems, but this is what a live agent might ask. If the problem persists, they would likely need to escalate to an account specialist team."
            elif "internet is not working" in lower_input or "no internet" in lower_input:
                response_text = "I'm sorry to hear your internet isn't working. I can help you with some basic troubleshooting steps. First, have you tried restarting your modem and router? Sometimes that resolves connection issues. (This is ChatChampion, a conceptual assistant.)"
            elif "refund" in lower_input and ("order" in lower_input or "last order" in lower_input):
                response_text = "I understand you'd like to request a refund for your last order. While I can't process refunds directly in this chat, I can guide you to our refund policy information and explain the general process. To initiate a refund request, you'll typically need to contact our billing department or fill out a form on our website. Would you like me to point you to where you might find that information (conceptually)? (This is ChatChampion.)"
            elif input_text.lower() not in ["hi", "hello", "hey"] : # Avoid re-greeting if already greeted
                 response_text = f"Thanks for sharing that. Regarding '{input_text}', how can I best assist you with this conceptually? (I am ChatChampion, a conceptual assistant.)"

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[chat_support_agent/main.py] Loaded. ChatSupportService defined.") 