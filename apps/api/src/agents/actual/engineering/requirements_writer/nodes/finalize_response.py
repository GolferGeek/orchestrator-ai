"""Response finalization node - Prepares final response with metadata"""

from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.progress_manager import emit_progress, emit_completion
from utils.state_manager import RequirementsWriterState, create_final_response


async def finalize_response_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Finalize the response with metadata and emit completion"""
    
    state = RequirementsWriterState(state_dict)
    
    try:
        # Emit start event
        emit_progress(
            state.task_id,
            "finalize_response",
            8,
            9,
            "in_progress",
            "Finalizing response and preparing deliverables..."
        )
        
        # Ensure we have content
        if not state.document_content:
            state.set_error("No document content was generated")
            return state.to_dict()
        
        # Add final metadata
        final_metadata = {
            'completion_timestamp': state.metadata.get('generated_at'),
            'workflow_status': 'success',
            'total_workflow_steps': 9,
            'processing_method': 'real_llm_calls',
            'content_length': len(state.document_content),
            'features_identified': len(state.features),
            'document_sections': count_document_sections(state.document_content)
        }
        
        state.metadata.update(final_metadata)
        state.workflow_step = 'completed'
        
        # Emit completion events
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
            f"Requirements document generated successfully ({len(state.document_content)} characters)"
        )
        
        return state.to_dict()
        
    except Exception as e:
        error_msg = f"Finalization failed: {str(e)}"
        print(f"Error in finalize_response_node: {error_msg}", file=sys.stderr)
        
        emit_progress(state.task_id, "finalize_response", 8, 9, "failed", error_msg)
        
        state.set_error(error_msg)
        return state.to_dict()


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