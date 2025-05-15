import pytest
from unittest.mock import AsyncMock
import httpx
from fastapi import FastAPI

from apps.api.agents.external.external_rag.main import AGENT_VERSION as EXTERNAL_RAG_VERSION
from apps.api.a2a_protocol.types import Message, TextPart
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Define expected ID and Name as literals based on ExternalRAGService.get_agent_card()
EXPECTED_EXTERNAL_RAG_AGENT_ID = "external-rag-agent-v1"
EXPECTED_EXTERNAL_RAG_AGENT_NAME = "External RAG Agent"

@pytest.mark.asyncio
async def test_external_rag_discovery(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/agents/external/external_rag/.well-known/agent.json")
    assert response.status_code == 200
    discovery = response.json()
    assert discovery["name"] == EXPECTED_EXTERNAL_RAG_AGENT_NAME
    assert discovery["description"] is not None
    assert discovery["a2a_protocol_version"] == "0.1.0"
    assert discovery["endpoints"] # Should be a non-empty list
    assert len(discovery["endpoints"]) > 0
    # The previous check for a structured root endpoint is removed as AgentCard.endpoints is now List[str]
    # Verify the tasks endpoint string is present
    assert f"/agents/external/external_rag/tasks" in discovery["endpoints"]
    # root_endpoint = next((ep for ep in discovery["endpoints"] if ep["path"] == "/"), None)
    # assert root_endpoint is not None
    # assert root_endpoint["methods"] == ["GET"]

@pytest.mark.asyncio
async def test_external_rag_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/agents/external/external_rag/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_EXTERNAL_RAG_AGENT_ID
    assert agent_card["name"] == EXPECTED_EXTERNAL_RAG_AGENT_NAME
    assert agent_card["version"] == EXTERNAL_RAG_VERSION
    # tasks_endpoint = next((ep for ep in agent_card["endpoints"] if ep["path"] == "/tasks"), None)
    # assert tasks_endpoint is not None
    # assert "POST" in tasks_endpoint["methods"]
    # Revert to simple check for string presence as endpoints is List[str]
    assert f"/agents/external/external_rag/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 3
    capability_names = [cap["name"] for cap in agent_card["capabilities"]]
    assert "web_based_rag" in capability_names
    assert "dynamic_knowledge_retrieval" in capability_names
    assert "source_citation" in capability_names

@pytest.mark.asyncio
async def test_external_rag_process_message_success(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    client, _ = client_and_app
    test_query = "What are the latest developments in quantum computing?"
    expected_response = "Recent breakthroughs in quantum computing include improved error correction and increased qubit coherence times."
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock the MCPClient response using mocker
    mock_query_aggregate = mocker.patch(
        "apps.api.agents.external.external_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=expected_response
    )
    
    # Send the request
    response = await client.post(
        "/agents/external/external_rag/tasks",
        json={"message": message.model_dump(mode='json')}
    )
    
    # Verify the response
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["response_message"]["parts"][0]["text"] == expected_response
    mock_query_aggregate.assert_called_once_with(
        agent_id="external_rag_agent",
        user_query=test_query,
        session_id=None
    )

@pytest.mark.asyncio
async def test_external_rag_process_message_connection_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    client, _ = client_and_app
    test_query = "What are the emerging trends in AI?"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise connection error
    mocker.patch(
        "apps.api.agents.external.external_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError("Failed to connect")
    )
    
    # Send the request
    response = await client.post(
        "/agents/external/external_rag/tasks",
        json={"message": message.model_dump(mode='json')}
    )
    
    # Verify the response
    assert response.status_code == 200
    response_data = response.json()
    assert "Connection Error" in response_data["response_message"]["parts"][0]["text"]

@pytest.mark.asyncio
async def test_external_rag_process_message_timeout_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    client, _ = client_and_app
    test_query = "Explain the latest research in machine learning"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise timeout error
    mocker.patch(
        "apps.api.agents.external.external_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError("Request timed out")
    )
    
    # Send the request
    response = await client.post(
        "/agents/external/external_rag/tasks",
        json={"message": message.model_dump(mode='json')}
    )
    
    # Verify the response
    assert response.status_code == 200
    response_data = response.json()
    assert "timed out" in response_data["response_message"]["parts"][0]["text"].lower()

@pytest.mark.asyncio
async def test_external_rag_process_message_mcp_error(
    client_and_app: tuple[httpx.AsyncClient, FastAPI],
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    client, _ = client_and_app
    test_query = "What are the current developments in blockchain?"
    
    # Create a test message
    message = Message(
        role="user",
        parts=[TextPart(text=test_query)]
    )
    
    # Mock MCPClient to raise MCP error
    mocker.patch(
        "apps.api.agents.external.external_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError("Invalid response from MCP")
    )
    
    # Send the request
    response = await client.post(
        "/agents/external/external_rag/tasks",
        json={"message": message.model_dump(mode='json')}
    )
    
    # Verify the response
    assert response.status_code == 200
    response_data = response.json()
    assert "Error processing RAG request" in response_data["response_message"]["parts"][0]["text"] 