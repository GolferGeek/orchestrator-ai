"""Response finalization node - Prepares final response with metadata"""

from typing import Dict, Any
import sys
import os
from datetime import datetime

# Add base services to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
agents_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))))
base_services_path = os.path.join(agents_dir, 'base/implementations/base-services/function/python')
sys.path.insert(0, base_services_path)

# Clean imports from base services
try:
    from progress_manager import emit_progress, emit_completion
    from workflow_state_manager import RequirementsWriterState, create_final_response
except ImportError as e:
    print(f"Error: Could not import from base services: {e}", file=sys.stderr)
    # Create minimal fallback implementations
    def emit_progress(task_id, step_name, step_index, total_steps, status, message=None):
        print(f"PROGRESS_FALLBACK: {step_name} - {status}", file=sys.stderr)
    
    def emit_completion(task_id, status, message):
        print(f"COMPLETION_FALLBACK: {task_id} - {status}", file=sys.stderr)
    
    class RequirementsWriterState:
        def __init__(self, state_dict):
            self.__dict__.update(state_dict)
        @property
        def task_id(self):
            return self.__dict__.get('metadata', {}).get('taskId', 'unknown')
    
    def create_final_response(state):
        return {"response": "Fallback final response", "metadata": {}}


async def finalize_response_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Finalize the response with metadata and emit completion"""
    
    print(f"DEBUG: finalize_response_node started with keys: {list(state_dict.keys())}", file=sys.stderr)
    
    state = RequirementsWriterState(state_dict)
    
    print(f"DEBUG: RequirementsWriterState created, task_id: {state.task_id}", file=sys.stderr)
    print(f"DEBUG: Document content available: {bool(getattr(state, 'document_content', None))}", file=sys.stderr)
    print(f"DEBUG: Document content length: {len(getattr(state, 'document_content', '')) if getattr(state, 'document_content', None) else 0}", file=sys.stderr)
    
    try:
        # Emit start event
        print(f"DEBUG: About to emit progress for finalize_response", file=sys.stderr)
        emit_progress(
            state.task_id,
            "finalize_response",
            8,
            9,
            "in_progress",
            "Finalizing response and preparing deliverables..."
        )
        print(f"DEBUG: Progress emitted successfully", file=sys.stderr)
        
        # Ensure we have content
        document_content = getattr(state, 'document_content', None)
        print(f"DEBUG: Checking document content: {bool(document_content)}", file=sys.stderr)
        if not document_content:
            error_msg = "No document content was generated"
            print(f"ERROR: {error_msg}", file=sys.stderr)
            try:
                state.set_error(error_msg)
                return state.to_dict()
            except Exception as error_set_error:
                print(f"ERROR: Failed to set error state: {error_set_error}", file=sys.stderr)
                return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}
        
        # Add final metadata
        print(f"DEBUG: About to add final metadata", file=sys.stderr)
        try:
            features = getattr(state, 'features', [])
            metadata = getattr(state, 'metadata', {})
            
            final_metadata = {
                'completion_timestamp': metadata.get('generated_at', datetime.now().isoformat()),
                'workflow_status': 'success',
                'total_workflow_steps': 9,
                'processing_method': 'real_llm_calls',
                'content_length': len(document_content),
                'features_identified': len(features),
                'document_sections': count_document_sections(document_content)
            }
            
            print(f"DEBUG: Final metadata created: {final_metadata}", file=sys.stderr)
            
            metadata.update(final_metadata)
            state.workflow_step = 'completed'
            
            print(f"DEBUG: Metadata updated successfully", file=sys.stderr)
        except Exception as metadata_error:
            print(f"ERROR: Failed to update final metadata: {metadata_error}", file=sys.stderr)
        
        # Emit completion events
        print(f"DEBUG: About to emit completion events", file=sys.stderr)
        try:
            emit_progress(
                state.task_id,
                "finalize_response",
                8,
                9,
                "completed",
                "Workflow completed successfully - Requirements document ready"
            )
            
            emit_completion(
                state.task_id,
                "completed",
                f"Requirements document generated successfully ({len(document_content)} characters)"
            )
            
            print(f"DEBUG: Completion events emitted successfully", file=sys.stderr)
        except Exception as completion_error:
            print(f"ERROR: Failed to emit completion events: {completion_error}", file=sys.stderr)
        
        # Return updated state
        print(f"DEBUG: About to return final state dictionary", file=sys.stderr)
        try:
            result = state.to_dict()
            print(f"DEBUG: Final state converted to dict successfully, keys: {list(result.keys())}", file=sys.stderr)
            return result
        except Exception as dict_error:
            print(f"ERROR: Failed to convert final state to dict: {dict_error}", file=sys.stderr)
            return {"error": f"Failed to convert final state: {dict_error}"}
        
    except Exception as e:
        error_msg = f"Finalization failed: {str(e)}"
        print(f"ERROR: Exception in finalize_response_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(getattr(state, 'task_id', 'unknown'), "finalize_response", 8, 9, "failed", error_msg)
        except Exception as emit_error:
            print(f"ERROR: Failed to emit error progress: {emit_error}", file=sys.stderr)
        
        try:
            state.set_error(error_msg)
            return state.to_dict()
        except Exception as state_error:
            print(f"ERROR: Failed to set error state: {state_error}", file=sys.stderr)
            return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}


def count_document_sections(content: str) -> int:
    """Count the number of sections in the document (based on markdown headers)"""
    if not content:
        return 0
    
    # Count markdown headers (# ## ###)
    import re
    headers = re.findall(r'^#+\s+', content, re.MULTILINE)
    return len(headers)


# For testing/development
if __name__ == "__main__":
    import asyncio
    
    test_state = {
        "userMessage": "Test requirements",
        "sessionId": "test-session",
        "metadata": {"taskId": "test-task"},
        "document_content": "# Test Document\n\n## Section 1\nContent here\n\n## Section 2\nMore content",
        "features": ["Feature 1", "Feature 2"],
        "document_type": "prd",
        "complexity": "medium"
    }
    
    async def test():
        result = await finalize_response_node(test_state)
        print("Final workflow step:", result.get('workflow_step'))
        print("Final metadata:", result.get('metadata', {}).get('document_sections'))
    
    asyncio.run(test())