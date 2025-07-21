"""Complexity assessment node - Uses real LLM to assess project complexity and effort"""

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


async def assess_complexity_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Assess the complexity of the requirements using AI analysis"""
    
    print(f"DEBUG: assess_complexity_node started with keys: {list(state_dict.keys())}", file=sys.stderr)
    
    state = RequirementsWriterState(state_dict)
    
    print(f"DEBUG: RequirementsWriterState created, task_id: {state.task_id}", file=sys.stderr)
    print(f"DEBUG: Current features count: {len(state.features) if hasattr(state, 'features') and state.features else 0}", file=sys.stderr)
    
    try:
        # Emit start event
        print(f"DEBUG: About to emit progress for assess_complexity", file=sys.stderr)
        emit_progress(
            state.task_id,
            "assess_complexity",
            3,
            9,
            "in_progress",
            "Using AI to assess project complexity and estimate implementation effort..."
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
        
        system_prompt = """You are a technical project manager and complexity assessment specialist. Analyze the requirements and provide a comprehensive complexity assessment.

Consider these factors:
1. **Technical Complexity**: Architecture, integrations, technology stack
2. **Feature Complexity**: Number and sophistication of features
3. **Data Complexity**: Data models, relationships, volume
4. **Integration Complexity**: External systems, APIs, third-party services
5. **Scalability Requirements**: Performance, concurrent users, growth
6. **Security Complexity**: Authentication, authorization, compliance
7. **UI/UX Complexity**: User interfaces, workflows, responsiveness
8. **Deployment Complexity**: Infrastructure, DevOps, monitoring

Respond with JSON:
{
    "overall_complexity": "low|medium|high|enterprise",
    "complexity_score": 1-10,
    "effort_estimate": "1-2 weeks|3-6 weeks|2-3 months|6+ months",
    "team_size_recommendation": "1-2|3-5|6-10|10+ developers",
    "complexity_factors": {
        "technical": 1-10,
        "features": 1-10,
        "data": 1-10,
        "integrations": 1-10,
        "scalability": 1-10,
        "security": 1-10,
        "ui_ux": 1-10,
        "deployment": 1-10
    },
    "risk_level": "low|medium|high|critical",
    "key_challenges": ["list", "of", "main", "challenges"],
    "recommended_approach": "agile|waterfall|hybrid",
    "technology_recommendations": ["suggested", "technologies"],
    "phases": ["phase 1", "phase 2", "phase 3"]
}"""

        # Build context from previous analysis
        context_parts = [f"Requirements: {state.user_message}"]
        
        if state.features:
            context_parts.append(f"Features ({len(state.features)}): {', '.join(state.features[:10])}")
        
        if state.document_type:
            context_parts.append(f"Document Type: {state.document_type}")
        
        if state.analysis:
            context_parts.append(f"Scope: {state.analysis.get('scope', 'unknown')}")
            context_parts.append(f"Domain: {state.analysis.get('domain', 'unknown')}")

        user_prompt = f"""Assess the complexity of this project:

{chr(10).join(context_parts)}

Provide a comprehensive complexity assessment including effort estimates and recommendations."""

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
        print(f"DEBUG: Attempting to parse complexity assessment from LLM response", file=sys.stderr)
        try:
            import json
            complexity_analysis = json.loads(response)
            
            complexity = complexity_analysis.get('overall_complexity', 'medium')
            effort_estimate = complexity_analysis.get('effort_estimate', '3-6 weeks')
            risk_level = complexity_analysis.get('risk_level', 'medium')
            
            print(f"DEBUG: Successfully parsed JSON response: {complexity} complexity, {effort_estimate} effort", file=sys.stderr)
            
        except Exception as parse_error:
            print(f"DEBUG: JSON parsing failed ({parse_error}), using fallback assessment", file=sys.stderr)
            
            # Fallback complexity assessment
            feature_count = len(state.features) if hasattr(state, 'features') and state.features else 0
            analysis_scope = state.analysis.get('scope', 'medium') if hasattr(state, 'analysis') and state.analysis else 'medium'
            
            print(f"DEBUG: Fallback assessment with {feature_count} features, scope: {analysis_scope}", file=sys.stderr)
            
            # Simple heuristic-based assessment
            if feature_count <= 3 and analysis_scope == 'small':
                complexity = 'low'
                effort_estimate = '1-2 weeks'
                risk_level = 'low'
            elif feature_count <= 8 and analysis_scope in ['small', 'medium']:
                complexity = 'medium'
                effort_estimate = '3-6 weeks'
                risk_level = 'medium'
            elif feature_count <= 15:
                complexity = 'high'
                effort_estimate = '2-3 months'
                risk_level = 'medium'
            else:
                complexity = 'enterprise'
                effort_estimate = '6+ months'
                risk_level = 'high'
            
            print(f"DEBUG: Fallback complexity determined: {complexity} (effort: {effort_estimate})", file=sys.stderr)
            
            complexity_analysis = {
                'overall_complexity': complexity,
                'effort_estimate': effort_estimate,
                'risk_level': risk_level,
                'complexity_score': min(10, max(1, feature_count // 2 + 3)),
                'assessment_method': 'fallback_heuristic',
                'llm_response': response,
                'parse_error': str(parse_error)
            }
        
        # Update state
        print(f"DEBUG: About to update state with complexity: {complexity}", file=sys.stderr)
        try:
            state.set_complexity(complexity)
            state.update_step_result('assess_complexity', complexity_analysis)
            print(f"DEBUG: State updated successfully with complexity", file=sys.stderr)
        except Exception as state_error:
            print(f"ERROR: Failed to update state: {state_error}", file=sys.stderr)
        
        # Emit completion event
        print(f"DEBUG: About to emit completion progress", file=sys.stderr)
        try:
            emit_progress(
                state.task_id,
                "assess_complexity",
                3,
                9,
                "completed",
                f"Complexity assessed: {complexity.upper()} - {effort_estimate} estimated effort"
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
        error_msg = f"Complexity assessment failed: {str(e)}"
        print(f"ERROR: Exception in assess_complexity_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(state.task_id, "assess_complexity", 3, 9, "failed", error_msg)
        except Exception as emit_error:
            print(f"ERROR: Failed to emit error progress: {emit_error}", file=sys.stderr)
        
        try:
            state.set_error(error_msg)
            return state.to_dict()
        except Exception as state_error:
            print(f"ERROR: Failed to set error state: {state_error}", file=sys.stderr)
            return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}