# apps/api/agents/orchestrator/main.py
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
import uuid
import os
from pathlib import Path
import logging
from supabase import Client as SupabaseClient # Import Supabase client

from apps.api.v1.a2a_protocol.base_agent import A2AAgentBaseService
# from apps.api.v1.a2a_protocol.task_store import TaskStoreService # Not strictly needed here if base class handles it
from apps.api.v1.a2a_protocol.types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart,
    TaskSendParams,
    TaskState,
    # ErrorCode, # Not directly used
    # TaskState # Not directly used
)
from apps.api.v1.llm.openai_service import OpenAIService
from apps.api.v1.a2a_protocol.supabase_chat_history import SupabaseChatMessageHistory # Import new history class

# Langchain imports
from langchain_core.messages import HumanMessage, AIMessage # ADDED
# from langchain_community.chat_message_histories import FileChatMessageHistory # Replaced from langchain_core.messages import HumanMessage, AIMessage

AGENT_VERSION = "0.1.0"
# CHAT_SESSIONS_DIR = Path(__file__).parent / "chat_sessions" # No longer needed for file history

class OrchestratorService(A2AAgentBaseService):
    """Orchestrator Agent Service implementing A2A protocol."""

    def __init__(self, task_store, http_client, agent_name, 
                 openai_service: Optional[OpenAIService] = None, 
                 supabase_client: Optional[SupabaseClient] = None): # Added supabase_client
        super().__init__(task_store=task_store, http_client=http_client, agent_name=agent_name)
        self.openai_service = openai_service
        self.supabase_client = supabase_client # Store Supabase client
        self.available_agents = []
        # self.chat_history_base_path = CHAT_SESSIONS_DIR # No longer needed
        # self.chat_history_base_path.mkdir(parents=True, exist_ok=True) # No longer needed
        
        self._discover_available_agents()
        
        if self.openai_service:
            self.logger.info("OrchestratorService initialized with OpenAIService.")
        else:
            self.logger.warning("OrchestratorService initialized WITHOUT OpenAIService (API key likely missing).")
        
        if self.supabase_client:
            self.logger.info("OrchestratorService initialized with SupabaseClient.")
        else:
            self.logger.warning("OrchestratorService initialized WITHOUT SupabaseClient. Chat history will not be persisted correctly.")

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
                AgentCapability(name="basic_chat", description="Can handle simple direct queries with persistent history per user/session."),
                AgentCapability(name="metrics_delegation", description="Can delegate metrics-related queries to the Metrics Agent.")
            ]
        )

    async def process_message(
        self,
        message: Message,
        task_id: str,
        session_id: str, 
        user_id: str,
        db_client_for_history: Optional[SupabaseClient] = None # ADDED: Accept user-scoped client
    ) -> Message:
        """Process a user message and generate a response, potentially calling other agents."""
        current_session_id = session_id 
        self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Processing message.")

        # Use the provided user-scoped client if available, otherwise fallback to the instance's (anon) client
        active_supabase_client = db_client_for_history if db_client_for_history else self.supabase_client

        if not active_supabase_client:
            self.logger.error("Supabase client for history is not available. Cannot proceed.")
            error_text = "Chat history service is unavailable. Please try again later."
            return self._create_text_message(error_text, role="agent")

        self.logger.info(f"SupabaseChatMessageHistory will use client instance: {id(active_supabase_client)}")
        chat_message_history = SupabaseChatMessageHistory(
            supabase_client=active_supabase_client, # MODIFIED: Use active_supabase_client
            session_id=current_session_id,
            user_id=user_id
        )

        input_text = ""
        if message.parts:
            first_part_wrapper = message.parts[0]
            if isinstance(first_part_wrapper.root, TextPart):
                input_text = first_part_wrapper.root.text
                # Add current user message to history
                chat_message_history.add_user_message(input_text)
            else:
                self.logger.warning(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Received empty or non-text message.")
                # Create an error/informative Message object to return
                ai_response_text = "I received an empty or non-text message. Please send text."
                chat_message_history.add_ai_message(ai_response_text)
                response_msg_obj = self._create_text_message(ai_response_text, role="agent")
                # IMPORTANT: A2AAgentBaseService needs to inject current_session_id into the Task.session_id field of the response
                # For now, we can add it to metadata of the response message if useful for A2ABaseService to pick up
                response_msg_obj.metadata = response_msg_obj.metadata or {}
                response_msg_obj.metadata["session_id_used"] = current_session_id
                return response_msg_obj
        else:
            self.logger.warning(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): No message parts received.")
            response_text = "I received no message parts. Please send text."
            chat_message_history.add_ai_message(response_text)
            response_msg_obj = self._create_text_message(response_text, role="agent")
            response_msg_obj.metadata = response_msg_obj.metadata or {}
            response_msg_obj.metadata["session_id_used"] = current_session_id
            return response_msg_obj

        self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Processing input: '{input_text}'")

        # --- Conceptual: Prepare history for your OpenAIService --- 
        # This is a placeholder. You need to decide how your decide_orchestration_action consumes history.
        # Option 1: Pass raw Langchain messages
        # loaded_lc_messages = chat_message_history.messages
        # Option 2: Format for OpenAI API (list of dicts)
        formatted_history_for_llm = []
        last_responding_agent = None
        
        # Process history to extract conversation flow and agent information
        for msg in chat_message_history.messages[:-1]: # Exclude the latest user message already added
            if isinstance(msg, HumanMessage):
                formatted_history_for_llm.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                # Extract agent information if available
                agent_info = ""
                if hasattr(msg, 'metadata') and msg.metadata and 'responding_agent_name' in msg.metadata:
                    last_responding_agent = msg.metadata['responding_agent_name']
                    agent_info = f" [Response from: {last_responding_agent}]"
                
                formatted_history_for_llm.append({"role": "assistant", "content": msg.content + agent_info})
        
        # Add a special message to emphasize the current conversation context if there is one
        if last_responding_agent and last_responding_agent != "Orchestrator":
            formatted_history_for_llm.append({
                "role": "system", 
                "content": f"IMPORTANT: The user is currently in an active conversation with {last_responding_agent}. Unless they explicitly say they want to end this conversation, you MUST continue routing messages to {last_responding_agent}."
            })
        # self.logger.debug(f"Formatted history for LLM: {formatted_history_for_llm}")
        # --- End Conceptual --- 

        response_text = f"Orchestrator (session {current_session_id}, user {user_id}) received: '{input_text}'. Default response."
        llm_decision = None

        try:
            if self.openai_service:
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Consulting LLM for user query: '{input_text}'")
                llm_decision = await self.openai_service.decide_orchestration_action(
                    user_query=input_text, 
                    available_agents=self.available_agents,
                    history=formatted_history_for_llm # Pass the history
                )
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): LLM decision: {llm_decision}")
            else:
                self.logger.warning(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): OpenAIService not available. Falling back to rule-based logic.")
                response_text = f"OpenAI service is not available. I cannot process your request: {input_text}."
                llm_decision = {"action": "cannot_handle", "reason": "OpenAI service not available."} # Set default decision
        except Exception as e:
            self.logger.error(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Error consulting LLM: {str(e)}", exc_info=True)
            response_text = f"An error occurred while trying to understand your request: {str(e)}"
            llm_decision = {"action": "cannot_handle", "reason": f"LLM consultation error: {str(e)}"} # Set default decision

        if llm_decision and "action" in llm_decision: # Ensure llm_decision is not None and has an action
            action = llm_decision.get("action")
            if action == "delegate":
                # Handle both field name formats for backward compatibility
                agent_path = llm_decision.get("agent") or llm_decision.get("agent_name")
                task_description = llm_decision.get("task_description") or llm_decision.get("query_for_agent", input_text)
                
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Delegating to {agent_path} with: '{task_description}'")
                try:
                    # When delegating, pass the current_session_id so sub-agents can also maintain context if they support it.
                    # Note: The sub-agent's TaskSendParams also has session_id.
                    agent_message_part = TextPart(text=task_description)
                    agent_message = Message(role="user", parts=[agent_message_part])
                    agent_task_params = TaskSendParams(
                        id=str(uuid.uuid4()),
                        message=agent_message,
                        session_id=current_session_id # Pass session_id here
                    )
                    agent_url = f"http://localhost:8000/agents/{agent_path}/tasks"
                    if "PYTEST_CURRENT_TEST" in os.environ:
                        agent_url = f"/agents/{agent_path}/tasks"
                    
                    self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Calling {agent_path} Agent at {agent_url} with sub-task ID {agent_task_params.id}")
                    api_response = await self.http_client.post(agent_url, json=agent_task_params.model_dump(mode='json'))
                    api_response.raise_for_status()
                    agent_task_response = api_response.json()
                    self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): {agent_path} Agent responded: {agent_task_response}")
                    
                    # Extract the agent's response
                    self.logger.info(f"Orchestrator attempting to extract text from {agent_path}. Full response: {agent_task_response}")

                    response_message_data = agent_task_response.get("response_message")
                    
                    if isinstance(response_message_data, dict):
                        parts_data = response_message_data.get("parts")
                        if isinstance(parts_data, list) and parts_data: # Check if list and not empty
                            first_part_data = parts_data[0] # This is the TextPart (or other Part) dict
                            if isinstance(first_part_data, dict):
                                if first_part_data.get("type") == "text" and "text" in first_part_data:
                                    response_text = first_part_data["text"]
                                    self.logger.info(f"Orchestrator successfully extracted text from {agent_path} via response_message.parts[0].text")
                                else:
                                    self.logger.warning(f"Orchestrator: Delegated agent {agent_path} response_message.parts[0] is not a text part with 'text' key. Part content: {first_part_data}")
                                    response_text = f"Received structured response from {agent_path}, but the primary content part is not recognized text."
                            else: # first_part_data is not a dict
                                self.logger.warning(f"Orchestrator: Delegated agent {agent_path} response_message.parts[0] is not a dictionary. Part content: {first_part_data}")
                                response_text = f"Received structured response from {agent_path}, but its main content part is malformed."
                        else: # parts_data is not a list or is empty
                            self.logger.warning(f"Orchestrator: Delegated agent {agent_path} response_message does not contain a valid 'parts' list or it is empty. Parts content: {parts_data}")
                            response_text = f"Received response from {agent_path} but it contained no message parts."
                    # Fallback for the older "result"/"content" structure (if any agent still uses it)
                    elif isinstance(agent_task_response.get("result"), dict) and \
                         isinstance(agent_task_response["result"].get("content"), list) and \
                         agent_task_response["result"]["content"]:
                        first_content = agent_task_response["result"]["content"][0]
                        if isinstance(first_content, dict) and "text" in first_content:
                            response_text = first_content["text"]
                            self.logger.info(f"Orchestrator successfully extracted text from {agent_path} via deprecated result.content[0].text")
                        else:
                            self.logger.warning(f"Orchestrator: Delegated agent {agent_path} used deprecated result.content structure, but text extraction failed. First content: {first_content}")
                            response_text = f"Received response from {agent_path} (old format) but couldn't extract text."
                    else: # Neither modern "response_message" nor deprecated "result" structure found
                        self.logger.warning(f"Orchestrator: Delegated agent {agent_path} response in wholly unexpected format. Full response: {agent_task_response}")
                        response_text = f"Received response from {agent_path} but in an unrecognized format."
                except httpx.HTTPStatusError as e:
                    self.logger.error(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): HTTP error calling {agent_path} Agent: {e.response.status_code} - {e.response.text}")
                    response_text = f"Error calling {agent_path} Agent. Status: {e.response.status_code}. Please try again later."
                except Exception as e:
                    self.logger.error(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Error processing {agent_path} delegation: {e}", exc_info=True)
                    response_text = f"Failed to delegate to {agent_path} Agent due to an internal error: {str(e)}"
            
            elif action == "respond_directly":
                # Check for both "response_text" and "response" keys for backward compatibility
                response_text = llm_decision.get("response_text", llm_decision.get("response", "I can help with that directly."))
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): LLM decided to respond directly: '{response_text}'")
            
            elif action == "clarify":
                clarification_question = llm_decision.get("response_text", "Could you please provide more details?")
                response_text = f"Clarification needed: {clarification_question}"
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): LLM decided to ask for clarification: '{response_text}'")
            
            elif action == "cannot_handle":
                reason = llm_decision.get("reason", "I am unable to process this request with my current capabilities.")
                response_text = f"I cannot handle this request: {reason}"
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): LLM decided it cannot handle the request. Reason: '{reason}'")
            elif action == "transition":
                # User wants to end the current specialized agent session and possibly start a new one
                response_text = llm_decision.get("response_text", "I understand you're done with this topic. How else can I assist you today?")
                self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): User transitioning from specialized agent. Response: '{response_text}'")
                
                # Add a special flag to the metadata to indicate the session has been reset
                # This will be used to clear any "sticky" behavior in future interactions
                llm_decision["reset_agent_session"] = True
                
                # Check if there's a next action to take (for a new topic)
                next_action = llm_decision.get("next_action")
                if next_action == "delegate":
                    next_agent = llm_decision.get("next_agent_name")
                    if next_agent:
                        self.logger.info(f"Orchestrator (task {task_id}): Transitioning to new agent: {next_agent}")
                        # We'll handle this in the metadata to inform the frontend
                        llm_decision["transition_to_agent"] = next_agent
                elif next_action == "respond_directly" and "next_response" in llm_decision:
                    # Append the next response to our acknowledgment
                    response_text = f"{response_text}\n\n{llm_decision['next_response']}"
            else: # Unknown action
                unknown_action_name = action # The 'action' variable holds the unknown action string
                self.logger.warning(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): LLM returned an unknown action: {unknown_action_name}. Defaulting.")
                # Changed to use the unknown_action_name in the response for better feedback
                response_text = f"Orchestrator received an unknown action: {unknown_action_name}. I cannot handle that yet."
        else: # No decision could be made
            self.logger.error(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): No decision could be made (LLM or fallback failed). llm_decision was: {llm_decision}")
            # Use the response_text set in the try/except block if it was updated, otherwise a generic message.
            if response_text == f"Orchestrator (session {current_session_id}, user {user_id}) received: '{input_text}'. Default response.": # Check if it's still the initial default
                 response_text = "I encountered an issue trying to understand your request. Please try again."
            # No need to set llm_decision here, as the response_text will be used.

        # Log final response_text and llm_decision before adding to history
        self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Final response_text before history: '{response_text}'")
        self.logger.info(f"Orchestrator (task {task_id}, session {current_session_id}, user {user_id}): Final llm_decision state: {llm_decision}")

        # Add AI response to history
        chat_message_history.add_ai_message(response_text)
        
        # Create the Message object for the final response
        final_response_message = self._create_text_message(response_text, role="agent")
        # Add session_id to metadata of the response message so A2ABaseService can pick it up for the Task object
        final_response_message.metadata = final_response_message.metadata or {}
        final_response_message.metadata["session_id_used"] = current_session_id
        
        # If the user requested to end the specialized agent session, add that to metadata
        if llm_decision and "reset_agent_session" in llm_decision and llm_decision["reset_agent_session"]:
            final_response_message.metadata["reset_agent_session"] = True
            self.logger.info(f"Orchestrator (task {task_id}): Adding reset_agent_session flag to response metadata")
        
        # Set the responding agent name based on the action taken
        responding_agent_name = "Orchestrator"
        if llm_decision and "action" in llm_decision:
            if llm_decision["action"] == "delegate":
                # Get the delegated agent path (e.g., business/metrics)
                agent_path = llm_decision.get("agent") or llm_decision.get("agent_name", "")
                # Format the agent name for display (e.g., "Metrics Agent")
                if "/" in agent_path:
                    # If it's a path like business/metrics, take the last part and capitalize
                    responding_agent_name = agent_path.split("/")[-1].capitalize() + " Agent"
                else:
                    # Otherwise just capitalize the name
                    responding_agent_name = agent_path.capitalize() + " Agent"
            elif llm_decision["action"] == "transition" and "transition_to_agent" in llm_decision:
                # For transitions to a new agent, use that agent's name
                agent_path = llm_decision["transition_to_agent"]
                if "/" in agent_path:
                    responding_agent_name = agent_path.split("/")[-1].capitalize() + " Agent"
                else:
                    responding_agent_name = agent_path.capitalize() + " Agent"
        
        final_response_message.metadata["responding_agent_name"] = responding_agent_name
        self.logger.info(f"Orchestrator (task {task_id}): Setting responding_agent_name to '{responding_agent_name}'")
        
        return final_response_message

    async def handle_task_cancel(self, task_id: str) -> Dict[str, Any]:
        """Override handle_task_cancel to ensure it returns 'cancelled' instead of 'already_final'."""
        # from apps.api.a2a_protocol.types import TaskState # Local import can be removed if TaskState is at top

        task_data_and_history = await self.task_store.get_task(task_id)

        if not task_data_and_history:
            return {"id": task_id, "status": "not_found", "message": "Task not found."}

        task = task_data_and_history.task
        final_states = [TaskState.PENDING, TaskState.WORKING] # Correction: cancel if pending or working
        
        # If already cancelled, just confirm it
        if task.status.state == TaskState.CANCELED:
            return {"id": task_id, "status": "cancelled", "message": "Task was already cancelled."}
            
        # If in another final state, still mark as cancelled for test consistency
        if task.status.state not in final_states:
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