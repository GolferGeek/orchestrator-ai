import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

/**
 * HR Assistant Agent Function - Simple LangGraph Implementation
 *
 * This demonstrates a basic LangGraph workflow for HR assistance:
 * 1. Classify the query type
 * 2. Route to appropriate processing
 * 3. Generate response with proper routing recommendations
 */

interface HRQueryClassification {
  type:
    | 'benefits'
    | 'leave'
    | 'policy'
    | 'performance'
    | 'payroll'
    | 'workplace'
    | 'general';
  confidence: number;
  topic: string;
  complexity: 'simple' | 'moderate' | 'complex';
  sensitive: boolean;
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
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<HRWorkflowState> {
  progressCallback?.(
    'Classifying HR query',
    0,
    'in_progress',
    'Analyzing query type and complexity',
  );
  const classificationPrompt = `You are an HR specialist classifier. Analyze this HR query and classify it.

Classification Types:
- benefits: Health insurance, retirement, compensation, enrollment questions
- leave: Vacation, sick leave, FMLA, bereavement, time off policies
- policy: Company policies, procedures, workplace standards, code of conduct
- performance: Reviews, goals, feedback, career development, promotions
- payroll: Salary, bonuses, deductions, tax forms, pay schedules
- workplace: Conflict resolution, accommodations, safety, remote work
- general: Basic HR information, company culture, general guidance

User Query: "${state.userMessage}"

Respond with a JSON object:
{
  "type": "classification_type",
  "confidence": 0.95,
  "topic": "specific_topic_description",
  "complexity": "simple/moderate/complex",
  "sensitive": true/false
}`;

  try {
    const classificationResponse = await llmService.generateResponse(
      'You are an expert HR query classifier. Always respond with valid JSON.',
      classificationPrompt,
      { 
        temperature: 0.1, 
        maxTokens: 200,
        callerType: 'agent',
        callerName: 'hr-assistant-agent',
        conversationId: state.metadata?.sessionId,
        dataClassification: 'confidential',
        providerName: 'anthropic',
        modelName: 'claude-3-5-sonnet-20241022',
      },
    );

    // Handle both string and object responses from LLM service
    const responseContent = typeof classificationResponse === 'string' 
      ? classificationResponse 
      : classificationResponse?.content || classificationResponse?.response || String(classificationResponse);
    
    const classification: HRQueryClassification = JSON.parse(
      responseContent,
    );

    progressCallback?.(
      'Classifying HR query',
      0,
      'completed',
      `Classified as ${classification.type} query (${classification.confidence * 100}% confidence)`,
    );

    return {
      ...state,
      classification,
      metadata: {
        ...state.metadata,
        classification_step: 'completed',
        query_type: classification.type,
      },
    };
  } catch (error) {
    // Fallback classification
    return {
      ...state,
      classification: {
        type: 'general',
        confidence: 0.5,
        topic: 'general_hr_inquiry',
        complexity: 'simple',
        sensitive: false,
      },
      metadata: {
        ...state.metadata,
        classification_step: 'fallback',
        classification_error:
          error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Step 2: Generate appropriate response based on classification
 */
async function generateResponse(
  state: HRWorkflowState,
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<HRWorkflowState> {
  progressCallback?.(
    'Generating HR response',
    1,
    'in_progress',
    `Creating ${state.classification?.type} response`,
  );
  if (!state.classification) {
    throw new Error('Classification required before response generation');
  }

  const { type, complexity, sensitive, topic } = state.classification;

  let systemPrompt = '';
  let responsePrompt = '';

  // Base system prompt for all HR responses
  const basePrompt = `You are a knowledgeable HR Assistant providing direct, helpful guidance to employees. You have comprehensive knowledge of standard HR practices, benefits, policies, and procedures. Always be professional, empathetic, and actionable in your responses.`;

  switch (type) {
    case 'benefits':
      systemPrompt = `${basePrompt} You specialize in employee benefits including health insurance, retirement plans, flexible spending accounts, and enrollment processes. Provide specific, actionable guidance.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide a comprehensive response about this benefits question. Include:
1. Direct answer to their specific question
2. Key details they should know
3. Next steps or action items
4. Important deadlines or enrollment periods if relevant
5. How to access more information or make changes

Be specific and helpful - they're asking HR directly.`;
      break;

    case 'leave':
      systemPrompt = `${basePrompt} You specialize in leave policies including vacation, sick leave, FMLA, bereavement, and time-off procedures. Provide clear guidance on policies and processes.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide a helpful response about this leave-related question. Include:
1. Explanation of the relevant leave policy
2. How to request or use this type of leave
3. Required documentation or approval process
4. Typical timeframes and limitations
5. How to check their current leave balance if applicable

Be clear about both their rights and responsibilities.`;
      break;

    case 'policy':
      systemPrompt = `${basePrompt} You specialize in company policies, workplace standards, and procedures. Help employees understand and navigate company policies effectively.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide a thorough response about this policy question. Include:
1. Explanation of the relevant policy or procedure
2. Why this policy exists and how it helps
3. Specific steps they should follow
4. What to expect from the process
5. Who to contact if they need additional support

Make complex policies easy to understand and follow.`;
      break;

    case 'performance':
      systemPrompt = `${basePrompt} You specialize in performance management, career development, reviews, and professional growth. Help employees understand and succeed in their performance journey.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide supportive guidance about this performance-related question. Include:
1. Clear explanation of the process or expectation
2. How they can prepare or improve
3. Timeline and what to expect
4. Resources available to help them succeed
5. How to address concerns or get additional support

Focus on helping them grow and succeed professionally.`;
      break;

    case 'payroll':
      systemPrompt = `${basePrompt} You specialize in payroll, compensation, tax forms, deductions, and pay-related questions. Provide clear, accurate information about pay and compensation matters.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide a clear response about this payroll/compensation question. Include:
1. Direct answer to their pay-related question
2. How pay calculations or deductions work
3. Important dates (pay periods, tax deadlines, etc.)
4. How to access pay stubs or tax documents
5. Who to contact for payroll corrections or issues

Be precise about pay-related information and deadlines.`;
      break;

    case 'workplace':
      systemPrompt = `${basePrompt} You specialize in workplace issues including conflict resolution, accommodations, safety, remote work, and creating positive work environments.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide thoughtful guidance about this workplace question. Include:
1. Understanding of their situation or concern
2. Available options and resources
3. Recommended next steps
4. Support available through HR or management
5. How to escalate if needed

${sensitive ? 'Handle this sensitively - it may involve personal or confidential matters.' : ''}
Focus on creating solutions and positive outcomes.`;
      break;

    case 'general':
      systemPrompt = `${basePrompt} Provide general HR guidance and help employees navigate various HR topics and company resources.`;
      responsePrompt = `Employee Question: "${state.userMessage}"

Provide a helpful response to this general HR question. Include:
1. Direct answer to their question
2. Relevant background information
3. How this applies to them specifically
4. Additional resources or next steps
5. Related topics they might also find useful

Be comprehensive and anticipate follow-up questions they might have.`;
      break;
  }

  try {
    const response = await llmService.generateResponse(
      systemPrompt,
      responsePrompt,
      {
        temperature: 0.7,
        maxTokens: 500,
        callerType: 'agent',
        callerName: 'hr-assistant-agent',
        conversationId: state.metadata?.sessionId,
        dataClassification: 'confidential',
        providerName: 'anthropic',
        modelName: 'claude-3-5-sonnet-20241022',
      },
    );

    const complexityNote = complexity === 'complex' ? ' (complex topic)' : '';
    progressCallback?.(
      'Generating HR response',
      1,
      'completed',
      `HR response generated for ${type} query${complexityNote}`,
    );

    // Handle both string and object responses from LLM service
    const responseContent = typeof response === 'string' 
      ? response 
      : response?.content || response?.response || String(response);

    return {
      ...state,
      response: responseContent,
      metadata: {
        ...state.metadata,
        response_step: 'completed',
        query_type: type,
        complexity_level: complexity,
        sensitive_topic: sensitive,
      },
    };
  } catch (error) {
    return {
      ...state,
      response: `I apologize, but I encountered an issue processing your HR question. Please contact the HR department directly for assistance with: "${topic}".`,
      metadata: {
        ...state.metadata,
        response_step: 'error',
        response_error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main LangGraph workflow execution
 */
async function executeHRWorkflow(
  userMessage: string,
  llmService: any,
  sessionId?: string,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<{ response: string; metadata: Record<string, any> }> {
  // Initialize workflow state
  let state: HRWorkflowState = {
    userMessage,
    classification: null,
    response: '',
    metadata: {
      workflow_id: `hr_${Date.now()}`,
      sessionId: sessionId || 'unknown',
      steps_completed: [],
    },
  };

  try {
    // Step 1: Classify the query
    state = await classifyQuery(state, llmService, progressCallback);
    state.metadata.steps_completed.push('classification');

    // Step 2: Generate response
    state = await generateResponse(state, llmService, progressCallback);
    state.metadata.steps_completed.push('response_generation');

    return {
      response: state.response,
      metadata: {
        ...state.metadata,
        workflow_status: 'completed',
        total_steps: 2,
      },
    };
  } catch (error) {
    return {
      response: `I apologize, but I encountered an issue with your HR question. Please contact the HR department directly for assistance.`,
      metadata: {
        ...state.metadata,
        workflow_status: 'error',
        workflow_error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Main agent function export
 */
export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const { userMessage, sessionId, llmService, progressCallback } = params;
  const startTime = Date.now();

  try {
    // Execute LangGraph workflow
    const { response, metadata: workflowMetadata } = await executeHRWorkflow(
      userMessage,
      llmService,
      sessionId,
      progressCallback,
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
        workflow: workflowMetadata,
      },
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
        toolsUsed: ['llm-service'],
      },
    };
  }
}
