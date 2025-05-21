import os
import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint

from apps.api.agents.development.requirements_writer.main import AGENT_VERSION as REQUIREMENTS_WRITER_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Define expected ID and Name as literals based on RequirementsWriterService.get_agent_card()
EXPECTED_REQUIREMENTS_WRITER_AGENT_ID = "requirements-writer-agent-v1"
EXPECTED_REQUIREMENTS_WRITER_AGENT_NAME = "Requirements Writer Agent"

@pytest.mark.asyncio
async def test_get_requirements_writer_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of RequirementsWriterService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/development/requirements_writer/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_REQUIREMENTS_WRITER_AGENT_ID
    assert agent_card["name"] == EXPECTED_REQUIREMENTS_WRITER_AGENT_NAME
    assert agent_card["version"] == REQUIREMENTS_WRITER_VERSION
    assert agent_card["type"] == "specialized"
    assert "/agents/development/requirements_writer/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 2  # We have two capabilities: generate and refine
    capabilities = {cap["name"]: cap["description"] for cap in agent_card["capabilities"]}
    assert "generate_requirements" in capabilities
    assert "refine_requirements" in capabilities

@pytest.mark.asyncio
async def test_requirements_writer_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for RequirementsWriterService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Here are the requirements for your login feature:\n1. The system shall allow users to log in using email and password\n2. The system shall provide password reset functionality"
    
    mock_query_aggregate = mocker.patch(
        "apps.api.agents.development.requirements_writer.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "Write requirements for a login feature"
    request_payload = TaskSendParams(
        id="test-req-task-123", 
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )

    response = await client.post("/agents/development/requirements_writer/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    mock_query_aggregate.assert_called_once_with(
        agent_id="requirements_writer_agent",
        user_query=user_query,
        session_id="test-req-task-123"
    )

@pytest.mark.asyncio
async def test_requirements_writer_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling of MCP connection error."""
    client, _ = client_and_app
    user_query = "Write requirements for user registration"
    mocker.patch(
        "apps.api.agents.development.requirements_writer.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError("Failed to connect to MCP")
    )
    request_payload = TaskSendParams(
        id="test-req-conn-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/development/requirements_writer/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = "Connection Error: Could not connect to the requirements processing service (MCP). Please ensure it's running."
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_requirements_writer_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling of MCP timeout error."""
    client, _ = client_and_app
    user_query = "Generate requirements for payment processing"
    mocker.patch(
        "apps.api.agents.development.requirements_writer.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError("Request to MCP timed out")
    )
    request_payload = TaskSendParams(
        id="test-req-timeout-error",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/development/requirements_writer/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = "The request to the requirements processing service (MCP) timed out."
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_requirements_writer_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling of generic MCP error."""
    client, _ = client_and_app
    user_query = "Create requirements for data backup system"
    mocker.patch(
        "apps.api.agents.development.requirements_writer.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError("An MCP specific error occurred for requirements", status_code=503)
    )
    response = await client.post("/agents/development/requirements_writer/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert "Error from requirements processing service (MCP): An MCP specific error occurred for requirements" in actual_response_text

@pytest.mark.asyncio
async def test_requirements_writer_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling of unexpected errors."""
    client, _ = client_and_app
    user_query = "Write requirements for user profile management"
    error_details = "Requirements writer specific unexpected error"
    mocker.patch(
        "apps.api.agents.development.requirements_writer.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_details)
    )
    response = await client.post("/agents/development/requirements_writer/tasks", json={"message": {"role": "user", "parts": [{"text": user_query}]}})
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    expected_service_error_message = "An unexpected error occurred while trying to reach the requirements processing service (MCP)."
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 