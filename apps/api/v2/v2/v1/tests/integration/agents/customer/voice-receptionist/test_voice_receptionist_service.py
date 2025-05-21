import pytest
from unittest.mock import AsyncMock, ANY
import uuid
import httpx
from fastapi import FastAPI

from apps.api.agents.customer.voice_receptionist.main import VoiceReceptionistService, AGENT_ID as VR_AGENT_ID, AGENT_NAME as VR_AGENT_NAME, AGENT_VERSION as VR_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_voice_receptionist_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    # Path based on directory: customer/voice_receptionist
    response = await client.get(f"/agents/customer/voice_receptionist/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == VR_AGENT_ID
    assert agent_card["name"] == VR_AGENT_NAME
    assert agent_card["version"] == VR_AGENT_VERSION
    assert f"/agents/customer/voice_receptionist/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "simulate_voice_reception"

@pytest.mark.asyncio
async def test_voice_receptionist_process_message_greeting(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Hello"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_receptionist/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]
    
    assert "Thank you for calling Golfer Geek." in response_text
    assert "How may I direct your call?" in response_text

@pytest.mark.asyncio
async def test_voice_receptionist_process_message_sales_request(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "I want to talk to sales."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_receptionist/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "Connecting you to the Sales Department now." in response_text

@pytest.mark.asyncio
async def test_voice_receptionist_process_message_hours_request(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "What are your business hours?"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/voice_receptionist/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "Our business hours are Monday to Friday, from 9 AM to 5 PM Eastern Time." in response_text 