"""Document generation node - Coordinates with specialist agents or uses LLM for document creation"""

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
    from agent_caller import call_prd_writer, call_technical_writer, call_specialist_agent
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
    
    def call_prd_writer(features, user_message): return "Fallback PRD content"
    def call_technical_writer(content): return "Fallback technical content"
    def call_specialist_agent(agent_type, content): return "Fallback specialist content"
    
    class LLMClient:
        async def call_llm_service(self, system_prompt, user_prompt, options=None):
            return "Fallback response - LLM service not available"
    llm_client = LLMClient()


async def generate_document_node(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Node: Generate the actual requirements document using specialist agents or LLM"""
    
    print(f"DEBUG: generate_document_node started with keys: {list(state_dict.keys())}", file=sys.stderr)
    
    state = RequirementsWriterState(state_dict)
    
    print(f"DEBUG: RequirementsWriterState created, task_id: {state.task_id}", file=sys.stderr)
    print(f"DEBUG: Document type: {getattr(state, 'document_type', 'NOT_SET')}", file=sys.stderr)
    print(f"DEBUG: Features count: {len(getattr(state, 'features', []))}", file=sys.stderr)
    
    try:
        # Emit start event
        print(f"DEBUG: About to emit progress for generate_document", file=sys.stderr)
        document_type = getattr(state, 'document_type', 'general')
        emit_progress(
            state.task_id,
            "generate_document",
            5,
            9,
            "in_progress",
            f"Generating {document_type.upper()} document using AI specialist knowledge..."
        )
        print(f"DEBUG: Progress emitted successfully", file=sys.stderr)
        
        # Route to appropriate document generator based on type
        document_generators = {
            'prd': generate_prd_document,
            'trd': generate_trd_document,
            'api': generate_api_document,
            'user_story': generate_user_story_document,
            'architecture': generate_architecture_document,
            'general': generate_general_document
        }
        
        document_type = getattr(state, 'document_type', 'general')
        generator = document_generators.get(document_type, generate_general_document)
        
        print(f"DEBUG: Using generator for document type: {document_type} -> {generator.__name__}", file=sys.stderr)
        
        # Generate document content
        start_time = datetime.now()
        try:
            content = await generator(state)
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"DEBUG: Document generation completed in {duration:.2f}s, content length: {len(content) if content else 0} chars", file=sys.stderr)
            if content:
                print(f"DEBUG: Document content preview: {content[:200]}...", file=sys.stderr)
            else:
                print(f"ERROR: Document generator returned empty content!", file=sys.stderr)
        except Exception as e:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            print(f"ERROR: Document generation failed after {duration:.2f}s: {e}", file=sys.stderr)
            content = f"ERROR: Document generation failed: {e}"
        
        # Update state
        print(f"DEBUG: About to update state with document content (length: {len(content) if content else 0})", file=sys.stderr)
        try:
            state.set_document_content(content)
            print(f"DEBUG: State updated successfully with document content", file=sys.stderr)
        except Exception as state_error:
            print(f"ERROR: Failed to update state with document content: {state_error}", file=sys.stderr)
        
        # Emit completion event
        print(f"DEBUG: About to emit completion progress", file=sys.stderr)
        try:
            emit_progress(
                state.task_id,
                "generate_document",
                5,
                9,
                "completed",
                f"{document_type.upper()} document generated - {len(content) if content else 0} characters"
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
        error_msg = f"Document generation failed: {str(e)}"
        print(f"ERROR: Exception in generate_document_node: {error_msg}", file=sys.stderr)
        print(f"ERROR: Exception type: {type(e)}", file=sys.stderr)
        import traceback
        print(f"ERROR: Full traceback: {traceback.format_exc()}", file=sys.stderr)
        
        try:
            emit_progress(getattr(state, 'task_id', 'unknown'), "generate_document", 5, 9, "failed", error_msg)
        except Exception as emit_error:
            print(f"ERROR: Failed to emit error progress: {emit_error}", file=sys.stderr)
        
        try:
            state.set_error(error_msg)
            return state.to_dict()
        except Exception as state_error:
            print(f"ERROR: Failed to set error state: {state_error}", file=sys.stderr)
            return {"error": error_msg, "userMessage": state_dict.get("userMessage", ""), "metadata": state_dict.get("metadata", {})}


async def generate_prd_document(state: RequirementsWriterState) -> str:
    """Generate Product Requirements Document"""
    
    # Try to call specialist agent first (when available)
    try:
        task_data = state.create_agent_task_data({
            'document_type': 'prd',
            'specialized_request': f"Generate a comprehensive PRD for: {state.user_message}"
        })
        
        result = await call_prd_writer(task_data)
        if result and not result.startswith("Error calling"):
            return result
            
    except Exception as e:
        print(f"Specialist PRD writer not available: {e}", file=sys.stderr)
    
    # Fallback to direct LLM generation
    return await generate_prd_with_llm(state)


async def generate_prd_with_llm(state: RequirementsWriterState) -> str:
    """Generate PRD using direct LLM call"""
    
    print(f"DEBUG: generate_prd_with_llm started", file=sys.stderr)
    
    try:
        llm_options = llm_client.create_options(**state.llm_preferences)
        print(f"DEBUG: LLM options created for PRD generation", file=sys.stderr)
    except Exception as e:
        print(f"ERROR: Failed to create LLM options for PRD: {e}", file=sys.stderr)
        llm_options = {}
    
    system_prompt = """You are a senior product manager and PRD specialist. Create a comprehensive Product Requirements Document (PRD) that includes:

1. **Executive Summary** - Brief overview and business justification
2. **Product Overview** - Goals, objectives, success metrics
3. **User Personas & Use Cases** - Target users and their needs
4. **Functional Requirements** - Detailed feature specifications
5. **User Stories** - Acceptance criteria and user workflows
6. **Non-Functional Requirements** - Performance, security, scalability
7. **Technical Considerations** - High-level technical requirements
8. **Implementation Timeline** - Phases and milestones
9. **Success Metrics** - KPIs and measurement criteria
10. **Risk Assessment** - Potential challenges and mitigation

Write in a professional, detailed manner suitable for stakeholders, developers, and designers."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create a comprehensive PRD for this request:

{context}

Features to include: {features_text}
Complexity Level: {state.complexity}

Generate a complete, professional PRD that covers all necessary sections for successful product development."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


async def generate_trd_document(state: RequirementsWriterState) -> str:
    """Generate Technical Requirements Document"""
    
    # Try specialist agent first
    try:
        task_data = state.create_agent_task_data({
            'document_type': 'trd',
            'specialized_request': f"Generate comprehensive technical requirements for: {state.user_message}"
        })
        
        result = await call_technical_writer(task_data)
        if result and not result.startswith("Error calling"):
            return result
            
    except Exception as e:
        print(f"Specialist TRD writer not available: {e}", file=sys.stderr)
    
    # Fallback to LLM
    return await generate_trd_with_llm(state)


async def generate_trd_with_llm(state: RequirementsWriterState) -> str:
    """Generate TRD using direct LLM call"""
    
    llm_options = llm_client.create_options(**state.llm_preferences)
    
    system_prompt = """You are a senior systems architect and technical documentation specialist. Create a comprehensive Technical Requirements Document (TRD) that includes:

1. **System Overview** - High-level architecture and technical approach
2. **Technical Architecture** - System components, services, and interactions
3. **Database Requirements** - Data models, storage requirements, performance needs
4. **API Specifications** - Service interfaces, protocols, and data formats
5. **Security Requirements** - Authentication, authorization, encryption, compliance
6. **Performance Requirements** - Scalability, throughput, response times, load handling
7. **Infrastructure Requirements** - Deployment, hosting, monitoring, backup
8. **Integration Requirements** - External systems, third-party services, data flows
9. **Development Standards** - Coding practices, testing requirements, documentation
10. **Deployment Strategy** - CI/CD, environments, rollback procedures

Write for a technical audience including architects, senior developers, and DevOps engineers."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create a comprehensive TRD for this request:

{context}

Technical Components: {features_text}
Complexity Level: {state.complexity}

Generate detailed technical specifications suitable for system implementation."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


async def generate_api_document(state: RequirementsWriterState) -> str:
    """Generate API Requirements Document"""
    
    llm_options = llm_client.create_options(**state.llm_preferences)
    
    system_prompt = """You are an API design specialist. Create a comprehensive API Requirements Document that includes:

1. **API Overview** - Purpose, scope, and design principles
2. **Authentication & Authorization** - Security model and access control
3. **Endpoint Specifications** - REST/GraphQL endpoints with parameters
4. **Data Models** - Request/response schemas and data structures
5. **Error Handling** - Error codes, messages, and handling strategies
6. **Rate Limiting & Throttling** - Usage limits and policies
7. **Versioning Strategy** - API evolution and backward compatibility
8. **Integration Examples** - Sample requests, responses, and SDKs
9. **Testing Requirements** - API testing strategies and tools
10. **Documentation Standards** - OpenAPI/Swagger specifications

Focus on RESTful design principles and industry best practices."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create comprehensive API requirements for this request:

{context}

API Features: {features_text}
Complexity Level: {state.complexity}

Generate detailed API specifications including endpoints, data models, and integration guidelines."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


async def generate_user_story_document(state: RequirementsWriterState) -> str:
    """Generate User Story Document"""
    
    llm_options = llm_client.create_options(**state.llm_preferences)
    
    system_prompt = """You are an agile coach and user story specialist. Create a comprehensive User Story Document that includes:

1. **Project Overview** - Goals and user-centered approach
2. **User Personas** - Detailed user types and their characteristics
3. **Epic Stories** - High-level user journeys and major features
4. **Detailed User Stories** - Specific features with "As a...I want...So that..." format
5. **Acceptance Criteria** - Clear, testable conditions for story completion
6. **Story Dependencies** - Prerequisites and sequential relationships
7. **Story Prioritization** - MoSCoW or similar prioritization framework
8. **Definition of Done** - Quality standards and completion criteria
9. **Story Estimation** - Relative sizing (story points or t-shirt sizes)
10. **Sprint Planning Guidance** - Recommended grouping and sequencing

Focus on user value and clear, actionable stories for agile development."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create comprehensive user stories for this request:

{context}

Features to cover: {features_text}
Complexity Level: {state.complexity}

Generate user-centered stories with clear acceptance criteria and agile development guidance."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


async def generate_architecture_document(state: RequirementsWriterState) -> str:
    """Generate System Architecture Document"""
    
    llm_options = llm_client.create_options(**state.llm_preferences)
    
    system_prompt = """You are a principal systems architect. Create a comprehensive System Architecture Document that includes:

1. **Architecture Overview** - High-level system design and principles
2. **System Context** - External systems, users, and environment
3. **Architecture Patterns** - Microservices, MVC, event-driven, etc.
4. **Component Design** - Services, modules, and their responsibilities
5. **Data Architecture** - Storage systems, data flow, and management
6. **Infrastructure Architecture** - Deployment, scaling, and operations
7. **Security Architecture** - Security layers, controls, and protocols
8. **Integration Architecture** - APIs, messaging, and external connections
9. **Quality Attributes** - Performance, reliability, maintainability
10. **Architecture Decisions** - Key choices with rationale and trade-offs

Create detailed diagrams descriptions and architectural blueprints."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create comprehensive system architecture for this request:

{context}

System Components: {features_text}
Complexity Level: {state.complexity}

Generate detailed architectural specifications including component design, data flow, and infrastructure requirements."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


async def generate_general_document(state: RequirementsWriterState) -> str:
    """Generate General Requirements Document"""
    
    print(f"DEBUG: generate_general_document started", file=sys.stderr)
    
    try:
        llm_options = llm_client.create_options(**state.llm_preferences)
        print(f"DEBUG: LLM options created for general document generation", file=sys.stderr)
    except Exception as e:
        print(f"ERROR: Failed to create LLM options for general doc: {e}", file=sys.stderr)
        llm_options = {}
    
    system_prompt = """You are a business analyst and requirements specialist. Create a comprehensive Requirements Document that includes:

1. **Project Overview** - Purpose, scope, and objectives
2. **Stakeholder Analysis** - Users, sponsors, and affected parties
3. **Business Requirements** - High-level business needs and goals
4. **Functional Requirements** - Specific system capabilities and features
5. **Non-Functional Requirements** - Performance, security, usability
6. **Constraints** - Technical, business, and regulatory limitations
7. **Assumptions** - Dependencies and assumptions made
8. **Implementation Approach** - Recommended methodology and phases
9. **Success Criteria** - Measurable outcomes and acceptance criteria
10. **Next Steps** - Recommended actions and planning guidance

Create a balanced document suitable for both technical and business stakeholders."""

    context = state.get_context_for_llm()
    features_text = ", ".join(state.features) if state.features else "No specific features identified"
    
    user_prompt = f"""Create comprehensive requirements documentation for this request:

{context}

Identified Components: {features_text}
Complexity Level: {state.complexity}

Generate detailed requirements that cover both business and technical aspects."""

    response = await llm_client.call_llm_service(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        options=llm_options
    )
    
    return response


# For testing/development
if __name__ == "__main__":
    import asyncio
    
    test_state_dict = {
        "userMessage": "Build a mobile fitness tracking app with social features",
        "sessionId": "test-session",
        "metadata": {"taskId": "test-task"},
        "document_type": "prd",
        "features": ["User Registration", "Workout Tracking", "Social Sharing", "Progress Analytics"],
        "complexity": "medium",
        "analysis": {"summary": "Fitness app with social features"}
    }
    
    async def test():
        result = await generate_document_node(test_state_dict)
        content = result.get('document_content', '')
        print(f"Generated document ({len(content)} chars):")
        print(content[:500] + "..." if len(content) > 500 else content)
    
    asyncio.run(test())