import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Blog Post agent's main module
from apps.api.agents.marketing.blog_post.main import (
    AGENT_ID as BLOG_POST_AGENT_ID,
    AGENT_NAME as BLOG_POST_AGENT_NAME,
    AGENT_VERSION as BLOG_POST_AGENT_VERSION,
    AGENT_DESCRIPTION as BLOG_POST_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as BLOG_POST_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as BLOG_POST_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as BLOG_POST_PRIMARY_CAPABILITY
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[7] 
BLOG_POST_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / BLOG_POST_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_blog_post_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of BlogPostAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/marketing/blog_post/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == BLOG_POST_AGENT_ID
    assert agent_card["name"] == BLOG_POST_AGENT_NAME
    assert agent_card["description"] == BLOG_POST_AGENT_DESCRIPTION
    assert agent_card["version"] == BLOG_POST_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert f"/agents/marketing/{BLOG_POST_AGENT_NAME}/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == BLOG_POST_PRIMARY_CAPABILITY

@pytest.mark.asyncio
async def test_blog_post_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for BlogPostAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Here is your draft for the blog post about sustainable gardening."
    
    try:
        actual_blog_post_context_content = BLOG_POST_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Blog Post context file not found at {BLOG_POST_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.agents.marketing.blog_post.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "Write a blog post about sustainable gardening for beginners."
    task_id = "test-blog-post-task-success-001"
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    response = await client.post("/agents/marketing/blog_post/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_query_for_mcp = f"{actual_blog_post_context_content}\n\nUser Query: {user_query}"
    mock_query_aggregate.assert_called_once_with(
        agent_id=BLOG_POST_MCP_TARGET_ID, 
        user_query=expected_query_for_mcp,
        session_id=task_id 
    )

@pytest.mark.asyncio
async def test_blog_post_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for connection error."
    task_id = "test-blog-post-conn-err-002"
    error_detail = "MCP connection failed."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.marketing.blog_post.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/marketing/blog_post/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_mcp_call.assert_called_once_with(
        agent_id=BLOG_POST_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_blog_post_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for timeout error."
    task_id = "test-blog-post-timeout-err-003"
    error_detail = "Request to MCP timed out."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.marketing.blog_post.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/marketing/blog_post/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_mcp_call.assert_called_once_with(
        agent_id=BLOG_POST_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_blog_post_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for generic MCP error."
    task_id = "test-blog-post-generic-err-004"
    error_detail = "An MCP specific error occurred."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.marketing.blog_post.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/marketing/blog_post/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_mcp_call.assert_called_once_with(
        agent_id=BLOG_POST_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_blog_post_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for unexpected service error."
    task_id = "test-blog-post-unexpected-err-005"
    error_detail = "Something truly unexpected happened."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.marketing.blog_post.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) 
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/marketing/blog_post/tasks", json=request_payload)
    assert response.status_code == 200 # Base service now handles and returns 200 with FAILED state
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_mcp_call.assert_called_once_with(
        agent_id=BLOG_POST_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    ) 