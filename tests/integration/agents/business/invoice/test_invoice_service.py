import pytest
from unittest.mock import AsyncMock # Added for mocking
import httpx # For client type hint from client_and_app
from fastapi import FastAPI # For app type hint from client_and_app
from apps.api.agents.business.invoice.main import AGENT_ID, AGENT_NAME, AGENT_VERSION # Keep AGENT_ID etc.
from apps.api.a2a_protocol.types import Message, TextPart # For constructing expected messages
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError # For error testing

@pytest.mark.asyncio
async def test_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method by calling the /agent-card endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/business/invoice/agent-card") # Use the client from fixture
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == AGENT_ID
    assert agent_card["name"] == AGENT_NAME
    assert agent_card["version"] == AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert f"/agents/business/invoice/tasks" in agent_card["endpoints"] # Endpoint check
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == "query_invoice_info_via_mcp"

@pytest.mark.asyncio
async def test_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing via the /tasks endpoint with a mocked MCPClient."""
    client, _ = client_and_app 
    mocked_mcp_response = "The status of invoice #INV-001 is Paid."
    
    mock_query_aggregate = mocker.patch(
        "apps.api.agents.business.invoice.main.MCPClient.query_agent_aggregate", 
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "What is the status of invoice #INV-001?"
    request_payload = {
        "message": {
            "role": "user",
            "parts": [{"text": user_query}]
        }
    }

    response = await client.post("/agents/business/invoice/tasks", json=request_payload)

    assert response.status_code == 200
    response_data_full = response.json() 
    
    # Assertions updated to check response_message within the Task object
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    assert actual_response_text == mocked_mcp_response

    mock_query_aggregate.assert_called_once_with(
        agent_id="invoice_agent", 
        user_query=user_query,
        session_id=None 
    )

@pytest.mark.asyncio
async def test_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test how InvoiceService handles MCPConnectionError from MCPClient."""
    client, _ = client_and_app
    user_query = "What is my outstanding balance?"
    mocker.patch(
        "apps.api.agents.business.invoice.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError("Failed to connect to MCP")
    )

    response = await client.post("/agents/business/invoice/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})

    assert response.status_code == 200 
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = "Connection Error: Could not connect to the invoicing processing service (MCP). Please ensure it's running."
    # For errors directly from process_message, the text is directly in response_message.parts
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test how InvoiceService handles MCPTimeoutError from MCPClient."""
    client, _ = client_and_app
    user_query = "Can I get a copy of my last invoice?"
    mocker.patch(
        "apps.api.agents.business.invoice.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError("Request to MCP timed out")
    )

    response = await client.post("/agents/business/invoice/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = "The request to the invoicing processing service (MCP) timed out."
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test how InvoiceService handles a generic MCPError from MCPClient."""
    client, _ = client_and_app
    user_query = "Update my billing address."
    mocker.patch(
        "apps.api.agents.business.invoice.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError("An MCP specific error occurred", status_code=503)
    )

    response = await client.post("/agents/business/invoice/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert "Error from invoicing processing service (MCP): An MCP specific error occurred" in actual_response_text

@pytest.mark.asyncio
async def test_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test how InvoiceService handles an unexpected non-MCP error during MCPClient usage."""
    client, _ = client_and_app
    user_query = "What are the payment terms?"
    error_details = "Something unexpected went wrong"
    mocker.patch(
        "apps.api.agents.business.invoice.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_details) 
    )

    response = await client.post("/agents/business/invoice/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200 # Service handles error, returns 200 with error in Task
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    # Corrected expected message based on actual service code
    expected_service_error_message = "An unexpected error occurred while trying to reach the invoicing processing service (MCP)."
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message

# TODO: Add more tests:
# 1. Test `process_message` with various inputs (e.g., empty message parts, different message structures if applicable based on A2A protocol).
# 2. Test different parts of the `process_message` logic (e.g., empty message, non-text parts if applicable).
# (Item 4 from original TODO is now covered by the new error tests) 