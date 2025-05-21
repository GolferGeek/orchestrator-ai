from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
import logging
import requests # Keep for synchronous discovery in __init__ as per doc
import json # Keep for potential agent.json parsing if needed directly
import uuid
import os
from pathlib import Path
import asyncio

from .types import (
    AgentCard,
    AgentCapability,
    Message,
    TextPart,
    TaskSendParams,
    TaskState,
    Task,
    TaskStatus,
    TaskAndHistory,
    JSONRPCError,
    ErrorCode,
    Artifact # Assuming Artifact might be used later from .types
)
from .task_store import TaskStoreService

class A2AUnifiedAgentService(ABC):
    """
    Unified A2A-compliant agent service that provides:
    1. Full A2A protocol compliance
    2. Both orchestration and execution capabilities
    3. Flexible implementation options (LangChain, LangGraph, OpenAI Agents SDK)
    4. Agent discovery via .well-known/agent.json endpoints
    
    This single service combines both the core A2A protocol handling and 
    orchestration capabilities.
    """

    # Class attributes that should be defined by subclasses
    agent_id: str = None
    agent_name: str = None # Short, unique name for paths, e.g., "my_agent"
    display_name: str = None # User-facing friendly name, e.g., "My Awesome Agent"
    agent_description: str = None
    agent_version: str = "1.0.0"
    department_name: str = None # e.g., "business", "customer"
    primary_capability_name: str = None
    primary_capability_description: str = None
    
    # Optional class attributes
    is_sticky: bool = False  # Whether this agent should maintain session stickiness when called
    sticky_duration: int = 30  # Minutes for stickiness, if applicable

    def __init__(self, 
                 task_store: TaskStoreService, 
                 http_client: httpx.AsyncClient, 
                 agent_name: Optional[str] = None, 
                 department_name: Optional[str] = None,
                 # Allow for additional services like openai_service to be passed
                 **kwargs: Any): 
        """
        Initialize the unified agent service.
        
        Args:
            task_store: Service for storing and retrieving tasks
            http_client: HTTP client for making requests to other agents
            agent_name: Name of the agent (overrides class attribute)
            department_name: Department the agent belongs to (overrides class attribute)
            **kwargs: Additional keyword arguments for other services (e.g., openai_service)
        """
        # Resolve names from class attributes if not provided during instantiation
        # Note: agent_name is critical for paths and logging, display_name for UI.
        # The markdown had `self.agent_name` assigned from `resolved_agent_name or self.__class__.__name__`
        # It's better if agent_name (for paths) is explicitly set by subclass or during init.
        self.agent_name = agent_name or getattr(self.__class__, 'agent_name', self.__class__.__name__.lower().replace("service", ""))
        self.department_name = department_name or getattr(self.__class__, 'department_name', None)
        self.display_name = getattr(self.__class__, 'display_name', self.agent_name.replace("_", " ").title())

        # Store essential services and attributes
        self.task_store = task_store
        self.http_client = http_client
        
        # Set up logger
        log_name_parts = [self.department_name, self.agent_name]
        effective_log_name = ".".join(filter(None, log_name_parts))
        if not effective_log_name:
            effective_log_name = self.__class__.__name__
        self.logger = logging.getLogger(effective_log_name)
        
        if not self.logger.hasHandlers():
            # Basic config if no handlers are set up by the main app
            logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper())
        self.logger.info(f"Logger {effective_log_name} initialized.")
        
        # Session stickiness tracking (when this agent is used as an orchestrator)
        self.session_stickiness: Dict[str, Dict[str, Any]] = {}
        
        # Initialize agent discovery
        self.available_agents: List[Dict[str, Any]] = []
        self._discovery_done = False # Flag to track if discovery has run

        # Store any additional services passed via kwargs (e.g., self.openai_service)
        for key, value in kwargs.items():
            setattr(self, key, value)
            self.logger.info(f"Stored additional service/attribute from kwargs: {key}")
        
        self.logger.info(f"{self.agent_name} ({self.__class__.__name__}) A2AUnifiedAgentService initialized. Agent discovery will be lazy or explicit.")

    #--------------------------------------------------
    # A2A PROTOCOL CORE FUNCTIONALITY
    #--------------------------------------------------
    
    @abstractmethod
    async def get_agent_card(self) -> AgentCard:
        """
        Get the agent card with capabilities and metadata.
        Must be implemented by subclasses.
        Example implementation (subclass should tailor this):
        return AgentCard(
            id=self.agent_id or f"{self.agent_name}-agent-v1",
            name=self.display_name, # User-facing friendly name
            description=self.agent_description or f"Agent for {self.display_name}",
            version=self.agent_version,
            type="unified",
            capabilities=[
                AgentCapability(
                    name=self.primary_capability_name or "process_requests", 
                    description=self.primary_capability_description or "Processes user requests"
                ),
                AgentCapability(
                    name="orchestration",
                    description="Can delegate tasks to other agents"
                )
            ]
            # endpoints are typically added by the router setup
        )
        """
        pass
    
    async def get_a2a_agent_card_discovery_format(self) -> Dict[str, Any]:
        """
        Get the .well-known/agent.json representation.
        This is different from the AgentCard Pydantic model - it follows the A2A spec for discovery.
        """
        agent_card_model = await self.get_agent_card() # Get the Pydantic model version
        
        # Convert from AgentCard Pydantic model to the .well-known JSON structure
        capabilities = [cap.name for cap in agent_card_model.capabilities] if agent_card_model.capabilities else []
        limitations: List[str] = [] # Placeholder, can be populated if agent has known limitations
        
        return {
            "name": self.agent_name, # The short, unique name used in paths
            "display_name": agent_card_model.name, # The friendly, displayable name
            "description": agent_card_model.description,
            "capabilities": capabilities,
            "limitations": limitations, 
            "routing": {}, # Placeholder for future routing hints
            "api_version": agent_card_model.version,
            "schema_version": "a2a-v1", # A2A protocol schema version
            "is_sticky": getattr(self.__class__, 'is_sticky', False),
            "sticky_duration": getattr(self.__class__, 'sticky_duration', 30) if getattr(self.__class__, 'is_sticky', False) else None,
            "department": self.department_name, # Adding department for better categorization
            "agent_id_stable": getattr(self.__class__, 'agent_id', None) # The stable unique ID of the agent
        }
    
    async def handle_task_send(self, params: TaskSendParams) -> Task:
        """Handles an incoming task request, processes it, and returns a task result."""
        self.logger.info(f"Task {params.id} (Session: {params.session_id}): Received task send request.")

        effective_session_id = params.session_id if params.session_id is not None else params.id
        self.logger.info(f"Task {params.id}: Effective session_id for processing will be '{effective_session_id}'.")

        # Ensure user_id is present in message metadata for history tracking, if possible
        # This is a good place to inject/ensure it if not already present.
        # For example, if user context is available from FastAPI's Depends, it could be added here.
        # For now, assuming it might be passed in params.message.metadata or task_store handles it.

        await self.task_store.update_task_status(
            task_id=params.id,
            new_state=TaskState.WORKING,
            status_update_message=self._create_text_message("Task received and processing started.")
        )

        task_data_and_history = None # Initialize to handle potential errors before assignment
        try:
            task_data_and_history = await self.task_store.create_or_get_task(
                task_id=params.id,
                request_message=params.message,
                session_id=effective_session_id,
                metadata=params.metadata
            )
            task_id_from_store = task_data_and_history.task.id

            working_task_data = await self._update_task_status_to_working(task_id_from_store)
            if not working_task_data:
                self.logger.error(f"TaskNotFound: Failed to set task {task_id_from_store} to working state.")
                raise self._create_error(
                    ErrorCode.TaskNotFound,
                    f"Task {task_id_from_store} not found or could not be updated."
                )
            
            response_message = await self.process_message(
                message=params.message,
                task_id=task_id_from_store,
                session_id=effective_session_id
            )
            
            final_session_id_for_task = effective_session_id
            responding_agent_name_for_task_metadata = self.display_name # Default to this agent's display name

            if response_message.metadata:
                if "session_id_used" in response_message.metadata:
                    final_session_id_for_task = response_message.metadata["session_id_used"]
                if "responding_agent_name" in response_message.metadata:
                    responding_agent_name_for_task_metadata = response_message.metadata["responding_agent_name"]

            completed_task_data = await self.task_store.update_task_status(
                task_id_from_store,
                TaskState.COMPLETED,
                response_message=response_message,
                status_update_message=self._create_text_message("Task completed successfully.")
            )

            if not completed_task_data:
                self.logger.error(f"InternalError: Failed to update task {task_id_from_store} to completed.")
                raise self._create_error(
                    ErrorCode.InternalError,
                    f"Failed to update task {task_id_from_store} to completed state."
                )
            
            final_task_object = completed_task_data.task
            if final_session_id_for_task:
                final_task_object.session_id = final_session_id_for_task
            
            final_task_object.metadata = final_task_object.metadata or {}
            final_task_object.metadata["responding_agent_name"] = responding_agent_name_for_task_metadata
            final_task_object.metadata["processed_by_agent_id"] = getattr(self.__class__, 'agent_id', self.agent_name)

            if final_task_object.response_message:
                final_task_object.response_message.metadata = final_task_object.response_message.metadata or {}
                if "responding_agent_name" not in final_task_object.response_message.metadata:
                    final_task_object.response_message.metadata["responding_agent_name"] = responding_agent_name_for_task_metadata

            return final_task_object

        except Exception as e:
            error_msg = f"Error processing task {params.id}: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            
            error_response_text = f"An error occurred while processing your request: {str(e)}"
            error_response_msg_obj = self._create_text_message(error_response_text, role="agent")
            
            now_iso = datetime.now(timezone.utc).isoformat()
            final_status = TaskStatus(state=TaskState.FAILED, timestamp=now_iso, message=error_response_text)
            
            if task_data_and_history and task_data_and_history.task: # If task was created/retrieved
                try:
                    await self.task_store.update_task_status(
                        task_id=task_data_and_history.task.id,
                        new_state=TaskState.FAILED,
                        status_update_message=self._create_text_message(error_response_text),
                        response_message=error_response_msg_obj # Also store error response in task
                    )
                except Exception as update_error:
                    self.logger.error(f"Failed to update task {task_data_and_history.task.id} to error state: {str(update_error)}")
                
                # Return the task object from the store if update was successful or even if it failed but task exists
                # This ensures the caller gets a Task object reflecting the failure.
                # We need to re-fetch it to get the latest state including the error response message.
                updated_failed_task_data = await self.task_store.get_task(task_data_and_history.task.id)
                if updated_failed_task_data:
                    return updated_failed_task_data.task

            # Fallback: If task was never created in store or fetch failed, construct a minimal Task object for return
            created_at_val = task_data_and_history.task.created_at if task_data_and_history and task_data_and_history.task else now_iso
            
            return Task(
                id=params.id,
                status=final_status,
                request_message=params.message, 
                response_message=error_response_msg_obj, 
                history=[], 
                artifacts=[],
                session_id=effective_session_id,
                metadata=params.metadata or {},
                created_at=created_at_val, 
                updated_at=now_iso
            )

    async def handle_task_get(self, task_id: str) -> Optional[Task]:
        self.logger.info(f"Handling task get for task {task_id}")
        task_data = await self.task_store.get_task(task_id)
        return task_data.task if task_data else None
        
    async def handle_task_cancel(self, task_id: str) -> Dict[str, Any]:
        task_data_and_history = await self.task_store.get_task(task_id)
        if not task_data_and_history:
            return {"id": task_id, "status": "not_found", "message": "Task not found."}

        task = task_data_and_history.task
        cancellable_states = [TaskState.PENDING, TaskState.WORKING]
        
        if task.status.state == TaskState.CANCELED:
            return {"id": task_id, "status": "cancelled", "message": "Task was already cancelled."}
            
        # If in another final state (e.g. COMPLETED, FAILED) but not CANCELLED, still mark as cancelled.
        # This might be specific to some interpretations; usually, one might not cancel an already completed task.
        # However, for consistency in tests or specific UX, this behavior is maintained from the doc.
        status_update_text = "Task cancellation processed." if task.status.state in cancellable_states else "Task marked as cancelled (was in a final state)."
        await self.task_store.update_task_status(
            task_id,
            TaskState.CANCELED,
            status_update_message=self._create_text_message(status_update_text)
        )
        return {"id": task_id, "status": "cancelled", "message": status_update_text}
    
    async def _update_task_status_to_working(self, task_id: str) -> Optional[TaskAndHistory]:
        try:
            return await self.task_store.update_task_status(
                task_id,
                TaskState.WORKING,
                status_update_message=self._create_text_message("Processing task...")
            )
        except Exception as e:
            self.logger.error(f"Error updating task {task_id} to working state: {str(e)}")
            return None
    
    def _create_error(self, code: ErrorCode, message: str) -> JSONRPCError:
        return JSONRPCError(code=code.value, message=message) # Use .value for Enum member
    
    def _create_text_message(self, text: str, role: str = "agent") -> Message:
        return Message(
            role=role,
            parts=[TextPart(text=text)],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    #--------------------------------------------------
    # ORCHESTRATION CAPABILITIES (Can be used by any agent inheriting this)
    #--------------------------------------------------
    
    async def ensure_agents_discovered(self):
        if not self._discovery_done:
            await self._discover_available_agents()
            self._discovery_done = True

    async def _discover_available_agents(self):
        discovered_agents_list: List[Dict[str, Any]] = []
        
        # Temporarily only discover the metrics agent
        metrics_agent_path = "business/metrics"
        metrics_agent_data = await self._discover_single_agent("", metrics_agent_path)
        if metrics_agent_data:
            discovered_agents_list.append(metrics_agent_data)
            self.logger.info(f"Successfully discovered metrics agent. Agent card data:\n{json.dumps(metrics_agent_data, indent=2)}")
        else:
            self.logger.error("Failed to discover metrics agent")

        self.available_agents = discovered_agents_list
        self.logger.info(f"({self.agent_name}) Discovery complete. {len(self.available_agents)} agents found.")
        if self.available_agents:
            self.logger.info("Discovered agents:")
            for agent in self.available_agents:
                self.logger.info(f"- {agent.get('name')} ({agent.get('path')})")
                self.logger.info(f"  Capabilities: {agent.get('capabilities', [])}")
                self.logger.info(f"  Description: {agent.get('description')}")

    async def _discover_single_agent(self, base_url: str, agent_path: str) -> Optional[Dict[str, Any]]:
        # Prioritize a general API_BASE_URL, then the passed base_url, then a hardcoded default.
        effective_base_url = os.getenv("API_BASE_URL")
        self.logger.info(f"[_discover_single_agent] API_BASE_URL from env: {effective_base_url}")
        
        if not effective_base_url: # If API_BASE_URL is None or empty
            effective_base_url = base_url # Try passed-in base_url (which is often "" from _discover_available_agents)
            self.logger.info(f"[_discover_single_agent] API_BASE_URL not set, using base_url parameter: {effective_base_url}")
        
        if not effective_base_url: # If still None or empty (e.g. API_BASE_URL and base_url param were both empty)
            effective_base_url = "http://localhost:8000" # Default for local development
            self.logger.warning(
                f"[_discover_single_agent] API_BASE_URL and base_url parameter were empty. Defaulting to {effective_base_url} for discovering {agent_path}."
            )
        
        # Ensure agent_path is relative for joining
        relative_agent_discovery_path = f"{agent_path.strip('/')}/.well-known/agent.json"
        
        # Construct the full URL
        # Ensure base_url ends with a slash and agent_discovery_path does not start with one for clean join
        clean_base_url = effective_base_url.strip('/')
        clean_discovery_path = relative_agent_discovery_path.lstrip('/')
        
        # Ensure the /agents/ prefix is part of the URL structure
        full_discovery_url = f"{clean_base_url}/agents/{clean_discovery_path}"

        self.logger.info(f"[_discover_single_agent] Attempting to discover agent '{agent_path}' at full URL: {full_discovery_url}") # Log the exact URL

        try:
            # The httpx client is stored as self.http_client
            response = await self.http_client.get(full_discovery_url, timeout=5.0)
            response.raise_for_status()
            agent_info = response.json()
            # Add the path used for discovery to the agent_info for later use
            agent_info['path'] = agent_path # Store the original path, e.g., "business/metrics"
            agent_info['full_discovery_url'] = full_discovery_url # Store the URL used
            self.logger.info(f"Successfully discovered agent: {agent_info.get('display_name', agent_path)} at {full_discovery_url}")
            return agent_info
        except httpx.HTTPStatusError as e:
            self.logger.warning(f"HTTP error discovering agent {agent_path} at {full_discovery_url}: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            self.logger.warning(f"Request error discovering agent {agent_path} at {full_discovery_url}: {type(e).__name__} - {str(e)}")
        except json.JSONDecodeError:
            self.logger.warning(f"Failed to decode JSON from agent discovery for {agent_path} at {full_discovery_url}")
        except Exception as e:
            self.logger.error(f"Unexpected error discovering agent {agent_path} at {full_discovery_url}: {e}", exc_info=True)
        return None
    
    def _is_session_sticky(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not session_id or session_id not in self.session_stickiness:
            return None
        sticky_data = self.session_stickiness[session_id]
        if "expiry" in sticky_data and sticky_data["expiry"] < datetime.now(timezone.utc).timestamp():
            del self.session_stickiness[session_id]
            self.logger.info(f"Session {session_id} stickiness to {sticky_data.get('agent_path')} has expired.")
            return None
        return sticky_data
    
    def _set_session_sticky(self, session_id: str, agent_path: str, duration_minutes: int = 30) -> None:
        if not session_id:
            return
        expiry = datetime.now(timezone.utc).timestamp() + (duration_minutes * 60)
        self.session_stickiness[session_id] = {"agent_path": agent_path, "expiry": expiry}
        self.logger.info(f"Session {session_id} is now sticky to {agent_path} for {duration_minutes} minutes")
    
    def _clear_session_sticky(self, session_id: str) -> None:
        if session_id and session_id in self.session_stickiness:
            agent_path = self.session_stickiness[session_id].get("agent_path")
            del self.session_stickiness[session_id]
            self.logger.info(f"Cleared stickiness of session {session_id} from {agent_path}.")
    
    async def delegate_to_agent(self, agent_path: str, task_description: str, task_id: str, session_id: Optional[str]) -> str:
        self.logger.info(f"({self.agent_name}) Delegating task '{task_id}' to '{agent_path}' for session '{session_id}'. Description: '{task_description[:100]}...'")
        
        # Create a new unique sub_task_id for the delegated task
        sub_task_id = str(uuid.uuid4())
        
        try:
            agent_message_part = TextPart(text=task_description)
            agent_message = Message(role="user", parts=[agent_message_part], metadata={"original_task_id": task_id})
            agent_task_params = TaskSendParams(
                id=sub_task_id, # Use new unique ID for the sub-task
                message=agent_message,
                session_id=session_id # Propagate session_id for context
            )
            
            # Construct the full URL for delegation
            agent_url_path_relative = f"agents/{agent_path.strip('/')}/tasks"

            # Prioritize a general API_BASE_URL, then a hardcoded default.
            delegation_base_url = os.getenv("API_BASE_URL")
            if not delegation_base_url:
                # Fallback if no specific base URL is set in environment variables
                delegation_base_url = "http://localhost:8000" 
                self.logger.warning(
                    f"API_BASE_URL env var not set. "
                    f"Defaulting to '{delegation_base_url}' for delegating to '{agent_path}'."
                )
            
            full_delegation_url = f"{delegation_base_url.strip('/')}/{agent_url_path_relative.lstrip('/')}"
            self.logger.info(f"Constructed full delegation URL: {full_delegation_url}")

            max_retries = int(os.environ.get("AGENT_DELEGATION_RETRIES", "3"))
            base_retry_delay = float(os.environ.get("AGENT_DELEGATION_RETRY_DELAY_SECONDS", "1"))
            
            for attempt in range(max_retries + 1):
                try:
                    self.logger.info(f"Calling {agent_path} at {full_delegation_url} (Attempt {attempt + 1})")
                    api_response = await self.http_client.post(
                        full_delegation_url, 
                        json=agent_task_params.model_dump(mode='json')
                    )
                    api_response.raise_for_status()
                    agent_task_response_data = api_response.json()
                    
                    # Extract the response text
                    response_text = self._extract_response_text(agent_task_response_data, agent_path)
                    
                    # Check if the delegated agent is sticky and set stickiness for the current session
                    await self._check_and_set_stickiness_after_delegation(agent_path, session_id)
                    
                    return response_text
                except (httpx.HTTPStatusError, httpx.RequestError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
                    self.logger.warning(f"Error calling {agent_path} (Attempt {attempt + 1}/{max_retries + 1}): {type(e).__name__} - {str(e)}")
                    if attempt == max_retries:
                        self.logger.error(f"All {max_retries + 1} attempts to call {agent_path} failed. Last error: {str(e)}")
                        raise # Re-raise the last exception to be caught by the outer try-except
                    backoff_delay = base_retry_delay * (2 ** attempt)
                    self.logger.info(f"Retrying in {backoff_delay}s...")
                    await asyncio.sleep(backoff_delay)
                except Exception as e: # Catch other unexpected errors during the attempt
                    self.logger.error(f"Unexpected error during delegation attempt {attempt + 1} to {agent_path}: {type(e).__name__} - {str(e)}", exc_info=True)
                    raise # Re-raise immediately as it's not a network/HTTP issue we should retry for

        except Exception as e:
            self.logger.error(f"({self.agent_name}) Error delegating task '{task_id}' to {agent_path}: {str(e)}", exc_info=True)
            # Return a user-friendly error message, not the raw exception, to the calling agent/user
            return f"Error communicating with the {agent_path.split('/')[-1]} agent. Details: {str(e)}"
        return f"An unexpected error occurred while trying to delegate to {agent_path}." # Should not be reached

    def _extract_response_text(self, agent_task_response: Dict[str, Any], agent_path: str) -> str:
        # Standardized way to extract response text from a Task object (which is what /tasks should return)
        if not isinstance(agent_task_response, dict):
            self.logger.warning(f"Response from {agent_path} was not a dictionary: {type(agent_task_response)}")
            return f"Received an invalid response format from {agent_path}."

        response_message = agent_task_response.get("response_message")
        if response_message and isinstance(response_message, dict):
            parts = response_message.get("parts")
            if parts and isinstance(parts, list) and len(parts) > 0:
                first_part = parts[0]
                if isinstance(first_part, dict):
                    text = first_part.get("text")
                    if text is not None:
                        return str(text)
                    # Handle cases where TextPart might be nested under 'root' (older Pydantic v1 style)
                    root_part = first_part.get("root")
                    if isinstance(root_part, dict) and "text" in root_part:
                        return str(root_part["text"])
        
        # Fallback for older/non-standard A2A formats (from original markdown)
        if "result" in agent_task_response and "content" in agent_task_response["result"]:
            content = agent_task_response["result"]["content"]
            if content and isinstance(content, list) and len(content) > 0 and "text" in content[0]:
                return str(content[0]["text"])

        self.logger.warning(f"Could not extract text from {agent_path} response: {json.dumps(agent_task_response)[:200]}...")
        status_info = agent_task_response.get("status", {}).get("state", "unknown state")
        status_message = agent_task_response.get("status", {}).get("message", "No specific message.")
        return f"Received response from {agent_path} (status: {status_info}), but couldn't extract primary text content. Details: {status_message}"
    
    async def _check_and_set_stickiness_after_delegation(self, agent_path: str, session_id: Optional[str]):
        if not session_id: return # Cannot set stickiness without a session_id
        try:
            # Find the agent's card data from the discovered list using the full path
            agent_info = next((agent for agent in self.available_agents if agent.get("path") == agent_path), None)
            
            if agent_info: # agent_info is the card data itself from .well-known/agent.json
                agent_card_data = agent_info 
                if agent_card_data.get("is_sticky", False):
                    sticky_duration = agent_card_data.get("sticky_duration", 30) # Default from A2A spec if not provided
                    self._set_session_sticky(session_id, agent_path, sticky_duration)
                    self.logger.info(f"Session {session_id} became sticky to {agent_path} for {sticky_duration} mins after delegation.")
                else:
                    self.logger.debug(f"Agent {agent_path} is not sticky; not setting session stickiness.")
            else:
                self.logger.warning(f"Could not find card data for agent {agent_path} in discovered list to check stickiness.")
        except Exception as e:
            self.logger.warning(f"Error in _check_and_set_stickiness_after_delegation for {agent_path}: {e}", exc_info=True)

    #--------------------------------------------------
    # AGENT-SPECIFIC IMPLEMENTATION METHODS (To be implemented by subclasses)
    #--------------------------------------------------
    
    @abstractmethod
    async def execute_agent_task(self, message: Message, task_id: str, session_id: Optional[str] = None) -> str:
        """
        Execute a task using the agent's internal implementation.
        This is where LangChain, LangGraph, or OpenAI Assistants SDK would be used.
        This method is called by `process_message` if the request is not handled by stickiness routing.
        It should return the string content of the agent's response.
        """
        pass
    
    async def process_message(self, message: Message, task_id: str, session_id: Optional[str] = None) -> Message:
        """
        Main processing method that supports both:
        1. Direct execution (using this agent's capabilities via execute_agent_task)
        2. Orchestration (delegating to other agents, if execute_agent_task decides to)
        
        The decision logic (e.g., using an LLM to decide to delegate or handle directly)
        should primarily reside within the `execute_agent_task` method of the specific agent implementation.
        This `process_message` method orchestrates stickiness and calls `execute_agent_task`.
        """
        self.logger.info(f"({self.agent_name}) Processing message for task {task_id}, session {session_id}")
        
        # Stickiness check is done first
        sticky_agent_data = self._is_session_sticky(session_id)
        
        response_text: str
        responding_agent_name_for_metadata = self.display_name # Default to this agent

        if sticky_agent_data:
            sticky_agent_path = sticky_agent_data["agent_path"]
            if sticky_agent_path == f"{self.department_name}/{self.agent_name}": # Sticky to self
                self.logger.info(f"Session {session_id} is sticky to self ({sticky_agent_path}). Executing task directly.")
                response_text = await self.execute_agent_task(message, task_id, session_id)
            else: # Sticky to another agent
                self.logger.info(f"Session {session_id} is sticky to {sticky_agent_path}. Delegating task.")
                message_text_for_delegation = message.parts[0].text if message.parts and isinstance(message.parts[0], TextPart) else ""
                if not message_text_for_delegation and hasattr(message.parts[0], 'root') and isinstance(message.parts[0].root, TextPart):
                     message_text_for_delegation = message.parts[0].root.text

                if not message_text_for_delegation:
                    self.logger.warning(f"Cannot delegate for task {task_id} as message text is empty.")
                    response_text = "Could not process your request as the message was empty or unreadable."
                else:
                    response_text = await self.delegate_to_agent(
                        agent_path=sticky_agent_path,
                        task_description=message_text_for_delegation,
                        task_id=task_id, 
                        session_id=session_id
                    )
                    # Update responding agent name if delegation occurred due to stickiness
                    delegated_agent_display_name = sticky_agent_path.split('/')[-1].replace('_',' ').title()
                    responding_agent_name_for_metadata = delegated_agent_display_name
        else:
            # Not sticky, or stickiness expired - execute this agent's specific logic
            self.logger.info(f"Session {session_id} is not sticky or stickiness expired. Executing task with {self.agent_name}.")
            response_text = await self.execute_agent_task(message, task_id, session_id)
            # If execute_agent_task itself delegates, it should return the text from the delegate_to_agent call.
            # Metadata about *which* agent ultimately responded if execute_agent_task delegates will be complex.
            # For now, if not sticky, the primary responder is considered this agent unless execute_agent_task changes it.

        # Final response message construction
        response_msg_obj = self._create_text_message(response_text, role="agent")
        response_msg_obj.metadata = response_msg_obj.metadata or {}
        response_msg_obj.metadata["session_id_used"] = session_id
        response_msg_obj.metadata["responding_agent_name"] = responding_agent_name_for_metadata
        response_msg_obj.metadata["processed_by_agent_id"] = getattr(self.__class__, 'agent_id', self.agent_name)
        
        return response_msg_obj 