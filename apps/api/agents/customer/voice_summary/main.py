# apps/api/agents/customer/voice_summary/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def voice_summary_root():
    return {"agent": "voice_summary", "message": "Voice Summary agent is active"}

@router.get("/.well-known/agent.json")
async def get_voice_summary_agent_discovery():
    return {
        "name": "Voice Summary Agent",
        "description": "Summarizes voice interactions and calls.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Voice Summary agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 