from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def sop_root():
    return {"agent": "sop", "message": "SOP agent is active"}

@router.get("/.well-known/agent.json")
async def get_sop_agent_discovery():
    return {
        "name": "SOP Agent",
        "description": "Manages and retrieves Standard Operating Procedures.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get SOP agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 