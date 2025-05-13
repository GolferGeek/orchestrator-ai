# apps/api/agents/business/invoice/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def invoice_root():
    return {"agent": "invoice", "message": "Invoice agent is active"}

@router.get("/.well-known/agent.json")
async def get_invoice_agent_discovery():
    return {
        "name": "Invoice Agent",
        "description": "Manages invoicing and billing.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get invoice agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 