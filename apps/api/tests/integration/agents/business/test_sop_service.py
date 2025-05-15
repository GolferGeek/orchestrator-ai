import pytest
from unittest.mock import AsyncMock, ANY # ANY might be useful for future mocks
import uuid
import httpx
from fastapi import FastAPI

from apps.api.agents.business.sop.main import SopService, AGENT_ID as SOP_AGENT_ID, AGENT_NAME as SOP_AGENT_NAME, AGENT_VERSION as SOP_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams

# Fixtures like client_and_app and mock_openai_service_session_scope will be picked up from tests/integration/conftest.py
# No need for mock_openai_service_session_scope here as SOPService doesn't use OpenAIService

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_sop_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    # Use the directory name 'sop' for the path, consistent with how main.py router is set up
    response = await client.get(f"/agents/business/sop/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == SOP_AGENT_ID # AGENT_ID itself is still 'sop_agent'
    assert agent_card["name"] == SOP_AGENT_NAME
    assert agent_card["version"] == SOP_AGENT_VERSION
    # Now check the corrected endpoint path
    assert f"/agents/business/sop/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "query_sop_knowledge"

@pytest.mark.asyncio
async def test_sop_process_message_employee_onboarding_first_step(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What is the first step for employee onboarding?"
    
    task_params = create_simple_task_send_params(user_query)
    # Use the directory name 'sop' for the path
    response = await client.post(f"/agents/business/sop/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    expected_response_text = "According to the conceptual Employee Onboarding SOP, Step 1 is: HR sends the welcome packet."
    assert response_data["response_message"]["parts"][0]["text"] == expected_response_text

@pytest.mark.asyncio
async def test_sop_process_message_expense_deadline(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What is the deadline for an expense report?"
    
    task_params = create_simple_task_send_params(user_query)
    # Use the directory name 'sop' for the path
    response = await client.post(f"/agents/business/sop/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    expected_response_text = "Based on the conceptual Expense Report SOP, all expense reports must be submitted via the XpensePro portal by the 5th of the following month."
    assert response_data["response_message"]["parts"][0]["text"] == expected_response_text

@pytest.mark.asyncio
async def test_sop_process_message_default_response(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Tell me something random."
    
    task_params = create_simple_task_send_params(user_query)
    # Use the directory name 'sop' for the path
    response = await client.post(f"/agents/business/sop/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    # Based on the SOPService logic for unhandled queries
    expected_response_text = f"ProcedurePro received: '{user_query}'. I can provide guidance on conceptual SOPs like Employee Onboarding, Expense Reports, and IT Support. How can I help with those?"
    assert response_data["response_message"]["parts"][0]["text"] == expected_response_text 