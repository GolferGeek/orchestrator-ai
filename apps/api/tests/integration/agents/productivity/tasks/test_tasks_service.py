import pytest
from unittest.mock import AsyncMock
import httpx  # For client type hint, though TestClient will be used
from fastapi import FastAPI  # For app type hint
from pathlib import Path  # For loading context file
from unittest.mock import ANY  # For asserting generated task_id

# Import agent-specific constants from the Tasks agent's main module
from apps.api.agents.productivity.tasks.main import (
    AGENT_ID as TASKS_AGENT_ID,
    AGENT_NAME as TASKS_AGENT_NAME,
    AGENT_VERSION as TASKS_AGENT_VERSION,
    AGENT_DESCRIPTION as TASKS_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as TASKS_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as TASKS_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as TASKS_PRIMARY_CAPABILITY
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
# Path is .../orchestrator-ai/apps/api/tests/integration/agents/productivity/tasks/test_tasks_service.py
# .parents[7] -> .../orchestrator-ai/
PROJECT_ROOT = Path(__file__).resolve().parents[7]
TASKS_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / TASKS_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_tasks_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]): # Type hint matches shared fixture
    """Test the get_agent_card method of TasksAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/productivity/tasks/agent-card") # Use await
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == TASKS_AGENT_ID
    assert agent_card["name"] == TASKS_AGENT_NAME
    assert agent_card["description"] == TASKS_AGENT_DESCRIPTION
    assert agent_card["version"] == TASKS_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert "/agents/productivity/tasks/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == TASKS_PRIMARY_CAPABILITY

@pytest.mark.asyncio
async def test_tasks_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock): # Updated type hint
    """Test successful message processing for TasksAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Okay, I've found the upcoming tasks."

    try:
        actual_tasks_context_content = TASKS_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Tasks context file not found at {TASKS_CONTEXT_FILE_PATH}")

    mock_send_to_mcp = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "Tell me about upcoming tasks."
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-task-xyz-123",  # This is the task_id
        message=Message(role="user", parts=[TextPart(text=user_query)])
        # session_id is intentionally omitted to default to None
    )

    response = await client.post(f"/agents/productivity/tasks/tasks", json=request_payload.model_dump(mode='json')) # Use model_dump
    assert response.status_code == 200
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-xyz-123" # Assert against the task_id
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_prompt_for_mcp = f"{actual_tasks_context_content.rstrip('\n')}\n\nUser Query: {user_query}"

    mock_send_to_mcp.assert_called_once_with(
        agent_id=TASKS_MCP_TARGET_ID,
        user_query=expected_prompt_for_mcp,
        session_id=None,  # Expect session_id to be None
        # stream=False # Default is False, so not strictly needed unless base class changes it
        # capabilities=None # Default is None
    )

@pytest.mark.asyncio
async def test_tasks_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock): # Updated type hint
    client, _ = client_and_app
    user_query = "What are my urgent tasks?"
    error_detail = "Failed to connect to MCP for tasks"
    
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-task-conn-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post(f"/agents/productivity/tasks/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert response_data_full["id"] == "test-task-conn-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_tasks_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock): # Updated type hint
    client, _ = client_and_app
    user_query = "Search for task 'alpha'."
    error_detail = "Request to MCP timed out for tasks"

    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-task-timeout-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post(f"/agents/productivity/tasks/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-timeout-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_tasks_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock): # Updated type hint
    client, _ = client_and_app
    user_query = "Create a new task: 'Project Omega'"
    error_detail = "An MCP specific error occurred for tasks"
    
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-task-mcp-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post(f"/agents/productivity/tasks/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert response_data_full["id"] == "test-task-mcp-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_tasks_process_message_unexpected_error_in_service(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "This should cause an unhandled error in the service."
    error_detail_text = "Tasks specific unexpected service error"

    # to simulate an error originating from within the service's core logic
    # AFTER MCPClient might have been called or not.
    # Corrected: This should mock the MCPClient call to simulate an error during that call, 
    # aligning with how other MCP error tests are structured and how the meetings agent does it.
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path
        new_callable=AsyncMock,
        side_effect=RuntimeError(error_detail_text) 
    )
    
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-task-service-unexpected-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post(f"/agents/productivity/tasks/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200 # Base service should catch and return Task in FAILED state
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-service-unexpected-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    # The error message from A2AAgentBaseService when an unhandled exception occurs in process_message
    # and is caught by handle_task_send
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert actual_response_text == expected_error_message 