"""Request analysis node - Uses real LLM to understand requirements intent and scope"""

from typing import Dict, Any
import sys
import os
from datetime import datetime

# Add base services to Python path (clean approach)
current_dir = os.path.dirname(os.path.abspath(__file__))
agents_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))))
base_services_path = os.path.join(agents_dir, 'base/implementations/base-services/function/python')
sys.path.insert(0, base_services_path)

# Clean imports from base services
try:
    from progress_manager import emit_progress, format_step_message
    from workflow_state_manager import RequirementsWriterState
    from llm_service_client import llm_client, extract_user_preferences, merge_llm_preferences
    print(f"SUCCESS: Using base services RequirementsWriterState: {RequirementsWriterState}", file=sys.stderr)
except ImportError as e:
    print(f"Error: Could not import from base services: {e}", file=sys.stderr)
    # Create minimal fallback implementations since utils directory was removed
    def emit_progress(task_id, step_name, step_index, total_steps, status, message=None):
        print(f"PROGRESS_FALLBACK: {step_name} - {status}", file=sys.stderr)
    def format_step_message(step_name, status):
        return f"{step_name} - {status}"
    
    class RequirementsWriterState:
        def __init__(self, state_dict):
            self.__dict__.update(state_dict)
        @property
        def task_id(self):
            return self.__dict__.get('metadata', {}).get('taskId', 'unknown')
        def set_error(self, error):
            self.error = error
            print(f"FALLBACK: set_error called with: {error}", file=sys.stderr)
    
    class LLMClient:
        async def call_llm_service(self, system_prompt, user_prompt, options=None):
            return "Fallback response - LLM service not available"
        def create_options(self, **kwargs):
            return {}
    llm_client = LLMClient()
    def extract_user_preferences(metadata): return {}
    def merge_llm_preferences(base, user): return base

async def analyze_request_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Analyze the user request to understand intent and scope using real LLM"""

    # Create state manager
    state = RequirementsWriterState(state_dict)

    try:
        # Emit start event

        emit_progress(
            state.task_id, 
            "analyze_request", 
            0, 
            9, 
            "in_progress", 
            "Analyzing user request using AI to understand requirements scope and intent..."
        )

        # Create LLM options from user preferences

        try:
            llm_options = llm_client.create_options(**state.llm_preferences)

        except Exception as e:
            print(f"ERROR: Failed to create LLM options: {e}", file=sys.stderr)
            llm_options = {}
        
        # System prompt for requirements analysis
        system_prompt = """You are an expert requirements analyst. Your job is to analyze user requests and understand:

1. **Intent**: What is the user trying to accomplish?
2. **Scope**: How broad or narrow is this request?
3. **Clarity**: How well-defined are the requirements?
4. **Urgency**: What is the implied timeline/urgency?
5. **Domain**: What business domain or technical area does this involve?

Respond with a JSON object containing:
{
    "intent": "Brief description of what user wants to accomplish",
    "scope": "small|medium|large|enterprise",
    "clarity": "low|medium|high",
    "urgency": "low|normal|high|urgent",
    "domain": "technical|business|product|operational|other",
    "confidence": 0.0-1.0,
    "key_indicators": ["list", "of", "important", "keywords", "or", "phrases"],
    "missing_info": ["what", "additional", "info", "might", "be", "needed"],
    "summary": "2-3 sentence summary of the request"
}"""

        user_prompt = f"""Analyze this requirements request:

"{state.user_message}"

Please provide a thorough analysis of this request following the JSON format specified."""

        # Make real LLM call
        start_time = datetime.now()
        try:
            response = await llm_client.call_llm_service(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                options=llm_options
            )
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

        except Exception as e:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"ERROR: LLM call failed after {duration:.2f}s: {e}", file=sys.stderr)
            response = f"ERROR: LLM call failed: {e}"
        
        # Try to parse LLM response as JSON, fallback to structured analysis

        try:
            import json
            analysis = json.loads(response)

        except Exception as parse_error:

            # Fallback if LLM doesn't return valid JSON
            analysis = {
                "intent": "requirements_generation",
                "scope": "medium",
                "clarity": "medium", 
                "urgency": "normal",
                "domain": "business",
                "confidence": 0.7,
                "key_indicators": state.user_message.split()[:10],  # First 10 words as indicators
                "missing_info": ["specific timeline", "technical constraints", "user personas"],
                "summary": f"Analysis of requirements request: {state.user_message[:100]}...",
                "llm_response": response  # Include raw LLM response for debugging
            }
        
        # Update state with analysis

        try:
            state.set_analysis(analysis)

        except Exception as state_error:
            print(f"ERROR: Failed to update state: {state_error}", file=sys.stderr)
        
        # Emit completion event

        try:
            emit_progress(
                state.task_id, 
                "analyze_request", 
                0, 
                9, 
                "completed", 
                f"Request analysis complete - Identified {analysis.get('scope', 'medium')} scope {analysis.get('domain', 'business')} requirements"
            )

        except Exception as progress_error:
            print(f"ERROR: Failed to emit completion progress: {progress_error}", file=sys.stderr)
        
        # Return updated state

        try:
            result = state.to_dict()

            return result
        except Exception as dict_error:
            print(f"ERROR: Failed to convert state to dict: {dict_error}", file=sys.stderr)
            return {"error": f"Failed to convert state: {dict_error}"}
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        print(f"ERROR: Exception in analyze_request_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(state.task_id, "analyze_request", 0, 9, "failed", error_msg)
        except Exception as emit_error:
            print(f"ERROR: Failed to emit error progress: {emit_error}", file=sys.stderr)
        
        try:
            state.set_error(error_msg)
            return state.to_dict()
        except Exception as state_error:
            print(f"ERROR: Failed to set error state: {state_error}", file=sys.stderr)
            return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}

# For testing/development
if __name__ == "__main__":
    import asyncio
    
    test_state = {
        "userMessage": "I need a PRD for a new mobile app that helps users track their fitness goals",
        "sessionId": "test-session",
        "metadata": {
            "taskId": "test-task",
            "llmPreferences": {
                "temperature": 0.7,
                "maxTokens": 1000
            }
        }
    }
    
    async def test():
        result = await analyze_request_node(test_state)
        print("Analysis result:", result['analysis'])
    
    asyncio.run(test())