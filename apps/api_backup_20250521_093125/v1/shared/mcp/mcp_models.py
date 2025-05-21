from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class LLMSettings(BaseModel):
    model_name: str = Field(default="gpt-3.5-turbo", description="The language model to use.")
    temperature: float = Field(default=0.7, ge=0, le=2, description="Controls randomness. Lower is more deterministic.")
    max_tokens: int = Field(default=500, description="Maximum number of tokens to generate.")
    # Add other common LLM settings as needed, e.g., top_p

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str

class MCPRequest(BaseModel):
    user_query: str = Field(..., description="The user's query for the agent.")
    llm_settings: Optional[LLMSettings] = None
    conversation_history: Optional[List[ChatMessage]] = None

# Models for SSE event data structures (optional, but good for clarity)
class SSEContentChunk(BaseModel):
    type: Literal["content"] = "content"
    chunk: str

class SSEInfoMessage(BaseModel):
    type: Literal["info"] = "info"
    message: str

class SSEError(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str

class SSEEndOfStream(BaseModel):
    type: Literal["eos"] = "eos"
    message: Optional[str] = None

# A Pydantic model for the path parameter to ensure agent_id is provided
class AgentIDPath(BaseModel):
    agent_id: str = Field(..., description="The unique identifier for the agent.") 