# apps/api/agents/customer/voice_receptionist/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def voice_receptionist_root():
    return {"agent": "voice_receptionist", "message": "Voice Receptionist agent is active"}

@router.get("/.well-known/agent.json")
async def get_voice_receptionist_agent_discovery():
    return {
        "name": "Voice Receptionist Agent",
        "description": "Acts as an automated voice receptionist.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Voice Receptionist agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 