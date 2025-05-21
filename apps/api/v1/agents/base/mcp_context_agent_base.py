from abc import abstractmethod
from datetime import datetime, timezone
from typing import Optional
import logging
from pathlib import Path

import httpx
# from fastapi import Depends # Not strictly needed by the base class itself for now

from apps.api.v1.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.v1.a2a_protocol.task_store import TaskStoreService
from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    Message,
    TextPart
)
from apps.api.v1.shared.mcp.mcp_client import MCPClient, MCPError, MCPConnectionError, MCPTimeoutError

class MCPContextAgentBaseService(A2AAgentBaseService):
    """
    Base service for A2A compliant agents that:
    1. Load contextual information from a markdown file.
    2. Prepend this context to a user query.
    3. Query a target agent on an MCP (Multi-Agent Communication Platform).
    4. Handle common MCP errors.
    """
    # These should be defined by subclasses as class attributes
    mcp_target_agent_id: Optional[str] = None 
    context_file_name: Optional[str] = None

    def __init__(
        self,
        task_store: TaskStoreService,
        http_client: httpx.AsyncClient,
        agent_name: Optional[str] = None, 
        department_name: Optional[str] = None, 
        mcp_client: Optional[MCPClient] = None, 
        **kwargs
    ):
        # Resolve agent_name: Use parameter if provided, else subclass's class attribute, else A2AAgentBaseService default.
        resolved_agent_name = agent_name
        if resolved_agent_name is None and hasattr(self.__class__, 'agent_name'):
            resolved_agent_name = getattr(self.__class__, 'agent_name')

        # Resolve department_name: Use parameter if provided, else subclass's class attribute.
        resolved_department_name = department_name
        if resolved_department_name is None and hasattr(self.__class__, 'department_name'):
            resolved_department_name = getattr(self.__class__, 'department_name')

        super().__init__(
            task_store=task_store,
            http_client=http_client,
            agent_name=resolved_agent_name, 
            department_name=resolved_department_name,
            **kwargs
        )
        
        self.mcp_client = mcp_client if mcp_client is not None else MCPClient()
        
        # For logging, use the resolved name (which might now be from class attr) or class name as fallback.
        # self.agent_name on the instance is now set by A2AAgentBaseService correctly.
        self.specific_agent_name = self.agent_name or self.__class__.__name__
        self.logger = logging.getLogger(self.specific_agent_name) 

        if not self.logger.handlers:
            # This base class assumes logging is configured at the application level.
            # If no handlers are found, INFO logs might not be visible.
            # Consider adding a default NullHandler if this class shouldn't configure logging:
            # self.logger.addHandler(logging.NullHandler())
            pass 
            
        self.logger.info(f"{self.specific_agent_name} ({self.__class__.__name__}) initialized using MCPContextAgentBaseService.")
        # Access mcp_target_agent_id and context_file_name via self, expecting them to be class attributes on the subclass.
        self.logger.info(f"Target MCP Agent ID for {self.specific_agent_name}: {self.mcp_target_agent_id}")
        self.logger.info(f"Context file for {self.specific_agent_name}: {self.context_file_name}")
        
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

    async def process_message(self, message: Message, task_id: str, session_id: Optional[str] = None) -> Message:
        """
        Processes an incoming message by:
        1. Relaying the user's query directly to the configured MCP target agent.
           The MCP target agent (via llm_mcp.py) is responsible for loading its own context based on the agent_id.
        2. Handling MCP communication errors.
        """
        self.logger.info(f"(Task {task_id}, Session {session_id}): Processing message. Content starts with: '{message.parts[0].root.text[:50] if message.parts and isinstance(message.parts[0].root, TextPart) else '[Non-text part or empty]'}'")
        self.logger.info(f"(Task {task_id}): Agent name: {self.specific_agent_name}, Target MCP agent ID: {self.mcp_target_agent_id}")

        user_query = ""
        if message.parts and isinstance(message.parts[0].root, TextPart):
            user_query = message.parts[0].root.text
            self.logger.info(f"(Task {task_id}): Full user query: '{user_query}'")
        
        if not user_query.strip(): # Handle empty or whitespace-only queries
            self.logger.warning(f"(Task {task_id}): Received message with empty or no usable text query part.")
            return Message(role="agent", parts=[TextPart(text="No valid query provided.")], timestamp=datetime.now(timezone.utc).isoformat())

        # MODIFICATION: Do not load context here. Pass user_query directly.
        # The mcp_target_agent_id should now be the logical name of this agent (e.g., "blog_post"),
        # which llm_mcp.py will use to load markdown_context/blog_post_agent.md.
        # loaded_context_str = self.load_context() # REMOVED
        # query_for_mcp = f"{loaded_context_str}\n\nUser Query: {user_query}" # REMOVED
        query_for_mcp = user_query # MODIFIED: Use original user query
        
        # Ensure mcp_target_agent_id is set, expecting it from subclass or constructor
        if not self.mcp_target_agent_id:
            self.logger.error(f"(Task {task_id}): mcp_target_agent_id is not set for {self.specific_agent_name}. Cannot query MCP.")
            # Let this propagate as an error, A2AAgentBaseService will handle it by failing the task.
            raise ValueError(f"mcp_target_agent_id not configured for agent {self.specific_agent_name}")

        self.logger.info(f"(Task {task_id}): Sending query to MCPClient for target agent '{self.mcp_target_agent_id}': '{query_for_mcp[:200]}...'")
        self.logger.info(f"(Task {task_id}): MCPClient instance: {id(self.mcp_client)}")
        response_text = ""

        try:
            self.logger.info(f"(Task {task_id}): About to call MCPClient.query_agent_aggregate with agent_id={self.mcp_target_agent_id}")
            response_text = await self.mcp_client.query_agent_aggregate(
                agent_id=self.mcp_target_agent_id, # This ID is used by llm_mcp.py to load the correct context file.
                user_query=query_for_mcp,
                session_id=session_id
            )
            self.logger.info(f"(Task {task_id}): Received aggregated response from MCPClient for target agent '{self.mcp_target_agent_id}'.")
            self.logger.info(f"(Task {task_id}): Response text (first 200 chars): '{response_text[:200]}...'")
            
            # Check if we got the 'no specific content' message
            if response_text == "MCP returned no specific content.":
                self.logger.warning(f"(Task {task_id}): MCP returned no specific content for agent '{self.mcp_target_agent_id}' and query '{query_for_mcp[:50]}...'")
        except Exception as e_generic: # Catch-all for other unexpected errors *during* the MCP call itself
            self.logger.exception(f"(Task {task_id}): Unexpected error during MCPClient call for target agent '{self.mcp_target_agent_id}': {str(e_generic)}")
            # This error here means the MCP call itself failed unexpectedly, not that MCP returned an error.
            # Let this propagate too, as A2AAgentBaseService will handle it.
            raise # Re-raise the unexpected error to be handled by A2AAgentBaseService

        self.logger.info(f"(Task {task_id}): Returning Message with response_text of length {len(response_text)}")
        return Message(
            role="agent",
            parts=[TextPart(text=response_text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def _format_mcp_error_for_user(self, e: MCPError) -> str:
        if isinstance(e, MCPConnectionError):
            return f"Connection Error: Could not connect to the target processing service. Details: {str(e)}"
        elif isinstance(e, MCPTimeoutError):
            return f"The request to the target processing service timed out. Details: {str(e)}"
        elif isinstance(e, MCPError):
            # hasattr check for status_code is good as it's optional in base MCPError
            error_code_str = f" ({e.status_code})" if hasattr(e, 'status_code') and e.status_code else ""
            return f"MCP Error{error_code_str}: An error occurred while communicating with the target processing service. Details: {str(e)}"
        return f"An unexpected error occurred with the target processing service: {str(e)}"

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
