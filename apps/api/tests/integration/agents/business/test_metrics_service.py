import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Metrics agent's main module
from apps.api.agents.business.metrics.main import (
    AGENT_ID as METRICS_AGENT_ID,
    AGENT_NAME as METRICS_AGENT_NAME,
    AGENT_VERSION as METRICS_AGENT_VERSION,
    AGENT_DESCRIPTION as METRICS_AGENT_DESCRIPTION, # Import new constant
    MCP_TARGET_AGENT_ID as METRICS_MCP_TARGET_ID,  # Import new constant
    CONTEXT_FILE_NAME as METRICS_CONTEXT_FILE    # Import new constant
)
from apps.api.a2a_protocol.types import Message, TextPart
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[6] # agents/business/tests/integration -> business -> agents -> api -> apps -> orchestrator-ai
METRICS_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / METRICS_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_metrics_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MetricsService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/business/metrics/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == METRICS_AGENT_ID
    assert agent_card["name"] == METRICS_AGENT_NAME
    assert agent_card["description"] == METRICS_AGENT_DESCRIPTION # Assert new constant
    assert agent_card["version"] == METRICS_AGENT_VERSION # This comes from the imported constant
    assert agent_card["type"] == "specialized"
    assert "/agents/business/metrics/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == "query_metrics_via_mcp"

@pytest.mark.asyncio
async def test_metrics_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for MetricsService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Total active users: 1500"
    
    # Read the actual metrics context content for the assertion
    try:
        actual_metrics_context_content = METRICS_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Metrics context file not found at {METRICS_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "How many active users do we have?"
    request_payload = {
        "message": {"role": "user", "parts": [{"text": user_query}]}
    }

    response = await client.post("/agents/business/metrics/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_query_for_mcp = f"{actual_metrics_context_content}\n\nUser Query: {user_query}"
    mock_query_aggregate.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID, # Use the constant
        user_query=expected_query_for_mcp,
        session_id=None
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What is the churn rate?"
    mocker.patch(
        "apps.api.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError("Failed to connect to MCP")
    )
    response = await client.post("/agents/business/metrics/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    error_detail = "Failed to connect to MCP" # Match the side_effect
    expected_error_message = f"Connection Error: Could not connect to the target processing service. Details: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Sales trend for last quarter?"
    mocker.patch(
        "apps.api.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError("Request to MCP timed out")
    )
    response = await client.post("/agents/business/metrics/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    error_detail = "Request to MCP timed out" # Match the side_effect
    expected_error_message = f"The request to the target processing service timed out. Details: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What is the MAU?"
    mocker.patch(
        "apps.api.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError("An MCP specific error occurred for metrics", status_code=503)
    )
    response = await client.post("/agents/business/metrics/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    error_detail = "An MCP specific error occurred for metrics" # Match the side_effect
    expected_error_message = f"Error from target processing service: {error_detail}"
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_metrics_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What is customer lifetime value?"
    error_details = "Metrics specific unexpected error"
    mocker.patch(
        "apps.api.agents.business.metrics.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_details)
    )
    response = await client.post("/agents/business/metrics/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    # error_details is defined in the test as "Metrics specific unexpected error"
    expected_service_error_message = f"An unexpected error occurred while trying to reach the target processing service. Details: {error_details}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 