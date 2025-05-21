import pytest
from unittest.mock import AsyncMock
import httpx  # For client type hint
from fastapi import FastAPI  # For app type hint

# Import AGENT_VERSION from the market_research agent's main.py
from apps.api.agents.external.market_research.main import AGENT_VERSION as MARKET_RESEARCH_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams # Ensure TaskSendParams is imported
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Define expected ID and Name based on MarketResearchService.get_agent_card()
EXPECTED_MARKET_RESEARCH_AGENT_ID = "market-research-agent-v1"
EXPECTED_MARKET_RESEARCH_AGENT_NAME = "Market Research Agent"

# The client_and_app fixture is expected to be provided by a conftest.py

@pytest.mark.asyncio
async def test_get_market_research_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MarketResearchService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/external/market_research/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_MARKET_RESEARCH_AGENT_ID
    assert agent_card["name"] == EXPECTED_MARKET_RESEARCH_AGENT_NAME
    assert agent_card["version"] == MARKET_RESEARCH_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert "/agents/external/market_research/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == "query_market_research_via_mcp"

@pytest.mark.asyncio
async def test_market_research_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for MarketResearchService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Global smartphone market to reach $1.5 trillion by 2027."
    
    # Mock the MCPClient's query_agent_aggregate method within the market_research agent's service
    mock_query_aggregate = mocker.patch(
        "apps.api.agents.external.market_research.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "What is the projected size of the global smartphone market?"
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-mr-task-123",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )

    response = await client.post("/agents/external/market_research/tasks", json=request_payload.model_dump(mode='json')) # Use model_dump
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    mock_query_aggregate.assert_called_once_with(
        agent_id="market_research_agent", # Ensure this matches the agent_id used in MarketResearchService
        user_query=user_query,
        session_id="test-mr-task-123"
    )

@pytest.mark.asyncio
async def test_market_research_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Competitor analysis for X?"
    mocker.patch(
        "apps.api.agents.external.market_research.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError("Failed to connect to MCP for market research")
    )
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-mr-conn-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/external/market_research/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    # Ensure this error message matches the one defined in MarketResearchService
    expected_error_message = "Connection Error: Could not connect to the market research processing service (MCP). Please ensure it's running."
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_market_research_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Latest trends in renewable energy?"
    mocker.patch(
        "apps.api.agents.external.market_research.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError("Request to MCP timed out for market research")
    )
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-mr-timeout-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/external/market_research/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    # Ensure this error message matches the one defined in MarketResearchService
    expected_error_message = "The request to the market research processing service (MCP) timed out."
    assert actual_response_text == expected_error_message

@pytest.mark.asyncio
async def test_market_research_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Consumer sentiment analysis on Y?"
    mocker.patch(
        "apps.api.agents.external.market_research.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError("An MCP specific error occurred for market research", status_code=503)
    )
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-mr-mcp-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/external/market_research/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    # Ensure this error message substring matches the one defined in MarketResearchService
    assert "Error from market research processing service (MCP): An MCP specific error occurred for market research" in actual_response_text

@pytest.mark.asyncio
async def test_market_research_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Market entry strategy for Z?"
    error_details = "Market research specific unexpected error"
    mocker.patch(
        "apps.api.agents.external.market_research.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_details) # Simulate an unexpected error
    )
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-mr-unexpected-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/external/market_research/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    # Ensure this error message matches the one defined in MarketResearchService
    expected_service_error_message = "An unexpected error occurred while trying to reach the market research processing service (MCP)."
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 