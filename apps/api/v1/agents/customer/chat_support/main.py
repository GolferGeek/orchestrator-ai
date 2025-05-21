from datetime import datetime, timezone
from typing import Optional, Any

from apps.api.v1.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
# Import settings from the v1 module
# from apps.api.v1.core.config import settings 
from apps.api.v1.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

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
        if input_text == "[empty message]" or input_text.lower() in ["hi", "hello", "hey"]:
            response_text = f"Hi there! I'm ChatChampion, and I'm here to help you today. What brings you to our support chat? I'd love to hear how I can make your day better."
            return Message(
                role="agent",
                parts=[TextPart(text=response_text)],
                timestamp=datetime.now(timezone.utc).isoformat()
            )

        # Use the MCP client to query the LLM with our context file
        try:
            self.logger.info(f"ChatSupportService (task {task_id}): Querying MCP with customer input: '{input_text}'")
            
            # Prepare a prompt that includes the user's query with clear instructions
            user_prompt = f"A customer has reached out with the following SPECIFIC issue: '{input_text}'\n\nYou MUST directly address what they've actually said, not what you think they might be asking about. For example, if they say 'I hurt my hand opening your box', your response must acknowledge their injury and the box issue specifically, not give a generic greeting.\n\nNEVER respond with generic templates like 'I understand you'd like to speak with a support agent.' Always respond to the exact content of their message.\n\nYour first sentence must directly acknowledge the specific issue they mentioned."
            
            # Query the MCP with the chat support agent context
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=AGENT_ID,
                user_query=user_prompt,
                session_id=session_id
            )
            
            self.logger.info(f"ChatSupportService (task {task_id}): Received response from MCP: '{response_text[:100]}...'")
            
            # If we didn't get a response, fall back to a default
            if not response_text or len(response_text.strip()) == 0:
                self.logger.warning(f"ChatSupportService (task {task_id}): Empty response from MCP, using fallback")
                response_text = f"I understand your concern about '{input_text}'. Could you provide a bit more detail so I can better assist you?"
                
        except (MCPError, MCPConnectionError, MCPTimeoutError) as e:
            self.logger.error(f"ChatSupportService (task {task_id}): Error querying MCP: {str(e)}")
            response_text = f"I'd like to help you with your question about '{input_text}', but I'm experiencing a technical issue. Could you please try again in a moment?"

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# print(f"[chat_support_agent/main.py] Loaded. ChatSupportService defined.") 