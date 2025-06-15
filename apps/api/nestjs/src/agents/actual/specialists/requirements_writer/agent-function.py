#!/usr/bin/env python3
"""
Requirements Writer Agent Function - LangGraph Implementation

This Python script handles requirements writing tasks using LangGraph for stateful workflow management.
It processes user requests and generates comprehensive technical documentation through a multi-step workflow.
"""

import sys
import json
import re
from typing import Dict, List, Any, Optional, TypedDict
from datetime import datetime

# Import LangGraph components
try:
    from langgraph.graph import StateGraph, START, END
    from langchain_core.language_models import BaseLanguageModel
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_openai import ChatOpenAI
    from langchain_anthropic import ChatAnthropic
    LANGGRAPH_AVAILABLE = True
except ImportError as e:
    print(f"Warning: LangGraph dependencies not available: {e}")
    # Fallback implementations for development
    class StateGraph:
        def __init__(self, state_schema): pass
        def add_node(self, name, func): pass
        def add_edge(self, source, target): pass
        def add_conditional_edges(self, source, condition, mapping): pass
        def set_entry_point(self, node): pass
        def set_finish_point(self, node): pass
        def compile(self): return self
        def invoke(self, state): return state
    START = "START"
    END = "END"


class RequirementsWriterState(TypedDict):
    """State schema for the Requirements Writer LangGraph workflow"""
    user_message: str
    session_id: str
    analysis: Optional[Dict[str, Any]]
    document_type: Optional[str]
    features: List[str]
    complexity: str
    document_content: str
    metadata: Dict[str, Any]
    error: Optional[str]
    workflow_step: str


