# apps/api/agents/hr/hr_assistant/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def hr_assistant_root():
    return {"agent": "hr_assistant", "message": "HR Assistant agent is active"}

@router.get("/.well-known/agent.json")
async def get_hr_assistant_agent_discovery():
    return {
        "name": "HR Assistant Agent",
        "description": "Provides assistance with HR-related queries and tasks.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get HR Assistant agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here
