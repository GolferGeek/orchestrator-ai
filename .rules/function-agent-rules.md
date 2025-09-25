# Function Agent Rules

This document defines the standards, patterns, and implementation guidelines for creating function agents in the OrchestratorAI system. Function agents are code-based agents that execute TypeScript/JavaScript functions to provide specialized capabilities.

## Table of Contents

1. [Agent Definition & Types](#agent-definition--types)
2. [File Structure](#file-structure)
3. [Agent.json Schema](#agentjson-schema)
4. [Implementation Patterns](#implementation-patterns)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)
7. [Testing Requirements](#testing-requirements)

---

## Agent Definition & Types

### What is a Function Agent?

A function agent is a specialized AI agent that executes custom TypeScript/JavaScript code to provide specific functionality. Unlike context agents that rely on knowledge bases, function agents use programmatic logic, API calls, and data processing to deliver results.

### Function Agent Characteristics

- **Code-Driven**: Primary intelligence comes from executable TypeScript/JavaScript functions
- **Multi-Step Workflows**: Can implement complex multi-step processes with progress tracking
- **LLM Integration**: Uses LLM services for analysis, generation, and decision-making
- **Data Processing**: Can process, transform, and analyze data
- **API Integration**: Can make external API calls and integrate with services
- **Progress Tracking**: Provides real-time progress updates during execution

---

## File Structure

### Standard Directory Layout

```
apps/api/src/agents/demo/{department}/{agent_name}/
├── agent.yaml                  # Agent configuration (generates .well-known/agent.json)
├── agent-function.ts           # Main function implementation
├── context.md                  # Optional knowledge base
├── agent.module.ts             # NestJS module (if custom services needed)
└── README.md                   # Agent documentation
```

### Required Files

- **`agent.yaml`** - Agent configuration and metadata (automatically generates `.well-known/agent.json` via A2A protocol)
- **`agent-function.ts`** - Main function implementation

---

## Agent.json Schema

### Complete Schema Definition

```json
{
  "name": "agent_name",
  "displayName": "Human Readable Name",
  "description": "Brief description of agent capabilities",
  "version": "1.0.0",
  "type": "function",
  "category": "department_category",
  "capabilities": [
    "capability_1",
    "capability_2"
  ],
  "skills": [
    {
      "id": "skill_id",
      "name": "Skill Name",
      "description": "Detailed skill description",
      "tags": ["tag1", "tag2"],
      "examples": [
        "Example request 1",
        "Example request 2"
      ]
    }
  ],
  "hierarchy": {
    "level": "specialist|manager|executive",
    "reportsTo": "parent_orchestrator",
    "department": "department_name"
  },
  "configuration": {
    "execution_modes": ["conversation", "plan", "build"],
    "execution_profile": "full_capability",
    "execution_capabilities": {
      "can_plan": true,
      "can_build": true,
      "requires_human_gate": false
    },
    "tone": "professional|friendly|authoritative",
    "safety_level": "workplace_safe|general|restricted",
    "response_style": "detailed|concise|conversational"
  }
}
```

---

## Implementation Patterns

### 1. Basic Function Agent Structure

```typescript
import {
  AgentFunctionParams,
  AgentFunctionResponse,
} from '@agents/base/implementations/base-services/a2a-base/interfaces';

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

  try {
    // Validate LLM service availability
    if (!llmService || typeof llmService.generateResponse !== 'function') {
      throw new Error('LLM service is not available');
    }

    // Process the request
    const result = await processRequest(params);

    return {
      success: true,
      response: result.content,
      metadata: {
        agentName: 'Agent Name',
        processingTime: Date.now() - startTime,
        ...result.metadata,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      response: `Error: ${message}`,
      metadata: {
        agentName: 'Agent Name',
        processingTime: Date.now() - startTime,
        error: message,
      },
    };
  }
}
```

### 2. Multi-Step Workflow Pattern

```typescript
const STEP_SEQUENCE = [
  'analyze_request',
  'process_data',
  'generate_response',
  'finalize_output',
] as const;

export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const updateProgress = (
    step: (typeof STEP_SEQUENCE)[number],
    index: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => {
    try {
      progressCallback?.(step, index, status, message);
    } catch (error) {
      console.debug(`Failed to emit progress for ${step}:`, error);
    }
  };

  try {
    // Step 1: Analyze request
    updateProgress('analyze_request', 0, 'in_progress', 'Analyzing request...');
    const analysis = await analyzeRequest(params);
    updateProgress('analyze_request', 0, 'completed', 'Request analyzed');

    // Step 2: Process data
    updateProgress('process_data', 1, 'in_progress', 'Processing data...');
    const processedData = await processData(analysis);
    updateProgress('process_data', 1, 'completed', 'Data processed');

    // Step 3: Generate response
    updateProgress('generate_response', 2, 'in_progress', 'Generating response...');
    const response = await generateResponse(processedData);
    updateProgress('generate_response', 2, 'completed', 'Response generated');

    // Step 4: Finalize
    updateProgress('finalize_output', 3, 'completed', 'Output finalized');

    return {
      success: true,
      response: response.content,
      metadata: {
        agentName: 'Agent Name',
        processingTime: Date.now() - startTime,
        steps: STEP_SEQUENCE.length,
        analysis,
      },
    };
  } catch (error) {
    // Error handling...
  }
}
```

### 3. LLM Integration Pattern

```typescript
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

function extractText(result: any): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result?.response) {
    return result.response;
  }

  if (result?.content) {
    return result.content;
  }

  return JSON.stringify(result);
}
```

---

## Code Examples

### Example 1: Requirements Writer Agent

**File: `apps/api/src/agents/demo/engineering/requirements_writer/agent.yaml`**
```yaml
# Requirements Writer Agent Configuration
metadata:
  name: "Requirements Writer"
  type: "specialists"
  category: "development"
  version: "1.0.0"
  description: "Transform your ideas into professional requirements documents! I create comprehensive PRDs, technical specs, user stories, and API documentation using advanced AI workflows."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: engineering_manager_orchestrator
  department: engineering

# Agent Type: TypeScript function-based agent
type: "function"

capabilities:
  - requirements_writing
  - technical_documentation
  - user_story_creation
  - api_specification
  - system_architecture
  - document_generation
  - complexity_analysis
  - feature_extraction

skills:
  - id: "prd_generation"
    name: "Product Requirements Document Generation"
    description: "Create comprehensive PRDs with business objectives, user stories, and technical requirements"
    tags: ["prd", "requirements", "product", "documentation"]
    examples:
      - "Create a PRD for a mobile app"
      - "Write requirements for an e-commerce platform"
      - "Generate technical specs for an API"
```

**File: `apps/api/src/agents/demo/engineering/requirements_writer/agent-function.ts`**
```typescript
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
}

const STEP_SEQUENCE = [
  'analyze_request',
  'determine_document_type',
  'extract_features',
  'assess_complexity',
  'generate_document',
  'finalize_response',
] as const;

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
      console.debug(`[RequirementsWriter] Failed to emit progress for ${step}:`, error);
    }
  };

  try {
    if (!llmService || typeof llmService.generateResponse !== 'function') {
      throw new Error('LLM service is not available for the Requirements Writer agent.');
    }

    const baseLlmOptions = resolveLlmOptions(params);
    const conversationContext = buildConversationContext(conversationHistory);
    const planContent = extractPlanContent(params);
    const mode = extractMode(params);
    const isBuilding = mode === 'build';

    // Step 1: Analyze request
    updateProgress('analyze_request', 0, 'in_progress', 'Analyzing request...');
    const analysis = await callLlmForJson<AnalysisResult>(
      llmService,
      baseLlmOptions,
      buildAnalysisSystemPrompt(),
      buildAnalysisUserPrompt(userMessage, conversationContext, isBuilding),
      DEFAULT_ANALYSIS,
    );
    updateProgress('analyze_request', 0, 'completed', 'Request analyzed');

    // Step 2: Determine document type
    updateProgress('determine_document_type', 1, 'in_progress', 'Determining document type...');
    const documentTypeResult = await callLlmForJson<DocumentTypeResult>(
      llmService,
      baseLlmOptions,
      buildDocumentTypeSystemPrompt(),
      buildDocumentTypeUserPrompt(userMessage, analysis),
      {},
    );
    updateProgress('determine_document_type', 1, 'completed', 'Document type determined');

    // Continue with remaining steps...
    // [Additional implementation details...]

    return {
      success: true,
      response: documentContent,
      metadata: {
        agentName: 'Requirements Writer',
        processingTime: Date.now() - startTime,
        responseType: documentType,
        analysis,
        workflow: {
          totalSteps: STEP_SEQUENCE.length,
          mode,
          isBuilding,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    updateProgress('finalize_response', 5, 'failed', `Requirements generation failed: ${message}`);

    return {
      success: false,
      response: `## Requirements generation error\n\nI wasn't able to produce the requirements document because of an error:\n\n> ${message}`,
      metadata: {
        agentName: 'Requirements Writer',
        processingTime: Date.now() - startTime,
        responseType: 'error',
        error: message,
      },
    };
  }
}

function resolveLlmOptions(params: AgentFunctionParams): Record<string, any> {
  const selection = (params as any)?.llmSelection || {};
  const routingDecision = (params as any)?.routingDecision || {};
  const meta = params.metadata || {};

  return {
    providerName: selection.providerName || meta.providerName || routingDecision.provider,
    modelName: selection.modelName || meta.modelName || routingDecision.model,
    temperature: selection.temperature ?? meta.temperature ?? routingDecision.temperature ?? 0.2,
    maxTokens: selection.maxTokens || meta.maxTokens || routingDecision.maxTokens || 3500,
    callerType: 'agent',
    callerName: 'requirements_writer',
    conversationId: params.sessionId || meta.conversationId,
    userId: params.currentUser?.id,
    authToken: params.authToken,
  };
}
```

### Example 2: Metrics Agent

**File: `apps/api/src/agents/demo/finance/metrics/agent-function.ts`**
```typescript
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
    step: string,
    index: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => {
    try {
      progressCallback?.(step, index, status, message);
    } catch (error) {
      console.debug(`[MetricsAgent] Failed to emit progress for ${step}:`, error);
    }
  };

  try {
    if (!llmService || typeof llmService.generateResponse !== 'function') {
      throw new Error('LLM service is not available for the Metrics agent.');
    }

    // Step 1: Analyze metrics requirements
    updateProgress('analyze_requirements', 0, 'in_progress', 'Understanding metrics requirements...');

    const analysisPrompt = `
User request: "${userMessage}"

Available database tables with schema from context file:

### KPI and Business Data Tables (Public Schema):
- **companies**: Company information (id, name, industry, founded_year, created_at, updated_at)
- **departments**: Organizational structure (id, company_id, name, head_of_department, budget, created_at, updated_at)  
- **kpi_metrics**: KPI definitions (id, name, metric_type, unit, description, created_at, updated_at)
- **kpi_goals**: Target values for metrics by department (id, department_id, metric_id, target_value, period_start, period_end, created_at, updated_at)
- **kpi_data**: Historical performance data (id, department_id, metric_id, value, date_recorded, created_at, updated_at)

Respond with JSON only:
{
  "intent": "brief description of what the user wants",
  "metrics_needed": ["specific", "metrics", "to", "analyze"],
  "tables_to_query": ["tables", "needed", "from", "available"],
  "sql_approach": "brief description of what SQL queries are needed using correct schema"
}
`;

    const analysisResponse = await llmService.generateResponse(
      'You are a metrics analysis expert. Analyze user requests and determine what metrics and data are needed.',
      analysisPrompt,
      {
        temperature: 0.3,
        maxTokens: 1000,
      }
    );

    const analysis = JSON.parse(extractText(analysisResponse));
    updateProgress('analyze_requirements', 0, 'completed', 'Requirements analyzed');

    // Step 2: Generate SQL queries
    updateProgress('generate_queries', 1, 'in_progress', 'Generating SQL queries...');
    const sqlQueries = await generateSqlQueries(analysis, llmService);
    updateProgress('generate_queries', 1, 'completed', 'SQL queries generated');

    // Step 3: Execute queries and analyze results
    updateProgress('execute_analysis', 2, 'in_progress', 'Executing analysis...');
    const results = await executeMetricsAnalysis(sqlQueries, analysis);
    updateProgress('execute_analysis', 2, 'completed', 'Analysis completed');

    return {
      success: true,
      response: results.content,
      metadata: {
        agentName: 'Metrics Agent',
        processingTime: Date.now() - startTime,
        analysis,
        sqlQueries: sqlQueries.length,
        resultsCount: results.count,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      response: `## Metrics analysis error\n\nI wasn't able to complete the metrics analysis because of an error:\n\n> ${message}`,
      metadata: {
        agentName: 'Metrics Agent',
        processingTime: Date.now() - startTime,
        error: message,
      },
    };
  }
}
```

### Example 3: Marketing Swarm Agent

**File: `apps/api/src/agents/demo/marketing/marketing_swarm/agent-function.ts`**
```typescript
interface SwarmWorkflowState {
  userRequest: string;
  specialistResults: Record<string, any>;
  finalContent: any;
  metadata: Record<string, any>;
}

const SPECIALIST_AGENTS: Record<string, AgentSpecialist> = {
  blog_writer: {
    name: 'Blog Post Writer',
    role: 'content_creator',
    specialties: [
      'long-form content',
      'thought leadership',
      'educational content',
      'storytelling',
    ],
    systemPrompt: `You are an expert blog post writer. Create compelling, informative, and engaging blog content that drives traffic and establishes thought leadership.`,
    temperature: 0.7,
  },
  seo_specialist: {
    name: 'SEO Specialist',
    role: 'optimizer',
    specialties: [
      'keyword optimization',
      'meta descriptions',
      'search intent',
      'technical seo',
    ],
    systemPrompt: `You are an SEO expert. Optimize content for search engines while maintaining readability and user value.`,
    temperature: 0.3,
  },
  brand_voice_analyst: {
    name: 'Brand Voice Analyst',
    role: 'evaluator',
    specialties: [
      'brand consistency',
      'voice and tone',
      'messaging alignment',
      'brand guidelines',
    ],
    systemPrompt: `You are a brand voice expert. Ensure all content maintains consistent brand voice, tone, and messaging.`,
    temperature: 0.4,
  },
};

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

  try {
    if (!llmService || typeof llmService.generateResponse !== 'function') {
      throw new Error('LLM service is not available for the Marketing Swarm agent.');
    }

    // Step 1: Analyze marketing task
    updateProgress('analyze_task', 0, 'in_progress', 'Analyzing marketing task...');
    const taskAnalysis = await analyzeMarketingTask(params, llmService, progressCallback);
    updateProgress('analyze_task', 0, 'completed', 'Task analyzed');

    // Step 2: Coordinate specialist agents
    updateProgress('coordinate_specialists', 1, 'in_progress', 'Coordinating specialist agents...');
    const specialistResults = await coordinateSpecialistAgents(taskAnalysis, llmService);
    updateProgress('coordinate_specialists', 1, 'completed', 'Specialists coordinated');

    // Step 3: Synthesize final content
    updateProgress('synthesize_content', 2, 'in_progress', 'Synthesizing final content...');
    const finalContent = await synthesizeFinalContent(specialistResults, llmService);
    updateProgress('synthesize_content', 2, 'completed', 'Content synthesized');

    return {
      success: true,
      response: finalContent.content,
      metadata: {
        agentName: 'Marketing Swarm',
        processingTime: Date.now() - startTime,
        specialistsUsed: Object.keys(specialistResults),
        taskAnalysis,
        finalContent: finalContent.metadata,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      response: `## Marketing swarm error\n\nI wasn't able to complete the marketing task because of an error:\n\n> ${message}`,
      metadata: {
        agentName: 'Marketing Swarm',
        processingTime: Date.now() - startTime,
        error: message,
      },
    };
  }
}

async function analyzeMarketingTask(
  state: SwarmWorkflowState,
  llmService: any,
  progressCallback?: (
    stepName: string,
    stepIndex: number,
    status: 'in_progress' | 'completed' | 'failed',
    message?: string,
  ) => void,
): Promise<any> {
  const analysisPrompt = `
Analyze this marketing request and determine which specialist agents should be involved:

Request: "${state.userRequest}"

Available specialists:
${Object.entries(SPECIALIST_AGENTS).map(([key, agent]) => 
  `- ${agent.name} (${key}): ${agent.specialties.join(', ')}`
).join('\n')}

Respond with JSON:
{
  "primary_specialists": ["specialist1", "specialist2"],
  "secondary_specialists": ["specialist3"],
  "coordination_strategy": "description of how to coordinate the specialists",
  "expected_output": "description of the final deliverable"
}
`;

  const result = await llmService.generateResponse(
    'You are a marketing coordination expert. Analyze requests and determine the best specialist team.',
    analysisPrompt,
    { temperature: 0.4, maxTokens: 1000 }
  );

  return JSON.parse(extractText(result));
}
```

---

## Error Handling

### 1. Graceful Error Handling Pattern

```typescript
export async function execute(
  params: AgentFunctionParams,
): Promise<AgentFunctionResponse> {
  const startTime = Date.now();
  
  try {
    // Main execution logic
    const result = await processRequest(params);
    
    return {
      success: true,
      response: result.content,
      metadata: {
        agentName: 'Agent Name',
        processingTime: Date.now() - startTime,
        ...result.metadata,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    
    // Log error for debugging
    console.error(`[AgentName] Execution failed:`, error);
    
    return {
      success: false,
      response: `## Error\n\nI encountered an error while processing your request:\n\n> ${message}\n\nPlease try again or contact support if the issue persists.`,
      metadata: {
        agentName: 'Agent Name',
        processingTime: Date.now() - startTime,
        responseType: 'error',
        error: message,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

### 2. Progress Callback Error Handling

```typescript
const updateProgress = (
  step: string,
  index: number,
  status: 'in_progress' | 'completed' | 'failed',
  message?: string,
) => {
  try {
    progressCallback?.(step, index, status, message);
  } catch (error) {
    // Guard against downstream callback errors breaking execution
    if (process?.env?.NODE_ENV !== 'production') {
      console.debug(`[AgentName] Failed to emit progress for ${step}:`, error);
    }
  }
};
```

### 3. LLM Service Validation

```typescript
if (!llmService || typeof llmService.generateResponse !== 'function') {
  throw new Error('LLM service is not available for the agent.');
}
```

---

## Testing Requirements

### 1. Unit Tests

```typescript
// agent-function.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from './agent-function';

describe('Agent Function', () => {
  let mockLlmService: any;
  let mockProgressCallback: any;

  beforeEach(() => {
    mockLlmService = {
      generateResponse: vi.fn(),
    };
    mockProgressCallback = vi.fn();
  });

  it('should process request successfully', async () => {
    const params = {
      userMessage: 'Test message',
      sessionId: 'test-session',
      conversationHistory: [],
      progressCallback: mockProgressCallback,
      llmService: mockLlmService,
      metadata: {},
    };

    mockLlmService.generateResponse.mockResolvedValue({
      content: 'Test response',
    });

    const result = await execute(params);

    expect(result.success).toBe(true);
    expect(result.response).toBe('Test response');
    expect(mockProgressCallback).toHaveBeenCalled();
  });

  it('should handle LLM service errors gracefully', async () => {
    const params = {
      userMessage: 'Test message',
      sessionId: 'test-session',
      conversationHistory: [],
      progressCallback: mockProgressCallback,
      llmService: null, // No LLM service
      metadata: {},
    };

    const result = await execute(params);

    expect(result.success).toBe(false);
    expect(result.response).toContain('LLM service is not available');
  });

  it('should handle execution errors gracefully', async () => {
    const params = {
      userMessage: 'Test message',
      sessionId: 'test-session',
      conversationHistory: [],
      progressCallback: mockProgressCallback,
      llmService: mockLlmService,
      metadata: {},
    };

    mockLlmService.generateResponse.mockRejectedValue(new Error('LLM Error'));

    const result = await execute(params);

    expect(result.success).toBe(false);
    expect(result.response).toContain('Error');
    expect(result.metadata.error).toBe('LLM Error');
  });
});
```

### 2. Integration Tests

```typescript
// agent.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Function Agent (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/function/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/function/execute')
      .send({
        userMessage: 'Test message',
        sessionId: 'test-session',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.response).toBeDefined();
      });
  });
});
```

### 3. Performance Tests

```typescript
// agent.performance.spec.ts
import { performance } from 'perf_hooks';

describe('Function Agent Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const startTime = performance.now();
    
    const result = await execute({
      userMessage: 'Test message',
      sessionId: 'test-session',
      conversationHistory: [],
      progressCallback: () => {},
      llmService: mockLlmService,
      metadata: {},
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(10000); // 10 seconds max
    expect(result.success).toBe(true);
  });
});
```

---

## Best Practices

### 1. Code Organization

- **Single Responsibility**: Each function should have a clear, single purpose
- **Modular Design**: Break complex workflows into smaller, testable functions
- **Type Safety**: Use TypeScript interfaces for all data structures
- **Error Boundaries**: Implement proper error handling at each step

### 2. Performance Optimization

- **Progress Tracking**: Provide real-time progress updates for long-running operations
- **Resource Management**: Clean up resources and handle timeouts appropriately
- **Caching**: Cache expensive operations when possible
- **Async Operations**: Use proper async/await patterns

### 3. Security Considerations

- **Input Validation**: Validate all user inputs and parameters
- **LLM Service Security**: Ensure LLM service calls are properly authenticated
- **Data Sanitization**: Sanitize data before processing or storage
- **Error Information**: Don't expose sensitive information in error messages

### 4. Monitoring and Observability

- **Logging**: Log important events and errors for debugging
- **Metrics**: Track execution times and success rates
- **Health Checks**: Implement health check endpoints
- **Alerting**: Set up alerts for critical failures

---

This comprehensive guide provides the foundation for creating, implementing, and maintaining function agents in the OrchestratorAI system. Follow these patterns and examples to ensure consistency, reliability, and maintainability across all function agent implementations.