class RequirementsWriterWorkflow:
    """LangGraph workflow for requirements writing with state management"""
    
    def __init__(self, llm_service_api_url: str = None):
        """Initialize the workflow with LLM service integration"""
        self.llm_service_api_url = llm_service_api_url or "http://localhost:3000/api/llm"
        self.document_templates = {
            'prd': self._generate_prd_content,
            'trd': self._generate_trd_content,
            'api': self._generate_api_content,
            'user_story': self._generate_user_story_content,
            'architecture': self._generate_architecture_content
        }
        
        # Build the LangGraph workflow
        self.workflow = self._build_workflow()
    
    def _build_workflow(self) -> StateGraph:
        """Build the LangGraph workflow with nodes and edges"""
        
        # Create the state graph
        workflow = StateGraph(RequirementsWriterState)
        
        # Add nodes for each step of the requirements writing process
        workflow.add_node("analyze_request", self._analyze_request_node)
        workflow.add_node("determine_document_type", self._determine_document_type_node)
        workflow.add_node("extract_features", self._extract_features_node)
        workflow.add_node("assess_complexity", self._assess_complexity_node)
        workflow.add_node("generate_document", self._generate_document_node)
        workflow.add_node("finalize_response", self._finalize_response_node)
        workflow.add_node("handle_error", self._handle_error_node)
        
        # Set entry point
        workflow.set_entry_point("analyze_request")
        
        # Define the workflow edges
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
    
    async def _call_llm_service(self, system_prompt: str, user_prompt: str, options: Dict[str, Any] = None) -> str:
        """Call the NestJS LLMService via HTTP API"""
        try:
            import requests
            
            payload = {
                "systemPrompt": system_prompt,
                "userPrompt": user_prompt,
                "options": options or {}
            }
            
            response = requests.post(f"{self.llm_service_api_url}/generate", json=payload)
            response.raise_for_status()
            
            return response.json().get("response", "")
        except Exception as e:
            # Fallback to basic string processing for development
            return f"Generated response for: {user_prompt[:100]}..."
    
    def _analyze_request_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Analyze the user request to understand intent and scope"""
        try:
            user_message = state["user_message"]
            
            # Initialize analysis structure
            analysis = {
                "request_intent": "requirements_generation",
                "scope": "medium",
                "urgency": "normal",
                "clarity": self._assess_request_clarity(user_message)
            }
            
            return {
                "analysis": analysis,
                "workflow_step": "analysis_complete",
                "metadata": {
                    **state.get("metadata", {}),
                    "analysis_timestamp": datetime.now().isoformat()
                }
            }
        except Exception as e:
            return {
                "error": f"Analysis failed: {str(e)}",
                "workflow_step": "analysis_error"
            }
    
    def _determine_document_type_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Determine the type of document to generate"""
        try:
            user_message = state["user_message"].lower()
            
            # Document type classification logic
            document_type = 'general'
            if any(keyword in user_message for keyword in ['prd', 'product requirements']):
                document_type = 'prd'
            elif any(keyword in user_message for keyword in ['trd', 'technical requirements']):
                document_type = 'trd'
            elif any(keyword in user_message for keyword in ['api', 'endpoint', 'rest', 'swagger']):
                document_type = 'api'
            elif any(keyword in user_message for keyword in ['user story', 'user stories', 'acceptance criteria']):
                document_type = 'user_story'
            elif any(keyword in user_message for keyword in ['architecture', 'system design', 'components']):
                document_type = 'architecture'
            
            return {
                "document_type": document_type,
                "workflow_step": "document_type_determined",
                "metadata": {
                    **state.get("metadata", {}),
                    "document_type_confidence": 0.8 if document_type != 'general' else 0.5
                }
            }
        except Exception as e:
            return {
                "error": f"Document type determination failed: {str(e)}",
                "workflow_step": "document_type_error"
            }
    
    def _extract_features_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Extract key features and components from the request"""
        try:
            user_message = state["user_message"]
            
            # Feature extraction patterns
            feature_patterns = [
                r'authentication', r'authorization', r'user management', r'database',
                r'api', r'ui', r'dashboard', r'reporting', r'notification', r'search',
                r'filtering', r'pagination', r'file upload', r'real-time', r'integration',
                r'security', r'logging', r'monitoring', r'analytics', r'backup'
            ]
            
            features = []
            message_lower = user_message.lower()
            
            for pattern in feature_patterns:
                if re.search(pattern, message_lower):
                    features.append(pattern.replace('_', ' ').title())
            
            return {
                "features": features,
                "workflow_step": "features_extracted",
                "metadata": {
                    **state.get("metadata", {}),
                    "feature_count": len(features),
                    "extraction_method": "pattern_matching"
                }
            }
        except Exception as e:
            return {
                "error": f"Feature extraction failed: {str(e)}",
                "workflow_step": "feature_extraction_error"
            }
    
    def _assess_complexity_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Assess the complexity of the requirements"""
        try:
            user_message = state["user_message"].lower()
            features = state.get("features", [])
            
            # Complexity assessment
            complexity = 'medium'
            if any(keyword in user_message for keyword in ['simple', 'basic', 'minimal']):
                complexity = 'low'
            elif any(keyword in user_message for keyword in ['complex', 'enterprise', 'scalable', 'distributed']):
                complexity = 'high'
            elif len(features) > 8:
                complexity = 'high'
            elif len(features) < 3:
                complexity = 'low'
            
            # Estimate effort
            estimated_effort = self._estimate_effort(complexity, len(features))
            
            return {
                "complexity": complexity,
                "workflow_step": "complexity_assessed",
                "metadata": {
                    **state.get("metadata", {}),
                    "estimated_effort": estimated_effort,
                    "complexity_factors": {
                        "feature_count": len(features),
                        "keyword_indicators": complexity
                    }
                }
            }
        except Exception as e:
            return {
                "error": f"Complexity assessment failed: {str(e)}",
                "workflow_step": "complexity_error"
            }
    
    def _generate_document_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Generate the actual requirements document"""
        try:
            document_type = state.get("document_type", "general")
            
            # Generate document content based on type
            if document_type in self.document_templates:
                content = self.document_templates[document_type](state)
            else:
                content = self._generate_general_requirements(state)
            
            return {
                "document_content": content,
                "workflow_step": "document_generated",
                "metadata": {
                    **state.get("metadata", {}),
                    "generation_timestamp": datetime.now().isoformat(),
                    "content_length": len(content)
                }
            }
        except Exception as e:
            return {
                "error": f"Document generation failed: {str(e)}",
                "workflow_step": "generation_error"
            }
    
    def _finalize_response_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Finalize the response with metadata"""
        try:
            return {
                "workflow_step": "completed",
                "metadata": {
                    **state.get("metadata", {}),
                    "completion_timestamp": datetime.now().isoformat(),
                    "workflow_status": "success"
                }
            }
        except Exception as e:
            return {
                "error": f"Finalization failed: {str(e)}",
                "workflow_step": "finalization_error"
            }
    
    def _handle_error_node(self, state: RequirementsWriterState) -> Dict[str, Any]:
        """Node: Handle errors and provide fallback response"""
        error_message = state.get("error", "Unknown error occurred")
        
        fallback_content = f"""# Requirements Document

## Error Notice
An error occurred during document generation: {error_message}

## Fallback Response
Based on your request: "{state.get('user_message', 'No message provided')}"

Please try again with a more specific request, or contact support if the issue persists.

## Request Analysis
- Document Type: {state.get('document_type', 'Unknown')}
- Features Identified: {len(state.get('features', []))}
- Complexity: {state.get('complexity', 'Unknown')}
"""
        
        return {
            "document_content": fallback_content,
            "workflow_step": "error_handled",
            "metadata": {
                **state.get("metadata", {}),
                "error_handled": True,
                "error_timestamp": datetime.now().isoformat()
            }
        }
    
    def _should_handle_error(self, state: RequirementsWriterState) -> str:
        """Conditional edge function: Determine if error handling is needed"""
        return "error" if state.get("error") else "success"
    
    # Utility methods
    def _assess_request_clarity(self, user_message: str) -> float:
        """Assess how clear and specific the user request is"""
        word_count = len(user_message.split())
        specificity_keywords = ['specific', 'detailed', 'include', 'must', 'should', 'require']
        specificity_score = sum(1 for keyword in specificity_keywords if keyword in user_message.lower())
        
        if word_count < 10:
            return 0.3
        elif word_count > 50 and specificity_score > 2:
            return 0.9
        else:
            return 0.6
    
    def _estimate_effort(self, complexity: str, feature_count: int) -> str:
        """Estimate development effort based on complexity and features"""
        base_effort = {'low': 1, 'medium': 3, 'high': 8}
        total_effort = base_effort.get(complexity, 3) + (feature_count * 0.5)
        
        if total_effort <= 2:
            return 'Small (1-2 weeks)'
        elif total_effort <= 6:
            return 'Medium (3-6 weeks)'
        elif total_effort <= 12:
            return 'Large (7-12 weeks)'
        else:
            return 'Extra Large (3+ months)'
    
    def _generate_prd_content(self, state: RequirementsWriterState) -> str:
        """Generate Product Requirements Document content"""
        features = state.get('features', [])
        complexity = state.get('complexity', 'medium')
        user_message = state.get('user_message', '')
        estimated_effort = state.get('metadata', {}).get('estimated_effort', 'Unknown')
        
        return f"""# Product Requirements Document

## 1. Executive Summary
Based on your request: "{user_message}"

This document outlines the requirements for implementing the requested product features with {complexity} complexity.

## 2. Product Overview
- **Estimated Effort**: {estimated_effort}
- **Complexity Level**: {complexity.title()}
- **Key Features**: {len(features)} identified features

## 3. Functional Requirements

### 3.1 Core Features
{self._format_feature_list(features)}

### 3.2 User Stories
{self._generate_user_stories(features)}

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- Response time: < 200ms for API calls
- Throughput: Support 1000+ concurrent users
- Availability: 99.9% uptime

### 4.2 Security Requirements
- Authentication: Multi-factor authentication
- Authorization: Role-based access control
- Data encryption: AES-256 for sensitive data
- HTTPS/TLS 1.3 for all communications

### 4.3 Scalability Requirements
- Horizontal scaling capability
- Database sharding support
- CDN integration for static assets

## 5. Technical Specifications

### 5.1 Technology Stack
- Backend: Node.js with TypeScript/NestJS
- Frontend: Vue.js 3 with TypeScript
- Database: PostgreSQL with Redis caching
- Infrastructure: Docker + Kubernetes

### 5.2 API Requirements
- RESTful API design
- OpenAPI 3.0 documentation
- Rate limiting and throttling
- Comprehensive error handling

## 6. Implementation Timeline
{self._generate_timeline(complexity)}

## 7. Risk Assessment
{self._assess_technical_risks(complexity)}

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    def _generate_trd_content(self, state: RequirementsWriterState) -> str:
        """Generate Technical Requirements Document content"""
        features = state.get('features', [])
        complexity = state.get('complexity', 'medium')
        user_message = state.get('user_message', '')
        
        return f"""# Technical Requirements Document

