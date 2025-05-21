from datetime import datetime, timezone, UTC
from typing import Dict, Optional, List
import uuid

from .types import Task, Message, TaskState, TaskStatus, TaskAndHistory, TaskSendParams, Artifact

class TaskStoreService:
    """In-memory store for tasks and their history."""

    def __init__(self):
        self._tasks: Dict[str, Task] = {}

    async def create_or_get_task(
        self,
        task_id: Optional[str],
        request_message: Message,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, any]] = None,
    ) -> TaskAndHistory:
        """Creates a new task or retrieves an existing one by ID."""
        now_iso = datetime.now(timezone.utc).isoformat()

        if task_id and task_id in self._tasks:
            # TODO: What should happen if a task with this ID already exists but we're trying to "create" it?
            # For now, just return the existing task. The A2A protocol might specify this behavior.
            # Or, if task_id is provided, it implies we are looking it up, not creating from message.
            # Let's assume for now create_or_get means if ID is given and exists, it's a get.
            # If ID is not given, or given and doesn't exist, it's a create.
            task = self._tasks[task_id]
            # Potentially update metadata or session_id if provided, or this could be an error.
            if metadata:
                task.metadata = {**(task.metadata or {}), **metadata}
            if session_id:
                task.session_id = session_id
            task.updated_at = now_iso
            return TaskAndHistory(task=task)

        # If no task_id is provided, or if provided ID is not found, create a new one.
        if not task_id:
            task_id = str(uuid.uuid4())
        
        initial_status = TaskStatus(
            state=TaskState.PENDING,
            timestamp=now_iso,
            message="Task created and pending processing."
        )
        
        new_task = Task(
            id=task_id,
            status=initial_status,
            request_message=request_message,
            session_id=session_id,
            metadata=metadata,
            history=[request_message], # Start history with the request message
            created_at=now_iso,
            updated_at=now_iso,
        )
        self._tasks[task_id] = new_task
        return TaskAndHistory(task=new_task)

    async def get_task(self, task_id: str) -> Optional[TaskAndHistory]:
        """Retrieves a task by its ID."""
        task = self._tasks.get(task_id)
        if task:
            return TaskAndHistory(task=task)
        return None

    async def update_task_status(
        self,
        task_id: str,
        new_state: TaskState,
        status_update_message: Optional[Message] = None, # Message from agent about this status change
        response_message: Optional[Message] = None # The final agent response for COMPLETED state
    ) -> Optional[TaskAndHistory]:
        """Updates the status of an existing task."""
        task = self._tasks.get(task_id)
        if not task:
            return None

        now_iso = datetime.now(timezone.utc).isoformat()
        
        task.status.state = new_state
        task.status.timestamp = now_iso
        if status_update_message:
            task.status.message = status_update_message.parts[0].text if status_update_message.parts and isinstance(status_update_message.parts[0], dict) and status_update_message.parts[0].get('type') == 'text' else "Status updated"
            if task.history:
                task.history.append(status_update_message)
            else:
                task.history = [status_update_message]
        
        if new_state == TaskState.COMPLETED and response_message:
            task.response_message = response_message
            # Optionally add response_message to history as well
            if task.history and response_message not in task.history:
                 task.history.append(response_message)

        task.updated_at = now_iso
        self._tasks[task_id] = task # Re-assign to ensure update if Task is truly immutable, though Pydantic models are mutable by default
        return TaskAndHistory(task=task)

    async def add_task_artifact(self, task_id: str, artifact: Artifact) -> Optional[TaskAndHistory]:
        task = self._tasks.get(task_id)
        if not task:
            return None
        
        if task.artifacts is None:
            task.artifacts = []
        task.artifacts.append(artifact)
        task.updated_at = datetime.now(timezone.utc).isoformat()
        return TaskAndHistory(task=task)

    # Placeholder for listing tasks if needed for admin/debug
    async def list_tasks(self) -> List[Task]:
        return list(self._tasks.values()) 