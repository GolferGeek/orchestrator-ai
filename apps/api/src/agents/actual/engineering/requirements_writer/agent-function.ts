import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

interface AnalysisResult {
  intent: string;
  scope: string;
  clarity: string;
  urgency: string;
  domain: string;
  confidence: number;
  key_indicators: string[];
  missing_info: string[];
  summary: string;
  [key: string]: any;
}

interface DocumentTypeResult {
  document_type?: string;
  confidence?: number;
  reasoning?: string;
  alternative_types?: string[];
  suggested_sections?: string[];
  [key: string]: any;
}

interface FeatureExtractionResult {
  core_features?: string[];
  technical_components?: string[];
  user_features?: string[];
  integrations?: string[];
  security_features?: string[];
  all_features?: string[];
  feature_categories?: Record<string, string[]>;
  estimated_complexity?: string;
  priority_features?: string[];
  [key: string]: any;
}

interface ComplexityAssessmentResult {
  overall_complexity?: string;
  complexity_score?: number;
  effort_estimate?: string;
  team_size_recommendation?: string;
  complexity_factors?: Record<string, number>;
  risk_level?: string;
  key_challenges?: string[];
  recommended_approach?: string;
  technology_recommendations?: string[];
  phases?: string[];
  [key: string]: any;
}

const STEP_SEQUENCE = [
  'analyze_request',
  'determine_document_type',
  'extract_features',
  'assess_complexity',
  'generate_document',
  'finalize_response',
] as const;

const DEFAULT_ANALYSIS: AnalysisResult = {
  intent: 'requirements_generation',
  scope: 'medium',
  clarity: 'medium',
  urgency: 'normal',
  domain: 'technical',
  confidence: 0.6,
  key_indicators: [],
  missing_info: [],
  summary: '',
};

const DEFAULT_FEATURES: FeatureExtractionResult = {
  core_features: [],
  technical_components: [],
  user_features: [],
  integrations: [],
  security_features: [],
  all_features: [],
  feature_categories: {},
  estimated_complexity: 'medium',
  priority_features: [],
};

const DEFAULT_COMPLEXITY: ComplexityAssessmentResult = {
  overall_complexity: 'medium',
  complexity_score: 6,
  effort_estimate: '3-6 weeks',
  team_size_recommendation: '3-5',
  complexity_factors: {},
  risk_level: 'medium',
  key_challenges: [],
  recommended_approach: 'agile',
  technology_recommendations: [],
  phases: [],
};

const DOCUMENT_PROMPTS = {
  prd: {
    label: 'Product Requirements Document',
    systemPrompt: `You are a senior product manager and PRD specialist. Create a comprehensive Product Requirements Document (PRD).

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
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

Write in a professional, detailed manner suitable for stakeholders, developers, and designers.`,
    completionMessage: 'PRD generated successfully',
  },
  trd: {
    label: 'Technical Requirements Document',
    systemPrompt: `You are a senior systems architect and technical documentation specialist. Create a comprehensive Technical Requirements Document (TRD).

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
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

Write for a technical audience including architects, senior developers, and DevOps engineers.`,
    completionMessage: 'TRD generated successfully',
  },
  api: {
    label: 'API Requirements Document',
    systemPrompt: `You are an API design specialist. Create a comprehensive API Requirements Document.

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
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

Focus on RESTful design principles and industry best practices.`,
    completionMessage: 'API requirements generated successfully',
  },
  user_story: {
    label: 'User Story Document',
    systemPrompt: `You are an agile coach and user story specialist. Create a comprehensive User Story Document.

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
1. **Project Overview** - Goals and user-centered approach
2. **User Personas** - Detailed user types and their characteristics
3. **Epic Stories** - High-level user journeys and major features
4. **Detailed User Stories** - Specific features with "As a...I want...So that..." format
5. **Acceptance Criteria** - Clear, testable conditions for story completion
6. **Story Dependencies** - Prerequisites and sequential relationships
7. **Story Prioritization** - Prioritization framework (e.g., MoSCoW)
8. **Definition of Done** - Quality standards and completion criteria
9. **Story Estimation** - Relative sizing guidance
10. **Sprint Planning Guidance** - Recommended grouping and sequencing

Focus on user value and clear, actionable stories for agile development.`,
    completionMessage: 'User story document generated successfully',
  },
  architecture: {
    label: 'Architecture Requirements Document',
    systemPrompt: `You are a principal software architect. Create a comprehensive Architecture Requirements Document.

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
1. **Architecture Overview** - System vision and guiding principles
2. **System Components** - Services, modules, and responsibilities
3. **Data Flow & Integrations** - Internal and external data movement
4. **Technology Stack** - Recommended technologies and rationale
5. **Scalability & Performance** - Capacity planning and scaling strategies
6. **Security Architecture** - Threat model, controls, compliance
7. **Deployment Architecture** - Environments, networking, DevOps practices
8. **Monitoring & Observability** - Logging, metrics, alerting strategy
9. **Risk Assessment** - Technical risks and mitigation plans
10. **Roadmap & Phasing** - Implementation phases and dependencies

Write for technical leadership and engineering teams responsible for implementation.`,
    completionMessage: 'Architecture document generated successfully',
  },
  general: {
    label: 'Requirements Document',
    systemPrompt: `You are a senior requirements analyst. Create a comprehensive requirements document.

IMPORTANT: Return ONLY the document content starting with the title or first header. Do not include any conversational text, greetings, or explanations before or after the document.

The document should include:
1. **Executive Summary**
2. **Project Objectives & Scope**
3. **Stakeholders & Personas**
4. **Functional Requirements**
5. **Non-Functional Requirements**
6. **Technical Considerations**
7. **Risks & Assumptions**
8. **Implementation Plan**
9. **Success Metrics**

Write clearly and concisely for both business and technical audiences.`,
    completionMessage: 'Requirements document generated successfully',
  },
};

