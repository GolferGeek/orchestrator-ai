import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Calendar agent's main module
from apps.api.agents.marketing.calendar.main import (
    AGENT_ID as CALENDAR_AGENT_ID,
    AGENT_NAME as CALENDAR_AGENT_NAME,
    AGENT_VERSION as CALENDAR_AGENT_VERSION,
    AGENT_DESCRIPTION as CALENDAR_AGENT_DESCRIPTION,
    MCP_TARGET_AGENT_ID as CALENDAR_MCP_TARGET_ID, 
    CONTEXT_FILE_NAME as CALENDAR_CONTEXT_FILE,
    PRIMARY_CAPABILITY_NAME as CALENDAR_PRIMARY_CAPABILITY 
)
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState # Ensure TaskSendParams is imported
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
# Corrected path for marketing/calendar: tests/integration/agents/marketing/calendar -> marketing -> agents -> api -> apps -> orchestrator-ai
PROJECT_ROOT = Path(__file__).resolve().parents[7] 
CALENDAR_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / CALENDAR_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_calendar_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of CalendarAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get("/agents/marketing/calendar/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == CALENDAR_AGENT_ID
    assert agent_card["name"] == CALENDAR_AGENT_NAME
    assert agent_card["description"] == CALENDAR_AGENT_DESCRIPTION 
    assert agent_card["version"] == CALENDAR_AGENT_VERSION 
    assert agent_card["type"] == "specialized"
    assert "/agents/marketing/calendar/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0
    assert agent_card["capabilities"][0]["name"] == CALENDAR_PRIMARY_CAPABILITY

@pytest.mark.asyncio
async def test_calendar_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for CalendarAgentService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Okay, I've scheduled the 'Summer Kickoff' webinar for next Friday."
    
    try:
        actual_calendar_context_content = CALENDAR_CONTEXT_FILE_PATH.read_text(encoding="utf-8").rstrip('\n')
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Calendar context file not found at {CALENDAR_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "Please schedule a webinar for the summer kickoff next Friday."
    # Construct payload using TaskSendParams
    request_payload = TaskSendParams(
        id="test-calendar-task-123", # Example task ID
        message=Message(role="user", parts=[TextPart(text=user_query)]),
        # include other TaskSendParams as needed, e.g., session_id, previous_task_id
    ).model_dump(exclude_none=True)

    response = await client.post("/agents/marketing/calendar/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    mock_query_aggregate.assert_called_once_with(
        agent_id=CALENDAR_MCP_TARGET_ID,
        user_query=user_query,
        session_id="test-calendar-task-123" # Should match the id from TaskSendParams
    )

@pytest.mark.asyncio
async def test_calendar_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What events are next week?"
    error_detail_text = "Failed to connect to MCP for calendar"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail_text)
    )
    request_payload = TaskSendParams(message=Message(role="user", parts=[TextPart(text=user_query)])).model_dump(exclude_none=True)
    response = await client.post("/agents/marketing/calendar/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

@pytest.mark.asyncio
async def test_calendar_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Is the Q3 campaign launch confirmed?"
    error_detail_text = "Request to MCP for calendar timed out"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail_text)
    )
    request_payload = TaskSendParams(message=Message(role="user", parts=[TextPart(text=user_query)])).model_dump(exclude_none=True)
    response = await client.post("/agents/marketing/calendar/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

@pytest.mark.asyncio
async def test_calendar_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Show me all webinars."
    error_detail_text = "An MCP specific error occurred for calendar"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail_text, status_code=503)
    )
    request_payload = TaskSendParams(message=Message(role="user", parts=[TextPart(text=user_query)])).model_dump(exclude_none=True)
    response = await client.post("/agents/marketing/calendar/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    expected_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert actual_response_text == expected_error_message
    assert response_data_full["status"]["state"] == TaskState.FAILED.value

@pytest.mark.asyncio
async def test_calendar_process_message_unexpected_error_in_service(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "What is the budget for the Christmas campaign?"
    error_detail_text = "Calendar service unexpected value error"
    # This mock simulates an error AFTER the MCPClient call, or if MCPClient is not called due to other logic,
    # or an error within the service's handling of the MCP response, or context loading etc.
    # For an error *during* the MCPClient.query_agent_aggregate, it's covered by the MCPError tests above.
    # We'll mock the query_agent_aggregate itself to cause an error as if from MCP client, for consistency with metrics test
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail_text) # Simulate an unexpected error from this call
    )
    request_payload = TaskSendParams(message=Message(role="user", parts=[TextPart(text=user_query)])).model_dump(exclude_none=True)
    response = await client.post("/agents/marketing/calendar/tasks", json=request_payload)
    assert response.status_code == 200 
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert response_data_full["response_message"]["role"] == "agent"
    expected_service_error_message = f"Falling back to rule-based processing due to LLM error: {error_detail_text}"
    assert response_data_full["response_message"]["parts"][0]["text"] == expected_service_error_message 
    assert response_data_full["status"]["state"] == TaskState.FAILED.value 