# Agent Runners Architecture - PRD

## Overview

This PRD defines a unified agent execution architecture for the Orchestrator AI platform. The system establishes a base class hierarchy where all agent types (Context, Tool, API, External, Function, Orchestrator) inherit common execution patterns (CONVERSE, PLAN, BUILD modes) but differ in their transport mechanisms and output schemas.

## Problem Statement

Currently, the agent execution layer has:
- Inconsistent execution patterns across agent types
- No unified interface for agent runners
- Limited composability for orchestration workflows
- Function agents are the only non-LLM execution path
- No clear separation between atomic agents (primitives) and composite agents (orchestrators)

This makes it difficult to:
- Build complex workflows using agents as building blocks
- Add new agent types consistently
- Create orchestrator agents that compose sub-agents into graphs
- Provide a clear alternative to n8n/Langraph using agents as primitives

## Goals

### Primary Goals
1. **Unified Agent Interface**: All agents implement the same base execution interface
2. **Mode Inheritance**: All agents support CONVERSE, PLAN, BUILD modes consistently
3. **Transport Abstraction**: Agent types differ only in transport implementation
4. **Composability**: Enable orchestrator agents to compose atomic agents into workflows
5. **Extensibility**: Easy to add new agent types by extending base class

### Secondary Goals
1. Support agent-specific output schemas (plans, deliverables)
2. Maintain backward compatibility with existing agents
3. Enable context optimization across all agent types
4. Provide clear migration path from LLM agents to Context agents

## Non-Goals

- Replacing the existing task/conversation infrastructure
- Changing the agent2agent protocol (TaskRequestDto/TaskResponseDto)
- Implementing new orchestration UI
- Modifying the agent registry or database schema (beyond adding transport definitions)

## Agent Type Taxonomy

### Atomic Agents (Execution Primitives)

#### 1. Context Agent
**Purpose**: Retrieve/curate context, then make ONE LLM call

**Capabilities**:
- Fetches context from sources (plans, deliverables, conversation history)
- Optimizes context to token budget
- Interpolates context into system prompt template
- Makes single LLM call with curated context
- Returns response

**Transport Definition**:
```typescript
{
  kind: 'context',
  context: {
    sources: ['plans', 'deliverables', 'conversations'],
    systemPromptTemplate: 'You are analyzing: {{plan.content}}...',
    tokenBudget: 8000,
    optimization: {
      strategy: 'relevance-scoring' | 'recency' | 'hybrid'
    }
  }
}
```

**Use Cases**:
- Plan analyzer: Fetches current plan, analyzes against user question
- Deliverable reviewer: Retrieves deliverables, provides feedback
- Conversation summarizer: Prunes history, generates summary
- Pure chat agent: No context sources, just LLM reasoning

**Note**: Context agents replace the concept of "LLM agents" - a pure LLM agent is just a context agent with `sources: []`.

#### 2. Tool Agent
**Purpose**: Execute discrete MCP tools

**Capabilities**:
- Invokes MCP tools via unified MCP service
- Supports single or multiple tool invocation
- Handles tool parameter mapping from user input
- Can optionally use LLM to parse tool arguments from natural language

**Transport Definition**:
```typescript
{
  kind: 'tool',
  tool: {
    tools: ['supabase/query-db', 'slack/send-message'],
    namespace?: string,
    timeout?: number,
    retries?: number,
    mode: 'sequential' | 'parallel',
    argumentMapping?: {
      llmParse: boolean,  // Use LLM to extract arguments
      schema: Record<string, any>
    }
  }
}
```

**Use Cases**:
- Database query agent: Executes SQL via supabase/query-db
- Slack notifier: Sends messages via slack/send-message
- Multi-step tool agent: Query DB → analyze → send notification
- Calculator agent: Math operations via tool

#### 3. API Agent
**Purpose**: Call HTTP endpoints with custom request/response transforms

**Capabilities**:
- Makes HTTP calls to arbitrary endpoints
- Applies request transforms (map A2A format → API format)
- Applies response transforms (map API format → A2A format)
- Handles authentication (bearer, API key, OAuth)
- Supports custom headers, timeouts, retries

**Transport Definition**:
```typescript
{
  kind: 'api',
  api: {
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    timeout?: number,
    headers?: Record<string, string>,
    authentication?: {
      type: 'bearer' | 'api-key' | 'oauth',
      credentials: Record<string, any>
    },
    requestTransform?: {
      template: string,  // JSONata or template string
      mapping: Record<string, any>
    },
    responseTransform?: {
      template: string,
      mapping: Record<string, any>
    }
  }
}
```

**Use Cases**:
- Third-party API integration (Stripe, Twilio, etc.)
- Legacy system integration
- Custom webhook caller
- External service wrapper

