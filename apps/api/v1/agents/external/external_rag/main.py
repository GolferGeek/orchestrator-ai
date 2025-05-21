from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from typing import Optional
import httpx

from apps.api.v1.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.v1.a2a_protocol.task_store import TaskStoreService
from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart
)
from apps.api.v1.core.config import settings
from apps.api.v1.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError
from apps.api.v1.llm.openai_service import OpenAIService
from apps.api.v1.main import get_original_openai_service

router = APIRouter()

@router.get("/")
async def external_rag_root():
    return {"agent": "external_rag", "message": "External RAG agent is active"}

# Define constants
AGENT_VERSION = "0.1.0"
AGENT_ID = "external-rag-agent-v1"
AGENT_NAME = "External RAG Agent"
AGENT_DESCRIPTION = "Provides Retrieval Augmented Generation capabilities using external web sources for enhanced context and up-to-date information."

class ExternalRagService(A2AAgentBaseService):
    """External RAG Agent Service that uses web-based RAG for enhanced responses."""

    def __init__(self, task_store: TaskStoreService, http_client: httpx.AsyncClient, openai_service: OpenAIService = Depends(get_original_openai_service), *args, **kwargs):
        super().__init__(task_store=task_store, http_client=http_client, agent_name=AGENT_NAME)
        self.openai_service = openai_service
        self.mcp_client = MCPClient()
        self.agent_id_for_mcp = "external_rag_agent"  # Matches the markdown context file name

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id=AGENT_ID,
            name=AGENT_NAME,
            description=AGENT_DESCRIPTION,
            version=AGENT_VERSION,
            a2a_protocol_version="0.1.0",
            type="specialized",
            endpoints=[f"/agents/external/external_rag/tasks"],
            capabilities=[
                AgentCapability(
                    name="web_based_rag",
                    description="Performs RAG using web sources to provide context-aware responses."
                ),
                AgentCapability(
                    name="dynamic_knowledge_retrieval",
                    description="Dynamically retrieves and processes information from external web sources."
                ),
                AgentCapability(
                    name="source_citation",
                    description="Provides citations and references for information sourced from the web."
                )
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a message by performing web-based RAG via MCPClient."""
        
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

        self.logger.info(f"ExternalRagService (task {task_id}): Processing query via MCPClient: '{input_text}'")
        response_text = ""

        try:
            # Use MCPClient to get RAG-enhanced response
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=self.agent_id_for_mcp,
                user_query=input_text,
                session_id=session_id
            )
            self.logger.info(f"ExternalRagService (task {task_id}): Received aggregated response from MCPClient.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"ExternalRagService (task {task_id}): MCPClient Connection Error: {e_conn}")
            response_text = "Connection Error: Could not connect to the RAG processing service. Please try again later."
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"ExternalRagService (task {task_id}): MCPClient Read Timeout: {e_timeout}")
            response_text = "The request to the RAG processing service timed out. Please try again."
        except MCPError as e_mcp:
            self.logger.error(f"ExternalRagService (task {task_id}): MCPClient Error: {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error processing RAG request: {str(e_mcp)}"
        except Exception as e_generic:
            self.logger.error(f"ExternalRagService (task {task_id}): Unexpected error: {str(e_generic)}")
            response_text = "An unexpected error occurred while processing your request with RAG."

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# Let the agent loading system handle router registration
agent_service = ExternalRagService  # Renamed from ExternalRAGService