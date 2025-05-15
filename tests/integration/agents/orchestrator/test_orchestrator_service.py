import pytest
from unittest.mock import AsyncMock, patch, ANY
import uuid
import httpx # Required for AsyncClient type hint if not already present through other imports
from fastapi import FastAPI # Required for FastAPI type hint

# from apps.api.main import app # No longer need the global app instance here
from apps.api.agents.orchestrator.main import OrchestratorService, AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams, AgentCard, Task, TaskState, TaskStatus, TaskAndHistory
from apps.api.llm.openai_service import OpenAIService # For type hinting the mock

# Constants for Orchestrator Agent
# Defined directly as OrchestratorService doesn't expose them as top-level module constants in the same way
# AGENT_ID = ORCHESTRATOR_AGENT_ID # Use imported one
# AGENT_NAME = ORCHESTRATOR_AGENT_NAME # Use imported one
# AGENT_VERSION is imported

# Define expected ID and Name as literals based on OrchestratorService.get_agent_card()
EXPECTED_ORCHESTRATOR_AGENT_ID = "orchestrator-agent-v1"
EXPECTED_ORCHESTRATOR_AGENT_NAME = "Orchestrator Agent"

# The client_and_app fixture will be picked up from tests/integration/conftest.py
# Remove local client fixture: 
# @pytest.fixture(scope="module")
# def client():
#     return TestClient(app)

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_orchestrator_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    response = await client.get("/agents/orchestrator/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EXPECTED_ORCHESTRATOR_AGENT_ID
    assert agent_card["name"] == EXPECTED_ORCHESTRATOR_AGENT_NAME
    assert agent_card["version"] == AGENT_VERSION
    assert "/agents/orchestrator/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) >= 3
    capability_names = [cap["name"] for cap in agent_card["capabilities"]]
    assert "task_orchestration" in capability_names
    assert "basic_chat" in capability_names
    assert "metrics_delegation" in capability_names

@pytest.mark.asyncio
async def test_orchestrator_respond_directly(client_and_app: tuple[httpx.AsyncClient, FastAPI], mock_openai_service: AsyncMock, mocker: AsyncMock):
    mock_openai_service.decide_orchestration_action.reset_mock() # Reset for this test
    client, _ = client_and_app
    user_query = "What is a tomato?"
    expected_llm_response = "LLMs say: A tomato is a fruit, often used as a vegetable."
    
    mock_openai_service.decide_orchestration_action.return_value = {
        "action": "respond_directly", 
        "response_text": expected_llm_response
    }
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["response_message"]["parts"][0]["text"] == expected_llm_response
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_delegate_to_metrics(
    client_and_app: tuple[httpx.AsyncClient, FastAPI], 
    mock_openai_service: AsyncMock, 
    mocker: AsyncMock
):
    mock_openai_service.decide_orchestration_action.reset_mock() # Reset for this test
    client, _ = client_and_app
    user_query = "What are the current sales figures?"
    delegation_reason = "Query is about metrics."
    
    mock_openai_service.decide_orchestration_action.return_value = {
        "action": "delegate",
        "agent_id": "business/metrics",
        "reason": delegation_reason,
        "user_query_for_agent": user_query 
    }
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()

    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_clarify(client_and_app: tuple[httpx.AsyncClient, FastAPI], mock_openai_service: AsyncMock, mocker: AsyncMock):
    mock_openai_service.decide_orchestration_action.reset_mock() 
    client, _ = client_and_app
    user_query = "Tell me about stuff."
    llm_clarification_text = "Could you please specify what kind of stuff you are asking about?"
    
    mock_openai_service.decide_orchestration_action.return_value = {"action": "clarify", "response_text": llm_clarification_text}
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200
    response_data = response.json()
    
    expected_text = f"Clarification needed: {llm_clarification_text}"
    assert response_data["response_message"]["parts"][0]["text"] == expected_text
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_cannot_handle(client_and_app: tuple[httpx.AsyncClient, FastAPI], mock_openai_service: AsyncMock, mocker: AsyncMock):
    mock_openai_service.decide_orchestration_action.reset_mock() 
    client, _ = client_and_app
    user_query = "Solve world hunger."
    llm_reason_text = "I am an AI assistant and cannot handle such complex, real-world problems." # Renamed for clarity
    
    # Mock provides "reason" as Orchestrator uses llm_decision.get("reason", fallback)
    mock_openai_service.decide_orchestration_action.return_value = {"action": "cannot_handle", "reason": llm_reason_text}
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200
    response_data = response.json()
    
    # Corrected: Orchestrator prepends "I cannot handle this request: " to the reason from LLM decision
    expected_text = f"I cannot handle this request: {llm_reason_text}"
    assert response_data["response_message"]["parts"][0]["text"] == expected_text
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_unknown_llm_action(client_and_app: tuple[httpx.AsyncClient, FastAPI], mock_openai_service: AsyncMock, mocker: AsyncMock):
    mock_openai_service.decide_orchestration_action.reset_mock() # Reset for this test
    client, _ = client_and_app
    user_query = "What if the LLM returns a weird action?"
    mock_openai_service.decide_orchestration_action.return_value = {"action": "do_magic", "detail": "something strange"}
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200
    response_data = response.json()
    expected_text = "Orchestrator received an unknown action: do_magic. I cannot handle that yet."
    assert response_data["response_message"]["parts"][0]["text"] == expected_text
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_llm_call_exception(
    client_and_app: tuple[httpx.AsyncClient, FastAPI], 
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    mock_openai_service.decide_orchestration_action.reset_mock() # Reset for this test
    client, _ = client_and_app
    user_query = "Analyze this complex dataset."
    llm_error_message = "LLM service unavailable."
    
    mock_openai_service.decide_orchestration_action.side_effect = Exception(llm_error_message)
    mock_openai_service.decide_orchestration_action.return_value = None 

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200 # Base agent handles the error and returns 200 with error in Task
    response_data = response.json()
    expected_text = f"Falling back to rule-based processing due to LLM error: {llm_error_message}"
    # The error message is now in response_message.parts[0].text due to base_agent change
    assert response_data["response_message"]["parts"][0]["text"] == expected_text
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

    mock_openai_service.decide_orchestration_action.side_effect = None

@pytest.mark.asyncio
async def test_orchestrator_openai_service_not_available(
    client_and_app: tuple[httpx.AsyncClient, FastAPI], 
    mock_openai_service: AsyncMock,
    mocker: AsyncMock
):
    mock_openai_service.decide_orchestration_action.reset_mock() 
    client, _ = client_and_app
    user_query = "Summarize this document for me."
    
    mock_openai_service.decide_orchestration_action.return_value = None # Simulate LLM returning no decision
    mock_openai_service.decide_orchestration_action.side_effect = None

    task_params = create_simple_task_send_params(user_query)
    response = await client.post("/agents/orchestrator/tasks", json=task_params.model_dump(mode='json'))
    assert response.status_code == 200
    response_data = response.json()
    
    # Corrected: Orchestrator falls back to a simpler message when LLM decision is None
    expected_text = "I encountered an issue trying to understand your request. Please try again."
    assert response_data["response_message"]["parts"][0]["text"] == expected_text
    mock_openai_service.decide_orchestration_action.assert_called_once_with(user_query, mocker.ANY)

@pytest.mark.asyncio
async def test_orchestrator_cancel_task_not_found(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    task_id = str(uuid.uuid4())
    # Mock TaskStoreService.get_task to return None
    mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.get_task", new_callable=AsyncMock, return_value=None)
    
    response = await client.delete(f"/agents/orchestrator/tasks/{task_id}")
    # Expect 200 with specific body, not 404, as per A2AAgentBaseService.handle_task_cancel
    assert response.status_code == 200 
    response_data = response.json()
    assert response_data["id"] == task_id
    assert response_data["status"] == "not_found"
    assert response_data["message"] == "Task not found."

@pytest.mark.asyncio
async def test_orchestrator_cancel_task_already_completed(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    task_id = str(uuid.uuid4())
    
    # Mock TaskAndHistory for a completed task
    completed_task_mock = mocker.MagicMock(spec=TaskAndHistory)
    completed_task_mock.task = mocker.MagicMock(spec=Task)
    completed_task_mock.task.status = mocker.MagicMock(spec=TaskStatus)
    completed_task_mock.task.status.state = TaskState.COMPLETED # Enum member
    
    mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.get_task", new_callable=AsyncMock, return_value=completed_task_mock)
    mock_update_status = mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.update_task_status", new_callable=AsyncMock, return_value=True)
    
    response = await client.delete(f"/agents/orchestrator/tasks/{task_id}")
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "cancelled"
    assert response_data["message"] == "Task marked as cancelled." # Corrected expected message
    # Check that update_task_status was called to mark it as CANCELED
    mock_update_status.assert_called_once_with(
        task_id,
        TaskState.CANCELED, # Expecting the enum member
        status_update_message=mocker.ANY
    )

@pytest.mark.asyncio
async def test_orchestrator_cancel_task_already_cancelled(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    task_id = str(uuid.uuid4())

    # Mock TaskAndHistory for an already cancelled task
    cancelled_task_mock = mocker.MagicMock(spec=TaskAndHistory)
    cancelled_task_mock.task = mocker.MagicMock(spec=Task)
    cancelled_task_mock.task.status = mocker.MagicMock(spec=TaskStatus)
    cancelled_task_mock.task.status.state = TaskState.CANCELED # Enum member

    mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.get_task", new_callable=AsyncMock, return_value=cancelled_task_mock)
    mock_update_status = mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.update_task_status", new_callable=AsyncMock)
    
    response = await client.delete(f"/agents/orchestrator/tasks/{task_id}")
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "cancelled"
    # Updated expected message from A2AAgentBaseService.handle_task_cancel
    assert response_data["message"] == "Task was already cancelled."
    mock_update_status.assert_not_called() # Should not call update_task_status if already cancelled

@pytest.mark.asyncio
async def test_orchestrator_cancel_active_task(client_and_app: tuple[httpx.AsyncClient, FastAPI], mocker: AsyncMock):
    client, _ = client_and_app
    task_id = str(uuid.uuid4())

    # Mock TaskAndHistory for an active (e.g., WORKING) task
    active_task_mock = mocker.MagicMock(spec=TaskAndHistory)
    active_task_mock.task = mocker.MagicMock(spec=Task)
    active_task_mock.task.status = mocker.MagicMock(spec=TaskStatus)
    active_task_mock.task.status.state = TaskState.WORKING # Enum member
    
    mocker.patch("apps.api.a2a_protocol.task_store.TaskStoreService.get_task", new_callable=AsyncMock, return_value=active_task_mock)
    # Mock update_task_status to confirm it's called correctly
    # Assume it returns a TaskAndHistory object on success as per its signature
    updated_task_response_mock = mocker.MagicMock(spec=TaskAndHistory) 
    mock_update_status = mocker.patch(
        "apps.api.a2a_protocol.task_store.TaskStoreService.update_task_status", 
        new_callable=AsyncMock, 
        return_value=updated_task_response_mock # Simulate successful update
    )
    
    response = await client.delete(f"/agents/orchestrator/tasks/{task_id}")
    assert response.status_code == 200
    response_data = response.json()
    assert response_data["status"] == "cancelled"
    assert response_data["message"] == "Task cancelled successfully." # Corrected expected message
    
    mock_update_status.assert_called_once()
    # Assert that update_task_status was called with TaskState.CANCELED (the enum member)
    assert mock_update_status.call_args[0][0] == task_id
    assert mock_update_status.call_args[0][1] == TaskState.CANCELED
    assert isinstance(mock_update_status.call_args[1]["status_update_message"], Message)

# Next steps:
# 1. Delete old orchestrator test files. (Done)
# 2. Run tests for Invoice, Metrics, Orchestrator and fix any issues. 