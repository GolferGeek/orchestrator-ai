from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def chat_support_root():
    return {"agent": "chat_support", "message": "Chat Support agent is active"}

@router.get("/.well-known/agent.json")
async def get_chat_support_agent_discovery():
    return {
        "name": "Chat Support Agent",
        "description": "Handles customer chat support interactions.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Chat Support agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 