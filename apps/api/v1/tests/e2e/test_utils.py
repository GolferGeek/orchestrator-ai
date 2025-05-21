import httpx
import json
import pytest # For pytest.fail
import uuid # Added
from datetime import datetime, timezone # Added
from typing import Optional

# Assuming a2a_protocol is two levels up from e2e directory, then into a2a_protocol
from apps.api.v1.a2a_protocol.types import TaskSendParams, Message, TextPart, Part # Changed to absolute

# Define a test API key. Ensure the server is configured with the same key
# in settings.TEST_API_SECRET_KEY
# E2E_TEST_API_KEY = "e2e-super-secret-key" # REMOVED - should be handled by conftest settings
# TEST_API_KEY_HEADER_NAME = "X-Test-Api-Key" # REMOVED

# Assumptions for endpoint paths:
# These should match your actual API structure for v1
ORCHESTRATOR_TASKS_PATH = "/agents/orchestrator/tasks" # Changed from ORCHESTRATOR_CHAT_PATH

async def call_orchestrator_task_endpoint(client: httpx.AsyncClient, session_id: str, user_query: str) -> dict:
    """Helper function to call the orchestrator's A2A /tasks endpoint and return parsed JSON response."""
    print(f"  [Task Call] POST to {ORCHESTRATOR_TASKS_PATH} with session {session_id}. Query: '{user_query[:50]}...'")
    
    text_content = TextPart(text=user_query)
    message_content = [Part(type="text", text=text_content.text)]
    
    message = Message(
        id=str(uuid.uuid4()),
        role="user",
        parts=message_content,
        timestamp=datetime.now(timezone.utc).isoformat() 
    )
    
    task_payload = TaskSendParams(
        local_session_id=session_id, # Ensure this maps to expected server-side session field
        # task_id: Optional[str] = None, # Let server generate if not provided
        # parent_task_id: Optional[str] = None,
        message=message,
        # agent_id: Optional[str] = "orchestrator", # Explicitly set if needed, or rely on path
        # config: Optional[Dict[str, Any]] = None,
        # context: Optional[Dict[str, Any]] = None
    )

    # headers = { # REMOVED - client fixture should set this
    #     TEST_API_KEY_HEADER_NAME: E2E_TEST_API_KEY
    # }

    try:
        response = await client.post(
            ORCHESTRATOR_TASKS_PATH, 
            json=task_payload.model_dump(mode='json'), # Use .model_dump() for Pydantic v2+
            # headers=headers # REMOVED
        )
        # print(f"    [Task Call] Response status: {response.status_code}")
        # print(f"    [Task Call] Response content: {response.text[:200]}...") # Log part of response for debug
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print(f"ERROR in call_orchestrator_task_endpoint: Status {e.response.status_code} for {e.request.url}")
        print(f"Response body: {e.response.text}")
        # pytest.fail(f"Orchestrator task call failed: {e.response.status_code} - {e.response.text}")
        raise # Re-raise the exception to be caught by the test
    except Exception as e:
        print(f"ERROR in call_orchestrator_task_endpoint: Unexpected error {type(e).__name__}: {e}")
        # pytest.fail(f"Orchestrator task call failed with unexpected error: {e}")
        raise # Re-raise