## 1. Technical Overview
Request: "{user_message}"
Complexity: {complexity.title()}

## 2. System Architecture
{self._generate_technical_components(features)}

## 3. Database Requirements
{self._generate_database_schema(features)}

## 4. API Specifications
{self._generate_api_schemas(features)}

## 5. Security Requirements
{self._generate_security_architecture()}

## 6. Performance Requirements
- Load testing for {complexity} complexity systems
- Monitoring and alerting setup
- Performance benchmarks

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    def _generate_api_content(self, state: RequirementsWriterState) -> str:
        """Generate API Requirements Document content"""
        features = state.get('features', [])
        user_message = state.get('user_message', '')
        
        return f"""# API Requirements Document

## 1. API Overview
Request: "{user_message}"

## 2. Endpoint Specifications
{self._generate_api_endpoints(features)}

## 3. Error Handling
{self._generate_api_error_responses()}

## 4. Authentication & Authorization
- JWT token-based authentication
- Role-based access control
- API key management

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    def _generate_user_story_content(self, state: RequirementsWriterState) -> str:
        """Generate User Story Document content"""
        features = state.get('features', [])
        user_message = state.get('user_message', '')
        
        return f"""# User Stories Document

## 1. Project Overview
Request: "{user_message}"

## 2. Detailed User Stories
{self._generate_detailed_user_stories(features)}

