import pytest
from unittest.mock import AsyncMock # Removed patch, mocker will be a fixture
import httpx  # For client type hint
from fastapi import FastAPI  # For app type hint
from pathlib import Path  # For loading context file
from unittest.mock import ANY  # For asserting generated task_id

# Import agent-specific constants from the Meetings agent's main module
from apps.api.agents.productivity.meetings.main import (
    AGENT_ID as MEETINGS_AGENT_ID,
    AGENT_NAME as MEETINGS_AGENT_NAME,
    AGENT_VERSION as MEETINGS_AGENT_VERSION,
    AGENT_DESCRIPTION as MEETINGS_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as MEETINGS_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as MEETINGS_CONTEXT_FILE
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[7]  # Corrected: meetings/productivity/agents/integration/tests/api/apps -> orchestrator-ai
MEETINGS_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / MEETINGS_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_meetings_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MeetingsAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/productivity/meetings/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == MEETINGS_AGENT_ID
    assert agent_card["name"] == MEETINGS_AGENT_NAME
    assert agent_card["description"] == MEETINGS_AGENT_DESCRIPTION
    assert agent_card["version"] == MEETINGS_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert "/agents/productivity/meetings/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == "query_meetings_via_mcp"

@pytest.mark.asyncio
async def test_get_meetings_agent_discovery_well_known(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the /.well-known/agent.json endpoint for MeetingsAgentService."""
    client, _ = client_and_app
    response = await client.get("/agents/productivity/meetings/.well-known/agent.json")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == MEETINGS_AGENT_ID
    assert agent_card["name"] == MEETINGS_AGENT_NAME
    # Add other relevant assertions from get_agent_card if needed,
    # as this endpoint now returns the full agent card.
    assert agent_card["description"] == MEETINGS_AGENT_DESCRIPTION
    assert agent_card["version"] == MEETINGS_AGENT_VERSION
    assert "/agents/productivity/meetings/tasks" in agent_card["endpoints"]

@pytest.mark.asyncio
async def test_meetings_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for MeetingsAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Okay, I've drafted a meeting agenda for your project kick-off."

    try:
        actual_meetings_context_content = MEETINGS_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Meetings context file not found at {MEETINGS_CONTEXT_FILE_PATH}")

    # This is typically the mcp_client instance method that the service calls.
    # Based on MCPContextAgentBaseService, this is likely mcp_client.send_message_to_agent
    mock_send_to_mcp = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path
        new_callable=AsyncMock,
        return_value="Okay, I've drafted a meeting agenda for your project kick-off." # query_agent_aggregate returns a string
    )

    user_query = "Help me draft an agenda for a project kick-off meeting."
    request_payload = TaskSendParams(
        id="test-task-123", # Provide a task ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )

    response = await client.post("/agents/productivity/meetings/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200 # Base service returns Task object which implies 200
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-123"
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    # Construct the expected prompt that MCPContextAgentBaseService sends
    # It's loaded_context + "\n\nUser Query: " + user_query
    # Ensure trailing newlines from file read don't affect the concatenation
    expected_prompt_for_mcp = f"{actual_meetings_context_content.rstrip('\n')}\n\nUser Query: {user_query}"

    mock_send_to_mcp.assert_called_once_with(
        agent_id=MEETINGS_MCP_TARGET_ID,
        user_query=expected_prompt_for_mcp,
        session_id="test-task-123" # Corrected: Expect session_id to be the task_id from TaskSendParams
    )

@pytest.mark.asyncio
async def test_meetings_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Can you schedule a meeting for tomorrow?"
    error_detail = "Failed to connect to MCP"
    
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    
    request_payload = TaskSendParams(
        id="test-task-conn-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/meetings/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200 # Base service should handle error and return Task
    response_data_full = response.json()
    
    assert response_data_full["id"] == "test-task-conn-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    # MCPContextAgentBaseService's _get_error_response_message creates this specific message
    # Update: The actual error message comes from A2AAgentBaseService's handle_task_send exception block
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_meetings_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Summarize the last meeting notes."
    error_detail = "Request to MCP timed out"

    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    
    request_payload = TaskSendParams(
        id="test-task-timeout-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/meetings/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-timeout-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_meetings_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What are the best practices for virtual meetings?"
    error_detail = "An MCP specific error occurred for meetings"
    
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    
    request_payload = TaskSendParams(
        id="test-task-mcp-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/meetings/tasks", json=request_payload.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert response_data_full["id"] == "test-task-mcp-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_meetings_process_message_unexpected_error_in_service(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Find available slots for a team meeting."
    error_detail_text = "Meetings specific unexpected service error"

    # This will mock the query_agent_aggregate method called by the service
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Corrected path to the actual MCPClient method
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail_text) # Simulate an unexpected error from the MCP call itself
    )
    
    request_payload = TaskSendParams(
        id="test-task-unexpected-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/meetings/tasks", json=request_payload.model_dump(mode='json'))
    
    # The main /tasks endpoint should catch this and return a 500 if not handled by base class to be a Task object
    # However, our current Meetings agent's /tasks route explicitly catches generic Exception and converts to 500.
    # The `handle_task_send` in `A2AAgentBaseService` (parent of `MCPContextAgentBaseService`)
    # is designed to catch exceptions from `process_message` and return a Task with FAILED state.
    
    assert response.status_code == 200 # Expecting the base class to handle it and return a Task
    response_data_full = response.json()

    assert response_data_full["id"] == "test-task-unexpected-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    
    # Message from A2AAgentBaseService's error handling
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 