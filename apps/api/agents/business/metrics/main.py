from datetime import datetime, timezone
from typing import Optional

from api.a2a_protocol.base_agent import A2AAgentBaseService
from api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)

AGENT_VERSION = "0.1.0"

class MetricsService(A2AAgentBaseService):
    """Metrics Agent Service implementing A2A protocol."""

    # __init__ is inherited from A2AAgentBaseService

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id="metrics-agent-v1",
            name="Metrics Agent",
            description="Provides business metrics and analytics.",
            version=AGENT_VERSION,
            type="specialized",
            endpoints=["/agents/business/metrics/tasks"],
            capabilities=[
                AgentCapability(name="get_metrics", description="Provides current business metrics."),
                AgentCapability(name="analyze_data", description="Can perform basic data analysis.")
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message for the Metrics agent."""
        # Extract text safely without directly accessing the text attribute
        input_text = "[empty message]"
        if message.parts:
            # Access the root value of the message part if it's a RootModel
            part = message.parts[0]
            # Handle possible RootModel wrapper
            if hasattr(part, "root"):
                part = part.root
                
            if hasattr(part, "text"):
                input_text = part.text
            # Also handle dictionary case
            elif isinstance(part, dict) and "text" in part:
                input_text = part["text"]
        
        self.logger.info(f"MetricsAgent (task {task_id}): Processing message: {input_text}")
        
        # In a real scenario, this agent would fetch/calculate actual metrics.
        # For now, just acknowledge the request.
        response_text = f"Metrics Agent received your query: '{input_text}'. Current sales: $1,234,567. Active users: 5,876."
        
        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# Old router definitions are removed. Dynamic loader in main.py handles routes. 