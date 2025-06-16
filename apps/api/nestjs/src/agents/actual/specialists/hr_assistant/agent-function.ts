import { AgentFunctionParams, AgentFunctionResponse } from '../../../base/services/base-services/a2a-base/interfaces';

/**
 * HR Assistant Agent Function - Simple LangGraph Implementation
 * 
 * This demonstrates a basic LangGraph workflow for HR assistance:
 * 1. Classify the query type
 * 2. Route to appropriate processing
 * 3. Generate response with proper routing recommendations
 */

interface HRQueryClassification {
  type: 'general' | 'onboarding' | 'policy' | 'personal_data' | 'complex';
  confidence: number;
  topic: string;
  requires_routing: boolean;
  target_agent?: string;
}

interface HRWorkflowState {
  userMessage: string;
  classification: HRQueryClassification | null;
  response: string;
  metadata: Record<string, any>;
}

/**
 * Step 1: Classify the HR query to determine how to handle it
 */
async function classifyQuery(
  state: HRWorkflowState,
  llmService: any
): Promise<HRWorkflowState> {
  const classificationPrompt = `You are an HR query classifier. Analyze the following user query and classify it.

Classification Types:
- general: General HR questions about benefits, leave types, processes (answer directly)
- onboarding: New employee questions (route to WelcomeWiz)
- policy: Specific policy details or document questions (route to PolicyPal)
- personal_data: Questions about personal employee information (cannot access)
- complex: Legal advice, complex employee relations (refer to human HR)

User Query: "${state.userMessage}"

Respond with a JSON object:
{
  "type": "classification_type",
  "confidence": 0.95,
  "topic": "brief_topic_description",
  "requires_routing": true/false,
  "target_agent": "agent_name_if_routing_needed"
}`;

  try {
    const classificationResponse = await llmService.generateResponse(
      'You are an expert HR query classifier. Always respond with valid JSON.',
      classificationPrompt,
      { temperature: 0.1, maxTokens: 200 }
    );

    const classification: HRQueryClassification = JSON.parse(classificationResponse);
    
    return {
      ...state,
      classification,
      metadata: {
        ...state.metadata,
        classification_step: 'completed',
        query_type: classification.type
      }
    };
  } catch (error) {
    // Fallback classification
    return {
      ...state,
      classification: {
        type: 'general',
        confidence: 0.5,
        topic: 'general_hr_inquiry',
        requires_routing: false
      },
      metadata: {
        ...state.metadata,
        classification_step: 'fallback',
        classification_error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Step 2: Generate appropriate response based on classification
 */
async function generateResponse(
  state: HRWorkflowState,
  llmService: any
): Promise<HRWorkflowState> {
  if (!state.classification) {
    throw new Error('Classification required before response generation');
  }

  const { type, requires_routing, target_agent, topic } = state.classification;

  let systemPrompt = '';
  let responsePrompt = '';

  switch (type) {
    case 'general':
      systemPrompt = `You are HRAssistPro, a professional HR assistant. Provide helpful, accurate information about general HR topics like benefits, leave types, performance management, and payroll basics. Be professional and empathetic.`;
      responsePrompt = `User Query: "${state.userMessage}"

Provide a helpful response about this HR topic. Include general information and, if applicable, mention where they can find more specific details.`;
      break;

    case 'onboarding':
      systemPrompt = `You are HRAssistPro. This query is about new employee onboarding, which should be handled by our specialized WelcomeWiz agent.`;
      responsePrompt = `User Query: "${state.userMessage}"

This appears to be an onboarding-related question. Politely explain that WelcomeWiz, our specialized onboarding agent, can best assist with this type of question. Provide a brief overview if helpful, but emphasize the routing recommendation.`;
      break;

    case 'policy':
      systemPrompt = `You are HRAssistPro. This query requires specific policy information that should be handled by our PolicyPal agent or official documentation.`;
      responsePrompt = `User Query: "${state.userMessage}"

This question requires specific policy details. Explain that PolicyPal, our policy specialist with access to HR documents, would be the best resource. Also mention checking official employee handbooks or HR portals.`;
      break;

    case 'personal_data':
      systemPrompt = `You are HRAssistPro. This query involves personal employee data that you cannot access.`;
      responsePrompt = `User Query: "${state.userMessage}"

This question involves personal employee information. Clearly explain that you cannot access personal data, HRIS systems, or individual employee records. Direct them to the appropriate HR portal, HRIS system, or human HR representative.`;
      break;

    case 'complex':
      systemPrompt = `You are HRAssistPro. This query is complex and requires human HR intervention.`;
      responsePrompt = `User Query: "${state.userMessage}"

This appears to be a complex HR matter that requires human expertise. Politely explain that you cannot provide legal advice or handle complex employee relations issues. Direct them to contact the HR department directly for proper assistance.`;
      break;
  }

  try {
    const response = await llmService.generateResponse(systemPrompt, responsePrompt, {
      temperature: 0.7,
      maxTokens: 500
    });

    return {
      ...state,
      response,
      metadata: {
        ...state.metadata,
        response_step: 'completed',
        routing_recommended: requires_routing,
        target_agent: target_agent || null
      }
    };
  } catch (error) {
    return {
      ...state,
      response: `I apologize, but I encountered an issue processing your HR question. Please contact the HR department directly for assistance with: "${topic}".`,
      metadata: {
        ...state.metadata,
        response_step: 'error',
        response_error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Main LangGraph workflow execution
 */
async function executeHRWorkflow(
  userMessage: string,
  llmService: any,
  sessionId?: string
): Promise<{ response: string; metadata: Record<string, any> }> {
  
  // Initialize workflow state
  let state: HRWorkflowState = {
    userMessage,
    classification: null,
    response: '',
    metadata: {
      workflow_id: `hr_${Date.now()}`,
      session_id: sessionId || 'unknown',
      steps_completed: []
    }
  };

  try {
    // Step 1: Classify the query
    state = await classifyQuery(state, llmService);
    state.metadata.steps_completed.push('classification');

    // Step 2: Generate response
    state = await generateResponse(state, llmService);
    state.metadata.steps_completed.push('response_generation');

    return {
      response: state.response,
      metadata: {
        ...state.metadata,
        workflow_status: 'completed',
        total_steps: 2
      }
    };

  } catch (error) {
    return {
      response: `I apologize, but I encountered an issue with your HR question. Please contact the HR department directly for assistance.`,
      metadata: {
        ...state.metadata,
        workflow_status: 'error',
        workflow_error: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

/**
 * Main agent function export
 */
export async function execute(params: AgentFunctionParams): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, llmService } = params;
  const startTime = Date.now();

  try {
    // Execute LangGraph workflow
    const { response, metadata: workflowMetadata } = await executeHRWorkflow(
      userMessage,
      llmService,
      sessionId
    );

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      response,
      metadata: {
        agentName: 'hr-assistant',
        processingType: 'langgraph-workflow',
        processingTime,
        sessionId,
        toolsUsed: ['llm-service', 'langgraph'],
        responseType: 'hr-assistance',
        workflow: workflowMetadata
      }
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      response: `I apologize, but I encountered an error processing your HR question. Please contact the HR department directly for assistance.`,
      metadata: {
        agentName: 'hr-assistant',
        processingType: 'error-fallback',
        processingTime,
        sessionId,
        error: errorMessage,
        toolsUsed: ['llm-service']
      }
    };
  }
} 