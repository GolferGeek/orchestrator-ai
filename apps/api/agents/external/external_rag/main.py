from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def external_rag_root():
    return {"agent": "external_rag", "message": "External RAG agent is active"}

@router.get("/.well-known/agent.json")
async def get_external_rag_agent_discovery():
    return {
        "name": "External RAG Agent",
        "description": "Provides Retrieval Augmented Generation from external web sources.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get External RAG agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 