from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
# Assuming shared models are in shared.models
from shared.models.agent_responses import NormalResponse # Only NormalResponse is needed now

router = APIRouter()

class UserQuery(BaseModel):
    message: str
    user_id: str
    session_id: str
    # Potentially other fields like current_sticky_agent_id

@router.post("/chat")
async def handle_chat(query: UserQuery) -> NormalResponse: # Agent now only returns NormalResponse
    """
    Main chat handler for the customer support agent.
    """
    # Agent focuses only on its core task.
    # The orchestrator will handle decisions about switching agents.
    
    # (Actual LLM call or business logic for customer support would go here)
    response_text = f"Customer Support Agent: You said '{query.message}'. How can I assist you with this customer support issue?"
    return NormalResponse(text=response_text)

# Example of how this might be included in a main FastAPI app
# from fastapi import FastAPI
# app = FastAPI()
# app.include_router(router, prefix="/agents/customer_support_agent") 