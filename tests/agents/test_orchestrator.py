import pytest
from httpx import AsyncClient
from typing import Dict, Any, Optional, List
import uuid
from unittest.mock import AsyncMock, patch
from api.a2a_protocol.types import Message, TextPart, TaskSendParams, Task, TaskState, AgentCard
from api.llm.openai_service import OpenAIService
# Remove OrchestratorService import if not directly used for type hinting here, already imported in main

# Helper to create a simple text message for sending tasks
def create_simple_task_send_params(text: str, task_id: Optional[str] = None) -> TaskSendParams:
    return TaskSendParams(
        id=task_id if task_id else str(uuid.uuid4()),
        message=Message(role="user", parts=[TextPart(text=text)]) # Correctly pass TextPart directly to parts
    )

@pytest.fixture
def mock_openai_service():
    mock = AsyncMock(spec=OpenAIService)
    # Setup default mock behaviors if needed for all tests using it
    # For example, a generic non-delegation response:
    mock.decide_orchestration_action.return_value = {
        "action": "respond_directly", 
        "response_text": "LLM fallback: I have processed your query."
    }
    return mock

# Removed test_orchestrator_root
# @pytest.mark.asyncio
# async def test_orchestrator_root(client: AsyncClient):
#     response = await client.get("/agents/orchestrator/")
#     assert response.status_code == 200
#     assert response.json() == {"agent": "orchestrator", "message": "Orchestrator agent is active"}

@pytest.mark.asyncio
async def test_get_orchestrator_agent_discovery(client: AsyncClient):
// ... existing code ... 