async def call_direct_agent_task_endpoint(
    client: httpx.AsyncClient, 
    session_id: str, 
    user_query: str, 
    agent_category: str, 
    agent_id_name: str
) -> dict:
    """Helper function to call a direct agent's A2A /tasks endpoint."""
    
    direct_task_path = f"/agents/{agent_category}/{agent_id_name}/tasks"
    print(f"  [Direct Task Call] POST to {direct_task_path} for session {session_id}. Query: '{user_query[:50]}...'")

    text_content = TextPart(text=user_query)
    message_content = [Part(type="text", text=text_content.text)]
    message = Message(
        id=str(uuid.uuid4()),
        role="user",
        parts=message_content,
        timestamp=datetime.now(timezone.utc).isoformat()
    )
    task_payload = TaskSendParams(
        local_session_id=session_id,
        message=message,
        agent_id=agent_id_name # For direct calls, specify the agent_id in payload
    )
    
    # headers = { # REMOVED
    #     TEST_API_KEY_HEADER_NAME: E2E_TEST_API_KEY
    # }

    try:
        response = await client.post(
            direct_task_path, 
            json=task_payload.model_dump(mode='json'),
            # headers=headers # REMOVED
        )
        # print(f"    [Direct Task Call] Response status: {response.status_code}")
        # print(f"    [Direct Task Call] Response content: {response.text[:200]}...")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print(f"ERROR in call_direct_agent_task_endpoint: Status {e.response.status_code} for {e.request.url} ({agent_category}/{agent_id_name})")
        print(f"Response body: {e.response.text}")
        raise
    except Exception as e:
        print(f"ERROR in call_direct_agent_task_endpoint: Unexpected error {type(e).__name__}: {e} for {agent_category}/{agent_id_name}")
        raise


def assert_non_trivial_answer(response_data: dict, query: str, agent_id: str, path_type: str = "Orchestrator"):
    """Asserts that an agent's answer is non-trivial."""
    print(f"  [Assert] Query: '{query[:50]}...' | Answer: '{response_data.get('text', 'No answer found')[:100]}...'")
    assert response_data, f"[{path_type} Path] No answer found in response for {agent_id} to query '{query}'"
    assert isinstance(response_data.get('text', ''), str), f"[{path_type} Path] Answer for {agent_id} is not a string: {type(response_data.get('text', ''))}"
    assert len(response_data.get('text', '').strip()) > 0, f"[{path_type} Path] Answer for {agent_id} is empty or whitespace only."
    
    # Basic check against placeholder/generic responses
    generic_responses = [
        "i am a language model", 
        "i cannot help with that",
        "placeholder response",
        "content for the agent." # From a common default e2e_test_query.txt
    ]
    answer_lower = response_data.get('text', '').lower()
    for generic in generic_responses:
        assert generic not in answer_lower, f"[{path_type} Path] Answer for {agent_id} seems generic: '{response_data.get('text', '')[:100]}...'"
    
    print(f"    [{path_type} Path] Validated non-trivial answer from {agent_id}: '{response_data.get('text', '')[:50]}...'")

# Example usage if you need to parse content from the agent's response structure
# This is highly dependent on what your agents return in the TaskSendResponse.
# For now, we assume the 'answer' is directly in a top-level 'text' field or similar
# within the 'message.content[0]' part.

def get_answer_from_task_response(response_data: dict) -> Optional[str]:
    """
    Extracts the textual answer from a TaskSendResponse.
    Adjust this based on your actual TaskSendResponse structure.
    """
    try:
        # Assuming response_data is the parsed JSON of TaskSendResponse
        # And that the response message is structured like the input message
        if not response_data or not isinstance(response_data, dict):
            return None

        # Example: navigating a structure similar to TaskSendParams.message
        message_data = response_data.get("message") 
        if not message_data or not isinstance(message_data, dict):
            # Maybe the response is directly the message part for simple agents
            message_data = response_data 


        content_list = message_data.get("content")
        if content_list and isinstance(content_list, list) and len(content_list) > 0:
            first_part = content_list[0]
            if isinstance(first_part, dict) and first_part.get("type") == "text":
                return first_part.get("text")
        
        # Fallback for simpler structures if the above is too specific
        # e.g., if agent returns { "answer": "..." } or { "text": "..." }
        if "answer" in response_data and isinstance(response_data["answer"], str):
            return response_data["answer"]
        if "text" in response_data and isinstance(response_data["text"], str):
            return response_data["text"]

    except Exception as e:
        print(f"Error parsing answer from response: {e}. Response data: {str(response_data)[:200]}")
    return None 