import pytest
from unittest.mock import AsyncMock, ANY # Added ANY
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # Added Path for reading context file

# Import agent-specific constants from the HR Assistant agent's main module
from apps.api.agents.hr.hr_assistant.main import (
    AGENT_ID as HR_ASSISTANT_AGENT_ID,
    AGENT_NAME as HR_ASSISTANT_AGENT_NAME,
    AGENT_VERSION as HR_ASSISTANT_AGENT_VERSION,
    AGENT_DESCRIPTION as HR_ASSISTANT_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID_FOR_HR_QUERIES as HR_ASSISTANT_MCP_TARGET_ID, # Renamed in agent main
    HR_CONTEXT_FILE_NAME as HR_CONTEXT_FILE # Corrected constant name
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState # Added TaskState, TaskSendParams
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError # For error scenario testing

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[7] # Adjusted for hr/hr-assistant nesting
HR_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / HR_CONTEXT_FILE # Use the imported constant

@pytest.mark.asyncio
async def test_get_hr_assistant_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of HRAssistantService via the /agent-card endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/hr/hr_assistant/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == HR_ASSISTANT_AGENT_ID
    assert agent_card["name"] == HR_ASSISTANT_AGENT_NAME
    assert agent_card["description"] == HR_ASSISTANT_AGENT_DESCRIPTION
    assert agent_card["version"] == HR_ASSISTANT_AGENT_VERSION
    assert agent_card["type"] == "specialized" # As defined in HRAssistantService
    assert f"/agents/hr/hr_assistant/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == "query_hr_info_via_mcp"
    assert agent_card["capabilities"][0]["description"] == "Answers HR-related questions by relaying them to an MCP, using HR context."

@pytest.mark.asyncio
async def test_hr_assistant_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for HRAssistantService via the /tasks endpoint, using actual context."""
    client, _ = client_and_app
    mocked_mcp_response = "Your leave request policy information has been processed."
    
    # Read the actual HR context content for the assertion
    try:
        actual_hr_context_content = HR_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: HR context file not found at {HR_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.agents.hr.hr_assistant.main.MCPClient.query_agent_aggregate", 
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "What is the policy for parental leave?"
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-hr-task-123",
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )

    response = await client.post("/agents/hr/hr_assistant/tasks", json=request_payload.model_dump(mode='json')) # Use model_dump
    
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    expected_query_for_mcp = f"{actual_hr_context_content}\n\nUser Query: {user_query}"
    mock_query_aggregate.assert_called_once_with(
        agent_id=HR_ASSISTANT_MCP_TARGET_ID,
        user_query=expected_query_for_mcp,
        session_id="test-hr-task-123"  # Corrected: Expect session_id to be the task_id
    )

@pytest.mark.asyncio
async def test_hr_assistant_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test HRAssistantService handling of MCPConnectionError."""
    client, _ = client_and_app
    user_query = "How do I submit a timesheet?"
    error_detail = "Failed to connect to HR MCP"
    
    mocker.patch(
        "apps.api.agents.hr.hr_assistant.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )

    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-hr-conn-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/hr/hr_assistant/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    
    assert "response_message" in response_data_full
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value # Ensure task is in FAILED state

@pytest.mark.asyncio
async def test_hr_assistant_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test HRAssistantService handling of MCPTimeoutError."""
    client, _ = client_and_app
    user_query = "What are the company holidays for this year?"
    error_detail = "Request to HR MCP timed out"
    
    mocker.patch(
        "apps.api.agents.hr.hr_assistant.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )

    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-hr-timeout-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/hr/hr_assistant/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

@pytest.mark.asyncio
async def test_hr_assistant_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test HRAssistantService handling of a generic MCPError."""
    client, _ = client_and_app
    user_query = "Can you explain the performance review process?"
    error_detail = "A specific HR MCP error occurred"
    
    mocker.patch(
        "apps.api.agents.hr.hr_assistant.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )

    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-hr-mcp-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/hr/hr_assistant/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

@pytest.mark.asyncio
async def test_hr_assistant_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test HRAssistantService handling of an unexpected non-MCP error."""
    client, _ = client_and_app
    user_query = "Tell me about professional development opportunities."
    error_detail = "An unexpected issue in HR agent logic"
    
    mocker.patch(
        "apps.api.agents.hr.hr_assistant.main.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) 
    )

    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-hr-unexpected-error", # Example ID
        message=Message(role="user", parts=[TextPart(text=user_query)])
    )
    response = await client.post("/agents/hr/hr_assistant/tasks", json=request_payload.model_dump(mode='json'))
    assert response.status_code == 200
    response_data_full = response.json()
    
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {str(error_detail)}"
    assert actual_response_text == expected_service_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

# TODO: Consider adding tests for:
# 1. Different message structures in TaskRequestBody (e.g., empty parts, multiple parts if relevant).
# 2. Scenarios with session_id if its usage becomes more complex.
# 3. Validation errors if specific request body validation is added beyond Pydantic's default. 