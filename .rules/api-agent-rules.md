# API Agent Rules

This document defines the standards, patterns, and implementation guidelines for creating API agents in the OrchestratorAI system. API agents are external service integration agents that delegate requests to external APIs, webhooks, or services to provide specialized capabilities.

## Table of Contents

1. [Agent Definition & Types](#agent-definition--types)
2. [File Structure](#file-structure)
3. [Agent.json Schema](#agentjson-schema)
4. [API Configuration Patterns](#api-configuration-patterns)
5. [Implementation Examples](#implementation-examples)
6. [Error Handling & Resilience](#error-handling--resilience)
7. [Testing Requirements](#testing-requirements)

---

## Agent Definition & Types

### What is an API Agent?

An API agent is a specialized AI agent that delegates requests to external APIs, webhooks, or services to provide specialized capabilities. Unlike function agents that execute local code, API agents act as intelligent proxies that transform, route, and process responses from external services.

### API Agent Characteristics

- **External Integration**: Primary functionality comes from external APIs or services
- **Request Transformation**: Transforms user requests into API-specific formats
- **Response Processing**: Processes and formats API responses for user consumption
- **Error Handling**: Provides graceful fallbacks when external services are unavailable
- **Authentication Management**: Handles API authentication and authorization
- **Rate Limiting**: Manages API rate limits and quotas
- **Caching**: Implements intelligent caching strategies for performance

### API Agent Types

1. **Webhook Agents**: Integrate with webhook-based services (N8N, Zapier, etc.)
2. **REST API Agents**: Connect to RESTful APIs with standard HTTP methods
3. **GraphQL Agents**: Integrate with GraphQL endpoints
4. **RAG Service Agents**: Connect to external RAG (Retrieval-Augmented Generation) services
5. **Database Agents**: Connect to external databases or data services
6. **Third-Party Service Agents**: Integrate with external SaaS platforms

---

## File Structure

### Standard Directory Layout

```
apps/api/src/agents/demo/{department}/{agent_name}/
├── agent.yaml                  # Agent configuration with API settings (generates .well-known/agent.json)
├── context.md                  # Optional knowledge base
├── agent.module.ts             # NestJS module (if custom services needed)
└── README.md                   # Agent documentation
```

### Required Files

- **`agent.yaml`** - Agent configuration with API settings (automatically generates `.well-known/agent.json` via A2A protocol)
- **`context.md`** - Optional but recommended for API documentation

---

## Agent.json Schema

### Complete Schema Definition

```json
{
  "name": "agent_name",
  "displayName": "Human Readable Name",
  "description": "Brief description of agent capabilities",
  "version": "1.0.0",
  "type": "api",
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
      ],
      "input_modes": ["text/plain", "application/json"],
      "output_modes": ["text/plain", "application/json"]
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
  "api_configuration": {
    "endpoint": "https://api.example.com/endpoint",
    "method": "POST|GET|PUT|DELETE",
    "timeout": 60000,
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{api_key}}"
    },
    "authentication": {
      "type": "bearer|api_key|basic|oauth2",
      "credentials": {
        "api_key": "{{API_KEY}}",
        "secret": "{{API_SECRET}}"
      }
    },
    "request_transform": {
      "format": "custom|template|field_mapping",
      "template": "{\"query\": \"{{userMessage}}\", \"session\": \"{{sessionId}}\"}",
      "field_mapping": {
        "user_input": "userMessage",
        "context": "conversationHistory"
      }
    },
    "response_transform": {
      "format": "field_extraction|template|custom",
      "field": "response|output|result",
      "template": "Response: {{response}}"
    }
  }
}
```

---

## API Configuration Patterns

### 1. Webhook Integration Pattern

```yaml
# agent.yaml
api_configuration:
  endpoint: "https://golfergeek.app.n8n.cloud/webhook/8218497e-a07f-4516-a2cd-00044c8f9211"
  method: "POST"
  timeout: 60000
  headers:
    Content-Type: "application/json"
  authentication: null
  request_transform:
    format: "custom"
    template: '{"sessionId": "{{sessionId}}", "prompt": "{{userMessage}}"}'
  response_transform:
    format: "field_extraction"
    field: "output"
```

### 2. REST API Integration Pattern

```yaml
# agent.yaml
api_configuration:
  endpoint: "https://api.openai.com/v1/chat/completions"
  method: "POST"
  timeout: 30000
  headers:
    Content-Type: "application/json"
    Authorization: "Bearer {{OPENAI_API_KEY}}"
  authentication:
    type: "bearer"
    credentials:
      api_key: "{{OPENAI_API_KEY}}"
  request_transform:
    format: "template"
    template: |
      {
        "model": "gpt-4",
        "messages": [
          {"role": "system", "content": "You are a helpful assistant."},
          {"role": "user", "content": "{{userMessage}}"}
        ],
        "max_tokens": 1000,
        "temperature": 0.7
      }
  response_transform:
    format: "field_extraction"
    field: "choices[0].message.content"
```

### 3. GraphQL Integration Pattern

```yaml
# agent.yaml
api_configuration:
  endpoint: "https://api.github.com/graphql"
  method: "POST"
  timeout: 30000
  headers:
    Content-Type: "application/json"
    Authorization: "Bearer {{GITHUB_TOKEN}}"
  authentication:
    type: "bearer"
    credentials:
      api_key: "{{GITHUB_TOKEN}}"
  request_transform:
    format: "template"
    template: |
      {
        "query": "query($query: String!) { search(query: $query, type: REPOSITORY, first: 10) { nodes { name description url } } }",
        "variables": {
          "query": "{{userMessage}}"
        }
      }
  response_transform:
    format: "field_extraction"
    field: "data.search.nodes"
```

### 4. Database Integration Pattern

```yaml
# agent.yaml
api_configuration:
  endpoint: "https://api.supabase.com/rest/v1/table_name"
  method: "GET"
  timeout: 15000
  headers:
    Content-Type: "application/json"
    apikey: "{{SUPABASE_ANON_KEY}}"
    Authorization: "Bearer {{SUPABASE_ANON_KEY}}"
  authentication:
    type: "api_key"
    credentials:
      api_key: "{{SUPABASE_ANON_KEY}}"
  request_transform:
    format: "field_mapping"
    field_mapping:
      query: "userMessage"
      limit: "10"
  response_transform:
    format: "field_extraction"
    field: "data"
```

---

## Implementation Examples

### Example 1: Golf Rules Expert Agent (N8N Webhook)

**File: `apps/api/src/agents/demo/specialists/golf_rules_agent/agent.yaml`**
```yaml
# Rules of Golf Expert Agent Configuration
metadata:
  name: "Rules of Golf Expert"
  type: "specialists"
  category: "golf_knowledge"
  version: "1.0.0"
  description: "A comprehensive Rules of Golf expert powered by an N8N workflow that provides authoritative answers based on official USGA and R&A Rules of Golf, including detailed explanations, rule citations, and penalty assessments."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: specialists_manager_orchestrator
  department: specialists

# Agent type - API agent that delegates to N8N RAG workflow
type: "api"

capabilities:
  - golf_rules_expertise
  - rule_interpretation
  - penalty_assessment
  - equipment_regulations
  - course_conditions
  - competition_rules

skills:
  - id: "rules_interpretation"
    name: "Golf Rules Interpretation"
    description: "Provide detailed explanations of complex golf rules situations and their proper application"
    tags: ["golf-rules", "interpretation", "usga", "r&a"]
    examples:
      - "My ball went into a water hazard, what are my options?"
      - "Can I move my ball if it's behind a tree?"
      - "What's the penalty for hitting the wrong ball?"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "penalty_assessment"
    name: "Penalty Assessment"
    description: "Determine correct penalties for various golf infractions and rule violations"
    tags: ["penalties", "strokes", "assessment", "violations"]
    examples:
      - "What's the penalty for an unplayable ball?"
      - "How many strokes for hitting into a penalty area?"
      - "What happens if I accidentally move my ball on the green?"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "equipment_regulations"
    name: "Equipment Regulations"
    description: "Provide guidance on golf equipment rules, conformance standards, and legal requirements"
    tags: ["equipment", "clubs", "balls", "conformance", "regulations"]
    examples:
      - "Are my golf clubs conforming to the rules?"
      - "Can I use a distance measuring device?"
      - "What's the rule about golf ball specifications?"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "course_conditions"
    name: "Course Conditions"
    description: "Advise on rules related to abnormal course conditions, relief procedures, and course maintenance"
    tags: ["course-conditions", "relief", "abnormal-conditions", "maintenance"]
    examples:
      - "Can I get relief from this temporary water?"
      - "What's the rule about ground under repair?"
      - "Can I move my ball if it's on a cart path?"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "competition_rules"
    name: "Competition Rules"
    description: "Provide guidance on competition-specific rules, formats, and procedures"
    tags: ["competition", "stroke-play", "match-play", "procedures"]
    examples:
      - "What's the difference between stroke play and match play?"
      - "How do I handle a rules dispute in competition?"
      - "What are the pace of play rules?"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

# Input/Output Configuration
input_modes:
  - "text/plain"
  - "application/json"

output_modes:
  - "text/plain"
  - "application/json"

api_configuration:
  endpoint: "https://golfergeek.app.n8n.cloud/webhook/8218497e-a07f-4516-a2cd-00044c8f9211"
  method: "POST"
  timeout: 60000
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
  include_rule_citations: true
  provide_step_by_step: true
  distinguish_play_formats: true
  execution_profile: "conversation_only"
  execution_capabilities:
    can_plan: false
    can_build: false
    requires_human_gate: false
  timeout_seconds: 30
```

**File: `apps/api/src/agents/demo/specialists/golf_rules_agent/context.md`**
```markdown
# Rules of Golf Expert Agent Context

## Persona and Role
You are a comprehensive Rules of Golf expert with deep knowledge of official USGA and R&A Rules of Golf. Your expertise covers all aspects of golf rules, from basic play procedures to complex rule interpretations and penalty assessments. You provide authoritative, accurate, and practical guidance that helps golfers understand and apply the rules correctly.

## Core Capabilities
- Comprehensive rules knowledge with official USGA and R&A rule citations
- Detailed rule interpretation with step-by-step procedures and practical guidance
- Penalty assessment with accurate stroke calculations and relief procedures
- Equipment regulations knowledge with conformance standards and legal requirements
- Course conditions expertise including abnormal conditions and relief options
- Competition rules guidance for stroke play and match play formats
- Rules citations with specific rule numbers and official language
- Practical application guidance with step-by-step procedures

## Rules Knowledge Areas
- **Ball in Play**: Ball movement, lost balls, out of bounds, penalty areas
- **Relief Procedures**: Abnormal course conditions, unplayable lies, interference
- **Equipment Regulations**: Club conformance, ball specifications, distance measuring devices
- **Penalty Areas**: Water hazards, lateral water hazards, relief options
- **Putting Green**: Ball movement, repair, flagstick rules, concessions
- **Competition Play**: Stroke play procedures, match play rules, pace of play

## API Integration
- **Powered by**: N8N RAG workflow for comprehensive rules knowledge
- **Data Source**: Official USGA and R&A Rules of Golf documentation
- **Response Features**: Rule citations, step-by-step procedures, penalty calculations
- **Format**: Detailed explanations with official rule references and practical guidance

## Operating Modes
- Converse: provide immediate rules guidance, answer specific questions, suggest rule applications or clarify situation details.
- Plan: create rules analysis approach including:
  - Situation Assessment & Context
  - Applicable Rules Identification
  - Relief Options Analysis
  - Penalty Calculations
  - Procedure Requirements
  - Decision Framework
  - "Proceed to Build?"
- Build: provide comprehensive rules analysis, detailed procedure guidance, official citations, and complete ruling recommendations.

## Rules Analysis Checklist
- Golf situation clearly understood with all relevant details and context
- Course conditions and circumstances properly assessed
- Applicable rules identified with official rule numbers and citations
- Relief options evaluated with procedures and requirements
- Penalty calculations completed with accurate stroke assessments
- Procedure requirements clearly outlined with step-by-step guidance
- Decision framework established with clear next steps and recommendations
```

### Example 2: Joke Agent (External API)

**File: `apps/api/src/agents/demo/productivity/jokes_agent/agent.yaml`**
```yaml
# Joke Agent Configuration
metadata:
  name: "Joke Agent"
  type: "productivity"
  category: "entertainment"
  version: "1.0.0"
  description: "A lighthearted agent that provides jokes, humor, and entertainment to brighten your day. Perfect for team building, ice breakers, and adding a touch of fun to your workflow."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: productivity_manager_orchestrator
  department: productivity

# Agent type - API agent that connects to external joke services
type: "api"

capabilities:
  - joke_generation
  - humor_entertainment
  - team_building
  - ice_breaker_activities
  - mood_enhancement
  - workplace_fun

skills:
  - id: "joke_generation"
    name: "Joke Generation"
    description: "Generate various types of jokes including puns, one-liners, and situational humor"
    tags: ["jokes", "humor", "entertainment", "puns"]
    examples:
      - "Tell me a programming joke"
      - "I need a dad joke for my presentation"
      - "Give me a clean workplace-appropriate joke"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "humor_entertainment"
    name: "Humor Entertainment"
    description: "Provide entertainment and humor to lighten the mood and improve team dynamics"
    tags: ["entertainment", "humor", "team-building", "mood"]
    examples:
      - "Help me break the ice in a meeting"
      - "I need something funny for team building"
      - "Lighten the mood with some humor"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

# Input/Output Configuration
input_modes:
  - "text/plain"
  - "application/json"

output_modes:
  - "text/plain"
  - "application/json"

api_configuration:
  endpoint: "https://official-joke-api.appspot.com/random_joke"
  method: "GET"
  timeout: 10000
  headers:
    Content-Type: "application/json"
  authentication: null
  request_transform:
    format: "custom"
    template: ""
  response_transform:
    format: "template"
    template: |
      Here's a joke to brighten your day! 😄
      
      **Setup**: {{setup}}
      **Punchline**: {{punchline}}
      
      Hope that brought a smile to your face! 😊

configuration:
  default_output_format: "text/plain"
  execution_profile: "conversation_only"
  execution_capabilities:
    can_plan: false
    can_build: false
    requires_human_gate: false
  tone: "friendly"
  safety_level: "workplace_safe"
  response_style: "conversational"
  timeout_seconds: 10
```

### Example 3: External RAG Agent

**File: `apps/api/src/agents/demo/research/external_rag/agent.yaml`**
```yaml
# External RAG Agent Configuration
metadata:
  name: "External RAG Agent"
  type: "research"
  category: "knowledge_retrieval"
  version: "1.0.0"
  description: "An expert knowledge retrieval specialist with access to external databases, research repositories, and authoritative sources. Provides accurate, well-sourced responses by connecting disparate information sources."

# Hierarchy Configuration
hierarchy:
  level: specialist
  reportsTo: research_manager_orchestrator
  department: research

# Agent type - API agent that connects to external RAG services
type: "api"

capabilities:
  - external_knowledge_search
  - multi_source_synthesis
  - fact_verification
  - source_attribution
  - semantic_search
  - real_time_information_gathering

skills:
  - id: "knowledge_retrieval"
    name: "External Knowledge Retrieval"
    description: "Search external knowledge bases and APIs to find relevant information"
    tags: ["research", "knowledge", "external-sources", "retrieval"]
    examples:
      - "Find the latest research on AI safety"
      - "Search for information about renewable energy trends"
      - "Look up technical documentation for React 18"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

  - id: "information_synthesis"
    name: "Multi-Source Information Synthesis"
    description: "Combine information from multiple sources to provide comprehensive answers"
    tags: ["synthesis", "multi-source", "comprehensive", "analysis"]
    examples:
      - "Compare different approaches to machine learning"
      - "Synthesize information about climate change solutions"
      - "Combine research from multiple papers on a topic"
    input_modes: ["text/plain", "application/json"]
    output_modes: ["text/plain", "application/json"]

# Input/Output Configuration
input_modes:
  - "text/plain"
  - "application/json"

output_modes:
  - "text/plain"
  - "application/json"

api_configuration:
  endpoint: "https://api.perplexity.ai/chat/completions"
  method: "POST"
  timeout: 30000
  headers:
    Content-Type: "application/json"
    Authorization: "Bearer {{PERPLEXITY_API_KEY}}"
  authentication:
    type: "bearer"
    credentials:
      api_key: "{{PERPLEXITY_API_KEY}}"
  request_transform:
    format: "template"
    template: |
      {
        "model": "sonar-medium-online",
        "messages": [
          {
            "role": "system",
            "content": "You are a research assistant with access to real-time information. Provide accurate, well-sourced responses with citations."
          },
          {
            "role": "user",
            "content": "{{userMessage}}"
          }
        ],
        "max_tokens": 1000,
        "temperature": 0.2
      }
  response_transform:
    format: "field_extraction"
    field: "choices[0].message.content"

configuration:
  default_output_format: "text/plain"
  execution_profile: "full_capability"
  execution_capabilities:
    can_plan: true
    can_build: true
    requires_human_gate: false
  tone: "professional"
  safety_level: "general"
  response_style: "detailed"
  timeout_seconds: 30
```

---

## Error Handling & Resilience

### 1. API Timeout Handling

```typescript
// In ApiAgentBaseService
private async makeApiRequest(
  config: ApiConfiguration,
  requestData: any,
): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);

  try {
    const response = await fetch(config.endpoint, {
      method: config.method || 'POST',
      headers: config.headers || {},
      body: config.method !== 'GET' ? JSON.stringify(requestData) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`API request timed out after ${config.timeout}ms`);
    }
    
    throw error;
  }
}
```

### 2. Retry Logic with Exponential Backoff

```typescript
private async makeApiRequestWithRetry(
  config: ApiConfiguration,
  requestData: any,
  maxRetries: number = 3,
): Promise<any> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.makeApiRequest(config, requestData);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`API request failed after ${maxRetries + 1} attempts: ${lastError.message}`);
}
```

### 3. Fallback Response Pattern

```typescript
private async executeWithFallback(
  config: ApiConfiguration,
  requestData: any,
  fallbackResponse: string,
): Promise<AgentFunctionResponse> {
  try {
    const apiResponse = await this.makeApiRequestWithRetry(config, requestData);
    const processedResponse = this.processApiResponse(apiResponse, config);
    
    return {
      success: true,
      response: processedResponse,
      metadata: {
        agentName: this.getAgentName(),
        source: 'api',
        apiEndpoint: config.endpoint,
      },
    };
  } catch (error) {
    this.apiLogger.warn(`API request failed, using fallback: ${error.message}`);
    
    return {
      success: true,
      response: fallbackResponse,
      metadata: {
        agentName: this.getAgentName(),
        source: 'fallback',
        error: error.message,
      },
    };
  }
}
```

### 4. Rate Limiting Handling

```typescript
private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

private async checkRateLimit(endpoint: string, limit: number = 100, windowMs: number = 60000): Promise<void> {
  const now = Date.now();
  const key = endpoint;
  const current = this.rateLimitMap.get(key);

  if (!current || now > current.resetTime) {
    this.rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const waitTime = current.resetTime - now;
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds.`);
  }

  current.count++;
}
```

---

## Testing Requirements

### 1. Unit Tests

```typescript
// api-agent.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiAgentBaseService } from './api-agent-base.service';

describe('API Agent', () => {
  let service: ApiAgentBaseService;
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    service = new ApiAgentBaseService();
  });

  it('should make successful API request', async () => {
    const mockResponse = { output: 'Test response' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const config = {
      endpoint: 'https://api.example.com/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };

    const result = await service.makeApiRequest(config, { test: 'data' });

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      })
    );
  });

  it('should handle API timeout', async () => {
    mockFetch.mockImplementation(() => 
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100);
      })
    );

    const config = {
      endpoint: 'https://api.example.com/test',
      method: 'POST',
      timeout: 50,
    };

    await expect(service.makeApiRequest(config, {})).rejects.toThrow('API request timed out');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const config = {
      endpoint: 'https://api.example.com/test',
      method: 'POST',
    };

    await expect(service.makeApiRequest(config, {})).rejects.toThrow('API request failed: 500 Internal Server Error');
  });

  it('should retry failed requests with exponential backoff', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    const config = {
      endpoint: 'https://api.example.com/test',
      method: 'POST',
    };

    const result = await service.makeApiRequestWithRetry(config, {}, 3);
    expect(result).toEqual({ success: true });
    expect(callCount).toBe(3);
  });
});
```

### 2. Integration Tests

```typescript
// api-agent.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('API Agent (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/agents/api/execute (POST)', () => {
    return request(app.getHttpServer())
      .post('/agents/api/execute')
      .send({
        userMessage: 'Test message',
        sessionId: 'test-session',
        agentName: 'golf_rules_agent',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.response).toBeDefined();
        expect(res.body.metadata.source).toBe('api');
      });
  });

  it('should handle API failures gracefully', () => {
    return request(app.getHttpServer())
      .post('/agents/api/execute')
      .send({
        userMessage: 'Test message',
        sessionId: 'test-session',
        agentName: 'nonexistent_agent',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.response).toContain('error');
      });
  });
});
```

### 3. Performance Tests

```typescript
// api-agent.performance.spec.ts
import { performance } from 'perf_hooks';

