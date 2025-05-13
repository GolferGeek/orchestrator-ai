# apps/api/agents/marketing/content/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def content_root():
    return {"agent": "content", "message": "Content agent is active"}

@router.get("/.well-known/agent.json")
async def get_content_agent_discovery():
    return {
        "name": "Content Agent",
        "description": "Generates and manages marketing content.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Content agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 