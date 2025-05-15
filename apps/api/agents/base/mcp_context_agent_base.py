from abc import abstractmethod
from datetime import datetime, timezone
from typing import Optional
import logging
from pathlib import Path

import httpx
# from fastapi import Depends # Not strictly needed by the base class itself for now

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService
from apps.api.a2a_protocol.types import (
    AgentCard,
    Message,
    TextPart
)
from apps.api.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

class MCPContextAgentBaseService(A2AAgentBaseService):
    """
    Base service for A2A compliant agents that:
    1. Load contextual information from a markdown file.
    2. Prepend this context to a user query.
    3. Query a target agent on an MCP (Multi-Agent Communication Platform).
    4. Handle common MCP errors.
    """

    def __init__(
        self,
        task_store: TaskStoreService,
        http_client: httpx.AsyncClient,
        agent_name: str, # Specific to the derived agent
        mcp_client: MCPClient,
        mcp_target_agent_id: str, # The ID of the agent on the MCP to query
        context_file_name: str   # Filename (e.g., "my_agent_context.md") in markdown_context/
    ):
        super().__init__(task_store=task_store, http_client=http_client, agent_name=agent_name)
        self.mcp_client = mcp_client
        self.mcp_target_agent_id = mcp_target_agent_id
        self.context_file_name = context_file_name
        
        self.logger = logging.getLogger(agent_name) 
        if not self.logger.handlers:
            # This base class assumes logging is configured at the application level.
            # If no handlers are found, INFO logs might not be visible.
            # Consider adding a default NullHandler if this class shouldn't configure logging:
            # self.logger.addHandler(logging.NullHandler())
            pass 
            
        self.logger.info(f"{agent_name} ({self.__class__.__name__}) initialized using MCPContextAgentBaseService.")
        
        # Determine project root from this file's location (base service)
        # apps/api/agents/base/mcp_context_agent_base.py
        # parents[0] = base
        # parents[1] = agents
        # parents[2] = api
        # parents[3] = apps
        # parents[4] = project_root
        self._project_root = Path(__file__).resolve().parents[4]

    @abstractmethod
    async def get_agent_card(self) -> AgentCard:
        """
        Subclasses must implement this to provide their specific agent card.
        It should use their unique AGENT_ID, AGENT_NAME, VERSION, DESCRIPTION, CAPABILITIES, etc.
        These are typically defined as constants in the subclass's module.
        """
        raise NotImplementedError("Subclasses must implement get_agent_card.")

    def load_context(self) -> str:
        """Loads contextual information from the agent-specific markdown file."""
        context_file_path = self._project_root / "markdown_context" / self.context_file_name
        try:
            return context_file_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            self.logger.error(f"Context file '{self.context_file_name}' not found at {context_file_path}. Using default fallback message.")
            return f"Context file '{self.context_file_name}' not available. This agent may not function as expected with full context."
        except Exception as e:
            self.logger.exception(f"Error loading context from '{self.context_file_name}' at {context_file_path}: {e}. Using default fallback message.")
            return f"Error loading context from '{self.context_file_name}'. This agent may not function as expected with full context."

    async def process_message(self, message: Message, task_id: str, session_id: Optional[str] = None) -> Message:
        """
        Processes an incoming message by:
        1. Loading agent-specific context.
        2. Prepending context to the user's query.
        3. Relaying the combined query to the configured MCP target agent.
        4. Handling MCP communication errors.
        """
        self.logger.info(f"(Task {task_id}, Session {session_id}): Processing message. Content starts with: '{message.parts[0].root.text[:50] if message.parts and isinstance(message.parts[0].root, TextPart) else '[Non-text part or empty]'}'")

        user_query = ""
        if message.parts and isinstance(message.parts[0].root, TextPart):
            user_query = message.parts[0].root.text
        
        if not user_query.strip(): # Handle empty or whitespace-only queries
            self.logger.warning(f"(Task {task_id}): Received message with empty or no usable text query part.")
            return Message(role="agent", parts=[TextPart(text="No valid query provided.")], timestamp=datetime.now(timezone.utc).isoformat())

        loaded_context_str = self.load_context()
        query_for_mcp = f"{loaded_context_str}\n\nUser Query: {user_query}"
        
        self.logger.info(f"(Task {task_id}): Relaying query to MCPClient targeting agent '{self.mcp_target_agent_id}'. Query (first 100 chars): '{query_for_mcp[:100].replace('\n', ' ')}...'")
        response_text = ""

        try:
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=self.mcp_target_agent_id,
                user_query=query_for_mcp,
                session_id=session_id
            )
            self.logger.info(f"(Task {task_id}): Received aggregated response from MCPClient for target agent '{self.mcp_target_agent_id}'.")
        except MCPConnectionError as e_conn:
            self.logger.error(f"(Task {task_id}): MCPClient Connection Error for target agent '{self.mcp_target_agent_id}': {e_conn}")
            response_text = f"Connection Error: Could not connect to the target processing service. Details: {e_conn}"
        except MCPTimeoutError as e_timeout:
            self.logger.error(f"(Task {task_id}): MCPClient Read Timeout for target agent '{self.mcp_target_agent_id}': {e_timeout}")
            response_text = f"The request to the target processing service timed out. Details: {e_timeout}"
        except MCPError as e_mcp:
            self.logger.error(f"(Task {task_id}): MCPClient Error for target agent '{self.mcp_target_agent_id}': {e_mcp} (Status: {e_mcp.status_code if hasattr(e_mcp, 'status_code') else 'N/A'})")
            response_text = f"Error from target processing service: {str(e_mcp)}"
        except Exception as e_generic: # Catch-all for other unexpected errors during MCP call
            self.logger.exception(f"(Task {task_id}): Unexpected error using MCPClient for target agent '{self.mcp_target_agent_id}': {str(e_generic)}")
            response_text = f"An unexpected error occurred while trying to reach the target processing service. Details: {e_generic}"

        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# Example of how a subclass might use this:
#
# from .mcp_context_agent_base import MCPContextAgentBaseService
# from apps.api.a2a_protocol.types import AgentCard, AgentCapability
#
# AGENT_ID = "my-specific-agent-v1"
# AGENT_NAME = "My Specific Agent"
# AGENT_VERSION = "0.1.0"
# AGENT_DESCRIPTION = "Description of my specific agent."
# MY_CONTEXT_FILE = "my_specific_agent_context.md"
# MY_MCP_TARGET_ID = "knowledge_base_for_my_domain"
#
# class MySpecificAgentService(MCPContextAgentBaseService):
#     def __init__(self, task_store: TaskStoreService, http_client: httpx.AsyncClient, mcp_client: MCPClient):
#         super().__init__(
#             task_store=task_store,
#             http_client=http_client,
#             agent_name=AGENT_NAME, # Use the constant
#             mcp_client=mcp_client,
#             mcp_target_agent_id=MY_MCP_TARGET_ID,
#             context_file_name=MY_CONTEXT_FILE
#         )
#
#     async def get_agent_card(self) -> AgentCard:
#         return AgentCard(
#             id=AGENT_ID,
#             name=AGENT_NAME,
#             version=AGENT_VERSION,
#             description=AGENT_DESCRIPTION,
#             a2a_protocol_version="0.1.0",
#             type="specialized",
#             capabilities=[
#                 AgentCapability(
#                     name="query_my_domain_via_mcp",
#                     description="Answers my domain questions by relaying them to an MCP, using specific context."
#                 )
#             ],
#             endpoints=[f"/agents/my_agents_prefix/tasks"] # Endpoint would be defined in its own main.py
#         )
#
