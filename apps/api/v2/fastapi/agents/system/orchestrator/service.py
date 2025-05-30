from ....a2a_protocol.unified_agent_service import A2AUnifiedAgentService
from ....a2a_protocol.task_store import TaskStoreService
from ....a2a_protocol.supabase_chat_history import SupabaseChatMessageHistory
from ....llm.openai_service import OpenAIService

# Shared Contract Types
from apps.api.v2.shared.generated.python.a2a_protocol import Message, TextPart
from apps.api.v2.shared.generated.python.agent_types import AgentCard, AgentCapability

from langchain_core.messages import HumanMessage, AIMessage
from supabase import Client as SupabaseClient
from typing import Optional, List, Dict, Any
import logging
import uuid
import httpx

# Assuming OpenAIService and TaskStoreService will be injected via __init__ or accessible
# from apps.api.v2.fastapi.llm.openai_service import OpenAIService
# from apps.api.v2.fastapi.a2a_protocol.task_store import TaskStoreService
# import httpx

class OrchestratorAgentService(A2AUnifiedAgentService):
    """
    The Orchestrator Agent, responsible for understanding user requests,
    coordinating with other specialized agents, and providing responses.
    It uses an LLM to decide on the best course of action for a given task.
    """

    # --- A2AUnifiedAgentService Class Attributes ---
    agent_id: str = "550e8400-e29b-12d3-a456-426655440000"  # Valid UUID for the orchestrator
    agent_name: str = "orchestrator"  # Short, unique name
    display_name: str = "Orchestrator Agent"  # Explicitly set for clarity
    agent_description: str = "Manages user conversations and delegates tasks to specialized agents."
    agent_version: str = "1.1.0"  # Increment version as appropriate
    department_name: str = "system"  # Logical grouping for the agent
    
    primary_capability_name: str = "task_orchestration"
    primary_capability_description: str = (
        "Understands user requests, delegates to appropriate agents, "
        "or responds directly if applicable."
    )
    
    # Orchestrator might not be sticky itself by default, but it manages stickiness for others.
    # If we want the orchestrator to "remember" a user for a short period, this could be True.
    is_sticky: bool = False 
    sticky_duration: int = 30 # Default, but not active if is_sticky is False

    # --- Orchestrator-Specific Attributes (if any) ---
    # e.g., default LLM model, specific prompts, etc. can be defined here or in config

    # __init__ will be inherited from A2AUnifiedAgentService
    # It expects task_store, http_client, and optionally other services like OpenAIService

    def __init__(self, 
                 task_store: TaskStoreService, 
                 http_client: httpx.AsyncClient, 
                 openai_service: OpenAIService,
                 supabase_client: Optional[SupabaseClient] = None,
                 **kwargs: Any):
        
        super().__init__(
            task_store=task_store, 
            http_client=http_client,
            agent_name=kwargs.pop('agent_name', self.agent_name),
            department_name=kwargs.pop('department_name', self.department_name),
            **kwargs
        )
        
        self.openai_service = openai_service
        self.supabase_client = supabase_client

        if self.openai_service:
            self.logger.info("OrchestratorAgentService initialized with OpenAIService.")
        else:
            self.logger.critical("OrchestratorAgentService initialized WITHOUT OpenAIService. This is a critical failure.")
        
        if self.supabase_client:
            self.logger.info("OrchestratorAgentService initialized with SupabaseClient for chat history.")
        else:
            self.logger.warning("OrchestratorAgentService initialized WITHOUT SupabaseClient. Chat history features will be impaired for LLM context.")

    async def get_agent_card(self) -> AgentCard:
        """
        Get the agent card with capabilities and metadata for the Orchestrator.
        """
        # Define the base path for this agent's endpoints
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        # Create full URL for endpoints (required by AgentCard validation)
        base_url = "http://localhost:8001"  # This should come from config in production
        
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="orchestrator",  # Use valid enum value
            # Use full URLs instead of relative paths
            endpoints=[f"{base_url}{base_agent_path}/tasks"],
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name,
                    description=self.primary_capability_description
                ),
                AgentCapability(
                    name="natural_language_understanding",
                    description="Processes and understands user queries in natural language."
                ),
                AgentCapability(
                    name="session_management",
                    description="Maintains conversation context and session continuity."
                ),
                AgentCapability(
                    name="agent_delegation", 
                    description="Delegates tasks to other specialized agents based on their capabilities."
                )
            ]
        )

    async def execute_agent_task(
        self, 
        message: Message, 
        task_id: str, 
        session_id: Optional[str] = None
    ) -> str:
        """
        Core logic for the Orchestrator agent.
        Uses the discovered metrics agent for delegation.
        """
        self.logger.info(f"Orchestrator ({self.agent_name}) executing task '{task_id}' for session '{session_id}'.")
        
        # Extract user query from the current message
        user_query = ""
        if message.parts:
            first_part_model = message.parts[0]
            if isinstance(first_part_model.root, TextPart):
                user_query = first_part_model.root.text
        
        if not user_query.strip():
            self.logger.warning(f"Task {task_id}: Could not extract text from incoming message parts for user_query or query is empty.")
            return "I could not understand your message as it did not contain readable text or was empty."

        self.logger.info(f"Orchestrator processing query: '{user_query[:100]}...'")

        # Ensure agents are discovered
        await self.ensure_agents_discovered()

        # Find the metrics agent in discovered agents by its path
        metrics_agent = next((agent for agent in self.available_agents if agent.get("path") == "business/metrics"), None)
        if not metrics_agent:
            error_msg = "Could not find the metrics agent (path: business/metrics) in discovered agents."
            self.logger.error(error_msg)
            return error_msg

        try:
            # Use the agent's path for delegation, which includes department/name
            response_text = await self.delegate_to_agent(
                agent_path=metrics_agent["path"],
                task_description=user_query,
                task_id=task_id,
                session_id=session_id
            )
            return response_text
        except Exception as e:
            error_msg = f"Error delegating to metrics agent: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            return f"I encountered an error while processing your request: {str(e)}"

    def get_capabilities(self) -> List[AgentCapability]:
        """
        Return the list of capabilities for this agent.
        Required implementation of abstract method from A2AUnifiedAgentService.
        """
        return [
            AgentCapability(
                name=self.primary_capability_name,
                description=self.primary_capability_description
            ),
            AgentCapability(
                name="natural_language_understanding",
                description="Processes and understands user queries in natural language."
            ),
            AgentCapability(
                name="session_management",
                description="Maintains conversation context and session continuity."
            ),
            AgentCapability(
                name="agent_delegation", 
                description="Delegates tasks to other specialized agents based on their capabilities."
            )
        ]

    async def process_message(self, message: Message, task_id: str, session_id: Optional[str] = None) -> Message:
        """
        Main processing method that handles incoming messages.
        Required implementation of abstract method from A2AUnifiedAgentService.
        """
        try:
            # Check for session stickiness first
            sticky_info = self._is_session_sticky(session_id) if session_id else None
            if sticky_info:
                sticky_agent_path = sticky_info.get("agent_path")
                self.logger.info(f"Session {session_id} is sticky to {sticky_agent_path}. Delegating directly.")
                try:
                    # Extract user query for delegation
                    user_query = ""
                    if message.parts:
                        first_part_model = message.parts[0]
                        if isinstance(first_part_model.root, TextPart):
                            user_query = first_part_model.root.text
                    
                    if user_query.strip():
                        response_text = await self.delegate_to_agent(
                            agent_path=sticky_agent_path,
                            task_description=user_query,
                            task_id=task_id,
                            session_id=session_id
                        )
                        return self._create_text_message(response_text)
                except Exception as e:
                    self.logger.warning(f"Sticky delegation to {sticky_agent_path} failed: {e}. Falling back to normal processing.")
                    self._clear_session_sticky(session_id)

            # Normal processing: execute the agent task
            response_text = await self.execute_agent_task(message, task_id, session_id)
            return self._create_text_message(response_text)
            
        except Exception as e:
            self.logger.error(f"Error processing message for task {task_id}: {e}", exc_info=True)
            error_message = f"I encountered an error while processing your request: {str(e)}"
            return self._create_text_message(error_message)

    # Additional orchestrator-specific methods can be added here
    # For example, methods related to managing how OpenAIService is accessed or configured for this agent. 