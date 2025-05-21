import pytest
from unittest.mock import AsyncMock, ANY
import uuid
import httpx
from fastapi import FastAPI

from apps.api.v1.agents.customer.email_triage.main import EmailTriageService, AGENT_ID as EMAIL_TRIAGE_AGENT_ID, AGENT_NAME as EMAIL_TRIAGE_AGENT_NAME, AGENT_VERSION as EMAIL_TRIAGE_AGENT_VERSION
from apps.api.v1.a2a_protocol.types import Message, TextPart, TaskSendParams

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: str | None = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)])
    )

@pytest.mark.asyncio
async def test_email_triage_get_agent_card(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    # Path based on directory: customer/email_triage
    response = await client.get(f"/agents/customer/email_triage/agent-card") 
    assert response.status_code == 200
    agent_card = response.json()
    assert agent_card["id"] == EMAIL_TRIAGE_AGENT_ID
    assert agent_card["name"] == EMAIL_TRIAGE_AGENT_NAME
    assert agent_card["version"] == EMAIL_TRIAGE_AGENT_VERSION
    assert f"/agents/customer/email_triage/tasks" in agent_card["endpoints"]
    assert len(agent_card["capabilities"]) == 1
    assert agent_card["capabilities"][0]["name"] == "triage_conceptual_email"

@pytest.mark.asyncio
async def test_email_triage_process_message_invoice_overdue(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Subject: Invoice Overdue! From: accounting@client.com - Hi, our invoice #123 is overdue."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/email_triage/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]
    
    assert "Category: Invoice Question/Billing Issue" in response_text
    assert "Priority: High" in response_text
    assert "Suggested Action: Forward to your accounting department" in response_text
    assert "Sentiment: Urgent/Negative" in response_text

@pytest.mark.asyncio
async def test_email_triage_process_message_support_request(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Help! I cannot access my account, I think I am locked out."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/email_triage/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "Category: Support Request" in response_text
    assert "Priority: High" in response_text
    assert "Suggested Action: Escalate to Tier 2 Support" in response_text
    assert "Sentiment: Urgent, Negative" in response_text

@pytest.mark.asyncio
async def test_email_triage_process_message_general_inquiry(client_and_app: tuple[httpx.AsyncClient, FastAPI]):
    client, _ = client_and_app
    user_query = "Just wanted to say hi."
    
    task_params = create_simple_task_send_params(user_query)
    response = await client.post(f"/agents/customer/email_triage/tasks", json=task_params.model_dump(mode='json'))
    
    assert response.status_code == 200
    response_data = response.json()
    response_text = response_data["response_message"]["parts"][0]["text"]

    assert "Category: General Inquiry" in response_text
    assert "Priority: Medium" in response_text
    assert "Suggested Action: Review and assign manually." in response_text
    assert "Sentiment: Neutral" in response_text 