"""Document type determination node - Uses real LLM to determine optimal document type"""

from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.progress_manager import emit_progress
from utils.llm_client import llm_client
from utils.state_manager import RequirementsWriterState


async def determine_document_type_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Determine the type of document to generate using AI analysis"""
    
    state = RequirementsWriterState(state_dict)
    
    try:
        # Emit start event
        emit_progress(
            state.task_id,
            "determine_document_type",
            1,
            9,
            "in_progress",
            "Using AI to determine optimal document type based on requirements analysis..."
        )
        
        # Create LLM options
        llm_options = llm_client.create_options(**state.llm_preferences)
        
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

        # Make real LLM call
        response = await llm_client.call_llm_service(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            options=llm_options
        )
        
        # Parse LLM response
        try:
            import json
            type_analysis = json.loads(response)
            document_type = type_analysis.get('document_type', 'general')
            confidence = type_analysis.get('confidence', 0.8)
            reasoning = type_analysis.get('reasoning', 'AI-determined document type')
        except:
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
            
            type_analysis = {
                'document_type': document_type,
                'confidence': confidence,
                'reasoning': reasoning,
                'llm_response': response
            }
        
        # Update state
        state.set_document_type(document_type)
        state.update_step_result('determine_document_type', type_analysis)
        
        # Emit completion event
        emit_progress(
            state.task_id,
            "determine_document_type", 
            1,
            9,
            "completed",
            f"Document type determined: {document_type.upper()} (confidence: {confidence:.1%})"
        )
        
        return state.to_dict()
        
    except Exception as e:
        error_msg = f"Document type determination failed: {str(e)}"
        print(f"Error in determine_document_type_node: {error_msg}", file=sys.stderr)
        
        emit_progress(state.task_id, "determine_document_type", 1, 9, "failed", error_msg)
        
        state.set_error(error_msg)
        return state.to_dict()


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