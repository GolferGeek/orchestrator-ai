# apps/api/agents/marketing/calendar/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def calendar_root():
    return {"agent": "calendar", "message": "Calendar agent is active"}

@router.get("/.well-known/agent.json")
async def get_calendar_agent_discovery():
    return {
        "name": "Calendar Agent",
        "description": "Manages marketing calendars and schedules.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Calendar agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 