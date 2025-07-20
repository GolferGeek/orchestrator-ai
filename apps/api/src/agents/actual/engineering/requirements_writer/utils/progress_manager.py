"""Progress management utilities - wrapper for base services"""

import sys
import os

# Import from base services
base_services_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    'base/implementations/base-services/function/python'
)
sys.path.insert(0, base_services_dir)

try:
    from progress_manager import *
except ImportError as e:
    print(f"Warning: Could not import from base services: {e}", file=sys.stderr)
    # Fallback implementation
    import json
    from datetime import datetime
    from typing import Optional
    
    def emit_progress(task_id: str, step_name: str, step_index: int, total_steps: int, 
                     status: str, message: Optional[str] = None):
        """Emit progress event for real-time workflow visualization"""
        progress_event = {
            "type": "workflow_step_progress",
            "taskId": task_id,
            "stepName": step_name,
            "stepIndex": step_index,
            "totalSteps": total_steps,
            "status": status,
            "message": message or f"Step {step_index + 1} of {total_steps}: {step_name.replace('_', ' ').title()}",
            "timestamp": datetime.now().isoformat()
        }
        
        # Emit to stderr so it doesn't interfere with the final JSON response
        print(f"PROGRESS_EVENT: {json.dumps(progress_event)}", file=sys.stderr)
        sys.stderr.flush()
    
    
    def emit_completion(task_id: str, status: str = "completed", message: Optional[str] = None):
        """Emit task completion event"""
        completion_event = {
            "type": "task_completion",
            "taskId": task_id,
            "status": status,
            "message": message or "Task completed successfully",
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"COMPLETION_EVENT: {json.dumps(completion_event)}", file=sys.stderr)
        sys.stderr.flush()
    
    
    def format_step_message(step_name: str, action: str) -> str:
        """Format a step name into a readable message"""
        readable_name = step_name.replace('_', ' ').title()
        return f"{action} {readable_name}..."