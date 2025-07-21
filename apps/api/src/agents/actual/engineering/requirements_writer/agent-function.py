#!/usr/bin/env python3
"""
Requirements Writer Agent Function - Modular LangGraph Implementation

This Python script handles requirements writing tasks using LangGraph with modular node architecture.
It processes user requests and generates comprehensive technical documentation using real LLM calls.
"""

import sys
import json
import os
from typing import Dict, Any
from datetime import datetime

# Add current directory and base services to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
base_services_dir = os.path.join(current_dir, '../../base/implementations/base-services/function/python')
sys.path.append(current_dir)
sys.path.append(base_services_dir)

# Import modular nodes
from nodes.analyze_request import analyze_request_node
from nodes.determine_type import determine_document_type_node
from nodes.extract_features import extract_features_node
from nodes.assess_complexity import assess_complexity_node
from nodes.generate_document import generate_document_node
from nodes.finalize_response import finalize_response_node

# Import base services
try:
    from progress_manager import emit_completion
    from workflow_state_manager import RequirementsWriterState
except ImportError as e:
    print(f"Warning: Could not import from base services: {e}", file=sys.stderr)
    # Create minimal fallback implementations
    def emit_completion(task_id, status, message):
        print(f"COMPLETION_FALLBACK: {task_id} - {status}", file=sys.stderr)
    
    class RequirementsWriterState:
        def __init__(self, state_dict):
            self.__dict__.update(state_dict)

# Import LangGraph components
try:
    from langgraph.graph import StateGraph, START, END
    LANGGRAPH_AVAILABLE = True
except ImportError as e:
    print(f"Warning: LangGraph dependencies not available: {e}", file=sys.stderr)
    # Fallback implementations for development
    class StateGraph:
        def __init__(self, state_schema): pass
        def add_node(self, name, func): pass
        def add_edge(self, source, target): pass
        def add_conditional_edges(self, source, condition, mapping): pass
        def set_entry_point(self, node): pass
        def set_finish_point(self, node): pass
        def compile(self): return self
        async def ainvoke(self, state): return await self._fallback_invoke(state)
        def invoke(self, state): return state
        async def _fallback_invoke(self, state):
            return await self._run_fallback_workflow(state)
        async def _run_fallback_workflow(self, state):
            # Simple sequential execution without LangGraph
            result = await analyze_request_node(state)
            result = await determine_document_type_node(result)
            result = await extract_features_node(result)
            result = await assess_complexity_node(result)
            result = await generate_document_node(result)
            result = await finalize_response_node(result)
            return result
    START = "START"
    END = "END"
    LANGGRAPH_AVAILABLE = False

# State is now managed by utils.state_manager.RequirementsWriterState


class RequirementsWriterWorkflow:
    """Modular LangGraph workflow for requirements writing with real LLM calls"""
    
    def __init__(self, task_id: str = None):
        """Initialize the workflow with modular node architecture"""
        self.task_id = task_id
        
        # Build the LangGraph workflow
        self.workflow = self._build_workflow()
    
    # Progress emission is now handled by utils.progress_manager
    
    def _build_workflow(self) -> StateGraph:
        """Build the modular LangGraph workflow with imported nodes"""
        
        # Create the state graph with dict schema for compatibility
        workflow = StateGraph(dict)
        
        # Add modular nodes (imported from nodes/ directory)
        workflow.add_node("analyze_request", self._wrap_async_node(analyze_request_node))
        workflow.add_node("determine_document_type", self._wrap_async_node(determine_document_type_node))
        workflow.add_node("extract_features", self._wrap_async_node(extract_features_node))
        workflow.add_node("assess_complexity", self._wrap_async_node(assess_complexity_node))
        workflow.add_node("generate_document", self._wrap_async_node(generate_document_node))
        workflow.add_node("finalize_response", self._wrap_async_node(finalize_response_node))
        workflow.add_node("handle_error", self._handle_error_node)
        
        # Set entry point
        workflow.set_entry_point("analyze_request")
        
        # Define the simplified workflow edges (6 core steps)
        workflow.add_edge("analyze_request", "determine_document_type")
        workflow.add_edge("determine_document_type", "extract_features")
        workflow.add_edge("extract_features", "assess_complexity")
        workflow.add_edge("assess_complexity", "generate_document")
        workflow.add_edge("generate_document", "finalize_response")
        
        # Add conditional edge for error handling
        workflow.add_conditional_edges(
            "finalize_response",
            self._should_handle_error,
            {
                "error": "handle_error",
                "success": END
            }
        )
        
        workflow.add_edge("handle_error", END)
        
        return workflow.compile()
    
    def _wrap_async_node(self, async_node_func):
        """Wrap async node functions for LangGraph compatibility"""
        def wrapper(state_dict: Dict[str, Any]) -> Dict[str, Any]:
            import asyncio
            try:
                # Run the async node function
                if asyncio.iscoroutinefunction(async_node_func):
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    result = loop.run_until_complete(async_node_func(state_dict))
                    loop.close()
                    return result
                else:
                    return async_node_func(state_dict)
            except Exception as e:
                print(f"Error in node {async_node_func.__name__}: {e}", file=sys.stderr)
                return {**state_dict, "error": str(e)}
        return wrapper
    
    # Node implementations moved to nodes/ directory
    
    def _handle_error_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Node: Handle errors and provide fallback response"""
        error_message = state.get("error", "Unknown error occurred")
        
        fallback_content = f"""# Requirements Document

