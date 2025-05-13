# apps/api/agents/customer/email_triage/main.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def email_triage_root():
    return {"agent": "email_triage", "message": "Email Triage agent is active"}

@router.get("/.well-known/agent.json")
async def get_email_triage_agent_discovery():
    return {
        "name": "Email Triage Agent",
        "description": "Triages and categorizes incoming customer emails.",
        "a2a_protocol_version": "0.1.0",
        "endpoints": [
            {
                "path": "/",
                "methods": ["GET"],
                "description": "Get Email Triage agent status."
            }
            # Add other specific endpoints for this agent
        ]
    }

# Add other agent-specific endpoints and logic here 