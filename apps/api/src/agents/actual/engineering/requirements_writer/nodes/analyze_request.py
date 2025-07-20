"""Request analysis node - Uses real LLM to understand requirements intent and scope"""

from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.progress_manager import emit_progress, format_step_message
from utils.llm_client import llm_client, extract_user_preferences, merge_llm_preferences
from utils.state_manager import RequirementsWriterState


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
        llm_options = llm_client.create_options(**state.llm_preferences)
        
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
        response = await llm_client.call_llm_service(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            options=llm_options
        )
        
        # Try to parse LLM response as JSON, fallback to structured analysis
        try:
            import json
            analysis = json.loads(response)
        except:
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
        state.set_analysis(analysis)
        
        # Emit completion event
        emit_progress(
            state.task_id, 
            "analyze_request", 
            0, 
            9, 
            "completed", 
            f"Request analysis complete - Identified {analysis.get('scope', 'medium')} scope {analysis.get('domain', 'business')} requirements"
        )
        
        # Return updated state
        return state.to_dict()
        
    except Exception as e:
        error_msg = f"Analysis failed: {str(e)}"
        print(f"Error in analyze_request_node: {error_msg}", file=sys.stderr)
        
        emit_progress(state.task_id, "analyze_request", 0, 9, "failed", error_msg)
        
        state.set_error(error_msg)
        return state.to_dict()


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