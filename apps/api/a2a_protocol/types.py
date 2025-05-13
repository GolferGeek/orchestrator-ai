from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, RootModel
import uuid

class ErrorCode(Enum):
    ParseError = -32700
    InvalidRequest = -32600
    MethodNotFound = -32601
    InvalidParams = -32602
    InternalError = -32603
    TaskNotFound = -32000 # Example custom error
    # Add other specific error codes as needed

class JSONRPCError(Exception):
    code: ErrorCode
    message: str
    data: Optional[Any]

    def __init__(self, code: ErrorCode, message: str, data: Optional[Any] = None, *args):
        super().__init__(message, *args)
        self.code = code
        self.data = data

class AgentCapability(BaseModel):
    name: str
    description: Optional[str] = None
    # Add other capability-specific fields if necessary

class AgentCard(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    version: str
    capabilities: List[AgentCapability] = []
    type: Optional[str] = None  # "orchestrator" or "specialized" etc.
    endpoints: Optional[List[str]] = None  # API endpoints for the agent
    # Corresponds to the .well-known/agent.json, but can be more detailed
    # discovery_url: Optional[str] = None # Or embed discovery info directly

class TaskState(str, Enum):
    PENDING = "pending"
    WORKING = "working"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"

class TaskStatus(BaseModel):
    state: TaskState
    timestamp: str # ISO 8601 timestamp
    message: Optional[str] = None # Agent's message regarding this state

class TextPart(BaseModel):
    type: str = "text"
    text: str

class ImagePart(BaseModel):
    type: str = "image"
    url: str
    alt_text: Optional[str] = None

class ArtifactPart(BaseModel): # For more complex structured data
    type: str = "artifact_data" # or a more specific type like 'json', 'csv_inline' etc.
    content: Any 
    encoding: Optional[str] = None # e.g., 'base64' if content is binary

# Union of all possible Part types
Part = RootModel[Union[TextPart, ImagePart, ArtifactPart]]

class Artifact(BaseModel):
    name: str
    parts: List[Part]
    # metadata: Optional[Dict[str, Any]] = None # if needed

class Message(BaseModel):
    role: str  # "user", "agent", "system"
    parts: List[Part]
    artifacts: Optional[List[Artifact]] = None
    timestamp: Optional[str] = None # ISO 8601 timestamp
    metadata: Optional[Dict[str, Any]] = None

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: TaskStatus
    request_message: Message # The initial message that started the task
    response_message: Optional[Message] = None # Agent's final response
    history: Optional[List[Message]] = [] # Intermediate messages or logs
    artifacts: Optional[List[Artifact]] = []
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: str # ISO 8601
    updated_at: str # ISO 8601

class TaskSendParams(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message: Message
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# For TaskStoreService
class TaskAndHistory(BaseModel):
    task: Task
    # history can be part of the task object itself or separate like in your TS example
    # If history is just a list of messages, Task.history can be used.
    # If it's more structured, define here. For now, assuming Task.history suffices. 