#### 4. External Agent
**Purpose**: Call external agents that strictly follow A2A protocol

**Capabilities**:
- Makes HTTP calls to A2A-compliant endpoints
- Expects TaskRequestDto → TaskResponseDto contract
- Validates protocol compliance
- Supports health checks and capability discovery
- Handles retries and circuit breaking

**Transport Definition**:
```typescript
{
  kind: 'external',
  external: {
    endpoint: string,
    protocol: 'a2a',  // Strict A2A protocol
    timeout?: number,
    authentication?: Record<string, any>,
    retry?: {
      maxAttempts: number,
      backoff: 'linear' | 'exponential'
    },
    expectedCapabilities?: string[],
    healthCheck?: {
      endpoint: string,
      interval: number
    }
  }
}
```

**Use Cases**:
- Distributed agent networks
- External A2A-compliant agents
- Microservice agents
- Partner organization agents

#### 5. Function Agent
**Purpose**: Execute sandboxed JavaScript code in VM

**Capabilities**:
- Runs user-defined JavaScript in isolated VM context
- Access to service APIs (agent builder, etc.)
- Timeout enforcement
- Console logging

**Transport Definition**:
```typescript
{
  kind: 'function',
  function: {
    code: string,  // Stored in function_code column
    timeout_ms: number,
    allowedServices: string[]
  }
}
```

**Use Cases**:
- Custom business logic
- Data transformations
- Complex calculations
- Prototype agents

### Composite Agents

#### 6. Orchestrator Agent
**Purpose**: Compose atomic agents into workflow graphs

**Capabilities**:
- Creates orchestration plans (PLAN mode)
- Executes orchestration runs (BUILD mode)
- Cannot respond directly to conversations (canConverse: false)
- Manages DAG execution with dependency resolution
- Passes outputs between agent nodes
- Handles human checkpoints and approval gates

**Transport Definition**:
```typescript
{
  kind: 'orchestrator',
  orchestrator: {
    defaultGraph?: string,  // Reference to saved orchestration
    availableAgents: string[],  // Sub-agent slugs
    executionMode: 'sequential' | 'graph' | 'adaptive',
    maxDepth?: number,  // Prevent infinite recursion
    humanGates?: {
      enabled: boolean,
      checkpoints: string[]
    }
  }
}
```

**Use Cases**:
- CEO orchestrator: Coordinates multiple domain agents
- Marketing workflow: Plan → content generation → review → publish
- Data pipeline: Extract → transform → analyze → report
- Multi-step automation

## Architecture

### Base Class Hierarchy

```typescript
interface IAgentRunner {
  execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;
}

abstract class BaseAgentRunner implements IAgentRunner {
  // Common mode routing
  async execute(...): Promise<TaskResponseDto>

  // Abstract methods - implemented by each runner
  protected abstract handleConverse(...): Promise<TaskResponseDto>
  protected abstract handlePlan(...): Promise<TaskResponseDto>
  protected abstract handleBuild(...): Promise<TaskResponseDto>

  // Shared utilities
  protected canExecuteMode(definition, mode): boolean
  protected resolveUserId(request): string | null
  protected buildMetadata(request): Record<string, any>
}
```

### Runner Implementations

```
BaseAgentRunner (abstract)
├── ContextAgentRunnerService (fetch context → LLM call)
├── ToolAgentRunnerService (MCP tool execution)
├── ApiAgentRunnerService (HTTP with transforms)
├── ExternalAgentRunnerService (A2A protocol)
├── FunctionAgentRunnerService (VM execution)
└── OrchestratorAgentRunnerService (graph execution)
```

### Mode Handling (Consistent Across All Agents)

#### CONVERSE Mode
- Processes user message
- Returns conversational response
- Saves to conversation history
- Metadata includes provider/model/usage

#### PLAN Mode
- Generates structured plan based on agent's plan schema
- Saves to plans table via PlansService
- Returns plan record with version
- Supports both 'create' action (LLM generation) and other actions (read, list, edit)

#### BUILD Mode
- Creates deliverable based on agent's deliverable schema
- Saves to deliverables table via DeliverablesService
- Returns deliverable record with version
- Can reference current plan if available
- Supports both 'create' action (LLM generation) and other actions (read, list, edit)

### Agent-Specific Schemas

Agents can define custom output schemas in their config:

```typescript
{
  agentType: 'context',
  slug: 'marketing-planner',
  config: {
    plan: {
      format: 'json' | 'markdown' | 'yaml',
      schema?: {
        type: 'object',
        properties: { /* JSON Schema */ }
      },
      template?: string  // Optional template for structure
    },
    deliverable: {
      format: 'json' | 'markdown' | 'html',
      type: string,  // e.g., 'marketing-report', 'code', 'document'
      schema?: { /* JSON Schema */ },
      sections?: string[]  // Expected sections in output
    }
  }
}
```

