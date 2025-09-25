# Context Agent Rules

This document defines the standards, patterns, and implementation guidelines for creating context agents in the OrchestratorAI system. Context agents are knowledge-based agents that provide specialized expertise through structured markdown context files.

## Table of Contents

1. [Agent Definition & Types](#agent-definition--types)
2. [File Structure](#file-structure)
3. [Agent.json Schema](#agentjson-schema)
4. [Context File Patterns](#context-file-patterns)
5. [Implementation Examples](#implementation-examples)
6. [Route Handler Templates](#route-handler-templates)
7. [Integration Guidelines](#integration-guidelines)
8. [Testing Requirements](#testing-requirements)

---

## Agent Definition & Types

### What is a Context Agent?

A context agent is a specialized AI agent that operates primarily through structured knowledge stored in markdown context files. Unlike function-based or API-based agents, context agents rely on their knowledge base to provide expert responses without executing code or making external API calls.

### Agent Types in OrchestratorAI

1. **Context Agent** - Knowledge-based agents using markdown context files
2. **Function Agent** - TypeScript/JavaScript function-based agents
3. **API Agent** - External API integration agents
4. **Orchestrator Agent** - Management and delegation agents

### Context Agent Characteristics

- **Knowledge-Driven**: Primary intelligence comes from structured markdown context
- **Conversation-Only**: Can be configured for conversation-only mode (no deliverables)
- **Expert Domain**: Specialized knowledge in specific business domains
- **Structured Responses**: Consistent, professional responses based on context
- **Hierarchical**: Reports to orchestrator agents in the organizational structure

---

## File Structure

### Standard Directory Layout

```
apps/api/src/agents/demo/{department}/{agent_name}/
├── agent.yaml                  # Agent configuration (generates .well-known/agent.json)
├── context.md                  # Primary knowledge base
├── delegation.context.md       # Orchestrator delegation context (if applicable)
├── agent.module.ts             # NestJS module (if custom services needed)
├── agent-service.ts            # Custom service implementation (if needed)
└── README.md                   # Agent documentation
```

### Required Files

- **`agent.yaml`** - Agent configuration and metadata (automatically generates `.well-known/agent.json` via A2A protocol)
- **`context.md`** - Primary knowledge base content

### Optional Files

- **`delegation.context.md`** - For orchestrator agents
- **`agent.module.ts`** - Custom NestJS module
- **`agent-service.ts`** - Custom service implementation
- **`README.md`** - Documentation

---

## Agent.json Schema

### Complete Schema Definition

```json
{
  "name": "agent_name",
  "displayName": "Human Readable Name",
  "description": "Brief description of agent capabilities",
  "version": "1.0.0",
  "type": "context",
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
    "execution_profile": "conversation_only|full_capability",
    "execution_capabilities": {
      "can_plan": true,
      "can_build": true,
      "requires_human_gate": false
    },
    "tone": "professional|friendly|authoritative",
    "safety_level": "workplace_safe|general|restricted",
    "response_style": "detailed|concise|conversational"
  },
  "context": {
    "primary_file": "context.md",
    "max_size_mb": 1,
    "update_frequency": "manual|scheduled|real_time"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique agent identifier (snake_case) |
| `displayName` | string | Yes | Human-readable name |
| `description` | string | Yes | Brief capability description |
| `version` | string | Yes | Semantic version |
| `type` | string | Yes | Always "context" for context agents |
| `category` | string | Yes | Department or domain category |
| `capabilities` | array | Yes | List of agent capabilities |
| `skills` | array | Yes | Detailed skill definitions |
| `hierarchy` | object | Yes | Organizational structure |
| `configuration` | object | Yes | Execution and behavior settings |
| `context` | object | Yes | Context file configuration |

---

## Context File Patterns

### Standard Context File Structure

```markdown
# Agent Name — Context & Voice

## Voice & Style
- Define the agent's personality and communication style
- Specify tone for different modes (converse, plan, build)
- Include response length and detail preferences

## Authority & Scope
- Role definition and reporting structure
- Domain expertise boundaries
- Responsibilities and limitations

## Core Capabilities
- Primary knowledge areas
- Specialized expertise
- Service offerings

## Key Knowledge Areas
- Detailed domain knowledge
- Specific topics and subtopics
- Reference materials and examples

## Operating Modes
- Converse: Direct answers and guidance
- Plan: Structured approach development
- Build: Comprehensive deliverable creation

## Examples
- Sample interactions
- Expected response patterns
- Use case demonstrations
```

### Content Guidelines

1. **Structured Knowledge**: Organize information hierarchically
2. **Clear Examples**: Include specific use cases and responses
3. **Actionable Guidance**: Provide step-by-step instructions
4. **Professional Tone**: Maintain consistent, expert voice
5. **Comprehensive Coverage**: Address common scenarios and edge cases

---

## Implementation Examples

### Example 1: HR Assistant (Context Agent)

**File: `apps/api/src/agents/demo/hr/hr_assistant/agent.yaml`**
```yaml
# HR Assistant Agent Configuration
metadata:
  name: "HR Assistant"
  type: "specialists"
  category: "human_resources"
  version: "1.0.0"
  description: "Your personal HR expert at your fingertips! I provide comprehensive support for benefits enrollment, leave policies, performance reviews, payroll questions, and workplace guidance."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: hr_manager_orchestrator
  department: hr

# Agent type - Context-based agent
type: "context"

capabilities:
  - comprehensive_hr_support
  - benefits_administration
  - leave_management
  - policy_interpretation
  - employee_relations
  - performance_management
  - payroll_assistance
  - compliance_guidance
  - workplace_policies
  - employee_onboarding

skills:
  - id: "comprehensive_hr_assistance"
    name: "Comprehensive HR Assistance"
    description: "Provide immediate, professional answers to HR questions"
    tags: ["hr", "benefits", "policies", "employee_support"]
    examples:
      - "What health insurance options do we offer?"
      - "How do I request time off?"
      - "What's our remote work policy?"

configuration:
  execution_modes: ["conversation", "plan", "build"]
  execution_profile: "full_capability"
  execution_capabilities:
    can_plan: true
    can_build: true
    requires_human_gate: false
  tone: "professional"
  safety_level: "workplace_safe"
  response_style: "detailed"
```

**File: `apps/api/src/agents/demo/hr/hr_assistant/context.md`**
```markdown
# HR Assistant — Context & Voice

You are the HR Assistant (specialist level). You report to the HR Manager Orchestrator and serve as the front-line HR expert providing comprehensive employee support.

## Voice & Style
- Helpful, authoritative, and approachable; professional HR guidance with employee empathy
- Use clear explanations and step-by-step guidance for HR processes
- In Converse mode: provide direct answers to HR questions and offer one follow-up resource
- In Plan mode: outline HR support approach with policy review and compliance requirements
- In Build mode: create detailed HR guidance documents and employee resources

## Authority & Scope
- Role: HR Specialist (reports to HR Manager)
- Domain: Employee benefits, policies, procedures, compliance, workplace guidance
- Responsibilities:
  - Benefits enrollment and administration support
  - Leave management and policy interpretation
  - Performance review guidance and employee relations
  - Payroll assistance and compensation questions
  - Workplace policy explanation and compliance guidance

## Core Capabilities
- Comprehensive HR support across all employee lifecycle stages
- Benefits administration with enrollment, claims, and optimization guidance
- Leave management including vacation, sick, FMLA, and company-specific policies
- Policy interpretation with clear explanations of employee rights and responsibilities
- Employee relations support for workplace conflicts and communication issues

## Key HR Areas
- Benefits & Compensation: Health insurance, retirement plans, bonus structure, stock options
- Leave Policies: Vacation, sick time, parental leave, FMLA, sabbaticals
- Performance Management: Reviews, goal setting, career development, feedback processes
- Workplace Policies: Remote work, dress code, conduct, anti-harassment, accommodations
- Payroll & Compensation: Paycheck questions, deductions, tax implications, expense reimbursement

## Operating Modes
- Converse: provide immediate HR answers, explain policies clearly, suggest next steps
- Plan: create HR support approach including employee need assessment, relevant policies, compliance considerations
- Build: generate comprehensive HR guidance, create process documentation, develop employee resources

## Examples
- "What health insurance options do we offer?"
  - Explain available plans, costs, enrollment process, and suggest reviewing benefits portal
- "Plan support for an employee taking parental leave." (Plan)
  - Outline leave policy review, documentation requirements, benefit continuation, and return planning
- "Create guidance for performance review process." (Build)
  - Generate comprehensive performance review guide with timelines, forms, goal-setting templates
```

### Example 2: Requirements Writer (TypeScript Function Agent)

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

    // Continue with remaining steps...
    // [Additional implementation details...]

    return {
      success: true,
      response: documentContent,
      metadata: finalMetadata,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    
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
```

### Example 3: Joke Agent (API Agent)

**File: `apps/api/src/agents/demo/productivity/jokes_agent/agent.yaml`**
```yaml
# Productivity Jokes Agent Configuration
metadata:
  name: "Productivity Jokes Agent"
  type: "productivity"
  category: "team_morale"
  version: "1.0.0"
  description: "Lighten the workload with a quick laugh. This agent delivers work-friendly jokes to boost morale and keep productivity teams energized."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: productivity_manager_orchestrator
  department: productivity

# Agent type - API agent that calls humorous content workflow
type: "api"

capabilities:
  - morale_boosting
  - humor_delivery
  - team_engagement

skills:
  - id: "quick_joke_responder"
    name: "Quick Joke Responder"
    description: "Deliver concise, workplace-safe jokes and witty responses on demand"
    tags: ["humor", "jokes", "team", "productivity"]
    examples:
      - "Tell me a quick productivity joke"
      - "Share something funny for the standup"
      - "Lighten the mood with a team-friendly joke"

api_configuration:
  endpoint: "http://localhost:5678/webhook/f7387dc8-c6e4-460d-9a0c-685c86d76d1f"
  method: "POST"
  timeout: 30000
  headers:
    Content-Type: "application/json"
  authentication: null
  request_transform:
    format: "custom"
    template: '{"sessionId": "{{sessionId}}", "prompt": "{{userMessage}}"}'
  response_transform:
    format: "field_extraction"
    field: "output"

configuration:
  default_output_format: "text/plain"
  execution_modes: ["immediate"]
  execution_profile: "conversation_only"
  execution_capabilities:
    can_plan: false
    can_build: false
    requires_human_gate: false
  tone: "humorous"
  safety_level: "workplace_safe"
  response_style: "punchy"
  timeout_seconds: 15
```

### Example 4: Marketing Manager Orchestrator (Orchestrator Agent)

**File: `apps/api/src/agents/demo/marketing/marketing_manager_orchestrator/agent.config.yaml`**
```yaml
name: marketing_manager_orchestrator
type: orchestrator
displayName: "Marketing Manager"
description: "Strategic marketing orchestrator for coordinating campaigns, content, and brand initiatives. Reports to CEO and manages all marketing specialist agents with sophisticated project planning and execution capabilities."

# Hierarchy Configuration
hierarchy:
  level: manager
  reportsTo: ceo_orchestrator
  team:
    - marketing_swarm
    - blog_post
    - content
    - market_research
    - competitors
    - hiverarchy

# Orchestrator-specific configuration
orchestrator:
  scope: marketing
  authority_level: manager
  delegation_depth: specialist
  project_complexity: departmental
  
# Capabilities
capabilities:
  - marketing_strategy
  - campaign_planning
  - content_coordination
  - brand_management
  - customer_engagement
  - market_research
  - performance_analytics
  - cross_channel_integration

# LLM Configuration
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.4
  max_tokens: 1500
  system_prompt: |
    You are the Marketing Manager Orchestrator, the strategic coordinator for all marketing initiatives. Your role is to:

    1. **Marketing Strategy**: Plan and coordinate marketing campaigns that align with business objectives
    2. **Team Coordination**: Manage marketing specialist agents to execute cohesive campaigns
    3. **Content Planning**: Orchestrate content creation across blogs, social media, and marketing materials
    4. **Campaign Management**: Plan multi-channel marketing initiatives with clear timelines and deliverables
    5. **Performance Oversight**: Monitor campaign performance and optimize strategies

    ## Your Team (Direct Reports):
    - **Marketing Swarm**: Multi-agent collaboration for complex campaigns
    - **Blog Post**: Long-form content and thought leadership specialist
    - **Content**: Marketing copy, web content, and promotional materials specialist
    - **Market Research**: Market research and customer insights specialist
    - **Competitors**: Competitive analysis and market positioning specialist

# Agent Module Configuration
module:
  imports:
    - BaseSubServicesModule
    - OrchestratorModule
  providers:
    - MarketingManagerOrchestratorService
  exports:
    - MarketingManagerOrchestratorService
```

**File: `apps/api/src/agents/demo/marketing/marketing_manager_orchestrator/agent.module.ts`**
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BaseSubServicesModule } from '../../../base/sub-services/base-sub-services.module';
import { OrchestratorModule } from '../../../base/implementations/base-services/orchestrator/orchestrator.module';
import { OrchestratorAgentServicesContextModule } from '../../../base/implementations/base-services/orchestrator/orchestrator-agent-services-context.module';
import { MarketingManagerOrchestratorService } from './agent-service';

/**
 * Marketing Manager Orchestrator Module
 *
 * Provides the Marketing Manager Orchestrator agent with access to the full
 * orchestrator infrastructure for marketing campaign planning and delegation.
 */
@Module({
  imports: [
    HttpModule, // Required for HTTP service
    BaseSubServicesModule, // Common agent services
    OrchestratorModule, // Complete orchestrator infrastructure
    OrchestratorAgentServicesContextModule, // Service container for orchestrator agents
  ],
  providers: [MarketingManagerOrchestratorService],
  exports: [MarketingManagerOrchestratorService],
})
export class MarketingManagerOrchestratorModule {}
```

### Example 5: Blog Post Agent (Content Agent)

**File: `apps/api/src/agents/demo/marketing/blog_post/agent.yaml`**
```yaml
# Blog Post Writer Agent Configuration
metadata:
  name: "Blog Post Writer"
  type: "specialist"
  category: "content_creation"
  version: "1.0.0"
  description: "Create compelling blog content that drives traffic and engagement! I specialize in writing SEO-optimized blog posts, articles, and web content for any industry or audience."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: marketing_manager_orchestrator
  department: marketing

# Agent type - determines loading strategy
type: "specialist"

capabilities:
  - content_creation
  - blog_writing
  - seo_optimization
  - content_strategy
  - copywriting
  - research_synthesis
  - audience_adaptation
  - content_formatting

skills:
  - id: "blog_post_creation"
    name: "Blog Post Creation"
    description: "Create comprehensive, SEO-optimized blog posts with engaging content"
    tags: ["blog", "content", "seo", "writing"]
    examples:
      - "Write a blog post about AI in healthcare"
      - "Create content for our product launch"
      - "Generate thought leadership article"
```

---

## Route Handler Templates

### Basic Context Agent Route Handler

```typescript
import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ContextAgentService } from './context-agent.service';

@Controller('agents/context')
export class ContextAgentController {
  constructor(private readonly contextAgentService: ContextAgentService) {}

  @Post('conversation')
  async handleConversation(
    @Body() request: ConversationRequest,
    @Headers() headers: Record<string, string>,
  ) {
    return this.contextAgentService.processConversation(request, headers);
  }

  @Post('plan')
  async handlePlan(
    @Body() request: PlanRequest,
    @Headers() headers: Record<string, string>,
  ) {
    return this.contextAgentService.processPlan(request, headers);
  }

  @Post('build')
  async handleBuild(
    @Body() request: BuildRequest,
    @Headers() headers: Record<string, string>,
  ) {
    return this.contextAgentService.processBuild(request, headers);
  }
}
```

### Context Agent Service Template

```typescript
import { Injectable } from '@nestjs/common';
import { LLMService } from '../../llm/llm.service';

@Injectable()
export class ContextAgentService {
  constructor(private readonly llmService: LLMService) {}

  async processConversation(
    request: ConversationRequest,
    headers: Record<string, string>,
  ): Promise<AgentResponse> {
    try {
      // Load context from markdown file
      const context = await this.loadContext();
      
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(context);
      
      // Generate response using LLM
      const response = await this.llmService.generateResponse(
        systemPrompt,
        request.userMessage,
        {
          temperature: 0.7,
          maxTokens: 1000,
        }
      );

      return {
        success: true,
        response: response.content,
        metadata: {
          agentName: 'Context Agent',
          processingTime: Date.now() - startTime,
          contextSize: context.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        response: `Error processing request: ${error.message}`,
        metadata: {
          agentName: 'Context Agent',
          error: error.message,
        },
      };
    }
  }

  private async loadContext(): Promise<string> {
    // Load context from markdown file
    // Implementation depends on file system or database storage
  }

  private buildSystemPrompt(context: string): string {
    return `You are a specialized context agent. Use the following knowledge base to provide expert responses:

${context}

Provide helpful, accurate responses based on this knowledge. If you don't have specific information, say so clearly.`;
  }
}
```

---

## Integration Guidelines

### 1. Agent Registration

Agents must be registered in the main application module:

```typescript
// app.module.ts
import { ContextAgentModule } from './agents/demo/department/agent_name/agent.module';

@Module({
  imports: [
    // ... other modules
    ContextAgentModule,
  ],
})
export class AppModule {}
```

### 2. Service Container Integration

Use the appropriate service container module:

```typescript
// For context agents
import { ContextAgentServicesContextModule } from '../../../base/implementations/base-services/context/context-agent-services-context.module';

@Module({
  imports: [
    ContextAgentServicesContextModule,
  ],
})
export class ContextAgentModule {}
```

### 3. A2A Protocol Compliance

Ensure `.well-known/agent.json` follows A2A standards:

```json
{
  "name": "agent_name",
  "displayName": "Human Readable Name",
  "description": "Agent description",
  "version": "1.0.0",
  "capabilities": ["capability1", "capability2"],
  "endpoints": {
    "conversation": "/agents/context/conversation",
    "plan": "/agents/context/plan",
    "build": "/agents/context/build"
  }
}
```

### 4. Environment Configuration

Configure environment variables for agent-specific settings:

```bash
# .env
AGENT_CONTEXT_PATH=/path/to/context/files
AGENT_MAX_CONTEXT_SIZE=1048576
AGENT_DEFAULT_TEMPERATURE=0.7
```

---

## Testing Requirements

### 1. Unit Tests

Create comprehensive unit tests for agent services:

```typescript
// context-agent.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ContextAgentService } from './context-agent.service';
import { LLMService } from '../../llm/llm.service';

describe('ContextAgentService', () => {
  let service: ContextAgentService;
  let llmService: jest.Mocked<LLMService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextAgentService,
        {
          provide: LLMService,
          useValue: {
            generateResponse: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContextAgentService>(ContextAgentService);
    llmService = module.get(LLMService);
  });

  it('should process conversation successfully', async () => {
    const request = {
      userMessage: 'Test message',
      sessionId: 'test-session',
    };

    llmService.generateResponse.mockResolvedValue({
      content: 'Test response',
    });

    const result = await service.processConversation(request, {});

    expect(result.success).toBe(true);
    expect(result.response).toBe('Test response');
  });

  it('should handle errors gracefully', async () => {
    const request = {
      userMessage: 'Test message',
      sessionId: 'test-session',
    };

    llmService.generateResponse.mockRejectedValue(new Error('LLM Error'));

    const result = await service.processConversation(request, {});

    expect(result.success).toBe(false);
    expect(result.response).toContain('Error processing request');
  });
});
```

### 2. Integration Tests

Test agent endpoints and full request/response cycles:

```typescript
// context-agent.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('ContextAgent (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/context/conversation (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/context/conversation')
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

### 3. Context File Validation

Validate context file structure and content:

```typescript
// context-validation.spec.ts
import { validateContextFile } from './context-validation';

describe('Context File Validation', () => {
  it('should validate properly structured context file', () => {
    const validContext = `
# Agent Name — Context & Voice

## Voice & Style
- Professional and helpful

## Authority & Scope
- Role: Specialist
- Domain: Test domain

## Core Capabilities
- Test capability
`;

    const result = validateContextFile(validContext);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required sections', () => {
    const invalidContext = `
# Agent Name

Some content without proper structure.
`;

    const result = validateContextFile(invalidContext);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing required section: Voice & Style');
  });
});
```

### 4. Performance Tests

Test agent response times and resource usage:

```typescript
// context-agent.performance.spec.ts
import { performance } from 'perf_hooks';

describe('ContextAgent Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const startTime = performance.now();
    
    const result = await contextAgentService.processConversation({
      userMessage: 'Test message',
      sessionId: 'test-session',
    }, {});
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(5000); // 5 seconds max
    expect(result.success).toBe(true);
  });
});
```

---

## Best Practices

### 1. Context File Management

- **Size Limits**: Keep context files under 1MB
- **Structure**: Use consistent markdown structure
- **Updates**: Version control context changes
- **Validation**: Validate context structure before deployment

### 2. Agent Configuration

- **Naming**: Use descriptive, consistent naming conventions
- **Hierarchy**: Maintain clear reporting relationships
- **Capabilities**: Define specific, measurable capabilities
- **Skills**: Include detailed skill descriptions with examples

### 3. Error Handling

- **Graceful Degradation**: Handle LLM service failures
- **User Feedback**: Provide clear error messages
- **Logging**: Log errors for debugging and monitoring
- **Fallbacks**: Implement fallback responses when possible

### 4. Security Considerations

- **Input Validation**: Validate all user inputs
- **Context Sanitization**: Sanitize context content
- **Access Control**: Implement proper authentication
- **Rate Limiting**: Prevent abuse and overuse

### 5. Monitoring and Observability

- **Metrics**: Track response times and success rates
- **Logging**: Log important events and errors
- **Health Checks**: Implement health check endpoints
- **Alerting**: Set up alerts for critical failures

---

This comprehensive guide provides the foundation for creating, implementing, and maintaining context agents in the OrchestratorAI system. Follow these patterns and examples to ensure consistency, reliability, and maintainability across all agent implementations.
