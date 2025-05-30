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

# Import from shared generated contracts instead of missing local types
from apps.api.v2.shared.generated.python.a2a_protocol import (
    Message,
    TextPart,
    TaskSendParams,
    TaskStatus,
    Task,
    ErrorCode,
    JSONRPCError,
    Part,
    ArtifactPart,
    ArtifactType,
    UUIDModel,
    ErrorDetails
)
from apps.api.v2.shared.generated.python.agent_types import (
    AgentCard,
    AgentCapability
)
from .task_store import TaskStoreService, TaskAndHistory

class A2AUnifiedAgentService(ABC):
    """
    Abstract Base Class for an A2A Unified Agent Service.
    Provides a common structure for agent services, including task handling and agent card generation.
    Requires subclasses to implement core logic for task execution and capability definition.
    """

    # --- Class Attributes (to be overridden by subclasses) ---
    agent_id: str = "550e8400-e29b-12d3-a456-426655440001"  # Default UUID (subclasses should override)
    agent_name: str = "base_agent" # Path-friendly name, used in routing by default
    display_name: str = "Base Unified Agent" # UI-friendly name
    agent_description: str = "A base unified agent service."
    agent_version: str = "1.0.0"
    department_name: str = "system" # Default department, used in routing
    
    primary_capability_name: str = "generic_task_execution"
    primary_capability_description: str = "Executes generic tasks."
    
    is_sticky: bool = False # Whether sessions should be sticky for this agent
    sticky_duration: int = 30 # Duration in minutes for sticky sessions if is_sticky is True

    def __init__(self, 
                 task_store: TaskStoreService, 
                 http_client: httpx.AsyncClient, # Added http_client
                 agent_name: Optional[str] = None, # Allow override for dynamic loading
                 department_name: Optional[str] = None, # Allow override for dynamic loading
                 **kwargs: Any):
        self.task_store = task_store
        self.http_client = http_client # Store http_client
        
        # Use provided or class-defined agent_name and department_name
        self.agent_name = agent_name if agent_name is not None else self.__class__.agent_name
        self.department_name = department_name if department_name is not None else self.__class__.department_name
        
        # Ensure class attributes are set if not overridden by constructor args
        # (This primarily ensures that if a subclass sets them, they are preferred over ABC defaults)
        if not hasattr(self, 'display_name') or self.display_name == A2AUnifiedAgentService.display_name:
            self.display_name = self.__class__.display_name
        if not hasattr(self, 'agent_id') or self.agent_id == A2AUnifiedAgentService.agent_id:
            self.agent_id = self.__class__.agent_id
        if not hasattr(self, 'agent_description') or self.agent_description == A2AUnifiedAgentService.agent_description:
            self.agent_description = self.__class__.agent_description
        if not hasattr(self, 'agent_version') or self.agent_version == A2AUnifiedAgentService.agent_version:
            self.agent_version = self.__class__.agent_version
        # etc. for other class attributes like primary_capability_name, is_sticky etc.

        self.logger = logging.getLogger(f"{self.__class__.__module__}.{self.agent_name}")
        self.logger.info(f"Initialized {self.display_name} ({self.agent_id}) in {self.department_name}")
        
        # Initialize delegation tracking
        self._last_delegation_info = None

    @abstractmethod
    async def execute_agent_task(self, message: Message, task_id: str, session_id: Optional[str] = None) -> str:
        """Core logic for the agent to execute a task. Must be implemented by subclasses."""
        pass

    @abstractmethod
    def get_capabilities(self) -> List[AgentCapability]:
        """Return the list of capabilities for this agent. Must be implemented by subclasses."""
        pass

    async def get_agent_card(self) -> AgentCard:
        """Return the agent card with capabilities."""
        # Construct base_agent_path using self.department_name and self.agent_name
        base_agent_path = f"/agents/{self.department_name}/{self.agent_name}"
        # Create full URL for endpoints (required by AgentCard validation)
        base_url = "http://localhost:8001"  # This should come from config in production
        
        return AgentCard(
            id=self.agent_id,
            name=self.display_name,
            description=self.agent_description,
            version=self.agent_version,
            type="specialized",  # Default type, subclasses should override
            endpoints=[f"{base_url}{base_agent_path}/tasks"],
            capabilities=self.get_capabilities()
        )

    async def handle_task_send(self, params: TaskSendParams) -> Task:
        """Handles an incoming task request, creates a task, and starts its execution."""
        
        # Extract from V2 TaskSendParams format - handle UUIDModel properly
        if params.task.id:
            # Handle UUIDModel by accessing the root attribute if it exists
            if hasattr(params.task.id, 'root'):
                task_id = str(params.task.id.root)
            else:
                task_id = str(params.task.id)
        else:
            task_id = str(uuid.uuid4())
        
        # Fix metadata access - convert to dict if it exists, otherwise handle as None
        session_id = None
        if params.task.metadata:
            # Convert Pydantic model to dict to use .get() method
            metadata_dict = params.task.metadata.model_dump() if hasattr(params.task.metadata, 'model_dump') else dict(params.task.metadata)
            session_id = metadata_dict.get('session_id')
        
        # Create a message object from the task description for processing
        user_query = params.task.description or params.task.title or ""
        
        message = Message(
            id=str(uuid.uuid4()),
            role="user",
            parts=[Part(root=TextPart(text=user_query, type="text"))],
            timestamp=params.task.created_at,
            session_id=session_id,
            metadata=params.task.metadata
        )
        
        self.logger.info(f"Task {task_id} (Session: {session_id}): Received for agent {self.agent_id}.")
        
        # Extract title and description from the task for create_task call
        title = params.task.title or "Task"
        description = params.task.description or user_query
        
        # Handle UUIDModel for created_by
        created_by = None
        if params.task.created_by:
            if hasattr(params.task.created_by, 'root'):
                created_by = str(params.task.created_by.root)
            else:
                created_by = str(params.task.created_by)
        
        await self.task_store.create_task(
            title=title,
            description=description,
            task_id=task_id,
            session_id=session_id,
            created_by=created_by,
            metadata=params.task.metadata.model_dump() if params.task.metadata else None
        )
        
        try:
            # Non-blocking execution (if actual task is long-running, consider background tasks)
            result_text = await self.execute_agent_task(message, task_id, session_id)
            await self.task_store.update_task_status(task_id, TaskStatus.completed)
            self.logger.info(f"Task {task_id} completed.")
            
            # Store the response according to A2A protocol in output_artifacts
            task_and_history = await self.task_store.get_task(task_id)
            if task_and_history and task_and_history.task:
                # Determine if this was a delegated task by checking delegation info
                agent_metadata = {
                    "agent_id": self.agent_id,
                    "agent_name": self.agent_name, 
                    "display_name": self.display_name,
                    "result_type": "agent_response"
                }
                
                # If this is an orchestrator and we have delegation info, use the delegated agent's info
                if self.agent_name == "orchestrator" and self._last_delegation_info:
                    agent_metadata.update({
                        "agent_name": self._last_delegation_info["agent_name"],
                        "display_name": self._last_delegation_info["display_name"],
                        "delegated_by": self.agent_name,
                        "original_agent_id": self.agent_id,
                        "agent_path": self._last_delegation_info["agent_path"]
                    })
                    # Clear delegation info after use
                    self._last_delegation_info = None
                
                # Create an output artifact with the response text
                response_artifact = ArtifactPart(
                    type="artifact_data",
                    artifact_id=UUIDModel(root=uuid.uuid4()),
                    artifact_type=ArtifactType.document,
                    format="text/plain",
                    data=result_text,
                    encoding="utf-8",
                    metadata=agent_metadata,
                    size=len(result_text.encode('utf-8'))
                )
                
                # Add the artifact to the task's output_artifacts
                if task_and_history.task.output_artifacts is None:
                    task_and_history.task.output_artifacts = []
                task_and_history.task.output_artifacts.append(response_artifact)
                
                # Update the task in the store
                self.task_store._tasks[task_id] = task_and_history.task
                
        except Exception as e:
            self.logger.error(f"Task {task_id} failed: {e}", exc_info=True)
            await self.task_store.update_task_status(task_id, TaskStatus.failed)
            
            # Store error information according to A2A protocol
            task_and_history = await self.task_store.get_task(task_id)
            if task_and_history and task_and_history.task:
                error_details = ErrorDetails(
                    code="EXECUTION_ERROR",
                    message=f"Task execution failed: {str(e)}",
                    details={"agent_id": self.agent_id, "exception_type": type(e).__name__}
                )
                task_and_history.task.error_details = error_details
                
                # Update the task in the store
                self.task_store._tasks[task_id] = task_and_history.task
            
            # Use the correct ErrorCode enum attribute
            error_code_value = ErrorCode.integer__32603.value if hasattr(ErrorCode.integer__32603, 'value') else -32603
            raise JSONRPCError(code=error_code_value, message=f"Task execution failed: {str(e)}")

        task_and_history = await self.task_store.get_task(task_id)
        return task_and_history.task if task_and_history else None

    async def handle_task_get(self, task_id: str) -> Optional[Task]:
        """Handles a request to get the status of a task."""
        self.logger.debug(f"Get request for Task ID: {task_id}")
        task_and_history = await self.task_store.get_task(task_id)
        return task_and_history.task if task_and_history else None

    async def handle_task_cancel(self, task_id: str) -> Dict[str, Any]:
        """Handles a request to cancel a task."""
        # Basic implementation: Mark task as cancelled. 
        # Real cancellation might involve more complex logic (e.g., stopping a background process).
        self.logger.info(f"Cancel request for Task ID: {task_id}")
        task_and_history = await self.task_store.get_task(task_id)
        if task_and_history and task_and_history.task and task_and_history.task.status not in [TaskStatus.completed, TaskStatus.failed, TaskStatus.canceled]:
            await self.task_store.update_task_status(task_id, TaskStatus.canceled)
            return {"status": "cancelled", "task_id": task_id}
        elif task_and_history and task_and_history.task:
            # Ensure task.status is accessible as an enum value
            state_value = task_and_history.task.status.value if hasattr(task_and_history.task.status, 'value') else str(task_and_history.task.status)
            return {"status": "not_cancellable", "reason": f"State: {state_value}", "task_id": task_id}
        else:
            return {"status": "not_found", "task_id": task_id}

    async def get_a2a_agent_card_discovery_format(self) -> Dict[str, Any]:
        """Returns the agent card information in the A2A .well-known/agent.json format."""
        agent_card = await self.get_agent_card()
        
        # Ensure capabilities are in the correct format (list of strings for discovery)
        capabilities_list = [cap.name for cap in agent_card.capabilities if isinstance(cap, AgentCapability)]

        return {
            "name": self.display_name, 
            "display_name": self.display_name,
            "description": agent_card.description,
            "version": agent_card.version,
            "api_version": "1.0.0", # A2A spec version for this structure
            "schema_version": "a2a-v1", # Specific schema version for this content
            "endpoints": agent_card.endpoints,
            "capabilities": capabilities_list,
            "limitations": [], # Add limitations if any
            "routing": {},
            "auth_requirements": None, # Specify if auth is needed
            "is_sticky": self.is_sticky,
            "sticky_duration": self.sticky_duration if self.is_sticky else None,
            "department": self.department_name, # Added department
            "agent_id_stable": self.agent_id # Added stable agent ID for reference
        }

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
            effective_base_url = "http://localhost:8001" # Default to V2 API for local development
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
        
        # Store delegation info for later attribution
        self._last_delegation_info = {
            "agent_path": agent_path,
            "agent_name": agent_path.split('/')[-1],  # Extract agent name from path
            "display_name": f"{agent_path.split('/')[-1].title()} Agent"
        }
        
        try:
            # Create V2 TaskSendParams with task object
            task_obj = Task(
                id=str(uuid.uuid4()),
                title="Delegated Task",
                description=task_description,
                status=TaskStatus.pending,
                created_at=datetime.now(timezone.utc).isoformat(),
                created_by=str(uuid.uuid4()),  # This would come from auth in real implementation
                metadata={
                    "original_task_id": task_id,
                    "session_id": session_id,
                    "delegated_from": self.agent_name
                }
            )
            
            agent_task_params = TaskSendParams(
                task=task_obj,
                target_agent_id=str(uuid.uuid4()),  # This would be the actual target agent ID
                timeout=3600,
                metadata={
                    "session_id": session_id,
                    "delegation_context": "orchestrator_delegation"
                }
            )
            
            # Construct the full URL for delegation
            agent_url_path_relative = f"agents/{agent_path.strip('/')}/tasks"

            # Prioritize a general API_BASE_URL, then a hardcoded default.
            delegation_base_url = os.getenv("API_BASE_URL")
            if not delegation_base_url:
                # Fallback if no specific base URL is set in environment variables
                delegation_base_url = "http://localhost:8001" # Default to V2 API
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
        
        original_response = agent_task_response  # Keep original for status info
        
        # Handle case where response might be a JSON string instead of parsed dict
        if isinstance(agent_task_response, str):
            try:
                agent_task_response = json.loads(agent_task_response)
            except json.JSONDecodeError:
                self.logger.warning(f"Response from {agent_path} was a string but not valid JSON: {agent_task_response[:200]}...")
                return f"Received text response from {agent_path}: {agent_task_response}"
        
        if not isinstance(agent_task_response, dict):
            self.logger.warning(f"Response from {agent_path} was not a dictionary: {type(agent_task_response)}")
            return f"Received an invalid response format from {agent_path}."

        # A2A Protocol V2 format - check for output_artifacts first (highest priority)
        output_artifacts = agent_task_response.get("output_artifacts")
        if output_artifacts and isinstance(output_artifacts, list) and len(output_artifacts) > 0:
            artifact = output_artifacts[0]
            if isinstance(artifact, dict) and "data" in artifact:
                artifact_data = artifact["data"]
                if isinstance(artifact_data, str):
                    self.logger.info(f"Successfully extracted response from {agent_path} via A2A output_artifacts format")
                    return artifact_data

        # Check for response_message field (A2A V1 standard format)
        response_message = agent_task_response.get("response_message")
        if response_message and isinstance(response_message, dict):
            parts = response_message.get("parts")
            if parts and isinstance(parts, list) and len(parts) > 0:
                first_part = parts[0]
                if isinstance(first_part, dict):
                    text = first_part.get("text")
                    if text is not None:
                        self.logger.info(f"Successfully extracted response from {agent_path} via V1 response_message.parts format")
                        return str(text)
                    # Handle cases where TextPart might be nested under 'root' (older Pydantic v1 style)
                    root_part = first_part.get("root")
                    if isinstance(root_part, dict) and "text" in root_part:
                        self.logger.info(f"Successfully extracted response from {agent_path} via V1 response_message.parts.root format")
                        return str(root_part["text"])
        
        # Check for result field (older A2A format)
        if "result" in agent_task_response and "content" in agent_task_response["result"]:
            content = agent_task_response["result"]["content"]
            if content and isinstance(content, list) and len(content) > 0 and "text" in content[0]:
                self.logger.info(f"Successfully extracted response from {agent_path} via deprecated result.content format")
                return str(content[0]["text"])

        # Check if this is a Task object with a response in the result or description field (fallback)
        task_result = agent_task_response.get("result")
        if task_result and isinstance(task_result, str):
            self.logger.info(f"Successfully extracted response from {agent_path} via direct result field")
            return task_result
            
        # Check for response in task description (fallback)
        task_description = agent_task_response.get("description")
        if task_description and isinstance(task_description, str):
            self.logger.info(f"Successfully extracted response from {agent_path} via task description field")
            return task_description

        self.logger.warning(f"Could not extract text from {agent_path} response: {json.dumps(agent_task_response)[:200]}...")
        
        # Use original_response for status info to avoid variable confusion
        status_info = "unknown state"
        status_message = "No specific message."
        
        if isinstance(original_response, dict):
            status_data = original_response.get("status", {})
            if isinstance(status_data, dict):
                status_info = status_data.get("state", "unknown state")
                status_message = status_data.get("message", "No specific message.")
            elif isinstance(status_data, str):
                status_info = status_data
        
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
    async def process_message(self, message: Message, task_id: str, session_id: Optional[str] = None) -> Message:
        """
        Main processing method that supports both:
        1. Direct execution (using this agent's capabilities via execute_agent_task)
        2. Orchestration (delegating to other agents, if execute_agent_task decides to)
        
        The decision logic (e.g., using an LLM to decide to delegate or handle directly)
        should primarily reside within the `execute_agent_task` method of the specific agent implementation.
        This `process_message` method orchestrates stickiness and calls `execute_agent_task`.
        """
        pass

    def _create_error(self, code: ErrorCode, message: str) -> JSONRPCError:
        return JSONRPCError(code=code.value, message=message) # Use .value for Enum member

    def _create_text_message(self, text: str, role: str = "agent") -> Message:
        return Message(
            role=role,
            parts=[Part(root=TextPart(text=text, type="text"))],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    # Additional methods and attributes can be added here as needed
    _discovery_done = False # Flag to track if discovery has run
    available_agents: List[Dict[str, Any]] = []
    session_stickiness: Dict[str, Any] = {}
