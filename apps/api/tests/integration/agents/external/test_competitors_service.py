import pytest
from unittest.mock import AsyncMock
import httpx
from fastapi import FastAPI

from apps.api.agents.external.competitors.main import AGENT_VERSION as COMPETITORS_VERSION
from apps.api.a2a_protocol.types import Message, TextPart
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Define expected ID and Name as literals based on CompetitorsService.get_agent_card()
EXPECTED_COMPETITORS_AGENT_ID = "competitors-agent-v1"
EXPECTED_COMPETITORS_AGENT_NAME = "Competitors Agent"

@pytest.mark.asyncio
async def test_competitors_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/agents/external/competitors/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_COMPETITORS_AGENT_ID
    assert agent_card["name"] == EXPECTED_COMPETITORS_AGENT_NAME
    assert agent_card["version"] == COMPETITORS_VERSION
    assert "/agents/external/competitors/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 3
    capability_names = [cap["name"] for cap in agent_card["capabilities"]]
    assert "query_competitor_info" in capability_names
    assert "compare_competitors" in capability_names
    assert "track_competitor_updates" in capability_names

@pytest.mark.asyncio
async def test_competitors_process_message_success(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock
):
    client, _ = client_and_app
    test_query = "Tell me about Innovatech Inc.'s products"
    expected_response = "Innovatech Inc. offers an AI-driven Analytics Suite and Cloud Data Solutions."
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock the MCPClient response
    with pytest.MonkeyPatch.context() as mp:
        mock_mcp = AsyncMock()
        mock_mcp.query_agent_aggregate.return_value = expected_response
        mp.setattr("apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", mock_mcp.query_agent_aggregate)
        
        # Send the request
        response = await client.post(
            "/agents/external/competitors/tasks",
            json={"message": message.model_dump(mode='json')}
        )
        
        # Verify the response
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["response_message"]["parts"][0]["text"] == expected_response
        mock_mcp.query_agent_aggregate.assert_called_once_with(
            agent_id="competitors_agent",
            user_query=test_query,
            session_id=None
        )

@pytest.mark.asyncio
async def test_competitors_process_message_connection_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock
):
    client, _ = client_and_app
    test_query = "What are our competitors' strengths?"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise connection error
    with pytest.MonkeyPatch.context() as mp:
        mock_mcp = AsyncMock()
        mock_mcp.query_agent_aggregate.side_effect = MCPConnectionError("Failed to connect")
        mp.setattr("apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", mock_mcp.query_agent_aggregate)
        
        # Send the request
        response = await client.post(
            "/agents/external/competitors/tasks",
            json={"message": message.model_dump(mode='json')}
        )
        
        # Verify the response
        assert response.status_code == 200
        response_data = response.json()
        assert "Connection Error" in response_data["response_message"]["parts"][0]["text"]
        mock_mcp.query_agent_aggregate.assert_called_once()

@pytest.mark.asyncio
async def test_competitors_process_message_timeout_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock
):
    client, _ = client_and_app
    test_query = "Compare our pricing with competitors"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise timeout error
    with pytest.MonkeyPatch.context() as mp:
        mock_mcp = AsyncMock()
        mock_mcp.query_agent_aggregate.side_effect = MCPTimeoutError("Request timed out")
        mp.setattr("apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", mock_mcp.query_agent_aggregate)
        
        # Send the request
        response = await client.post(
            "/agents/external/competitors/tasks",
            json={"message": message.model_dump(mode='json')}
        )
        
        # Verify the response
        assert response.status_code == 200
        response_data = response.json()
        assert "timed out" in response_data["response_message"]["parts"][0]["text"].lower()
        mock_mcp.query_agent_aggregate.assert_called_once()

@pytest.mark.asyncio
async def test_competitors_process_message_mcp_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock
):
    client, _ = client_and_app
    test_query = "Get competitor market share"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise MCP error
    with pytest.MonkeyPatch.context() as mp:
        mock_mcp = AsyncMock()
        mock_mcp.query_agent_aggregate.side_effect = MCPError("Invalid response from MCP")
        mp.setattr("apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", mock_mcp.query_agent_aggregate)
        
        # Send the request
        response = await client.post(
            "/agents/external/competitors/tasks",
            json={"message": message.model_dump(mode='json')}
        )
        
        # Verify the response
        assert response.status_code == 200
        response_data = response.json()
        assert "Error retrieving competitor information" in response_data["response_message"]["parts"][0]["text"]
        mock_mcp.query_agent_aggregate.assert_called_once() 