### Routing

AgentModeRouterService routes by `transport.kind`:

```typescript
private async handleBuild(context: HydratedExecutionContext) {
  const transport = context.definition.transport;

  switch (transport?.kind) {
    case 'context':
      return this.contextRunner.execute(...);
    case 'tool':
      return this.toolRunner.execute(...);
    case 'api':
      return this.apiRunner.execute(...);
    case 'external':
      return this.externalRunner.execute(...);
    case 'function':
      return this.functionRunner.execute(...);
    case 'orchestrator':
      return this.orchestratorRunner.execute(...);
    default:
      return TaskResponseDto.failure(...);
  }
}
```

## User Flows

### Flow 1: Context Agent Execution
1. User sends message to context agent
2. ContextAgentRunner.execute() called
3. Runner fetches context from sources (plans, deliverables, history)
4. Context optimized to token budget
5. System prompt interpolated with context
6. ONE LLM call made
7. Response returned as TaskResponseDto

### Flow 2: Tool Agent Execution
1. User sends message to tool agent
2. ToolAgentRunner.execute() called
3. Runner parses user message to extract tool + arguments (or uses LLM to parse)
4. MCP tool invoked via MCPService
5. Tool response normalized to TaskResponseDto
6. Response returned

### Flow 3: Orchestrator Agent Execution (PLAN mode)
1. User requests orchestration plan
2. OrchestratorRunner.execute() with mode=PLAN
3. Runner analyzes request to determine sub-agents needed
4. Builds DAG of agent nodes with dependencies
5. Saves orchestration plan
6. Returns plan as TaskResponseDto

### Flow 4: Orchestrator Agent Execution (BUILD mode)
1. User triggers orchestration execution
2. OrchestratorRunner.execute() with mode=BUILD
3. Runner starts OrchestrationRun
4. Executes graph nodes in dependency order:
   - Calls sub-agent (context/tool/api/external/function)
   - Waits for response
   - Passes output to dependent nodes
5. Handles human checkpoints if configured
6. Returns final aggregated result

### Flow 5: API Agent Execution
1. User sends message to API agent
2. ApiAgentRunner.execute() called
3. Request transformed using requestTransform
4. HTTP call made to external endpoint
5. Response transformed using responseTransform
6. Normalized to TaskResponseDto
7. Response returned

## Technical Specifications

### Interface Definitions

```typescript
// apps/api/src/agent2agent/services/base-agent-runner.interface.ts
export interface IAgentRunner {
  execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;
}

// apps/api/src/agent2agent/services/base-agent-runner.service.ts
export abstract class BaseAgentRunner implements IAgentRunner {
  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    // Validate mode support
    if (!this.canExecuteMode(definition, request.mode)) {
      return TaskResponseDto.failure(
        request.mode,
        `Agent does not support ${request.mode} mode`
      );
    }

    // Route to mode handler
    switch (request.mode) {
      case AgentTaskMode.CONVERSE:
        return this.handleConverse(definition, request, organizationSlug);
      case AgentTaskMode.PLAN:
        return this.handlePlan(definition, request, organizationSlug);
      case AgentTaskMode.BUILD:
        return this.handleBuild(definition, request, organizationSlug);
      default:
        return TaskResponseDto.failure(request.mode, 'Unsupported mode');
    }
  }

  protected abstract handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;

  protected abstract handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;

  protected abstract handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;

  protected canExecuteMode(
    definition: AgentRuntimeDefinition,
    mode: AgentTaskMode
  ): boolean {
    const exec = definition.execution;
    switch (mode) {
      case AgentTaskMode.CONVERSE: return exec.canConverse;
      case AgentTaskMode.PLAN: return exec.canPlan;
      case AgentTaskMode.BUILD: return exec.canBuild;
      default: return false;
    }
  }

  protected resolveUserId(request: TaskRequestDto): string | null {
    return request.metadata?.userId ||
           request.payload?.metadata?.userId ||
           null;
  }

  protected buildMetadata(
    request: TaskRequestDto,
    additional?: Record<string, any>
  ): Record<string, any> {
    return {
      ...(request.metadata ?? {}),
      ...(request.payload?.metadata ?? {}),
      ...(additional ?? {}),
    };
  }
}
```

### Transport Definition Updates

