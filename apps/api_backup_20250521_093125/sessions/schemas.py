# apps/api/sessions/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# For request to create a session
class SessionCreate(BaseModel):
    name: Optional[str] = None

# Base model for session data, used for responses
class SessionBase(BaseModel):
    id: UUID
    user_id: UUID
    name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Response model for a single session
class SessionResponse(SessionBase):
    pass

# Response model for listing multiple sessions
class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]
    count: int

# Message Schemas
class MessageBase(BaseModel):
    id: UUID
    session_id: UUID
    user_id: UUID # Redundant if session implies user, but good for direct RLS on messages
    role: str # 'user', 'assistant', 'system', 'tool'
    content: Optional[str] = None
    timestamp: datetime
    order: int
    metadata: Optional[dict] = None

    class Config:
        from_attributes = True

class MessageResponse(MessageBase):
    pass

class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    session_id: UUID
    count: int # Total messages in the session
    skip: int
    limit: int 