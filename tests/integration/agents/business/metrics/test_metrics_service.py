import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
# Import only AGENT_VERSION as it's the only top-level constant
from apps.api.agents.business.metrics.main import AGENT_VERSION as METRICS_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Define expected ID and Name as literals based on MetricsService.get_agent_card()
EXPECTED_METRICS_AGENT_ID = "metrics-agent-v1"
EXPECTED_METRICS_AGENT_NAME = "Metrics Agent"

# Removed local client and metrics_service_instance fixtures

@pytest.mark.asyncio
async def test_get_metrics_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MetricsService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/business/metrics/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_METRICS_AGENT_ID
    assert agent_card["name"] == EXPECTED_METRICS_AGENT_NAME
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

    mock_query_aggregate.assert_called_once_with(
        agent_id="metrics_agent",
        user_query=user_query,
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
    expected_error_message = "Connection Error: Could not connect to the metrics processing service (MCP). Please ensure it's running."
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
    expected_error_message = "The request to the metrics processing service (MCP) timed out."
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
    assert "Error from metrics processing service (MCP): An MCP specific error occurred for metrics" in actual_response_text

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
    # Corrected expected message based on actual service code
    expected_service_error_message = "An unexpected error occurred while trying to reach the metrics processing service (MCP)."
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 