## 3. Acceptance Criteria
{self._generate_acceptance_criteria(features)}

## 4. Story Dependencies
{self._generate_story_dependencies(features)}

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    def _generate_architecture_content(self, state: RequirementsWriterState) -> str:
        """Generate Architecture Document content"""
        features = state.get('features', [])
        complexity = state.get('complexity', 'medium')
        user_message = state.get('user_message', '')
        
        return f"""# System Architecture Document

## 1. Architecture Overview
Request: "{user_message}"
Complexity: {complexity.title()}

## 2. Frontend Architecture
{self._generate_frontend_architecture(features)}

## 3. Backend Architecture
{self._generate_microservices_architecture(features)}

## 4. Data Architecture
{self._generate_data_architecture(features)}

## 5. Infrastructure
{self._generate_deployment_requirements()}

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    def _generate_general_requirements(self, state: RequirementsWriterState) -> str:
        """Generate general requirements document"""
        features = state.get('features', [])
        complexity = state.get('complexity', 'medium')
        user_message = state.get('user_message', '')
        
        return f"""# Requirements Document

## Request Analysis
"{user_message}"

## Identified Components
{self._format_feature_list(features)}

## Complexity Assessment
- Level: {complexity.title()}
- Estimated Effort: {state.get('metadata', {}).get('estimated_effort', 'Unknown')}

