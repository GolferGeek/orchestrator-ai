from datetime import datetime, timezone, UTC
from typing import Dict, Optional, List
import uuid

# Import shared types from a2a_protocol
from apps.api.v2.shared.contracts.generated.python.a2a_protocol import (
    Task, TaskStatus, TaskPriority, TaskSendParams, ArtifactPart, 
    UUIDModel, Timestamp, ErrorDetails, Message
)

# Import task store specific types
from apps.api.v2.shared.contracts.generated.python.task_store_types import (
    TaskConversation, TaskAndHistory
)

class TaskStoreService:
    """A2A Protocol compliant in-memory store for tasks and conversations."""

    def __init__(self):
        self._tasks: Dict[str, Task] = {}
        self._conversations: Dict[str, TaskConversation] = {}

    async def create_task(
        self,
        title: str,
        description: str,
        instructions: Optional[str] = None,
        task_id: Optional[str] = None,
        session_id: Optional[str] = None,
        created_by: Optional[str] = None,
        metadata: Optional[Dict[str, any]] = None,
    ) -> TaskAndHistory:
        """Creates a new A2A protocol compliant task."""
        now = datetime.now(timezone.utc)

        if not task_id:
            task_id = str(uuid.uuid4())
        
        if not created_by:
            created_by = str(uuid.uuid4())  # Default creator

        # Create A2A compliant task
        new_task = Task(
            id=UUIDModel(root=uuid.UUID(task_id)),
            title=title,
            description=description,
            instructions=instructions,
            status=TaskStatus.pending,
            priority=TaskPriority.normal,
            created_at=Timestamp(root=now),
            updated_at=Timestamp(root=now),
            created_by=UUIDModel(root=uuid.UUID(created_by)),
            metadata=metadata,
        )
        
        # Create separate conversation tracking
        conversation = TaskConversation(
            task_id=task_id,
            session_id=session_id,
            messages=[]
        )
        
        self._tasks[task_id] = new_task
        self._conversations[task_id] = conversation
        
        return TaskAndHistory(task=new_task, conversation=conversation)

    async def get_task(self, task_id: str) -> Optional[TaskAndHistory]:
        """Retrieves a task with its conversation history."""
        task = self._tasks.get(task_id)
        conversation = self._conversations.get(task_id)
        
        if task:
            return TaskAndHistory(task=task, conversation=conversation)
        return None

    async def update_task_status(
        self,
        task_id: str,
        new_status: TaskStatus,
        error_details: Optional[ErrorDetails] = None,
    ) -> Optional[TaskAndHistory]:
        """Updates task status following A2A protocol."""
        task = self._tasks.get(task_id)
        if not task:
            return None

        # Update task with new status
        task.status = new_status
        task.updated_at = Timestamp(root=datetime.now(timezone.utc))
        
        # Handle completion timing
        if new_status == TaskStatus.completed and task.estimated_duration:
            actual_duration = int((datetime.now(timezone.utc) - task.created_at.root).total_seconds())
            task.actual_duration = actual_duration
            
        # Handle error details
        if error_details:
            task.error_details = error_details
            
        self._tasks[task_id] = task
        conversation = self._conversations.get(task_id)
        
        return TaskAndHistory(task=task, conversation=conversation)

    async def add_message_to_conversation(
        self, 
        task_id: str, 
        message: Message
    ) -> Optional[TaskAndHistory]:
        """Adds a message to the task's conversation history."""
        task = self._tasks.get(task_id)
        conversation = self._conversations.get(task_id)
        
        if not task or not conversation:
            return None
            
        conversation.messages.append(message)
        self._conversations[task_id] = conversation
        
        return TaskAndHistory(task=task, conversation=conversation)

    async def add_task_artifact(
        self, 
        task_id: str, 
        artifact: ArtifactPart,
        is_input: bool = False
    ) -> Optional[TaskAndHistory]:
        """Adds an artifact to the task (input or output)."""
        task = self._tasks.get(task_id)
        if not task:
            return None
        
        if is_input:
            if task.input_artifacts is None:
                task.input_artifacts = []
            task.input_artifacts.append(artifact)
        else:
            if task.output_artifacts is None:
                task.output_artifacts = []
            task.output_artifacts.append(artifact)
            
        task.updated_at = Timestamp(root=datetime.now(timezone.utc))
        conversation = self._conversations.get(task_id)
        
        return TaskAndHistory(task=task, conversation=conversation)

    async def list_tasks(self) -> List[TaskAndHistory]:
        """Lists all tasks with their conversation history."""
        results = []
        for task_id, task in self._tasks.items():
            conversation = self._conversations.get(task_id)
            results.append(TaskAndHistory(task=task, conversation=conversation))
        return results

    # A2A Protocol specific methods
    async def send_task(self, send_params: TaskSendParams) -> str:
        """Sends a task following A2A protocol."""
        task = send_params.task
        task_id = str(task.id.root)
        
        # Store the task
        self._tasks[task_id] = task
        
        # Create conversation if it doesn't exist
        if task_id not in self._conversations:
            self._conversations[task_id] = TaskConversation(
                task_id=task_id,
                messages=[]
            )
            
        return task_id 