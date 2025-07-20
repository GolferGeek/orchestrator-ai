"""Complexity assessment node - Uses real LLM to assess project complexity and effort"""

from typing import Dict, Any
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.progress_manager import emit_progress
from utils.llm_client import llm_client
from utils.state_manager import RequirementsWriterState


async def assess_complexity_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Assess the complexity of the requirements using AI analysis"""
    
    state = RequirementsWriterState(state_dict)
    
    try:
        # Emit start event
        emit_progress(
            state.task_id,
            "assess_complexity",
            3,
            9,
            "in_progress",
            "Using AI to assess project complexity and estimate implementation effort..."
        )
        
        # Create LLM options
        llm_options = llm_client.create_options(**state.llm_preferences)
        
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

        # Make real LLM call
        response = await llm_client.call_llm_service(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            options=llm_options
        )
        
        # Parse LLM response
        try:
            import json
            complexity_analysis = json.loads(response)
            
            complexity = complexity_analysis.get('overall_complexity', 'medium')
            effort_estimate = complexity_analysis.get('effort_estimate', '3-6 weeks')
            risk_level = complexity_analysis.get('risk_level', 'medium')
            
        except:
            # Fallback complexity assessment
            feature_count = len(state.features)
            analysis_scope = state.analysis.get('scope', 'medium') if state.analysis else 'medium'
            
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
            
            complexity_analysis = {
                'overall_complexity': complexity,
                'effort_estimate': effort_estimate,
                'risk_level': risk_level,
                'complexity_score': min(10, max(1, feature_count // 2 + 3)),
                'assessment_method': 'fallback_heuristic',
                'llm_response': response
            }
        
        # Update state
        state.set_complexity(complexity)
        state.update_step_result('assess_complexity', complexity_analysis)
        
        # Emit completion event
        emit_progress(
            state.task_id,
            "assess_complexity",
            3,
            9,
            "completed",
            f"Complexity assessed: {complexity.upper()} - {effort_estimate} estimated effort"
        )
        
        return state.to_dict()
        
    except Exception as e:
        error_msg = f"Complexity assessment failed: {str(e)}"
        print(f"Error in assess_complexity_node: {error_msg}", file=sys.stderr)
        
        emit_progress(state.task_id, "assess_complexity", 3, 9, "failed", error_msg)
        
        state.set_error(error_msg)
        return state.to_dict()