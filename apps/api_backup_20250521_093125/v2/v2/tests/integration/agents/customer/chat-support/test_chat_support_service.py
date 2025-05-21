import pytest
from unittest.mock import AsyncMock, ANY
import uuid
import httpx
from fastapi import FastAPI

from apps.api.agents.customer.chat_support.main import ChatSupportService, AGENT_ID as CHAT_SUPPORT_AGENT_ID, AGENT_NAME as CHAT_SUPPORT_AGENT_NAME, AGENT_VERSION as CHAT_SUPPORT_AGENT_VERSION
from apps.api.a2a_protocol.types import Message, TextPart, TaskSendParams

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_chat_support_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    # Path based on directory: customer/chat_support
    response = await client.get(f"/agents/customer/chat_support/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == CHAT_SUPPORT_AGENT_ID
    assert agent_card["name"] == CHAT_SUPPORT_AGENT_NAME
    assert agent_card["version"] == CHAT_SUPPORT_AGENT_VERSION
    assert f"/agents/customer/chat_support/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "handle_support_inquiries"

@pytest.mark.asyncio
async def test_chat_support_process_message_greeting(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Hello"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/chat_support/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    # Less strict check since the exact response text may vary
    response_text = response_data["response_message"]["parts"][0]["text"]
    # Check for common greeting phrases rather than exact match
    assert any(greeting in response_text for greeting in ["Hi", "Hello", "Welcome"]) 
    assert "assist" in response_text.lower() or "help" in response_text.lower()

@pytest.mark.asyncio
async def test_chat_support_process_message_login_issue(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "I can't log in"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/chat_support/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    # Less strict check since the exact response text may vary
    response_text = response_data["response_message"]["parts"][0]["text"]
    assert "trouble logging in" in response_text.lower() or "log in" in response_text.lower()
    assert "error message" in response_text.lower() or "details" in response_text.lower() or "more" in response_text.lower()

@pytest.mark.asyncio
async def test_chat_support_process_message_login_issue_invalid_credentials(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "I can't log in, I see invalid credentials"
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/chat_support/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    
    # Less strict check since the exact response text may vary
    response_text = response_data["response_message"]["parts"][0]["text"]
    assert any(term in response_text.lower() for term in ["mismatch", "incorrect", "invalid credentials", "wrong password"])
    assert "password" in response_text.lower()
    assert "reset" in response_text.lower() or "forgot" in response_text.lower()