type DocumentTemplateKey = keyof typeof DOCUMENT_PROMPTS;

export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const startTime = Date.now();
  const {
    userMessage,
    conversationHistory = [],
    progressCallback,
    llmService,
    metadata,
  } = params;

  const updateProgress = (
    step: (typeof STEP_SEQUENCE)[number],
    index: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => {
    try {
      progressCallback?.(step, index, status, message);
    } catch (error) {
      // Guard against downstream callback errors breaking execution
      if (process?.env?.NODE_ENV !== 'production') {
        console.debug(
          `[RequirementsWriter] Failed to emit progress for ${step}:`,
          error,
        );
      }
    }
  };

  try {
    if (!llmService || typeof llmService.generateResponse !== 'function') {
      throw new Error(
        'LLM service is not available for the Requirements Writer agent.',
      );
    }

    const baseLlmOptions = resolveLlmOptions(params);
    const conversationContext = buildConversationContext(conversationHistory);
    const planContent = extractPlanContent(params);
    const mode = extractMode(params);
    const isBuilding = mode === 'build';

    // Step 1: Analyze request
    updateProgress(
      'analyze_request',
      0,
      'in_progress',
      'Analyzing request to understand requirements intent and scope...',
    );

    const analysis = await callLlmForJson<AnalysisResult>(
      llmService,
      baseLlmOptions,
      buildAnalysisSystemPrompt(),
      buildAnalysisUserPrompt(userMessage, conversationContext, isBuilding),
      DEFAULT_ANALYSIS,
    );

    updateProgress(
      'analyze_request',
      0,
      'completed',
      `Identified ${analysis.scope || 'medium'} scope ${analysis.domain || 'technical'} requirements`,
    );

    // Step 2: Determine document type
    updateProgress(
      'determine_document_type',
      1,
      'in_progress',
      'Determining the most appropriate requirements document type...',
    );

    const documentTypeResult = await callLlmForJson<DocumentTypeResult>(
      llmService,
      baseLlmOptions,
      buildDocumentTypeSystemPrompt(),
      buildDocumentTypeUserPrompt(userMessage, analysis),
      {},
    );

    const documentType: DocumentTemplateKey = normalizeDocumentType(
      documentTypeResult.document_type,
    );

    const documentTemplate = DOCUMENT_PROMPTS[documentType];

    updateProgress(
      'determine_document_type',
      1,
      'completed',
      `Document type selected: ${documentTemplate.label}`,
    );

    // Step 3: Extract features
    updateProgress(
      'extract_features',
      2,
      'in_progress',
      'Extracting key features and components from the request...',
    );

    const featureExtraction = await callLlmForJson<FeatureExtractionResult>(
      llmService,
      baseLlmOptions,
      buildFeatureExtractionSystemPrompt(),
      buildFeatureExtractionUserPrompt(userMessage, analysis, documentType),
      DEFAULT_FEATURES,
    );

    const featureSet = buildFeatureList(featureExtraction);

    updateProgress(
      'extract_features',
      2,
      'completed',
      `Identified ${featureSet.length} key features and components`,
    );

    // Step 4: Assess complexity
    updateProgress(
      'assess_complexity',
      3,
      'in_progress',
      'Assessing complexity, effort, and risk profile...',
    );

    const complexityAssessment = await callLlmForJson<ComplexityAssessmentResult>(
      llmService,
      baseLlmOptions,
      buildComplexitySystemPrompt(),
      buildComplexityUserPrompt(userMessage, analysis, featureSet, documentType),
      DEFAULT_COMPLEXITY,
    );

    const complexityLevel =
      (complexityAssessment.overall_complexity || 'medium').toLowerCase();

    updateProgress(
      'assess_complexity',
      3,
      'completed',
      `Complexity assessed as ${complexityLevel.toUpperCase()}`,
    );

    // Step 5: Generate document
    updateProgress(
      'generate_document',
      4,
      'in_progress',
      `Generating ${documentTemplate.label}...`,
    );

    const documentContent = await callLlmForDocument(
      llmService,
      baseLlmOptions,
      documentType,
      {
        userMessage,
        conversationContext,
        planContent,
        analysis,
        features: featureSet,
        complexity: complexityLevel,
        mode,
      },
    );

    updateProgress(
      'generate_document',
      4,
      'completed',
      `${documentTemplate.completionMessage} (${documentContent.length} chars)`,
    );

    // Step 6: Finalize
    updateProgress(
      'finalize_response',
      5,
      'completed',
      'Requirements document ready for review',
    );

    const finalMetadata = {
      agentName: 'Requirements Writer',
      processingTime: Date.now() - startTime,
      responseType: documentType,
      analysis,
      documentType: {
        value: documentType,
        confidence: documentTypeResult.confidence ?? null,
        reasoning: documentTypeResult.reasoning,
        alternatives: documentTypeResult.alternative_types,
      },
      features: {
        list: featureSet,
        categories: featureExtraction.feature_categories || {},
        estimatedComplexity: featureExtraction.estimated_complexity,
      },
      complexity: complexityAssessment,
      sections: countDocumentSections(documentContent),
      workflow: {
        totalSteps: STEP_SEQUENCE.length,
        mode,
        isBuilding,
      },
      piiMetadata: params.piiMetadata,
      originalPrompt: params.originalPrompt ?? userMessage,
      planIncluded: Boolean(planContent),
      conversationSummaries: conversationContext
        ? conversationContext.slice(0, 1000)
        : undefined,
      llmPreferences: baseLlmOptions.providerName
        ? {
            provider: baseLlmOptions.providerName,
            model: baseLlmOptions.modelName,
            temperature: baseLlmOptions.temperature,
          }
        : undefined,
      ...(metadata || {}),
    };

    return {
      success: true,
      response: documentContent,
      metadata: finalMetadata,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');

    updateProgress(
      'finalize_response',
      5,
      'failed',
      `Requirements generation failed: ${message}`,
    );

    const response = `## Requirements generation error\n\nI wasn’t able to produce the requirements document because of an error:\n\n> ${message}\n\nPlease try again with a slightly different request or contact support if the issue persists.`;

    return {
      success: false,
      response,
      metadata: {
        agentName: 'Requirements Writer',
        processingTime: Date.now() - startTime,
        responseType: 'error',
        error: message,
        piiMetadata: params.piiMetadata,
      },
    };
  }
}

function resolveLlmOptions(params: AgentFunctionParams): Record<string, any> {
  const selection = (params as any)?.llmSelection || {};
  const routingDecision = (params as any)?.routingDecision || {};
  const meta = params.metadata || {};

  const providerName =
    selection.providerName ||
    meta.providerName ||
    routingDecision.provider ||
    undefined;
  const modelName =
    selection.modelName ||
    meta.modelName ||
    routingDecision.model ||
    undefined;

  const temperature =
    selection.temperature ??
    meta.temperature ??
    routingDecision.temperature ??
    0.2;

  const maxTokens =
    selection.maxTokens ||
    meta.maxTokens ||
    routingDecision.maxTokens ||
    3500;

  return {
    providerName,
    modelName,
    temperature,
    maxTokens,
    callerType: 'agent',
    callerName: 'requirements_writer',
    conversationId: params.sessionId || meta.conversationId,
    userId: params.currentUser?.id,
    authToken: params.authToken,
    cidafmOptions: (params as any)?.cidafmOptions,
  };
}

async function callLlmForJson<T extends Record<string, any>>(
  llmService: any,
  baseOptions: Record<string, any>,
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
): Promise<T> {
  const result = await llmService.generateResponse(
    systemPrompt,
    userPrompt,
    baseOptions,
  );

  const text = extractText(result);

  try {
    const parsed = JSON.parse(text);
    return { ...fallback, ...parsed } as T;
  } catch (parseError) {
    return fallback;
  }
}

async function callLlmForDocument(
  llmService: any,
  baseOptions: Record<string, any>,
  documentType: DocumentTemplateKey,
  context: {
    userMessage: string;
    conversationContext: string;
    planContent?: string | null;
    analysis: AnalysisResult;
    features: string[];
    complexity: string;
    mode: string;
  },
): Promise<string> {
  const template = DOCUMENT_PROMPTS[documentType];

  const featureList = context.features.length
    ? context.features.join(', ')
    : 'No specific features identified';

  const planFragment = context.planContent
    ? `\nPLANNING CONTEXT:\n${context.planContent}`
    : '';

  const conversationFragment = context.conversationContext
    ? `\nCONVERSATION HISTORY:\n${context.conversationContext}`
    : '';

  const analysisFragment = `\nANALYSIS SUMMARY:\n- Intent: ${context.analysis.intent}\n- Scope: ${context.analysis.scope}\n- Domain: ${context.analysis.domain}\n- Summary: ${context.analysis.summary}`;

  const userPrompt = `Generate a ${template.label} for the following requirements scenario.

ORIGINAL REQUEST:
"${context.userMessage}"
${analysisFragment}

FEATURES & COMPONENTS:
${featureList}

COMPLEXITY LEVEL:
${context.complexity}
${planFragment}
${conversationFragment}

Generate a complete, professional document that satisfies the specification above. Start directly with the document title or first header (no conversational prefacing).`;

  const result = await llmService.generateResponse(
    template.systemPrompt,
    userPrompt,
    {
      ...baseOptions,
      temperature: Math.max(0.15, (baseOptions.temperature ?? 0.2) - 0.05),
      maxTokens: Math.max(3500, baseOptions.maxTokens ?? 3500),
    },
  );

  const content = extractText(result).trim();

  if (!content) {
    throw new Error('The language model did not return any document content.');
  }

  return stripLeadingConversation(content);
}

function buildAnalysisSystemPrompt(): string {
  return `You are an expert requirements analyst. Your job is to analyze user requests and understand:
1. Intent
2. Scope
3. Clarity
4. Urgency
5. Domain

Respond with a JSON object matching this schema:
{
  "intent": string,
  "scope": "small"|"medium"|"large"|"enterprise",
  "clarity": "low"|"medium"|"high",
  "urgency": "low"|"normal"|"high"|"urgent",
  "domain": "technical"|"business"|"product"|"operational"|"other",
  "confidence": number (0-1),
  "key_indicators": string[],
  "missing_info": string[],
  "summary": string
}`;
}

function buildAnalysisUserPrompt(
  userMessage: string,
  conversationContext: string,
  isBuilding: boolean,
): string {
  if (isBuilding && conversationContext) {
    return `Analyze this requirements conversation to understand what needs to be built.

CONVERSATION HISTORY:
${conversationContext}

LATEST REQUEST:
"${userMessage}"

Provide JSON following the required schema.`;
  }

  return `Analyze this requirements request:
"${userMessage}"

Provide JSON following the required schema.`;
}

function buildDocumentTypeSystemPrompt(): string {
  return `You are a technical documentation expert. Determine the optimal requirements document type.

Available document types:
- prd
- trd
- api
- user_story
- architecture
- general

Respond with JSON:
{
  "document_type": string,
  "confidence": number,
  "reasoning": string,
  "alternative_types": string[],
  "suggested_sections": string[]
}`;
}

function buildDocumentTypeUserPrompt(
  userMessage: string,
  analysis: AnalysisResult,
): string {
  const analysisSummary = `Intent: ${analysis.intent} | Scope: ${analysis.scope} | Domain: ${analysis.domain}`;
  return `Determine the best document type for this request.

ORIGINAL REQUEST:
"${userMessage}"

ANALYSIS SUMMARY:
${analysisSummary}`;
}

function buildFeatureExtractionSystemPrompt(): string {
  return `You are a feature extraction specialist. Identify key features, components, and capabilities.

Respond with JSON:
{
  "core_features": string[],
  "technical_components": string[],
  "user_features": string[],
  "integrations": string[],
  "security_features": string[],
  "all_features": string[],
  "feature_categories": Record<string,string[]>,
  "estimated_complexity": "low"|"medium"|"high",
  "priority_features": string[]
}`;
}

function buildFeatureExtractionUserPrompt(
  userMessage: string,
  analysis: AnalysisResult,
  documentType: string,
): string {
  return `Extract implementation-ready features and components for this ${documentType.toUpperCase()}.

REQUEST:
"${userMessage}"

ANALYSIS SUMMARY:
${analysis.summary || 'N/A'}

Key indicators: ${analysis.key_indicators?.join(', ') || 'None provided'}`;
}

function buildComplexitySystemPrompt(): string {
  return `You are a technical project manager. Assess project complexity.

Respond with JSON:
{
  "overall_complexity": "low"|"medium"|"high"|"enterprise",
  "complexity_score": number,
  "effort_estimate": string,
  "team_size_recommendation": string,
  "complexity_factors": Record<string,number>,
  "risk_level": "low"|"medium"|"high"|"critical",
  "key_challenges": string[],
  "recommended_approach": string,
  "technology_recommendations": string[],
  "phases": string[]
}`;
}

function buildComplexityUserPrompt(
  userMessage: string,
  analysis: AnalysisResult,
  features: string[],
  documentType: string,
): string {
  return `Assess complexity for this ${documentType.toUpperCase()} initiative.

REQUEST:
"${userMessage}"

ANALYSIS SUMMARY:
${analysis.summary || 'N/A'}

FEATURES (${features.length}):
${features.join(', ') || 'None provided'}`;
}

function extractText(result: any): string {
  if (typeof result === 'string') {
    return result;
  }

  if (!result || typeof result !== 'object') {
    return '';
  }

  if (typeof result.response === 'string') {
    return result.response;
  }

  if (typeof result.content === 'string') {
    return result.content;
  }

  if (Array.isArray(result.content)) {
    return result.content
      .map((entry: any) => entry?.text || '')
      .filter(Boolean)
      .join('\n');
  }

  if (typeof result.message === 'string') {
    return result.message;
  }

  return JSON.stringify(result);
}

function stripLeadingConversation(content: string): string {
  const trimmed = content.trimStart();
  const firstHeaderIndex = trimmed.search(/^#{1,6}\s+/m);

  if (firstHeaderIndex > 0) {
    return trimmed.slice(firstHeaderIndex);
  }

  return trimmed;
}

function buildFeatureList(result: FeatureExtractionResult): string[] {
  const lists = [
    result.all_features,
    result.core_features,
    result.user_features,
    result.technical_components,
    result.integrations,
    result.security_features,
    result.priority_features,
  ].filter(Array.isArray) as string[][];

  const combined = lists.flat().map((feature) => feature?.trim()).filter(Boolean);

  return Array.from(new Set(combined));
}

function buildConversationContext(
  conversationHistory: AgentFunctionParams['conversationHistory'],
): string {
  if (!conversationHistory?.length) {
    return '';
  }

  const recent = conversationHistory.slice(-20);

  return recent
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join('\n');
}

function normalizeDocumentType(
  documentType?: string,
): DocumentTemplateKey {
  if (!documentType) {
    return 'prd';
  }

  const normalized = documentType.trim().toLowerCase();

  if (normalized in DOCUMENT_PROMPTS) {
    return normalized as DocumentTemplateKey;
  }

  switch (normalized) {
    case 'product':
    case 'product_requirements':
      return 'prd';
    case 'technical':
    case 'technical_requirements':
      return 'trd';
    case 'api_requirements':
    case 'api_spec':
      return 'api';
    case 'stories':
    case 'user_stories':
      return 'user_story';
    case 'architecture_requirements':
      return 'architecture';
    default:
      return 'prd';
  }
}

function countDocumentSections(content: string): number {
  if (!content) {
    return 0;
  }

  const matches = content.match(/^#+\s+/gm);
  return matches ? matches.length : 0;
}

function extractPlanContent(params: AgentFunctionParams): string | undefined {
  return (
    (params as any)?.planContent ||
    params.metadata?.planContent ||
    (params.metadata as any)?.planSummary ||
    undefined
  );
}

function extractMode(params: AgentFunctionParams): string {
  return (
    ((params as any)?.mode ||
      params.metadata?.mode ||
      (params.routingDecision as any)?.mode ||
      'converse')
      .toString()
      .toLowerCase()
  );
}
