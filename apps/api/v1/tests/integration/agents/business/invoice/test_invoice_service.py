import pytest
from unittest.mock import AsyncMock, ANY
import httpx
from fastapi import FastAPI
from pathlib import Path

# Import agent-specific constants from the Invoice agent's main module
from apps.api.v1.agents.business.invoice.main import (
    AGENT_ID as INVOICE_AGENT_ID,
    AGENT_NAME as INVOICE_AGENT_NAME,
    AGENT_VERSION as INVOICE_AGENT_VERSION,
    AGENT_DESCRIPTION as INVOICE_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as INVOICE_MCP_TARGET_ID, # Corrected constant name
    CONTEXT_FILE_NAME as INVOICE_CONTEXT_FILE, # Corrected constant name
    # PRIMARY_CAPABILITY_NAME is also available but used directly in get_agent_card if needed
)
from apps.api.v1.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.v1.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Determine the project root based on the current file's location
# apps/api/v1/tests/integration/agents/business/invoice/test_invoice_service.py
# Corrected path to apps/api/v1/
API_V1_ROOT = Path(__file__).resolve().parents[5]
INVOICE_CONTEXT_FILE_PATH = API_V1_ROOT / "markdown_context" / INVOICE_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_invoice_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the /agent-card endpoint for the Invoice Agent."""
    client, _ = client_and_app
    response = await client.get("/agents/business/invoice/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == INVOICE_AGENT_ID
    assert agent_card["name"] == "invoice" # AGENT_NAME from main.py is now 'invoice'
    assert agent_card["version"] == INVOICE_AGENT_VERSION
    assert agent_card["description"] == INVOICE_AGENT_DESCRIPTION
    assert agent_card["type"] == "specialized"
    # Endpoint now includes department from base class logic
    assert f"/agents/business/invoice/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    # Assuming PRIMARY_CAPABILITY_NAME from main.py is "query_invoice_information"
    assert agent_card["capabilities"][0]["name"] == "query_invoice_information" 

@pytest.mark.asyncio
async def test_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing via the /tasks endpoint with a mocked MCPClient."""
    client, _ = client_and_app
    mocked_mcp_response = "The status of invoice #INV-001 is Paid."
    
    try:
        actual_context_content = INVOICE_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Invoice context file not found at {INVOICE_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        # The path to mcp_client used by the service is now within MCPContextAgentBaseService,
        # but we mock the instance method on the specific service that an instance of MCPClient will be on.
        # The actual MCPClient is instantiated in MCPContextAgentBaseService's __init__.
        # So we patch the mcp_client instance that will be used by *InvoiceService*.
        "apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "What is the status of invoice #INV-001?"
    task_id = "test-invoice-task-success-001"
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )

    response = await client.post("/agents/business/invoice/tasks", json=request_payload.model_dump(mode='json'))

    assert response.status_code == 200
    response_data_full = response.json()

    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]

    assert actual_response_text == mocked_mcp_response
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=INVOICE_MCP_TARGET_ID, # Use the constant from main.py
        user_query=user_query,
        session_id=task_id # Expecting task_id as session_id
    )

@pytest.mark.asyncio
async def test_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for connection error in invoice."
    task_id = "test-invoice-conn-err-002"
    error_detail = "MCP connection failed for invoice."
    
    # Path to mock is where MCPClient is *used* by the service instance
    mock_query_aggregate = mocker.patch(
        "apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/business/invoice/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200 # Base service handles error, returns 200 with error in Task
    response_data_full = response.json()
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    # MCPContextAgentBaseService returns this specific message format
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=INVOICE_MCP_TARGET_ID,
        user_query=ANY, # Context + query, exact match not critical for this error test
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Can I get a copy of my last invoice?"
    task_id = "test-invoice-timeout-003"
    error_detail = "Request to MCP timed out"

    mock_query_aggregate = mocker.patch(
        "apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )

    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/business/invoice/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_query_aggregate.assert_called_once_with(
        agent_id=INVOICE_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Update my billing address."
    task_id = "test-invoice-generic-err-004"
    error_detail = "An MCP specific error occurred"
    
    mock_query_aggregate = mocker.patch(
        "apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )

    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/business/invoice/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]

    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=INVOICE_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What are the payment terms?"
    task_id = "test-invoice-unexpected-err-005"
    error_detail = "Something unexpected went wrong"

    mock_query_aggregate = mocker.patch(
        "apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) 
    )

    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/business/invoice/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200 
    response_data_full = response.json()
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_query_aggregate.assert_called_once_with(
        agent_id=INVOICE_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

# TODO: Further tests could include:
# - Empty message parts or non-text parts if the protocol allows and needs specific handling.
# - Behavior when context file is missing (though base class should handle this gracefully).

# TODO: Add more tests:
# 1. Test `process_message` with various inputs (e.g., empty message parts, different message structures if applicable based on A2A protocol).
# 2. Test different parts of the `process_message` logic (e.g., empty message, non-text parts if applicable).
# (Item 4 from original TODO is now covered by the new error tests) 