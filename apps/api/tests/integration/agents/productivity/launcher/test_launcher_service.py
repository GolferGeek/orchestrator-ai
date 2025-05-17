import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Launcher agent's main module
from apps.api.agents.productivity.launcher.main import (
    AGENT_ID as LAUNCHER_AGENT_ID,
    AGENT_NAME as LAUNCHER_AGENT_NAME,
    AGENT_VERSION as LAUNCHER_AGENT_VERSION,
    AGENT_DESCRIPTION as LAUNCHER_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as LAUNCHER_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as LAUNCHER_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as LAUNCHER_PRIMARY_CAPABILITY # Added Primary Capability
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
# For .../productivity/launcher/test_launcher_service.py, parents[7] should be correct
PROJECT_ROOT = Path(__file__).resolve().parents[7] 
LAUNCHER_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / LAUNCHER_CONTEXT_FILE

# Note: The client_and_app fixture is provided globally from apps/api/tests/integration/conftest.py
# No need to redefine it here if it correctly loads all agent routers including the new launcher agent.

@pytest.mark.asyncio
async def test_get_launcher_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of LauncherAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/productivity/launcher/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == LAUNCHER_AGENT_ID
    assert agent_card["name"] == LAUNCHER_AGENT_NAME
    assert agent_card["description"] == LAUNCHER_AGENT_DESCRIPTION
    assert agent_card["version"] == LAUNCHER_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert "/agents/productivity/launcher/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == LAUNCHER_PRIMARY_CAPABILITY # Use the new constant

@pytest.mark.asyncio
async def test_launcher_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for LauncherAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Okay, routing your request to the Tasks Agent."
    
    try:
        actual_launcher_context_content = LAUNCHER_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Launcher context file not found at {LAUNCHER_CONTEXT_FILE_PATH}")

    # Path to the mocked method should be the shared MCPClient's method
    mock_send_to_mcp = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "I need to manage my tasks for today."
    # Use TaskSendParams for payload consistency
    request_payload = TaskSendParams(
        id="test-launch-task-123",
        message=Message(role="user", parts=[TextPart(text=user_query)])
        # session_id is omitted, so it will be None
    )

    response = await client.post("/agents/productivity/launcher/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()

    assert response_data_full["id"] == "test-launch-task-123"
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_prompt_for_mcp = f"{actual_launcher_context_content.rstrip('\n')}\n\nUser Query: {user_query}"
    mock_send_to_mcp.assert_called_once_with(
        agent_id=LAUNCHER_MCP_TARGET_ID, 
        user_query=expected_prompt_for_mcp,
        session_id=None # Base service passes TaskSendParams.session_id, which is None here
    )

@pytest.mark.asyncio
async def test_launcher_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Launch meeting scheduler."
    error_detail = "Failed to connect to MCP for launcher"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    request_payload = TaskSendParams(
        id="test-launch-conn-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/launcher/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["id"] == "test-launch-conn-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_launcher_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Start my focus timer workflow."
    error_detail = "Request to MCP timed out for launcher"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    request_payload = TaskSendParams(
        id="test-launch-timeout-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/launcher/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["id"] == "test-launch-timeout-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_launcher_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Initiate project 'Omega' setup."
    error_detail = "An MCP specific error occurred for launcher"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    request_payload = TaskSendParams(
        id="test-launch-mcp-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/launcher/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["id"] == "test-launch-mcp-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_launcher_process_message_unexpected_error_in_service(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "This request should cause an unhandled error in the launcher service."
    error_detail_text = "Launcher specific unexpected service error"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", # Mock the actual MCP call
        new_callable=AsyncMock,
        side_effect=RuntimeError(error_detail_text) # Simulate an unexpected runtime error from the call
    )
    request_payload = TaskSendParams(
        id="test-launch-unexpected-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/productivity/launcher/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200 # Base class should handle and return Task in FAILED state
    response_data_full = response.json()
    assert response_data_full["id"] == "test-launch-unexpected-error"
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert actual_response_text == expected_service_error_message 