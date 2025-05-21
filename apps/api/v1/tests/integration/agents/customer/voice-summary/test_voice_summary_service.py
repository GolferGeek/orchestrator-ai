import pytest
from unittest.mock import AsyncMock, ANY
import uuid
import httpx
from fastapi import FastAPI

from apps.api.agents.customer.voice_summary.main import VoiceSummaryService, AGENT_ID as VS_AGENT_ID, AGENT_NAME as VS_AGENT_NAME, AGENT_VERSION as VS_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_voice_summary_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    # Path based on directory: customer/voice_summary
    response = await client.get(f"/agents/customer/voice_summary/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == VS_AGENT_ID
    assert agent_card["name"] == VS_AGENT_NAME
    assert agent_card["version"] == VS_AGENT_VERSION
    assert f"/agents/customer/voice_summary/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "summarize_conceptual_voice_interaction"

@pytest.mark.asyncio
async def test_voice_summary_process_message_simple_login_issue(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Caller: Jane Doe. Issue: Can't log in, password reset not working."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_summary/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]
    
    assert "- Caller: Jane Doe" in response_text
    assert "- Primary Issue/Reason: Password/Login Issue." in response_text
    assert "- Key Points Discussed:" in response_text
    assert "  - Password/Login Issue."
    assert "- Outcome/Resolution: (Not specified)" in response_text

@pytest.mark.asyncio
async def test_voice_summary_process_message_sales_call(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Tom from Beta Inc. called about pricing for enterprise. Requested a demo. Call back sales team this week."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_summary/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "- Caller: Tom (Beta)" in response_text # Parser might get this from 'Tom from Beta Inc.'
    assert "- Primary Issue/Reason: Sales Inquiry (Pricing/Demo)." in response_text
    assert "- Key Points Discussed:" in response_text
    assert "  - Sales Inquiry (Pricing/Demo)." in response_text
    assert "- Action Items:" in response_text
    assert "  - Call back to discuss pricing/demo - (Sales Team, This Week)" in response_text

@pytest.mark.asyncio
async def test_voice_summary_process_message_empty_input(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "[empty message]"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_summary/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "SummaryScribe ready. Please provide the conceptual transcript or notes" in response_text 