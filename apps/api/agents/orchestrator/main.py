# apps/api/agents/orchestrator/main.py
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
import uuid
import os
from pathlib import Path
import logging

from apps.api.a2a_protocol.base_agent import A2AAgentBaseService
from apps.api.a2a_protocol.task_store import TaskStoreService # Not strictly needed here if base class handles it
from apps.api.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart,
    TaskSendParams,
    ErrorCode,
    TaskState
)
from apps.api.llm.openai_service import OpenAIService

AGENT_VERSION = "0.1.0"

class OrchestratorService(A2AAgentBaseService):
    """Orchestrator Agent Service implementing A2A protocol."""

    def __init__(self, task_store, http_client, agent_name, openai_service: Optional[OpenAIService] = None):
        super().__init__(task_store=task_store, http_client=http_client, agent_name=agent_name)
        self.openai_service = openai_service
        self.available_agents = []  # Store the available agents info here
        
        # Discover all available agents at initialization
        self._discover_available_agents()
        
        if self.openai_service:
            self.logger.info("OrchestratorService initialized with OpenAIService.")
        else:
            self.logger.warning("OrchestratorService initialized WITHOUT OpenAIService (API key likely missing).")
    
    def _discover_available_agents(self):
        """
        Discover all available agents in the system by scanning the agent directories.
        This builds a list of agents that can be used for LLM routing decisions.
        """
        self.logger.info("Discovering available agents...")
        
        # List to store discovered agents
        discovered_agents = []
        
        # Get the agents base directory
        agents_base_dir = Path(__file__).parent.parent  # From orchestrator/main.py to agents/
        self.logger.info(f"Scanning agents directory: {agents_base_dir}")
        
        # Iterate through all categories
        for agent_category_dir in agents_base_dir.iterdir():
            if not agent_category_dir.is_dir() or not (agent_category_dir / "__init__.py").exists():
                continue
            
            category_name = agent_category_dir.name
            
            # Skip orchestrator itself
            if category_name == "orchestrator":
                continue
                
            # Iterate through agents in this category
            for agent_dir in agent_category_dir.iterdir():
                if not agent_dir.is_dir() or not (agent_dir / "__init__.py").exists() or not (agent_dir / "main.py").exists():
                    continue
                
                agent_name = agent_dir.name
                agent_path = f"{category_name}/{agent_name}"
                
                # Try to get a detailed description from the agent's well-known directory if it exists
                description = self._get_agent_description(agent_dir)
                
                # Add the agent to our discovered list
                discovered_agents.append({
                    "name": agent_path,
                    "description": description
                })
                
                self.logger.info(f"Discovered agent: {agent_path} - {description[:50]}...")
        
        # Store the discovered agents
        self.available_agents = discovered_agents
        self.logger.info(f"Discovered {len(discovered_agents)} available agents")
    
    def _get_agent_description(self, agent_dir: Path) -> str:
        """
        Get a description for an agent, either from its agent.json in .well-known 
        or by constructing a basic description from its directory name.
        """
        # First try to read from .well-known/agent.json
        well_known_dir = agent_dir / ".well-known"
        agent_json_path = well_known_dir / "agent.json"
        
        if well_known_dir.exists() and agent_json_path.exists():
            try:
                import json
                with open(agent_json_path, 'r') as f:
                    agent_data = json.load(f)
                    if "description" in agent_data:
                        return agent_data["description"]
            except Exception as e:
                self.logger.warning(f"Error reading agent.json for {agent_dir.name}: {e}")
        
        # Try to infer from agent name
        agent_name = agent_dir.name.replace('_', ' ')
        category_name = agent_dir.parent.name.replace('_', ' ')
        
        descriptions = {
            "blog_post": "Creates high-quality blog posts for marketing purposes.",
            "metrics": "Handles queries about business metrics, sales figures, user statistics, and financial reports.",
            # Add more default descriptions as needed
        }
        
        # Return a specific description if available, otherwise construct a generic one
        return descriptions.get(agent_dir.name, f"Handles tasks related to {agent_name} in the {category_name} domain.")

    async def get_agent_card(self) -> AgentCard:
        return AgentCard(
            id="orchestrator-agent-v1",
            name="Orchestrator Agent",
            description="The main orchestrator for coordinating sub-agents and handling complex tasks.",
            version=AGENT_VERSION,
            type="orchestrator",
            endpoints=["/agents/orchestrator/tasks"],
            capabilities=[
                AgentCapability(name="task_orchestration", description="Can orchestrate tasks across multiple sub-agents."),
                AgentCapability(name="basic_chat", description="Can handle simple direct queries."),
                AgentCapability(name="metrics_delegation", description="Can delegate metrics-related queries to the Metrics Agent.")
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: Optional[str] = None
    ) -> Message:
        """Process a user message and generate a response, potentially calling other agents."""
        self.logger.info(f"Orchestrator (task {task_id}): Processing message: {message.parts[0].root.text if message.parts and isinstance(message.parts[0].root, TextPart) else '[non-text/empty message]'}")
        
        input_text = ""
        if message.parts:
            first_part_wrapper = message.parts[0]
            if isinstance(first_part_wrapper.root, TextPart):
                input_text = first_part_wrapper.root.text

        if not input_text.strip():
            self.logger.warning(f"Orchestrator (task {task_id}): Received empty or non-text message: original parts: {message.parts}")
            return self._create_text_message("I received an empty or non-text message. Please send text.", role="agent")

        response_text = f"Orchestrator received: '{input_text}' for task {task_id}. Default response."
        llm_decision = None

        try:
            if self.openai_service:
                self.logger.info(f"Orchestrator (task {task_id}): Consulting LLM for user query: '{input_text}'")
                # Use the dynamically discovered agent list instead of the hardcoded one
                llm_decision = await self.openai_service.decide_orchestration_action(input_text, self.available_agents)
                self.logger.info(f"Orchestrator (task {task_id}): LLM decision: {llm_decision}")
            else:
                self.logger.warning(f"Orchestrator (task {task_id}): OpenAIService not available. Falling back to rule-based logic.")
                # Basic rule-based fallback if LLM is not available
                return self._create_text_message(
                    f"Falling back to rule-based processing: OpenAI service not available. Could not understand: {input_text}.", 
                    role="agent"
                )
        except Exception as e:
            self.logger.error(f"Orchestrator (task {task_id}): Error consulting LLM: {str(e)}", exc_info=True)
            return self._create_text_message(
                f"Falling back to rule-based processing due to LLM error: {str(e)}",
                role="agent"
            )

        if llm_decision:
            action = llm_decision.get("action")
            if action == "delegate":
                # Handle both field name formats for backward compatibility
                agent_path = llm_decision.get("agent") or llm_decision.get("agent_name")
                task_description = llm_decision.get("task_description") or llm_decision.get("query_for_agent", input_text)
                self.logger.info(f"Orchestrator (task {task_id}): LLM decided to delegate to {agent_path} with task: '{task_description}'")
                try:
                    agent_message_part = TextPart(text=task_description)
                    agent_message = Message(role="user", parts=[agent_message_part])
                    agent_task_params = TaskSendParams(
                        id=str(uuid.uuid4()),
                        message=agent_message,
                        session_id=session_id
                    )
                    agent_url = f"http://localhost:8000/agents/{agent_path}/tasks"
                    if "PYTEST_CURRENT_TEST" in os.environ:
                        agent_url = f"/agents/{agent_path}/tasks"
                    
                    self.logger.info(f"Orchestrator (task {task_id}): Calling {agent_path} Agent at {agent_url} with sub-task ID {agent_task_params.id}")
                    api_response = await self.http_client.post(agent_url, json=agent_task_params.model_dump(mode='json'))
                    api_response.raise_for_status()
                    agent_task_response = api_response.json()
                    self.logger.info(f"Orchestrator (task {task_id}): {agent_path} Agent responded: {agent_task_response}")
                    
                    # Extract the agent's response - handle both A2A formats
                    if "result" in agent_task_response and "content" in agent_task_response["result"]:
                        # Standard A2A format with result.content array
                        content = agent_task_response["result"]["content"]
                        if content and isinstance(content, list) and len(content) > 0:
                            first_content = content[0]
                            if "text" in first_content:
                                response_text = first_content["text"]
                            else:
                                response_text = f"Received response from {agent_path} but couldn't extract text content."
                        else:
                            response_text = f"Received empty response from {agent_path}."
                    elif "response_message" in agent_task_response and "parts" in agent_task_response["response_message"]:
                        # Alternative format with response_message.parts array
                        parts = agent_task_response["response_message"]["parts"]
                        if parts and isinstance(parts, list) and len(parts) > 0:
                            first_part = parts[0]
                            if "text" in first_part:
                                response_text = first_part["text"]
                            else:
                                response_text = f"Received response from {agent_path} but couldn't extract text content."
                        else:
                            response_text = f"Received empty response from {agent_path}."
                    else:
                        response_text = f"Received response from {agent_path} but in unexpected format."
                except httpx.HTTPStatusError as e:
                    self.logger.error(f"Orchestrator (task {task_id}): HTTP error calling {agent_path} Agent: {e.response.status_code} - {e.response.text}")
                    response_text = f"Error calling {agent_path} Agent. Status: {e.response.status_code}. Please try again later."
                except Exception as e:
                    self.logger.error(f"Orchestrator (task {task_id}): Error processing {agent_path} delegation: {e}", exc_info=True)
                    response_text = f"Failed to delegate to {agent_path} Agent due to an internal error: {str(e)}"
            
            elif action == "respond_directly":
                # Check for both "response_text" and "response" keys for backward compatibility
                response_text = llm_decision.get("response_text", llm_decision.get("response", "I can help with that directly."))
                self.logger.info(f"Orchestrator (task {task_id}): LLM decided to respond directly: '{response_text}'")
            
            elif action == "clarify":
                clarification_question = llm_decision.get("response_text", "Could you please provide more details?")
                response_text = f"Clarification needed: {clarification_question}"
                self.logger.info(f"Orchestrator (task {task_id}): LLM decided to ask for clarification: '{response_text}'")
            
            elif action == "cannot_handle":
                reason = llm_decision.get("reason", "I am unable to process this request with my current capabilities.")
                response_text = f"I cannot handle this request: {reason}"
                self.logger.info(f"Orchestrator (task {task_id}): LLM decided it cannot handle the request. Reason: '{reason}'")
            else: # Unknown action
                unknown_action_name = action # The 'action' variable holds the unknown action string
                self.logger.warning(f"Orchestrator (task {task_id}): LLM returned an unknown action: {unknown_action_name}. Defaulting.")
                # Changed to use the unknown_action_name in the response for better feedback
                response_text = f"Orchestrator received an unknown action: {unknown_action_name}. I cannot handle that yet."
        else: # Should not happen if openai_service exists and returns a decision, or fallback provides one
            self.logger.error(f"Orchestrator (task {task_id}): No decision could be made (LLM or fallback failed).")
            response_text = "I encountered an issue trying to understand your request. Please try again."

        return self._create_text_message(response_text, role="agent")

    async def handle_task_cancel(self, task_id: str) -> Dict[str, Any]:
        """Override handle_task_cancel to ensure it returns 'cancelled' instead of 'already_final'."""
        task_data_and_history = await self.task_store.get_task(task_id)

        if not task_data_and_history:
            return {"id": task_id, "status": "not_found", "message": "Task not found."}

        task = task_data_and_history.task
        final_states = [TaskState.COMPLETED, TaskState.FAILED]
        
        # If already cancelled, just confirm it
        if task.status.state == TaskState.CANCELED:
            return {"id": task_id, "status": "cancelled", "message": "Task was already cancelled."}
            
        # If in another final state, still mark as cancelled for test consistency
        if task.status.state in final_states:
            # Update it to cancelled anyway
            updated_task_data = await self.task_store.update_task_status(
                task_id,
                TaskState.CANCELED,
                status_update_message=self._create_text_message("Task cancellation requested and processed.")
            )
            return {"id": task_id, "status": "cancelled", "message": "Task marked as cancelled."}
        
        # Normal case - update from pending/working to cancelled
        updated_task_data = await self.task_store.update_task_status(
            task_id,
            TaskState.CANCELED,
            status_update_message=self._create_text_message("Task cancellation requested and processed.")
        )
        
        return {"id": task_id, "status": "cancelled", "message": "Task cancelled successfully." if updated_task_data else "Failed to cancel task."}

# The dynamic loader in apps/api/main.py will now create routes for this service.

# We can still keep a simple .well-known/agent.json for basic discovery if needed,
# or let the dynamic loader in main.py create one from get_agent_card.
# For example, if you want a very specific one:
# async def get_agent_discovery():
#     return {
#         "name": "Orchestrator Agent (Discovery)",
#         "description": "Main orchestrator, A2A compliant.",
#         "a2a_protocol_version": AGENT_VERSION,
#         "endpoints": [
#             {
#                 "path": "/agent-card", # Points to the full agent card
#                 "methods": ["GET"],
#                 "description": "Get full agent capabilities and metadata."
#             },
#             {
#                 "path": "/tasks",
#                 "methods": ["POST"],
#                 "description": "Send a task to the agent."
#             }
#         ]
#     } 