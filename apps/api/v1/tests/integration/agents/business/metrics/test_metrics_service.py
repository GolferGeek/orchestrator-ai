import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Metrics agent's main module
from apps.api.v1.agents.business.metrics.main import (
    AGENT_ID as METRICS_AGENT_ID,
    AGENT_NAME as METRICS_AGENT_NAME,
    AGENT_VERSION as METRICS_AGENT_VERSION,
    AGENT_DESCRIPTION as METRICS_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as METRICS_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as METRICS_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as METRICS_PRIMARY_CAPABILITY
)
from apps.api.v1.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.v1.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
API_V1_ROOT = Path(__file__).resolve().parents[5] # Corrected path to apps/api/v1/
METRICS_CONTEXT_FILE_PATH = API_V1_ROOT / "markdown_context" / METRICS_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_metrics_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MetricsService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/business/metrics/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == METRICS_AGENT_ID
    assert agent_card["name"] == METRICS_AGENT_NAME
    assert agent_card["description"] == METRICS_AGENT_DESCRIPTION
    assert agent_card["version"] == METRICS_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert f"/agents/business/{METRICS_AGENT_NAME}/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == METRICS_PRIMARY_CAPABILITY

@pytest.mark.asyncio
async def test_metrics_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for MetricsService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Total active users: 1500"
    
    # Read the actual metrics context content
    try:
        METRICS_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Metrics context file not found at {METRICS_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.v1.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "How many active users do we have?"
    task_id = "test-metrics-task-success-001" # Define a specific task_id
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    # Updated assertion to match the new architecture that passes user query directly without context
    mock_query_aggregate.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=user_query,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for connection error."
    task_id = "test-metrics-conn-err-002" # Define a specific task_id
    error_detail = "MCP connection failed."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.v1.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id # Expect the task_id used in payload
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for timeout error."
    task_id = "test-metrics-timeout-err-003" # Define a specific task_id
    error_detail = "Request to MCP timed out."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.v1.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id # Expect the task_id used in payload
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for generic MCP error."
    task_id = "test-metrics-generic-err-004" # Define a specific task_id
    error_detail = "An MCP specific error occurred."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.v1.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id # Expect the task_id used in payload
    )

@pytest.mark.asyncio
async def test_metrics_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for unexpected service error."
    task_id = "test-metrics-unexpected-err-005" # Define a specific task_id
    error_detail = "Something truly unexpected happened."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.v1.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) # Simulate an unexpected error
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id # Expect the task_id used in payload
    )

# Ensure TaskSendParams is imported if not already 