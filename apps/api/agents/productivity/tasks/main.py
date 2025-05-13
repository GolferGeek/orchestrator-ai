# apps/api/agents/productivity/tasks/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def tasks_root():
    return {"agent": "tasks", "message": "Tasks agent is active"}

@router.get("/.well-known/agent.json")
async def get_tasks_agent_discovery():
    return {
        "name": "Tasks Agent",
        "description": "Manages tasks and to-do lists.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Tasks agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 