## Implementation Recommendations
{self._generate_implementation_recommendations(complexity)}

## Next Steps
{self._generate_clarification_questions(user_message)}

Generated using LangGraph workflow at {datetime.now().isoformat()}
"""
    
    # Helper methods (keeping the existing utility methods but simplified)
    def _format_feature_list(self, features: List[str]) -> str:
        if not features:
            return "- No specific features identified. Please provide more details."
        return "\n".join([f"- {feature}" for feature in features[:10]])
    
    def _generate_user_stories(self, features: List[str]) -> str:
        if not features:
            return self._default_user_story()
        
        stories = []
        for feature in features[:3]:
            stories.append(f"- As a user, I want {feature.lower()} functionality so that I can accomplish my tasks efficiently.")
        
        return "\n".join(stories)
    
    def _default_user_story(self) -> str:
        return """- As a user, I want a clear and intuitive interface so that I can easily navigate the system.
- As a user, I want reliable functionality so that I can complete my tasks without interruption.
- As an administrator, I want proper access controls so that I can manage user permissions effectively."""
    
    def _generate_timeline(self, complexity: str) -> str:
        timelines = {
            'low': "Phase 1: Planning (1 week)\nPhase 2: Development (2-3 weeks)\nPhase 3: Testing (1 week)",
            'medium': "Phase 1: Planning (2 weeks)\nPhase 2: Development (4-6 weeks)\nPhase 3: Testing (2 weeks)",
            'high': "Phase 1: Planning (3-4 weeks)\nPhase 2: Development (8-12 weeks)\nPhase 3: Testing (3-4 weeks)"
        }
        return timelines.get(complexity, timelines['medium'])
    
    def _generate_acceptance_criteria(self, features: List[str]) -> str:
        if not features:
            return "- System must be functional and user-friendly\n- All core requirements must be met\n- System must pass security audit"
        
        criteria = []
        for feature in features[:5]:
            criteria.append(f"- {feature} must be fully functional and tested")
        
        return "\n".join(criteria)
    
    def _assess_technical_risks(self, complexity: str) -> str:
        risk_levels = {
            'low': "Low technical risk. Standard implementation with well-established patterns.",
            'medium': "Medium technical risk. Some complex integration points require careful planning.",
            'high': "High technical risk. Complex architecture requires expert-level implementation and thorough testing."
        }
        return risk_levels.get(complexity, risk_levels['medium'])
    
    def _generate_technical_components(self, features: List[str]) -> str:
        return "- API Gateway and Load Balancer\n- Application Server (NestJS/Node.js)\n- Database Layer (PostgreSQL)\n- Caching Layer (Redis)\n- File Storage (AWS S3 or similar)"
    
    def _generate_database_schema(self, features: List[str]) -> str:
        return "- Users table with authentication fields\n- Core business entities\n- Audit and logging tables\n- Configuration tables"
    
    def _generate_api_schemas(self, features: List[str]) -> str:
        return "- RESTful endpoints following OpenAPI 3.0 specification\n- JSON request/response format\n- Proper HTTP status codes\n- Rate limiting headers"
    
    def _generate_security_architecture(self) -> str:
        return "- OAuth 2.0/JWT authentication\n- Role-based authorization\n- API rate limiting\n- Input validation and sanitization\n- HTTPS encryption"
    
    def _generate_api_endpoints(self, features: List[str]) -> str:
        return "- GET /api/health - Health check\n- POST /api/auth/login - Authentication\n- GET /api/users - User management\n- Standard CRUD operations for main entities"
    
    def _generate_api_error_responses(self) -> str:
        return "- 400: Bad Request with validation details\n- 401: Unauthorized access\n- 403: Forbidden operation\n- 404: Resource not found\n- 500: Internal server error"
    
    def _generate_detailed_user_stories(self, features: List[str]) -> str:
        return self._generate_user_stories(features)
    
    def _generate_story_dependencies(self, features: List[str]) -> str:
        return "- Authentication must be completed before user management\n- Database setup before data operations\n- API foundation before specific features"
    
    def _generate_frontend_architecture(self, features: List[str]) -> str:
        return "- Vue.js 3 with Composition API\n- TypeScript for type safety\n- Vite for build tooling\n- Responsive design with CSS Grid/Flexbox"
    
    def _generate_microservices_architecture(self, features: List[str]) -> str:
        return "- NestJS with modular architecture\n- Event-driven communication\n- Database per service pattern\n- API Gateway for routing"
    
    def _generate_data_architecture(self, features: List[str]) -> str:
        return "- PostgreSQL for relational data\n- Redis for caching and sessions\n- Event sourcing for audit trails\n- Backup and disaster recovery"
    
    def _generate_deployment_requirements(self) -> str:
        return "- Docker containerization\n- Kubernetes orchestration\n- CI/CD pipeline with GitHub Actions\n- Environment-specific configurations"
    
    def _generate_implementation_recommendations(self, complexity: str) -> str:
        recommendations = {
            'low': "Start with MVP implementation. Use established patterns and libraries.",
            'medium': "Implement in phases. Set up proper monitoring and logging from the start.",
            'high': "Requires detailed technical planning. Consider proof-of-concept for complex components."
        }
        return recommendations.get(complexity, recommendations['medium'])
    
    def _generate_clarification_questions(self, user_message: str) -> str:
        return """1. What is the primary use case for this system?
