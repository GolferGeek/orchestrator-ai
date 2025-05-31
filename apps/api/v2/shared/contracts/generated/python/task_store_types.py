from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

# Import shared types from a2a_protocol
from .a2a_protocol import Task, Message


class TaskConversation(BaseModel):
    """
    Conversation history for a task (V2 extension)
    """

    task_id: str = Field(..., description="Associated task ID")
    messages: List[Message] = Field(default=[], description="Conversation messages")
    session_id: Optional[str] = Field(None, description="Optional session ID")


class TaskAndHistory(BaseModel):
    """
    Task with conversation history wrapper
    """

    task: Task
    conversation: Optional[TaskConversation] = None
