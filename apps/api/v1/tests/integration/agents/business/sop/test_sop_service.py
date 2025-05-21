import pytest
from unittest.mock import AsyncMock, ANY, patch # Added patch
import uuid
import httpx
from fastapi import FastAPI
from pathlib import Path # Added for context file loading

from apps.api.v1.agents.business.sop.main import (
    SopService, 
    AGENT_ID as SOP_AGENT_ID, 
    AGENT_NAME as SOP_AGENT_NAME, 
    AGENT_VERSION as SOP_AGENT_VERSION,
    MCP_TARGET_AGENT_ID, # Added
    CONTEXT_FILE_NAME, # Added
)
from apps.api.v1.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState # Moved TaskState import
from apps.api.v1.shared.mcp.mcp_client import MCPError, MCPConnectionError, MCPTimeoutError # Added for mocking side effects

# Fixtures like client_and_app and mock_openai_service_session_scope will be picked up from tests/integration/conftest.py
# No need for mock_openai_service_session_scope here as SOPService doesn't use OpenAIService

# Helper to load context for assertions
def load_test_context(context_file: str) -> str:
    # Path is now .../orchestrator-ai/apps/api/v1/tests/integration/agents/business/sop/test_sop_service.py
    # .parents[5] -> .../orchestrator-ai/apps/api/v1/
    api_v1_root = Path(__file__).resolve().parents[5]
    context_path = api_v1_root / "markdown_context" / context_file
    if not context_path.exists():
        # This fallback is likely not needed anymore if the primary path is correct
        raise FileNotFoundError(f"Context file {context_file} not found at {context_path}")
    return context_path.read_text()

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_sop_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get(f"/agents/business/procedurepro/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == SOP_AGENT_ID
    assert agent_card["name"] == SOP_AGENT_NAME
    assert agent_card["version"] == SOP_AGENT_VERSION
    assert f"/agents/business/procedurepro/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "query_sop_knowledge"

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_success(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What are the steps for employee onboarding?"
    expected_response_text = "Step 1: HR sends the welcome packet. Step 2: Manager schedules introductory meetings."
    mock_query_aggregate.return_value = expected_response_text
    
    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-123")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == expected_response_text
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=MCP_TARGET_AGENT_ID,
        user_query=user_query,
        session_id="test-sop-task-123"
    )

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_mcp_connection_error(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What are the steps for employee onboarding?"
    mock_query_aggregate.side_effect = MCPConnectionError("Connection error to MCP")
    
    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-conn-error")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=MCP_TARGET_AGENT_ID,
        user_query=user_query,
        session_id="test-sop-task-conn-error"
    )

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_mcp_timeout_error(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Query that times out"
    error_detail = "Test MCP Timeout Error Detail"
    mock_query_aggregate.side_effect = MCPTimeoutError(error_detail)

    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-expense")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))

    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_mcp_generic_error(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Query that causes generic MCP error"
    error_detail = "Test Generic MCP Error Detail"
    mock_query_aggregate.side_effect = MCPError(error_detail, status_code=500)

    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-generic-error")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))

    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.FAILED.value
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail}"
    assert actual_response_text == expected_error_message

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_expense_deadline(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What is the deadline for expense reports?"
    expected_response_text = "All expense reports must be submitted via the XpensePro portal by the 5th of the following month."
    mock_query_aggregate.return_value = expected_response_text
    
    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-expense")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == expected_response_text
    
    mock_query_aggregate.assert_called_once_with(
        agent_id=MCP_TARGET_AGENT_ID,
        user_query=user_query,
        session_id="test-sop-task-expense"
    )

@patch("apps.api.v1.shared.mcp.mcp_client.MCPClient.query_agent_aggregate", new_callable=AsyncMock)
async def test_sop_process_message_default_response(mock_query_aggregate: AsyncMock, client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Give me some SOP info"
    expected_response_text = "ProcedurePro is here to help with SOPs. What can I help you look up or understand today? For example, you can ask about 'employee onboarding' or 'expense reports'.... or anything else related to our SOPs!"
    mock_query_aggregate.return_value = expected_response_text

    task_params = create_simple_task_send_params(user_query, task_id="test-sop-task-default")
    response = await client.post("/agents/business/procedurepro/tasks", json=task_params.model_dump(mode='json'))

    assert response.status_code == 200
    response_data_full = response.json()
    assert response_data_full["status"]["state"] == TaskState.COMPLETED.value
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == expected_response_text

    mock_query_aggregate.assert_called_once_with(
        agent_id=MCP_TARGET_AGENT_ID,
        user_query=user_query,
        session_id="test-sop-task-default"
    ) 