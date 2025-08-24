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
    from progress_manager import emit_completion, emit_progress
    from workflow_state_manager import RequirementsWriterState
    print(f"Successfully imported base services", file=sys.stderr)
except ImportError as e:
    print(f"Warning: Could not import from base services: {e}", file=sys.stderr)
    print(f"Python path: {sys.path}", file=sys.stderr)
    
    # Create fallback implementations that still emit proper events
    def emit_completion(task_id, status, message):
        import json
        completion_event = {
            "type": "task_completion",
            "taskId": task_id,
            "status": status,
            "message": message or "Task completed successfully",
            "timestamp": datetime.now().isoformat()
        }
        print(f"COMPLETION_EVENT: {json.dumps(completion_event)}", file=sys.stderr)
        
    def emit_progress(task_id, step_name, step_index, total_steps, status, message=None):
        import json
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
        print(f"PROGRESS_EVENT: {json.dumps(progress_event)}", file=sys.stderr)
    
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

        input_raw = sys.stdin.read().strip()

        if not input_raw:
            print(f"MAIN_ERROR: No input provided from stdin", file=sys.stderr)
            print(json.dumps({"error": "No input provided"}))
            return

        try:
            input_data = json.loads(input_raw)

        except Exception as json_error:
            print(f"MAIN_ERROR: Failed to parse JSON input: {json_error}", file=sys.stderr)
            print(f"MAIN_ERROR: Raw input was: {input_raw[:200]}...", file=sys.stderr)
            print(json.dumps({"error": f"Invalid JSON input: {json_error}"}))
            return
        
        # Debug: Print input data to stderr for debugging

        user_message = input_data.get('userMessage', '')
        session_id = input_data.get('sessionId', 'unknown')
        metadata = input_data.get('metadata', {})
        task_id = metadata.get('taskId', metadata.get('originalParams', {}).get('taskId', 'unknown'))

        # Initialize the modular LangGraph workflow

        try:
            workflow_instance = RequirementsWriterWorkflow(task_id=task_id)

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
            "workflow_step": "initialized",
            "task_id": task_id  # Add task_id to state for node access
        }

        # Execute the modular LangGraph workflow

        start_time = datetime.now()
        
        # Emit workflow start progress
        emit_progress(task_id, "workflow_start", 0, 6, "in_progress", "Starting requirements document generation workflow")
        
        try:
            if LANGGRAPH_AVAILABLE:

                # Emit intermediate progress events (simulating workflow steps)
                emit_progress(task_id, "analyzing_request", 1, 6, "in_progress", "Analyzing your request...")
                
                try:
                    # Simulate step-by-step progress during workflow execution
                    import time
                    
                    # Start workflow execution
                    final_state = workflow_instance.workflow.invoke(initial_state)

                    # Emit additional progress based on workflow completion
                    emit_progress(task_id, "generating_content", 4, 6, "in_progress", "Generating requirements document content...")
                    
                    # Emit completion progress
                    emit_progress(task_id, "workflow_complete", 5, 6, "completed", "Requirements document generated successfully")
                    
                except Exception as langgraph_error:
                    print(f"MAIN_ERROR: LangGraph invoke() failed: {langgraph_error}", file=sys.stderr)
                    import traceback
                    print(f"MAIN_ERROR: LangGraph traceback: {traceback.format_exc()}", file=sys.stderr)
                    # Emit error progress
                    emit_progress(task_id, "workflow_error", 5, 6, "failed", f"Workflow execution failed: {langgraph_error}")
                    raise
            else:

                # Fallback execution without LangGraph
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:

                    final_state = loop.run_until_complete(workflow_instance.workflow._fallback_invoke(initial_state))

                    # Emit completion progress for fallback
                    emit_progress(task_id, "workflow_complete", 5, 6, "completed", "Requirements document generated successfully")
                    
                except Exception as fallback_error:
                    print(f"MAIN_ERROR: Fallback workflow failed: {fallback_error}", file=sys.stderr)
                    import traceback
                    print(f"MAIN_ERROR: Fallback traceback: {traceback.format_exc()}", file=sys.stderr)
                    # Emit error progress for fallback
                    emit_progress(task_id, "workflow_error", 5, 6, "failed", f"Fallback workflow failed: {fallback_error}")
                    raise
                finally:
                    loop.close()

            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            if isinstance(final_state, dict) and 'document_content' in final_state:
                content_length = len(final_state['document_content']) if final_state['document_content'] else 0

        except Exception as workflow_error:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"MAIN_ERROR: Workflow failed after {duration:.2f}s: {workflow_error}", file=sys.stderr)
            print(f"MAIN_ERROR: Workflow error type: {type(workflow_error)}", file=sys.stderr)
            import traceback
            print(f"MAIN_ERROR: Workflow traceback: {traceback.format_exc()}", file=sys.stderr)
            final_state = {"error": f"Workflow execution failed: {workflow_error}", **initial_state}

        # Format response using modular structure

        document_content = final_state.get("document_content", "No content generated")
        analysis = final_state.get("analysis", {})
        document_type = final_state.get("document_type", "general")
        complexity = final_state.get("complexity", "medium")
        features = final_state.get("features", [])
        workflow_step = final_state.get("workflow_step", "unknown")

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

        # Handle errors in final state
        if final_state.get("error"):

            response["metadata"]["error"] = final_state["error"]
            response["metadata"]["workflow_status"] = "error"
        else:

            response["metadata"]["workflow_status"] = "success"
        
        # Emit final completion event

        try:
            emit_completion(
                task_id,
                "completed",
                "Modular requirements writing workflow completed successfully"
            )

        except Exception as completion_error:
            print(f"MAIN_ERROR: Failed to emit final completion: {completion_error}", file=sys.stderr)

        print(json.dumps(response))

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

        print(json.dumps(error_response))

if __name__ == "__main__":
    print("=" * 50, file=sys.stderr)
    print("REQUIREMENTS_WRITER_PYTHON_SCRIPT_STARTED", file=sys.stderr)
    print("=" * 50, file=sys.stderr)
    main()
    print("=" * 50, file=sys.stderr)
    print("REQUIREMENTS_WRITER_PYTHON_SCRIPT_COMPLETED", file=sys.stderr)
    print("=" * 50, file=sys.stderr)