```typescript
// apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts

export interface AgentTransportContextDefinition {
  sources: ('plans' | 'deliverables' | 'conversations' | 'projects')[];
  systemPromptTemplate: string;
  tokenBudget?: number;
  optimization?: {
    strategy: 'relevance-scoring' | 'recency' | 'hybrid';
  };
}

export interface AgentTransportToolDefinition {
  tools: string[];  // MCP tool names with namespace
  namespace?: string;
  timeout?: number;
  retries?: number;
  mode?: 'sequential' | 'parallel';
  argumentMapping?: {
    llmParse?: boolean;
    schema?: Record<string, any>;
  };
}

export interface AgentTransportOrchestratorDefinition {
  defaultGraph?: string;
  availableAgents: string[];
  executionMode: 'sequential' | 'graph' | 'adaptive';
  maxDepth?: number;
  humanGates?: {
    enabled: boolean;
    checkpoints: string[];
  };
}

export interface AgentTransportDefinition {
  kind: 'context' | 'tool' | 'api' | 'external' | 'function' | 'orchestrator';
  context?: AgentTransportContextDefinition;
  tool?: AgentTransportToolDefinition;
  api?: AgentTransportApiDefinition;
  external?: AgentTransportExternalDefinition;
  function?: Record<string, any>;
  orchestrator?: AgentTransportOrchestratorDefinition;
  raw?: Record<string, any> | null;
}
```

### Agent Config Schema

```typescript
export interface AgentConfigPlanDefinition {
  format: 'json' | 'markdown' | 'yaml';
  schema?: Record<string, any>;  // JSON Schema
  template?: string;
}

export interface AgentConfigDeliverableDefinition {
  format: 'json' | 'markdown' | 'html';
  type: string;
  schema?: Record<string, any>;  // JSON Schema
  sections?: string[];
}

// Extend existing AgentRuntimeDefinition.config
export interface AgentConfig {
  plan?: AgentConfigPlanDefinition;
  deliverable?: AgentConfigDeliverableDefinition;
  [key: string]: any;
}
```

## Migration Path

### Phase 1: Foundation
1. Create base interface and abstract class
2. Update transport definitions
3. Update config schema definitions

### Phase 2: Atomic Agents
1. Implement ContextAgentRunnerService
2. Implement ToolAgentRunnerService
3. Implement ApiAgentRunnerService
4. Implement ExternalAgentRunnerService
5. Migrate FunctionAgentRunnerService to extend BaseAgentRunner

### Phase 3: Routing
1. Update AgentModeRouterService to route by transport.kind
2. Add runner registry/factory pattern
3. Update dependency injection

### Phase 4: Orchestrator
1. Implement OrchestratorAgentRunnerService
2. Integrate with existing OrchestrationRunnerService
3. Add DAG execution engine
4. Add human checkpoint handling

### Phase 5: Testing & Migration
1. Create example agents of each type
2. Write integration tests
3. Migrate existing LLM agents to context agents
4. Performance testing

## Success Metrics

### Engineering Metrics
- All 6 agent types implemented and tested
- 100% of existing agents migrated successfully
- No regression in existing functionality
- <200ms overhead for base class routing

### Product Metrics
- Orchestrator agents can compose 3+ sub-agents
- Context agents support 4+ context sources
- Tool agents support 10+ MCP tools
- API/External agents support 5+ real-world integrations

### Developer Experience
- New agent type can be added in <1 day
- Agent creation via builder generates correct transport config
- Clear documentation with examples for each agent type

## Open Questions

1. **Streaming support**: How do we handle streaming responses consistently across all agent types?
2. **Caching**: Should context agents cache fetched context? For how long?
3. **Tool selection**: Should tool agents use LLM to select which tool to use, or require explicit tool specification?
4. **Orchestrator recursion**: What's the max depth for orchestrators calling orchestrators?
5. **Error handling**: How do we standardize error responses across transport types?
6. **Rate limiting**: Should each transport type have its own rate limiting strategy?

## Future Enhancements

- **Agent composition UI**: Visual graph builder for orchestrator agents
- **Agent marketplace**: Share and discover pre-built agents
- **Multi-modal agents**: Support for image/audio/video in context agents
- **Streaming orchestrations**: Real-time progress updates during graph execution
- **Agent analytics**: Usage tracking, performance metrics per agent type
- **Agent versioning**: Semantic versioning for agent definitions
- **Agent testing framework**: Unit/integration test harness for agent builders

## References

- [Agent Execution Gateway](apps/api/src/agent2agent/services/agent-execution-gateway.service.ts)
- [Agent Mode Router](apps/api/src/agent2agent/services/agent-mode-router.service.ts)
- [Function Agent Runner](apps/api/src/agent2agent/services/function-agent-runner.service.ts)
- [Context Optimization Service](apps/api/src/agent2agent/context-optimization/context-optimization.service.ts)
- [MCP Service](apps/api/src/mcp/mcp.service.ts)
- [Agent Runtime Definition](apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts)