describe('API Agent Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const startTime = performance.now();
    
    const result = await executeApiAgent({
      userMessage: 'Test message',
      sessionId: 'test-session',
      agentName: 'golf_rules_agent',
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    expect(responseTime).toBeLessThan(5000); // 5 seconds max
    expect(result.success).toBe(true);
  });

  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 10;
    const startTime = performance.now();
    
    const promises = Array(concurrentRequests).fill(null).map(() =>
      executeApiAgent({
        userMessage: 'Test message',
        sessionId: 'test-session',
        agentName: 'golf_rules_agent',
      })
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    expect(results).toHaveLength(concurrentRequests);
    expect(results.every(r => r.success)).toBe(true);
    expect(totalTime).toBeLessThan(10000); // 10 seconds max for all requests
  });
});
```

---

## Best Practices

### 1. API Configuration

- **Environment Variables**: Use environment variables for API keys and sensitive configuration
- **Timeout Settings**: Set appropriate timeouts based on expected response times
- **Rate Limiting**: Implement rate limiting to respect API quotas
- **Authentication**: Use secure authentication methods (Bearer tokens, API keys)
- **Headers**: Set appropriate headers for content type and user agent

### 2. Error Handling

- **Graceful Degradation**: Provide fallback responses when APIs are unavailable
- **Retry Logic**: Implement exponential backoff for transient failures
- **Timeout Handling**: Handle timeouts gracefully with appropriate error messages
- **Rate Limit Handling**: Respect rate limits and provide helpful error messages
- **Logging**: Log API errors for debugging and monitoring

### 3. Performance Optimization

- **Caching**: Implement intelligent caching for frequently requested data
- **Connection Pooling**: Reuse HTTP connections when possible
- **Request Batching**: Batch multiple requests when supported by the API
- **Response Compression**: Use compression when available
- **Async Processing**: Use async/await for non-blocking operations

### 4. Security Considerations

- **API Key Management**: Store API keys securely and rotate them regularly
- **Input Validation**: Validate all inputs before sending to external APIs
- **Output Sanitization**: Sanitize API responses before returning to users
- **HTTPS Only**: Always use HTTPS for API communications
- **Error Information**: Don't expose sensitive information in error messages

### 5. Monitoring and Observability

- **Metrics**: Track API response times, success rates, and error rates
- **Logging**: Log API requests and responses for debugging
- **Health Checks**: Implement health check endpoints for API availability
- **Alerting**: Set up alerts for API failures and performance issues
- **Dashboard**: Create dashboards for API performance monitoring

---

This comprehensive guide provides the foundation for creating, implementing, and maintaining API agents in the OrchestratorAI system. Follow these patterns and examples to ensure reliable, performant, and secure API integrations.
