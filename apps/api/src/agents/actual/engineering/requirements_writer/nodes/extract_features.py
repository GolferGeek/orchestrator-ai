"""Feature extraction node - Uses real LLM to identify key features and components"""

from typing import Dict, Any, List
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


async def extract_features_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Extract key features and components from the request using AI analysis"""
    
    print(f"DEBUG: extract_features_node started with keys: {list(state_dict.keys())}", file=sys.stderr)
    
    state = RequirementsWriterState(state_dict)
    
    print(f"DEBUG: RequirementsWriterState created, task_id: {state.task_id}", file=sys.stderr)
    
    try:
        # Emit start event
        print(f"DEBUG: About to emit progress for extract_features", file=sys.stderr)
        emit_progress(
            state.task_id,
            "extract_features",
            2,
            9,
            "in_progress",
            "Using AI to identify key features and components from requirements..."
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
        
        # System prompt for feature extraction
        system_prompt = """You are a feature extraction specialist. Your job is to identify and extract key features, components, and capabilities from user requirements.

Focus on extracting:
1. **Core Features**: Main functionality the system needs to provide
2. **Technical Components**: Infrastructure, databases, APIs, integrations needed
3. **User-Facing Features**: UI/UX elements, user interactions, workflows
4. **Non-Functional Requirements**: Performance, security, scalability needs
5. **Integration Points**: External systems, third-party services, data sources

Guidelines:
- Be specific but concise with feature names
- Focus on actionable, implementable features
- Include both business and technical features
- Consider the document type being generated
- Think about dependencies between features

Respond with a JSON object:
{
    "core_features": ["list", "of", "main", "features"],
    "technical_components": ["infrastructure", "technical", "components"],
    "user_features": ["user-facing", "interface", "features"],
    "integrations": ["external", "systems", "or", "apis"],
    "security_features": ["authentication", "authorization", "security"],
    "all_features": ["comprehensive", "list", "of", "all", "identified", "features"],
    "feature_categories": {
        "authentication": ["login", "registration"],
        "data_management": ["storage", "retrieval"],
        "user_interface": ["dashboard", "forms"]
    },
    "estimated_complexity": "low|medium|high",
    "priority_features": ["most", "important", "features", "first"]
}"""

        # Build context from previous analysis
        context_parts = [f"Original Request: {state.user_message}"]
        
        if state.document_type:
            context_parts.append(f"Document Type: {state.document_type}")
        
        if state.analysis:
            context_parts.append(f"Analysis Summary: {state.analysis.get('summary', '')}")
            context_parts.append(f"Domain: {state.analysis.get('domain', '')}")
            if state.analysis.get('key_indicators'):
                context_parts.append(f"Key Indicators: {', '.join(state.analysis['key_indicators'][:5])}")

        user_prompt = f"""Extract features and components from this requirements request:

{chr(10).join(context_parts)}

Please identify all key features, components, and capabilities that would need to be implemented."""

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
        print(f"DEBUG: Attempting to parse features from LLM response", file=sys.stderr)
        try:
            import json
            feature_analysis = json.loads(response)
            
            # Extract main features list
            features = feature_analysis.get('all_features', [])
            if not features:
                # Fallback to combining other feature lists
                features = (
                    feature_analysis.get('core_features', []) +
                    feature_analysis.get('user_features', []) +
                    feature_analysis.get('technical_components', [])
                )
            
            complexity = feature_analysis.get('estimated_complexity', 'medium')
            print(f"DEBUG: Successfully parsed JSON response: {len(features)} features, complexity: {complexity}", file=sys.stderr)
            
        except Exception as parse_error:
            print(f"DEBUG: JSON parsing failed ({parse_error}), using fallback extraction", file=sys.stderr)
            
            # Fallback feature extraction using keyword analysis
            features = extract_features_fallback(state.user_message, response)
            complexity = 'medium'
            
            print(f"DEBUG: Fallback extraction resulted in {len(features)} features", file=sys.stderr)
            
            feature_analysis = {
                'all_features': features,
                'estimated_complexity': complexity,
                'extraction_method': 'fallback',
                'llm_response': response,
                'parse_error': str(parse_error)
            }
        
        # Update state
        print(f"DEBUG: About to update state with {len(features)} features", file=sys.stderr)
        try:
            state.set_features(features)
            state.update_step_result('extract_features', feature_analysis)
            print(f"DEBUG: State updated successfully with features", file=sys.stderr)
        except Exception as state_error:
            print(f"ERROR: Failed to update state: {state_error}", file=sys.stderr)
        
        # Emit completion event
        print(f"DEBUG: About to emit completion progress", file=sys.stderr)
        try:
            emit_progress(
                state.task_id,
                "extract_features",
                2,
                9,
                "completed", 
                f"Extracted {len(features)} key features and components ({complexity} complexity)"
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
        error_msg = f"Feature extraction failed: {str(e)}"
        print(f"ERROR: Exception in extract_features_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(state.task_id, "extract_features", 2, 9, "failed", error_msg)
        except Exception as emit_error:
            print(f"ERROR: Failed to emit error progress: {emit_error}", file=sys.stderr)
        
        try:
            state.set_error(error_msg)
            return state.to_dict()
        except Exception as state_error:
            print(f"ERROR: Failed to set error state: {state_error}", file=sys.stderr)
            return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}


def extract_features_fallback(user_message: str, llm_response: str) -> List[str]:
    """Fallback feature extraction using keyword analysis"""
    
    # Common feature keywords to look for
    feature_patterns = [
        'authentication', 'authorization', 'login', 'registration', 'user management',
        'dashboard', 'reporting', 'analytics', 'search', 'filtering', 'pagination',
        'notifications', 'messaging', 'chat', 'email', 'sms', 
        'database', 'storage', 'backup', 'sync', 'integration',
        'api', 'rest', 'graphql', 'webhook', 'microservice',
        'mobile', 'responsive', 'ui', 'ux', 'interface',
        'payment', 'billing', 'subscription', 'pricing',
        'admin', 'moderation', 'content management', 'cms',
        'real-time', 'live', 'streaming', 'websocket',
        'security', 'encryption', 'ssl', 'https', 'gdpr',
        'monitoring', 'logging', 'metrics', 'performance'
    ]
    
    # Combine user message and LLM response for analysis
    text_to_analyze = f"{user_message} {llm_response}".lower()
    
    # Find matching features
    found_features = []
    for pattern in feature_patterns:
        if pattern in text_to_analyze:
            # Convert to proper case
            feature_name = pattern.replace('_', ' ').title()
            found_features.append(feature_name)
    
    # If no features found, extract from nouns/key terms
    if not found_features:
        words = user_message.split()
        # Simple heuristic: take longer words that might be features
        potential_features = [word.capitalize() for word in words if len(word) > 4 and word.isalpha()]
        found_features = potential_features[:10]  # Limit to 10
    
    return found_features[:15]  # Return max 15 features


# For testing/development
if __name__ == "__main__":
    import asyncio
    
    test_state = {
        "userMessage": "Build a social media app with user profiles, posting, commenting, real-time notifications, and admin dashboard",
        "sessionId": "test-session",
        "metadata": {"taskId": "test-task"},
        "document_type": "prd",
        "analysis": {
            "summary": "Social media application requirements",
            "domain": "product",
            "key_indicators": ["social", "media", "user", "profiles", "posting"]
        }
    }
    
    async def test():
        result = await extract_features_node(test_state)
        print("Extracted features:", result.get('features'))
        print("Feature analysis:", result.get('step_results', {}).get('extract_features'))
    
    asyncio.run(test())