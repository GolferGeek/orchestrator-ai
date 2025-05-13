from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def competitors_root():
    return {"agent": "competitors", "message": "Competitors agent is active"}

@router.get("/.well-known/agent.json")
async def get_competitors_agent_discovery():
    return {
        "name": "Competitors Agent",
        "description": "Gathers and analyzes information about competitors.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Competitors agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 