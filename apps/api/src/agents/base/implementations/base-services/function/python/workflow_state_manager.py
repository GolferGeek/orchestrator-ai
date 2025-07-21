"""Workflow state management utilities for Python function agents"""

from typing import Dict, Any, List
from datetime import datetime


class WorkflowState:
    """Generic workflow state management for Python function agents"""
    
    def __init__(self, initial_data: Dict[str, Any]):
        self.user_message = initial_data.get('userMessage', '')
        self.session_id = initial_data.get('sessionId', '')
        self.task_id = initial_data.get('metadata', {}).get('taskId', 'unknown')
        self.metadata = initial_data.get('metadata', {})
        
        # Workflow state
        self.workflow_step: str = 'initialized'
        self.error: str = ''
        self.step_results: Dict[str, Any] = {}
        self.current_step_index = 0
        
        # User preferences for LLM calls
        self.llm_preferences = self._extract_llm_preferences()
    
    def _extract_llm_preferences(self) -> Dict[str, Any]:
        """Extract LLM preferences from metadata"""
        llm_prefs = self.metadata.get('llmPreferences', {})
        return {
            'providerId': llm_prefs.get('providerId'),
            'modelId': llm_prefs.get('modelId'),
            'temperature': llm_prefs.get('temperature'),
            'maxTokens': llm_prefs.get('maxTokens'),
            'cidafmOptions': llm_prefs.get('cidafmOptions'),
            'authToken': self.metadata.get('authToken'),
            'sessionId': self.session_id
        }
    
    def update_step_result(self, step_name: str, result: Any):
        """Update the result for a workflow step"""
        self.step_results[step_name] = result
        self.workflow_step = f"{step_name}_completed"
    
    def set_error(self, error: str):
        """Set error state"""
        self.error = error
        self.workflow_step = 'error'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert state to dictionary for LangGraph"""
        return {
            'userMessage': self.user_message,
            'sessionId': self.session_id,
            'metadata': self.metadata,
            'workflow_step': self.workflow_step,
            'error': self.error,
            'step_results': self.step_results,
            'llm_preferences': self.llm_preferences,
            **self._get_additional_state()
        }
    
    def _get_additional_state(self) -> Dict[str, Any]:
        """Override in subclasses to add specific state fields"""
        return {}
    
    def get_context_for_llm(self) -> str:
        """Get contextual information for LLM calls"""
        context_parts = [
            f"User Request: {self.user_message}",
            f"Session ID: {self.session_id}"
        ]
        return "\n".join(context_parts)
    
    def create_agent_task_data(self, additional_context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create task data for agent calls"""
        task_data = {
            'userMessage': self.user_message,
            'sessionId': self.session_id,
            'metadata': self.metadata,
            'context': self.get_context_for_llm(),
            'llm_preferences': self.llm_preferences
        }
        
        if additional_context:
            task_data.update(additional_context)
        
        return task_data


class RequirementsWriterState(WorkflowState):
    """State management for the requirements writer workflow"""
    
    def __init__(self, initial_data: Dict[str, Any]):
        super().__init__(initial_data)
        
        # Requirements-specific state - load from initial_data if available
        self.analysis: Dict[str, Any] = initial_data.get('analysis', {})
        self.document_type: str = initial_data.get('document_type', '')
        self.features: List[str] = initial_data.get('features', [])
        self.complexity: str = initial_data.get('complexity', 'medium')
        self.document_content: str = initial_data.get('document_content', '')
        
        # Progress tracking
        self.total_steps = 6  # Updated for streamlined workflow
    
    def _get_additional_state(self) -> Dict[str, Any]:
        """Add requirements-specific state fields"""
        return {
            'analysis': self.analysis,
            'document_type': self.document_type,
            'features': self.features,
            'complexity': self.complexity,
            'document_content': self.document_content
        }
    
    def set_analysis(self, analysis: Dict[str, Any]):
        """Set analysis results"""
        self.analysis = analysis
        self.update_step_result('analyze_request', analysis)
    
    def set_document_type(self, doc_type: str):
        """Set determined document type"""
        self.document_type = doc_type
        self.update_step_result('determine_document_type', doc_type)
    
    def set_features(self, features: List[str]):
        """Set extracted features"""
        self.features = features
        self.update_step_result('extract_features', features)
    
    def set_complexity(self, complexity: str):
        """Set assessed complexity"""
        self.complexity = complexity
        self.update_step_result('assess_complexity', complexity)
    
    def set_document_content(self, content: str):
        """Set generated document content"""
        self.document_content = content
        self.update_step_result('generate_document', content)
    
    def get_context_for_llm(self) -> str:
        """Get requirements-specific context for LLM calls"""
        context_parts = [
            f"User Request: {self.user_message}",
            f"Session ID: {self.session_id}"
        ]
        
        if self.features:
            context_parts.append(f"Identified Features: {', '.join(self.features)}")
        
        if self.complexity:
            context_parts.append(f"Complexity Level: {self.complexity}")
        
        if self.document_type:
            context_parts.append(f"Document Type: {self.document_type}")
        
        return "\n".join(context_parts)


def create_final_response(state: WorkflowState, content_key: str = 'response') -> Dict[str, Any]:
    """Create the final response structure for any workflow"""
    content = getattr(state, 'document_content', '') or state.step_results.get('final_result', '')
    
    return {
        "response": content or "No content generated",
        "analysis": getattr(state, 'analysis', {}),
        "metadata": {
            "workflow_step": state.workflow_step,
            "generated_at": datetime.now().isoformat(),
            "processing_type": "langgraph-real-llm-workflow",
            "tools_used": ["langgraph", "real-llm-calls", "state-management"],
            "workflow_steps_completed": list(state.step_results.keys()),
            "step_results": state.step_results,
            **state.metadata
        }
    }