2. How many users do you expect initially and at scale?
3. Are there any specific integrations required?
4. What are the main business constraints?
5. Are there any specific compliance requirements?"""


def main():
    """Main entry point for the requirements writer agent"""
    try:
        # Parse input from stdin
        input_raw = sys.stdin.read().strip()
        if not input_raw:
            print(json.dumps({"error": "No input provided"}))
            return
        
        input_data = json.loads(input_raw)
        user_message = input_data.get('userMessage', '')
        session_id = input_data.get('sessionId', 'unknown')
        metadata = input_data.get('metadata', {})
        
        # Initialize the LangGraph workflow
        workflow_instance = RequirementsWriterWorkflow()
        
        # Prepare initial state
        initial_state = RequirementsWriterState(
            user_message=user_message,
            session_id=session_id,
            analysis=None,
            document_type=None,
            features=[],
            complexity='medium',
            document_content='',
            metadata=metadata,
            error=None,
            workflow_step='initialized'
        )
        
        # Execute the LangGraph workflow
        final_state = workflow_instance.workflow.invoke(initial_state)
        
        # Format response
        response = {
            "response": final_state.get("document_content", "No content generated"),
            "analysis": final_state.get("analysis", {}),
            "metadata": {
                "document_type": final_state.get("document_type", "general"),
                "complexity": final_state.get("complexity", "medium"),
                "features": final_state.get("features", []),
                "workflow_step": final_state.get("workflow_step", "unknown"),
                "generated_at": datetime.now().isoformat(),
                "processing_type": "langgraph-workflow",
                "agent_type": "requirements_writer",
                "tools_used": ["langgraph", "state-management", "workflow-orchestration"],
                **final_state.get("metadata", {})
            }
        }
        
        # Handle errors in final state
        if final_state.get("error"):
            response["metadata"]["error"] = final_state["error"]
            response["metadata"]["workflow_status"] = "error"
        else:
            response["metadata"]["workflow_status"] = "success"
        
        print(json.dumps(response))
        
    except Exception as e:
        error_response = {
            "response": f"I apologize, but I encountered an error while processing your requirements request: {str(e)}",
            "analysis": {},
            "metadata": {
                "error": str(e),
                "workflow_status": "fatal_error",
                "generated_at": datetime.now().isoformat(),
                "processing_type": "langgraph-workflow",
                "agent_type": "requirements_writer"
            }
        }
        print(json.dumps(error_response))


if __name__ == "__main__":
    main() 