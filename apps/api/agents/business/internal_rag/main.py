from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def internal_rag_root():
    return {"agent": "internal_rag", "message": "Internal RAG agent is active"}

@router.get("/.well-known/agent.json")
async def get_internal_rag_agent_discovery():
    return {
        "name": "Internal RAG Agent",
        "description": "Provides Retrieval Augmented Generation from internal company documents.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Internal RAG agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 