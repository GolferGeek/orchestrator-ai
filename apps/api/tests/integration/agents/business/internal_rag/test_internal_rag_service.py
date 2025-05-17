import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id
import asyncio # Added for E2E test
import uuid # Added for E2E test

# Import agent-specific constants from the Internal RAG agent's main module
from apps.api.agents.business.internal_rag.main import (
    AGENT_ID as INTERNAL_RAG_AGENT_ID,
    AGENT_NAME as INTERNAL_RAG_AGENT_NAME,
    AGENT_VERSION as INTERNAL_RAG_AGENT_VERSION,
    AGENT_DESCRIPTION as INTERNAL_RAG_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as INTERNAL_RAG_MCP_TARGET_ID,
    CONTEXT_FILE_NAME as INTERNAL_RAG_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as INTERNAL_RAG_PRIMARY_CAPABILITY
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[7] 
INTERNAL_RAG_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / INTERNAL_RAG_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_internal_rag_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of InternalRagAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/business/internal_rag/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == INTERNAL_RAG_AGENT_ID
    assert agent_card["name"] == INTERNAL_RAG_AGENT_NAME
    assert agent_card["description"] == INTERNAL_RAG_AGENT_DESCRIPTION
    assert agent_card["version"] == INTERNAL_RAG_AGENT_VERSION
    assert agent_card["type"] == "specialized"
    assert f"/agents/business/{INTERNAL_RAG_AGENT_NAME}/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == INTERNAL_RAG_PRIMARY_CAPABILITY

@pytest.mark.asyncio
async def test_internal_rag_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for InternalRagAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "The remote work policy states that employees can work remotely up to 3 days a week with manager approval."
    
    try:
        actual_internal_rag_context_content = INTERNAL_RAG_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Internal RAG context file not found at {INTERNAL_RAG_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "What is the company policy on remote work?"
    task_id = "test-internal-rag-task-success-001"
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_query_for_mcp = f"{actual_internal_rag_context_content}\n\nUser Query: {user_query}"
    mock_query_aggregate.assert_called_once_with(
        agent_id=INTERNAL_RAG_MCP_TARGET_ID, 
        user_query=expected_query_for_mcp,
        session_id=task_id 
    )

@pytest.mark.asyncio
async def test_internal_rag_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for connection error."
    task_id = "test-internal-rag-conn-err-002"
    error_detail = "MCP connection failed."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
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
        agent_id=INTERNAL_RAG_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_internal_rag_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for timeout error."
    task_id = "test-internal-rag-timeout-err-003"
    error_detail = "Request to MCP timed out."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
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
        agent_id=INTERNAL_RAG_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_internal_rag_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for generic MCP error."
    task_id = "test-internal-rag-generic-err-004"
    error_detail = "An MCP specific error occurred."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
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
        agent_id=INTERNAL_RAG_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    )

@pytest.mark.asyncio
async def test_internal_rag_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for unexpected service error."
    task_id = "test-internal-rag-unexpected-err-005"
    error_detail = "Something truly unexpected happened."
    mock_mcp_call = mocker.patch(
        "apps.api.agents.business.internal_rag.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) 
    )
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post("/agents/business/internal_rag/tasks", json=request_payload)
    assert response.status_code == 200 # Base service now handles and returns 200 with FAILED state
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

    mock_mcp_call.assert_called_once_with(
        agent_id=INTERNAL_RAG_MCP_TARGET_ID,
        user_query=ANY,
        session_id=task_id
    ) 

@pytest.mark.asyncio
async def test_create_and_get_internal_rag_task_e2e(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """
    End-to-end test for creating an internal RAG task and polling for its completion.
    """
    client, app = client_and_app

    user_query = "What is the company's official stance on using personal devices for work, and are there any security requirements I need to be aware of?"
    unique_task_id = str(uuid.uuid4())

    task_payload = TaskSendParams(
        id=unique_task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    # 1. Create the task
    response = await client.post(f"/agents/business/{INTERNAL_RAG_AGENT_NAME}/tasks", json=task_payload)
    assert response.status_code == 202
    
    task_creation_response_data = response.json()
    assert task_creation_response_data["id"] == unique_task_id
    assert task_creation_response_data["status"]["state"] == TaskState.QUEUED.value

    # 2. Poll for task completion
    max_retries = 45 # RAG might be slower
    retry_interval = 2 
    current_state = None

    for attempt in range(max_retries):
        await asyncio.sleep(retry_interval)
        response = await client.get(f"/agents/business/{INTERNAL_RAG_AGENT_NAME}/tasks/{unique_task_id}")
        
        if response.status_code == 200:
            task_status_data = response.json()
            current_state = task_status_data["status"]["state"]
            if current_state == TaskState.COMPLETED.value:
                break
            elif current_state == TaskState.FAILED.value:
                pytest.fail(f"Task {unique_task_id} failed. Details: {task_status_data.get('response_message')}")
        elif response.status_code == 404:
            print(f"Attempt {attempt + 1}: Task {unique_task_id} not found yet (404), retrying...")
            continue 
        else:
            pytest.fail(f"Unexpected status code {response.status_code} while polling task {unique_task_id}. Response: {response.text}")
    else: 
        pytest.fail(f"Task {unique_task_id} did not complete within the timeout. Last known state: {current_state}")

    # 3. Assertions on the completed task
    assert current_state == TaskState.COMPLETED.value
    
    completed_task_data = response.json()
    assert "response_message" in completed_task_data
    assert "parts" in completed_task_data["response_message"]
    assert len(completed_task_data["response_message"]["parts"]) > 0
    
    response_text = completed_task_data["response_message"]["parts"][0]["text"]
    assert response_text is not None
    assert response_text.strip() != ""
    assert "MCP returned no specific content." not in response_text
    assert "Falling back to rule-based processing due to LLM error" not in response_text

    # Specific assertions for internal RAG agent
    assert "personal devices" in response_text.lower() or "policy" in response_text.lower() or "security" in response_text.lower()
    
    print(f"Internal RAG Agent E2E Test - Task {unique_task_id} completed. Response: {response_text[:200]}...") 