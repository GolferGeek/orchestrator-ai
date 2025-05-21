import pytest
from unittest.mock import AsyncMock
import httpx # For client type hint
from fastapi import FastAPI # For app type hint
from pathlib import Path # For loading context file
from unittest.mock import ANY # For asserting generated task_id

# Import agent-specific constants from the Metrics agent's service module or main
from apps.api.agents.business.metrics.service import MetricsAgentService # Import the new service

# Use attributes from the NEW service class for constants
METRICS_AGENT_ID = MetricsAgentService.agent_id
METRICS_DISPLAY_NAME = MetricsAgentService.display_name # Correct constant for display name
METRICS_AGENT_NAME = MetricsAgentService.agent_name # Short name for path
METRICS_AGENT_VERSION = MetricsAgentService.agent_version
METRICS_AGENT_DESCRIPTION = MetricsAgentService.agent_description
METRICS_MCP_TARGET_ID = MetricsAgentService.MCP_TARGET_AGENT_ID
METRICS_CONTEXT_FILE = MetricsAgentService.CONTEXT_FILE_NAME

from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, TaskState
from apps.api.shared.mcp.mcp_client import MCPConnectionError, MCPTimeoutError, MCPError

# Helper to get project root for loading the context file in tests
PROJECT_ROOT = Path(__file__).resolve().parents[7] # Corrected: agents/business/metrics/tests/integration -> metrics -> business -> agents -> api -> apps -> orchestrator-ai
METRICS_CONTEXT_FILE_PATH = PROJECT_ROOT / "markdown_context" / METRICS_CONTEXT_FILE

@pytest.mark.asyncio
async def test_get_metrics_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the get_agent_card method of MetricsAgentService via endpoint."""
    client, _ = client_and_app
    response = await client.get(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/agent-card") # Use new path
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == METRICS_AGENT_ID
    # Assert against the display_name for the "name" field in AgentCard Pydantic model
    assert agent_card["name"] == METRICS_DISPLAY_NAME 
    assert agent_card["description"] == METRICS_AGENT_DESCRIPTION
    assert agent_card["version"] == METRICS_AGENT_VERSION
    # Type is now "unified" as it inherits from A2AUnifiedAgentService
    assert agent_card["type"] == "unified" 
    # Endpoints will be structured by the new service
    assert f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) > 0 
    # Check primary capability based on service definition
    assert agent_card["capabilities"][0]["name"] == "metrics_analysis"
    
    # Check for additional capabilities we defined
    capabilities = {cap["name"]: cap["description"] for cap in agent_card["capabilities"]}
    assert "data_visualization_preparation" in capabilities
    assert "trend_reporting" in capabilities
    assert "custom_query_execution" in capabilities

@pytest.mark.asyncio
async def test_metrics_process_message_success(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test successful message processing for MetricsService via /tasks endpoint."""
    client, _ = client_and_app
    mocked_mcp_response = "Total active users: 1500"
    
    # Read the actual metrics context content
    try:
        METRICS_CONTEXT_FILE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        pytest.fail(f"Test setup error: Metrics context file not found at {METRICS_CONTEXT_FILE_PATH}")

    mock_query_aggregate = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mocked_mcp_response
    )

    user_query = "How many active users do we have?"
    task_id = "test-metrics-task-success-001" # Define a specific task_id
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')

    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data_full = response.json()
    assert "response_message" in response_data_full
    assert "parts" in response_data_full["response_message"]
    assert len(response_data_full["response_message"]["parts"]) >= 1
    actual_response_text = response_data_full["response_message"]["parts"][0]["text"]
    assert actual_response_text == mocked_mcp_response

    # Updated assertion to match the new architecture that passes user query directly without context
    mock_query_aggregate.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=ANY
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_connection_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for connection error."
    task_id = "test-metrics-conn-err-002" # Define a specific task_id
    error_detail = "MCP connection failed."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPConnectionError(error_detail)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert len(response_data["response_message"]["parts"]) >= 1
    actual_response_text = response_data["response_message"]["parts"][0]["text"]
    assert "MCP Connection Error" in actual_response_text

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=ANY
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_timeout_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for timeout error."
    task_id = "test-metrics-timeout-err-003" # Define a specific task_id
    error_detail = "Request to MCP timed out."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPTimeoutError(error_detail)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert len(response_data["response_message"]["parts"]) >= 1
    actual_response_text = response_data["response_message"]["parts"][0]["text"]
    assert "MCP Timeout Error" in actual_response_text

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=ANY
    )

@pytest.mark.asyncio
async def test_metrics_process_message_mcp_generic_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for generic MCP error."
    task_id = "test-metrics-generic-err-004" # Define a specific task_id
    error_detail = "An MCP specific error occurred."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=MCPError(error_detail, status_code=503)
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert len(response_data["response_message"]["parts"]) >= 1
    actual_response_text = response_data["response_message"]["parts"][0]["text"]
    assert "MCP Error" in actual_response_text

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=ANY
    )

