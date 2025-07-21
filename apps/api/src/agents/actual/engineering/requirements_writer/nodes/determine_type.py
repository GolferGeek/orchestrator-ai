"""Document type determination node - Uses real LLM to determine optimal document type"""

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
    from progress_manager import emit_progress
    from llm_service_client import llm_client
    from workflow_state_manager import RequirementsWriterState
except ImportError as e:
    print(f"Error: Could not import from base services: {e}", file=sys.stderr)
    # Create minimal fallback implementations
    def emit_progress(task_id, step_name, step_index, total_steps, status, message=None):
        print(f"PROGRESS_FALLBACK: {step_name} - {status}", file=sys.stderr)
    
    class RequirementsWriterState:
        def __init__(self, state_dict):
            self.__dict__.update(state_dict)
        @property
        def task_id(self):
            return self.__dict__.get('metadata', {}).get('taskId', 'unknown')
    
    class LLMClient:
        async def call_llm_service(self, system_prompt, user_prompt, options=None):
            return "Fallback response - LLM service not available"
    llm_client = LLMClient()


async def determine_document_type_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Determine the type of document to generate using AI analysis"""
    
    print(f"DEBUG: determine_document_type_node started with keys: {list(state_dict.keys())}", file=sys.stderr)
    
    state = RequirementsWriterState(state_dict)
    
    print(f"DEBUG: RequirementsWriterState created, task_id: {state.task_id}", file=sys.stderr)
    
    try:
        # Emit start event
        print(f"DEBUG: About to emit progress for determine_document_type", file=sys.stderr)
        emit_progress(
            state.task_id,
            "determine_document_type",
            1,
            9,
            "in_progress",
            "Using AI to determine optimal document type based on requirements analysis..."
        )
        print(f"DEBUG: Progress emitted successfully", file=sys.stderr)
        
        # Create LLM options
        print(f"DEBUG: About to create LLM options from preferences: {state.llm_preferences}", file=sys.stderr)
        try:
            llm_options = llm_client.create_options(**state.llm_preferences)
            print(f"DEBUG: LLM options created: {llm_options}", file=sys.stderr)
        except Exception as e:
            print(f"ERROR: Failed to create LLM options: {e}", file=sys.stderr)
            llm_options = {}
        
        # System prompt for document type determination
        system_prompt = """You are a technical documentation expert. Based on the user's request and analysis, determine the most appropriate type of requirements document to generate.

Available document types:
- **prd**: Product Requirements Document - For product features, user stories, business requirements
- **trd**: Technical Requirements Document - For system architecture, technical specifications, engineering requirements
- **api**: API Requirements Document - For API design, endpoint specifications, integration requirements
- **user_story**: User Story Document - For agile development, user acceptance criteria, workflow requirements
- **architecture**: System Architecture Document - For high-level system design, component specifications, infrastructure requirements
- **general**: General Requirements Document - For mixed or unclear requirements that don't fit other categories

Consider:
1. The user's intent and domain
2. Whether they're asking for business features vs technical specifications
3. The level of technical detail required
4. The intended audience (business stakeholders vs developers)

Respond with a JSON object:
{
    "document_type": "prd|trd|api|user_story|architecture|general",
    "confidence": 0.0-1.0,
    "reasoning": "Explanation of why this type was chosen",
    "alternative_types": ["list", "of", "other", "viable", "options"],
    "suggested_sections": ["key", "sections", "to", "include"]
}"""

        # Include analysis context in user prompt
        analysis_context = ""
        if state.analysis:
            analysis_context = f"""
Previous Analysis:
- Intent: {state.analysis.get('intent', 'Unknown')}
- Scope: {state.analysis.get('scope', 'Unknown')}
- Domain: {state.analysis.get('domain', 'Unknown')}
- Summary: {state.analysis.get('summary', 'No summary available')}
"""

        user_prompt = f"""Determine the optimal document type for this request:

Original Request: "{state.user_message}"
{analysis_context}