## Error Notice
An error occurred during document generation: {error_message}

## Fallback Response
Based on your request: "{state.get('userMessage', 'No message provided')}"

Please try again with a more specific request, or contact support if the issue persists.

## Request Analysis
- Document Type: {state.get('document_type', 'Unknown')}
- Features Identified: {len(state.get('features', []))}
- Complexity: {state.get('complexity', 'Unknown')}
"""
        
        return {
            **state,
            "document_content": fallback_content,
            "workflow_step": "error_handled",
            "metadata": {
                **state.get("metadata", {}),
                "error_handled": True,
                "error_timestamp": datetime.now().isoformat()
            }
        }
    
    def _should_handle_error(self, state: Dict[str, Any]) -> str:
        """Conditional edge function: Determine if error handling is needed"""
        return "error" if state.get("error") else "success"


def main():
    """Main entry point for the modular requirements writer agent"""
    print("🔥 MAIN FUNCTION STARTED 🔥", file=sys.stderr)
    try:
        # Parse input from stdin
        print(f"MAIN_DEBUG: About to read from stdin", file=sys.stderr)
        input_raw = sys.stdin.read().strip()
        print(f"MAIN_DEBUG: Read {len(input_raw)} characters from stdin", file=sys.stderr)
        
        if not input_raw:
            print(f"MAIN_ERROR: No input provided from stdin", file=sys.stderr)
            print(json.dumps({"error": "No input provided"}))
            return
        
        print(f"MAIN_DEBUG: About to parse JSON input", file=sys.stderr)
        try:
            input_data = json.loads(input_raw)
            print(f"MAIN_DEBUG: Successfully parsed JSON input", file=sys.stderr)
        except Exception as json_error:
            print(f"MAIN_ERROR: Failed to parse JSON input: {json_error}", file=sys.stderr)
            print(f"MAIN_ERROR: Raw input was: {input_raw[:200]}...", file=sys.stderr)
            print(json.dumps({"error": f"Invalid JSON input: {json_error}"}))
            return
        
        # Debug: Print input data to stderr for debugging
        print(f"MAIN_DEBUG: Input data keys: {list(input_data.keys())}", file=sys.stderr)
        print(f"MAIN_DEBUG: userMessage: {input_data.get('userMessage', 'NOT_FOUND')}", file=sys.stderr)
        print(f"MAIN_DEBUG: prompt in originalParams: {input_data.get('metadata', {}).get('originalParams', {}).get('prompt', 'NOT_FOUND')}", file=sys.stderr)
        
        user_message = input_data.get('userMessage', '')
        session_id = input_data.get('sessionId', 'unknown')
        metadata = input_data.get('metadata', {})
        task_id = metadata.get('taskId', metadata.get('originalParams', {}).get('taskId', 'unknown'))
        
        print(f"MAIN_DEBUG: Extracted user_message: {user_message[:100]}...", file=sys.stderr)
        print(f"MAIN_DEBUG: Extracted session_id: {session_id}", file=sys.stderr)
        print(f"MAIN_DEBUG: Extracted task_id: {task_id}", file=sys.stderr)
        print(f"MAIN_DEBUG: Metadata keys: {list(metadata.keys())}", file=sys.stderr)
        
        # Initialize the modular LangGraph workflow
        print(f"MAIN_DEBUG: About to initialize RequirementsWriterWorkflow", file=sys.stderr)
        try:
            workflow_instance = RequirementsWriterWorkflow(task_id=task_id)
            print(f"MAIN_DEBUG: RequirementsWriterWorkflow initialized successfully", file=sys.stderr)
        except Exception as workflow_init_error:
            print(f"MAIN_ERROR: Failed to initialize workflow: {workflow_init_error}", file=sys.stderr)
            import traceback
            print(f"MAIN_ERROR: Workflow init traceback: {traceback.format_exc()}", file=sys.stderr)
            raise
        
        # Prepare initial state using dict (compatible with modular nodes)
        initial_state = {
            "userMessage": user_message,
            "sessionId": session_id,
            "metadata": metadata,
            "workflow_step": "initialized"
        }
        
        print(f"MAIN_DEBUG: Prepared initial state with keys: {list(initial_state.keys())}", file=sys.stderr)
        print(f"MAIN_DEBUG: Initial state userMessage length: {len(user_message)}", file=sys.stderr)
        print(f"MAIN_DEBUG: LangGraph available: {LANGGRAPH_AVAILABLE}", file=sys.stderr)
        print(f"MAIN_DEBUG: Workflow instance type: {type(workflow_instance)}", file=sys.stderr)
        print(f"MAIN_DEBUG: Workflow instance workflow type: {type(workflow_instance.workflow)}", file=sys.stderr)
        
        # Execute the modular LangGraph workflow
        print(f"MAIN_DEBUG: About to execute workflow", file=sys.stderr)
        start_time = datetime.now()
        try:
            if LANGGRAPH_AVAILABLE:
                print(f"MAIN_DEBUG: Executing with LangGraph using invoke()", file=sys.stderr)
                try:
                    final_state = workflow_instance.workflow.invoke(initial_state)
                    print(f"MAIN_DEBUG: LangGraph invoke() completed", file=sys.stderr)
                except Exception as langgraph_error:
                    print(f"MAIN_ERROR: LangGraph invoke() failed: {langgraph_error}", file=sys.stderr)
                    import traceback
                    print(f"MAIN_ERROR: LangGraph traceback: {traceback.format_exc()}", file=sys.stderr)
                    raise
            else:
                print(f"MAIN_DEBUG: Executing with fallback workflow", file=sys.stderr)
                # Fallback execution without LangGraph
                import asyncio
                print(f"MAIN_DEBUG: Creating new event loop for fallback", file=sys.stderr)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    print(f"MAIN_DEBUG: About to run fallback workflow with asyncio", file=sys.stderr)
                    final_state = loop.run_until_complete(workflow_instance.workflow._fallback_invoke(initial_state))
                    print(f"MAIN_DEBUG: Fallback workflow completed", file=sys.stderr)
                except Exception as fallback_error:
                    print(f"MAIN_ERROR: Fallback workflow failed: {fallback_error}", file=sys.stderr)
                    import traceback
                    print(f"MAIN_ERROR: Fallback traceback: {traceback.format_exc()}", file=sys.stderr)
                    raise
                finally:
                    loop.close()
                    print(f"MAIN_DEBUG: Event loop closed", file=sys.stderr)
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"MAIN_DEBUG: Workflow completed in {duration:.2f}s", file=sys.stderr)
            print(f"MAIN_DEBUG: Final state type: {type(final_state)}", file=sys.stderr)
            print(f"MAIN_DEBUG: Final state keys: {list(final_state.keys()) if isinstance(final_state, dict) else 'Not a dict'}", file=sys.stderr)
            if isinstance(final_state, dict) and 'document_content' in final_state:
                content_length = len(final_state['document_content']) if final_state['document_content'] else 0
                print(f"MAIN_DEBUG: Document content length: {content_length}", file=sys.stderr)
            
        except Exception as workflow_error:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"MAIN_ERROR: Workflow failed after {duration:.2f}s: {workflow_error}", file=sys.stderr)
            print(f"MAIN_ERROR: Workflow error type: {type(workflow_error)}", file=sys.stderr)
            import traceback
            print(f"MAIN_ERROR: Workflow traceback: {traceback.format_exc()}", file=sys.stderr)
            final_state = {"error": f"Workflow execution failed: {workflow_error}", **initial_state}
            print(f"MAIN_DEBUG: Created error final_state with keys: {list(final_state.keys())}", file=sys.stderr)
        
        # Format response using modular structure
        print(f"MAIN_DEBUG: About to format final response", file=sys.stderr)
        
        document_content = final_state.get("document_content", "No content generated")
        analysis = final_state.get("analysis", {})
        document_type = final_state.get("document_type", "general")
        complexity = final_state.get("complexity", "medium")
        features = final_state.get("features", [])
        workflow_step = final_state.get("workflow_step", "unknown")
        
        print(f"MAIN_DEBUG: Response components - content: {len(document_content)} chars, type: {document_type}, features: {len(features)}, step: {workflow_step}", file=sys.stderr)
        
        response = {
            "response": document_content,
            "analysis": analysis,
            "metadata": {
                "document_type": document_type,
                "complexity": complexity,
                "features": features,
                "workflow_step": workflow_step,
                "generated_at": datetime.now().isoformat(),
                "processing_type": "modular-langgraph-workflow",
                "processing_method": "real_llm_calls",
                "agent_type": "requirements_writer",
                "tools_used": ["langgraph", "real-llm-calls", "modular-nodes", "state-management"],
                "workflow_steps_completed": [
                    "analyze_request",
                    "determine_document_type", 
                    "extract_features",
                    "assess_complexity",
                    "generate_document",
                    "finalize_response"
                ],
                **final_state.get("metadata", {})
            }
        }
        
        print(f"MAIN_DEBUG: Formatted response with metadata keys: {list(response['metadata'].keys())}", file=sys.stderr)
        
        # Handle errors in final state
        if final_state.get("error"):
            print(f"MAIN_DEBUG: Final state contains error: {final_state['error']}", file=sys.stderr)
            response["metadata"]["error"] = final_state["error"]
            response["metadata"]["workflow_status"] = "error"
        else:
            print(f"MAIN_DEBUG: Final state successful, no errors", file=sys.stderr)
            response["metadata"]["workflow_status"] = "success"
        
        # Emit final completion event
        print(f"MAIN_DEBUG: About to emit final completion event", file=sys.stderr)
        try:
            emit_completion(
                task_id,
                "completed",
                "Modular requirements writing workflow completed successfully"
            )
            print(f"MAIN_DEBUG: Final completion event emitted successfully", file=sys.stderr)
        except Exception as completion_error:
            print(f"MAIN_ERROR: Failed to emit final completion: {completion_error}", file=sys.stderr)
        
        print(f"MAIN_DEBUG: About to output final JSON response", file=sys.stderr)
        print(json.dumps(response))
        print(f"MAIN_DEBUG: JSON response output completed", file=sys.stderr)
        
    except Exception as e:
        print(f"MAIN_ERROR: Fatal exception in main(): {str(e)}", file=sys.stderr)
        print(f"MAIN_ERROR: Fatal exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"MAIN_ERROR: Fatal exception traceback: {traceback.format_exc()}", file=sys.stderr)
        
        error_response = {
            "response": f"I apologize, but I encountered an error while processing your requirements request: {str(e)}",
            "analysis": {},
            "metadata": {
                "error": str(e),
                "workflow_status": "fatal_error",
                "generated_at": datetime.now().isoformat(),
                "processing_type": "modular-langgraph-workflow",
                "agent_type": "requirements_writer"
            }
        }
        print(f"MAIN_DEBUG: About to output fatal error response", file=sys.stderr)
        print(json.dumps(error_response))
        print(f"MAIN_DEBUG: Fatal error response output completed", file=sys.stderr)


if __name__ == "__main__":
    print("=" * 50, file=sys.stderr)
    print("REQUIREMENTS_WRITER_PYTHON_SCRIPT_STARTED", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    main()
    print("=" * 50, file=sys.stderr)
    print("REQUIREMENTS_WRITER_PYTHON_SCRIPT_COMPLETED", file=sys.stderr)
    print("=" * 50, file=sys.stderr)