@pytest.mark.asyncio
async def test_metrics_process_message_unexpected_error(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    user_query = "Query for unexpected service error."
    task_id = "test-metrics-unexpected-err-005" # Define a specific task_id
    error_detail = "Something truly unexpected happened."
    # Correctly capture the mock object returned by mocker.patch
    mock_mcp_call = mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        side_effect=ValueError(error_detail) # Simulate an unexpected error
    )
    request_payload = TaskSendParams( # Use TaskSendParams
        id=task_id,
        message=Message(role="user", parts=[TextPart(text=user_query)])
    ).model_dump(mode='json')
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert len(response_data["response_message"]["parts"]) >= 1
    actual_response_text = response_data["response_message"]["parts"][0]["text"]
    assert "An unexpected error occurred" in actual_response_text

    # Use the correctly captured mock object for assertion
    mock_mcp_call.assert_called_once_with(
        agent_id=METRICS_MCP_TARGET_ID,
        user_query=ANY,
        session_id=ANY
    )

@pytest.mark.asyncio
async def test_metrics_process_empty_message(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test handling of empty message parts."""
    client, _ = client_and_app
    task_id = "test-metrics-empty-msg-006"
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text="")])
    ).model_dump(mode='json')
    
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert "Please provide a valid query" in response_data["response_message"]["parts"][0]["text"]

@pytest.mark.asyncio
async def test_metrics_process_no_message_parts(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test handling of message with no parts."""
    client, _ = client_and_app
    task_id = "test-metrics-no-parts-007"
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[])
    ).model_dump(mode='json')
    
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"]["state"] == TaskState.FAILED.value
    assert response_data["response_message"]["role"] == "agent"
    assert "Please provide a valid query" in response_data["response_message"]["parts"][0]["text"]

@pytest.mark.asyncio
async def test_metrics_missing_mcp_target_id(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling of missing MCP_TARGET_AGENT_ID configuration."""
    client, _ = client_and_app
    task_id = "test-metrics-no-target-008"
    
    # Temporarily patch the MCP_TARGET_AGENT_ID to None
    original_target_id = MetricsAgentService.MCP_TARGET_AGENT_ID
    MetricsAgentService.MCP_TARGET_AGENT_ID = None
    
    try:
        request_payload = TaskSendParams(
            id=task_id,
            message=Message(role="user", parts=[TextPart(text="What are our current sales?")])
        ).model_dump(mode='json')
        
        response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
        assert response.status_code == 200
        response_data = response.json()
        assert response_data["status"]["state"] == TaskState.FAILED.value
        assert response_data["response_message"]["role"] == "agent"
        assert "not properly configured" in response_data["response_message"]["parts"][0]["text"]
    finally:
        # Restore the original MCP_TARGET_AGENT_ID
        MetricsAgentService.MCP_TARGET_AGENT_ID = original_target_id

@pytest.mark.asyncio
async def test_metrics_context_file_not_found(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    """Test handling when context file is not found."""
    client, _ = client_and_app
    task_id = "test-metrics-no-context-009"
    
    # Mock Path.exists to return False for context file
    mocker.patch('pathlib.Path.exists', return_value=False)
    
    # Mock the MCP response since we're testing context file handling
    mock_mcp_response = "Mocked response without context"
    mocker.patch(
        "apps.api.shared.mcp.mcp_client.MCPClient.query_agent_aggregate",
        new_callable=AsyncMock,
        return_value=mock_mcp_response
    )
    
    request_payload = TaskSendParams(
        id=task_id,
        message=Message(role="user", parts=[TextPart(text="What are our current sales?")])
    ).model_dump(mode='json')
    
    response = await client.post(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks", json=request_payload)
    assert response.status_code == 200
    response_data = response.json()
    # The request should still succeed even without context, as the MCP handles context loading
    assert response_data["status"]["state"] == TaskState.COMPLETED.value
    assert response_data["response_message"]["role"] == "agent"
    assert response_data["response_message"]["parts"][0]["text"] == mock_mcp_response

@pytest.mark.asyncio
async def test_metrics_agent_capabilities(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test that all expected capabilities are present in the agent card."""
    client, _ = client_and_app
    response = await client.get(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/agent-card")
    assert response.status_code == 200
    agent_card = response.json()
    
    # Get all capability names
    capability_names = {cap["name"] for cap in agent_card["capabilities"]}
    
    # Check for all expected capabilities
    expected_capabilities = {
        "metrics_analysis",  # Primary capability
        "data_visualization_preparation",
        "trend_reporting",
        "custom_query_execution"
    }
    
    assert capability_names == expected_capabilities
    
    # Verify descriptions for each capability
    capabilities_dict = {cap["name"]: cap["description"] for cap in agent_card["capabilities"]}
    assert "visualization" in capabilities_dict["data_visualization_preparation"].lower()
    assert "trends" in capabilities_dict["trend_reporting"].lower()
    assert "custom" in capabilities_dict["custom_query_execution"].lower()
    assert "metrics" in capabilities_dict["metrics_analysis"].lower()

@pytest.mark.asyncio
async def test_metrics_agent_discovery_well_known(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    """Test the /.well-known/agent.json endpoint for MetricsAgentService."""
    client, _ = client_and_app
    response = await client.get(f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/.well-known/agent.json")
    assert response.status_code == 200
    discovery = response.json()
    assert discovery["name"] == METRICS_DISPLAY_NAME
    assert discovery["description"] == METRICS_AGENT_DESCRIPTION
    assert discovery["version"] == METRICS_AGENT_VERSION
    assert discovery["api_version"] == "1.0.0"
    assert discovery["schema_version"] == "a2a-v1"
    assert f"/agents/{MetricsAgentService.department_name}/{METRICS_AGENT_NAME}/tasks" in discovery["endpoints"]
    assert len(discovery["capabilities"]) > 0
    assert "metrics_analysis" in discovery["capabilities"]  # Updated to match service implementation
    