What type of requirements document should be generated?"""

        print(f"DEBUG: About to call LLM service with prompts (system: {len(system_prompt)} chars, user: {len(user_prompt)} chars)", file=sys.stderr)
        
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
            print(f"DEBUG: LLM call completed in {duration:.2f}s, response length: {len(response)} chars", file=sys.stderr)
            print(f"DEBUG: LLM response preview: {response[:200]}...", file=sys.stderr)
        except Exception as e:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"ERROR: LLM call failed after {duration:.2f}s: {e}", file=sys.stderr)
            response = f"ERROR: LLM call failed: {e}"
        
        # Parse LLM response
        print(f"DEBUG: Attempting to parse document type from LLM response", file=sys.stderr)
        try:
            import json
            type_analysis = json.loads(response)
            document_type = type_analysis.get('document_type', 'general')
            confidence = type_analysis.get('confidence', 0.8)
            reasoning = type_analysis.get('reasoning', 'AI-determined document type')
            print(f"DEBUG: Successfully parsed JSON response: {document_type} (confidence: {confidence:.2f})", file=sys.stderr)
        except Exception as parse_error:
            print(f"DEBUG: JSON parsing failed ({parse_error}), using fallback analysis", file=sys.stderr)
            # Fallback logic if JSON parsing fails
            response_lower = response.lower()
            document_type = 'general'
            confidence = 0.6
            reasoning = "Fallback determination based on keyword analysis"
            
            # Simple keyword-based fallback
            if any(keyword in response_lower for keyword in ['product', 'feature', 'business', 'user']):
                document_type = 'prd'
            elif any(keyword in response_lower for keyword in ['technical', 'system', 'architecture', 'engineering']):
                document_type = 'trd' 
            elif any(keyword in response_lower for keyword in ['api', 'endpoint', 'rest', 'integration']):
                document_type = 'api'
            elif any(keyword in response_lower for keyword in ['user story', 'agile', 'acceptance']):
                document_type = 'user_story'
            elif any(keyword in response_lower for keyword in ['architecture', 'component', 'design']):
                document_type = 'architecture'
            
            print(f"DEBUG: Fallback document type determined: {document_type}", file=sys.stderr)
            
            type_analysis = {
                'document_type': document_type,
                'confidence': confidence,
                'reasoning': reasoning,
                'llm_response': response,
                'parse_error': str(parse_error)
            }
        
        # Update state
        print(f"DEBUG: About to update state with document type: {document_type}", file=sys.stderr)
        try:
            state.set_document_type(document_type)
            state.update_step_result('determine_document_type', type_analysis)
            print(f"DEBUG: State updated successfully with document type", file=sys.stderr)
        except Exception as state_error:
            print(f"ERROR: Failed to update state: {state_error}", file=sys.stderr)
        
        # Emit completion event
        print(f"DEBUG: About to emit completion progress", file=sys.stderr)
        try:
            emit_progress(
                state.task_id,
                "determine_document_type", 
                1,
                9,
                "completed",
                f"Document type determined: {document_type.upper()} (confidence: {confidence:.1%})"
            )
            print(f"DEBUG: Completion progress emitted successfully", file=sys.stderr)
        except Exception as progress_error:
            print(f"ERROR: Failed to emit completion progress: {progress_error}", file=sys.stderr)
        
        # Return updated state
        print(f"DEBUG: About to return state dictionary", file=sys.stderr)
        try:
            result = state.to_dict()
            print(f"DEBUG: State converted to dict successfully, keys: {list(result.keys())}", file=sys.stderr)
            return result
        except Exception as dict_error:
            print(f"ERROR: Failed to convert state to dict: {dict_error}", file=sys.stderr)
            return {"error": f"Failed to convert state: {dict_error}"}
        
    except Exception as e:
        error_msg = f"Document type determination failed: {str(e)}"
        print(f"ERROR: Exception in determine_document_type_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(state.task_id, "determine_document_type", 1, 9, "failed", error_msg)
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
        "userMessage": "I need technical specifications for a REST API that handles user authentication",
        "sessionId": "test-session", 
        "metadata": {"taskId": "test-task"},
        "analysis": {
            "intent": "API technical specifications",
            "scope": "medium",
            "domain": "technical"
        }
    }
    
    async def test():
        result = await determine_document_type_node(test_state)
        print("Document type result:", result.get('document_type'))
        print("Analysis:", result.get('step_results', {}).get('determine_document_type'))
    
    asyncio.run(test())