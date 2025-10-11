# Agent Runners Architecture - PRD v2

## Overview

This PRD defines a unified agent execution architecture based on an object-oriented class hierarchy. All agents inherit from a base runner class that provides shared functionality (CONVERSE, PLAN modes and orchestration capabilities), while each agent type implements its own BUILD mode behavior. This architecture enables any agent to orchestrate sub-agents, creating a flexible composition model.

## Problem Statement

Currently, the agent execution layer has:
- Function agents with VM execution
- LLM-based agents with direct dispatch
- No clear separation between agent types (context, tool, API, external)
- No unified pattern for agent orchestration
- Inconsistent handling of BUILD mode across different agent capabilities

This makes it difficult to:
- Add new agent types with different BUILD behaviors
- Enable agents to orchestrate other agents
- Maintain and test agent-specific logic
- Understand how different agents handle CONVERSE/PLAN/BUILD modes

## Goals

### Primary Goals
1. **Unified Base Class**: All agent types extend `BaseAgentRunner` with shared mode handling
2. **Type-Specific BUILD**: Each agent type implements BUILD differently based on its capabilities
3. **Universal Orchestration**: All agents can orchestrate sub-agents through inherited `handleOrchestration()`
4. **Clean Separation**: Each agent type in its own class file (150-300 lines, not monolithic)
5. **OOP Architecture**: Clear inheritance hierarchy following NestJS patterns

### Secondary Goals
1. Support agent-specific output schemas (plans, deliverables)
2. Maintain backward compatibility with existing function agents
3. Enable future overrides of CONVERSE/PLAN if needed per agent type
4. Provide clear extension points for new agent types

## Non-Goals

- Changing A2A transport protocol definitions (transport stays as-is)
- Replacing the existing task/conversation infrastructure
- Modifying the agent registry or core database schema
- Implementing new orchestration UI
- Changing how agents are discovered/hydrated

## Agent Type Taxonomy

### The 5 Agent Types

Agents differ in **how they implement BUILD mode**. CONVERSE and PLAN are shared (with ability to override if needed).

#### 1. Context Agent (`type='context'`)
**Purpose**: Use contextual information + LLM to generate responses

**Data Source**: `context` column (markdown)

**BUILD Implementation**:
1. Fetch context from sources (plans, deliverables, conversation history)
2. Optimize context to token budget
3. Combine with markdown from `context` column
4. Interpolate into system prompt
5. Make ONE LLM call
6. Return deliverable

**Use Cases**:
- Chat agents (golf rules agent, Q&A agent)
- Plan analyzers (review current plan quality)
- Report generators (analyze data + generate report)
- Any agent that needs LLM reasoning with context

**Example**:
```typescript
{
  type: 'context',
  context: '# Golf Rules Expert\nYou are an expert in golf rules...',
  yaml: {
    agent_card: {
      modes: ['converse', 'plan', 'build']
    }
  }
}
```

#### 2. Tool Agent (`type='tool'`)
**Purpose**: Execute MCP tools (database queries, API calls, etc.)

**Data Source**: `yaml` column (defines which MCP tools)

**BUILD Implementation**:
1. Parse request to determine tool + arguments
2. Optionally use LLM to extract arguments from natural language
3. Call MCP service with tool name + arguments
4. Normalize MCPToolResponse to deliverable format
5. Return deliverable

**Use Cases**:
- Database query agent (supabase/query-db)
- Slack notifier (slack/send-message)
- Calculator agent
- File processor

**Example**:
```typescript
{
  type: 'tool',
  yaml: {
    tools: ['supabase/query-db', 'supabase/execute-sql'],
    tool_mode: 'sequential',
    agent_card: {
      modes: ['build'] // Usually no converse/plan - used by other agents
    }
  }
}
```

#### 3. API Agent (`type='api'`)
**Purpose**: Call external HTTP APIs with custom request/response transforms

**Data Source**: `yaml` column + `transport.api` config

**BUILD Implementation**:
1. Apply request transform (map A2A format → API format)
2. Make HTTP call to external endpoint
3. Apply response transform (map API format → deliverable format)
4. Handle authentication, retries, timeouts
5. Return deliverable

**Use Cases**:
- Stripe integration agent
- Twilio SMS agent
- Third-party API wrapper
- Legacy system integration

**Example**:
```typescript
{
  type: 'api',
  transport: {
    kind: 'api',
    api: {
      endpoint: 'https://api.stripe.com/v1/charges',
      method: 'POST',
      authentication: { type: 'bearer' }
    }
  },
  yaml: {
    request_transform: { /* mapping */ },
    response_transform: { /* mapping */ }
  }
}
```

#### 4. External Agent (`type='external'`)
**Purpose**: Call external A2A-compliant agents

**Data Source**: `yaml` column + `transport.external` config

**BUILD Implementation**:
1. Validate request conforms to A2A protocol (TaskRequestDto)
2. Make HTTP POST to external `/agent-to-agent/tasks` endpoint
3. Validate response conforms to A2A protocol (TaskResponseDto)
4. Handle retries, health checks, circuit breaking
5. Return deliverable

**Use Cases**:
- Distributed agent networks
- Partner organization agents
- External microservice agents
- A2A ecosystem agents

**Example**:
```typescript
{
  type: 'external',
  transport: {
    kind: 'external',
    external: {
      endpoint: 'https://partner.com/agent-to-agent/tasks',
      protocol: 'a2a',
      healthCheck: { endpoint: '/health' }
    }
  }
}
```

#### 5. Function Agent (`type='function'`)
**Purpose**: Execute custom JavaScript code in sandboxed VM

**Data Source**: `function_code` column

**BUILD Implementation**:
1. Read JavaScript code from `function_code` column
2. Create VM sandbox context
3. Execute code with timeout enforcement
4. Provide access to service APIs (agent builder, etc.)
5. Normalize result to deliverable format
6. Return deliverable

**Use Cases**:
- Custom business logic
- Data transformations
- Complex calculations
- Prototype agents

**Example**:
```typescript
{
  type: 'function',
  function_code: `
    async function handler(input, ctx) {
      // Custom logic
      return { result: ... };
    }
  `,
  transport: {
    kind: 'function',
    function: {
      timeout_ms: 20000
    }
  }
}
```

## Architecture

### Class Hierarchy

```
BaseAgentRunner (abstract)
├── handleConverse() - shared implementation
├── handlePlan() - shared implementation
├── handleBuild() - abstract (each type implements)
├── handleOrchestration() - shared orchestration capability
└── utility methods

ContextAgentRunnerService extends BaseAgentRunner
├── handleBuild() - context + LLM implementation

ToolAgentRunnerService extends BaseAgentRunner
├── handleBuild() - MCP tool execution

ApiAgentRunnerService extends BaseAgentRunner
├── handleBuild() - HTTP + transforms

ExternalAgentRunnerService extends BaseAgentRunner
├── handleBuild() - A2A protocol call

FunctionAgentRunnerService extends BaseAgentRunner (existing)
├── handleBuild() - VM execution (already implemented)
```

### Base Class Design

```typescript
// apps/api/src/agent2agent/services/base-agent-runner.service.ts

export abstract class BaseAgentRunner implements IAgentRunner {
  protected readonly logger: Logger;

  /**
   * Main entry point - routes to mode handlers
   */
  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    // Validate mode support
    // Route to handleConverse/handlePlan/handleBuild
  }

  /**
   * CONVERSE mode - shared implementation
   * Can be overridden by subclasses if needed
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    // Default: conversational interaction
    // Most agents use this as-is
  }

  /**
   * PLAN mode - shared implementation
   * Can be overridden by subclasses if needed
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    // Default: generate/manipulate plans
    // Most agents use this as-is
  }

  /**
   * BUILD mode - must be implemented by each agent type
   * This is where agent types differ
   */
  protected abstract handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;

  /**
   * ORCHESTRATION - shared capability for all agents
   * Any agent can orchestrate sub-agents
   */
  protected async handleOrchestration(
    action: 'execute' | 'continue' | 'pause' | 'resume' | 'human-response' | 'rollback',
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    switch (action) {
      case 'execute':
        return this.executeOrchestration(definition, request, organizationSlug);
      case 'continue':
        return this.continueOrchestration(definition, request, organizationSlug);
      case 'pause':
        return this.pauseOrchestration(definition, request, organizationSlug);
      case 'human-response':
        return this.handleHumanResponse(definition, request, organizationSlug);
      case 'rollback':
        return this.rollbackOrchestration(definition, request, organizationSlug);
      default:
        return TaskResponseDto.failure(request.mode!, `Unknown orchestration action: ${action}`);
    }
  }

  // Orchestration helper methods
  private async executeOrchestration(...) { }
  private async continueOrchestration(...) { }
  private async pauseOrchestration(...) { }
  private async handleHumanResponse(...) { }
  private async rollbackOrchestration(...) { }
  private async callSubAgent(agentSlug: string, ...) { }
  private async executeSequentialAgents(...) { }
  private async executeParallelAgents(...) { }

  // Utility methods
  protected canExecuteMode(...) { }
  protected resolveUserId(...) { }
  protected buildMetadata(...) { }
  protected shouldStream(...) { }
}
```

### Routing Strategy

`AgentModeRouterService` routes by `definition.agentType`:

```typescript
// In AgentModeRouterService.handleBuild()

// Check if orchestration is requested
if (request.payload?.orchestrate || request.payload?.orchestrationAction) {
  // Any agent can orchestrate
  const runner = this.getRunnerForType(definition.agentType);
  return runner.handleOrchestration(
    request.payload.orchestrationAction || 'execute',
    definition,
    request,
    organizationSlug
  );
}

// Otherwise, standard BUILD routing by type
switch (definition.agentType) {
  case 'context':
    return this.contextRunner.execute(definition, request, organizationSlug);
  case 'tool':
    return this.toolRunner.execute(definition, request, organizationSlug);
  case 'api':
    return this.apiRunner.execute(definition, request, organizationSlug);
  case 'external':
    return this.externalRunner.execute(definition, request, organizationSlug);
  case 'function':
    return this.functionRunner.execute(definition, request, organizationSlug);
  default:
    return TaskResponseDto.failure(request.mode!, `Unknown agent type: ${definition.agentType}`);
}
```

## Orchestration Capability

### Universal Orchestration

**Key Insight**: Orchestration is not an agent type, it's a capability available to all agents.

Any agent can:
- Call sub-agents in sequence or parallel
- Pass data between agents
- Handle human checkpoints
- Pause/resume/rollback orchestrations

### Orchestration Actions

All agents inherit these orchestration transport types:

1. **execute**: Start a new orchestration
   - Define sequence/graph of sub-agents
   - Execute and return final result

2. **continue**: Continue a paused orchestration
   - Resume from last checkpoint
   - Execute remaining steps

3. **pause**: Pause an orchestration
   - Save current state
   - Return pause token

4. **resume**: Resume from pause
   - Load saved state
   - Continue execution

5. **human-response**: Provide human input to orchestration
   - Submit approval/rejection
   - Provide additional input
   - Continue execution

6. **rollback**: Roll back orchestration to previous step
   - Undo last step
   - Restart from checkpoint

### Example: Context Agent with Orchestration

```typescript
class ContextAgentRunnerService extends BaseAgentRunner {
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto> {
    // Check if orchestration is requested
    if (request.payload?.orchestrate) {
      return this.handleOrchestration(
        request.payload.orchestrationAction || 'execute',
        definition,
        request,
        organizationSlug
      );
    }

    // Standard context agent build
    // 1. Fetch context
    const contextData = await this.fetchContextFromSources(definition);

    // 2. Check if we need data from other agents
    if (definition.config?.requiresSubAgents) {
      const subAgentData = await this.callSubAgent(
        definition.config.subAgentSlug,
        request,
        organizationSlug
      );
      contextData.subAgentResults = subAgentData;
    }

    // 3. Optimize context
    const optimized = await this.contextOptimization.optimizeContext(contextData);

    // 4. Build system prompt
    const systemPrompt = this.buildSystemPrompt(definition, optimized);

    // 5. Call LLM
    const response = await this.llm.generateResponse({
      systemPrompt,
      userMessage: request.userMessage,
      provider: definition.llm.provider,
      model: definition.llm.model
    });

    // 6. Save deliverable
    const deliverable = await this.deliverablesService.executeAction(
      'create',
      {
        title: request.payload?.title || 'Context Agent Output',
        content: response.content,
        format: 'markdown'
      },
      { conversationId: request.conversationId, userId: this.resolveUserId(request) }
    );

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      content: deliverable.data,
      metadata: response.metadata
    });
  }
}
```

## Data Model

### Agent Table Columns

Agents have the following key columns that determine behavior:

- **`type`**: String identifying agent type
  - Values: `'context'`, `'tool'`, `'api'`, `'external'`, `'function'`

- **`context`**: Markdown text
  - Contains context/instructions for the agent
  - Used by context agents in system prompt

- **`yaml`**: YAML text
  - Parsed into agent card (A2A protocol)
  - Contains metadata: modes, tools, endpoints, capabilities
  - Used by tool/api/external agents for configuration

- **`function_code`**: JavaScript code
  - Used by function agents
  - Executed in VM sandbox

### Agent Runtime Definition

```typescript
export interface AgentRuntimeDefinition {
  id: string;
  slug: string;
  organizationSlug: string | null;
  agentType: string; // 'context' | 'tool' | 'api' | 'external' | 'function'

  // Existing fields
  transport?: AgentTransportDefinition; // A2A transport (api, external, function, none)
  llm?: AgentLLMDefinition;
  execution: AgentExecutionDefinition;
  context: Record<string, any> | null; // Parsed from context column
  config: Record<string, any> | null; // Parsed from yaml column

  // Agent card
  agentCard?: Record<string, any> | null; // Parsed from yaml

  // ... other fields
}
```

### Config Schema Extensions

Agents can define custom schemas in config for plans/deliverables:

```typescript
// In agent's config (from yaml)
{
  plan: {
    format: 'json' | 'markdown' | 'yaml',
    schema?: { /* JSON Schema */ },
    template?: string
  },
  deliverable: {
    format: 'json' | 'markdown' | 'html',
    type: string,
    schema?: { /* JSON Schema */ },
    sections?: string[]
  },
  orchestration?: {
    availableAgents: string[],
    defaultMode: 'sequential' | 'parallel',
    maxDepth: number
  }
}
```

## User Flows

### Flow 1: Context Agent BUILD
1. User sends BUILD request to context agent
2. Router calls `ContextAgentRunner.execute()`
3. Runner calls `handleBuild()`
4. Fetches context from sources (plans, deliverables, history)
5. Reads markdown from `context` column
6. Optimizes context to token budget
7. Interpolates into system prompt
8. Calls LLM
9. Saves deliverable via DeliverablesService
10. Returns TaskResponseDto with deliverable

### Flow 2: Tool Agent BUILD (Called by Another Agent)
1. Context agent needs data, calls tool agent via `callSubAgent()`
2. Tool agent receives BUILD request
3. Router calls `ToolAgentRunner.execute()`
4. Runner calls `handleBuild()`
5. Parses request to extract tool name + arguments
6. Calls MCPService.callTool()
7. Normalizes MCPToolResponse to deliverable format
8. Returns TaskResponseDto to calling agent

### Flow 3: Context Agent with Orchestration
1. User sends BUILD request with `payload.orchestrate = true`
2. Router calls `ContextAgentRunner.execute()`
3. Runner detects orchestration request
4. Calls `handleOrchestration('execute', ...)`
5. Orchestration logic:
   - Determines sub-agents needed (from config or LLM planning)
   - Calls product agent via `callSubAgent()`
   - Calls data agent via `callSubAgent()`
   - Aggregates results
6. Uses aggregated data as context for LLM
7. Generates final deliverable
8. Returns TaskResponseDto

### Flow 4: API Agent BUILD
1. User sends BUILD request to API agent
2. Router calls `ApiAgentRunner.execute()`
3. Runner calls `handleBuild()`
4. Reads request transform from `yaml` config
5. Transforms TaskRequestDto → API format
6. Makes HTTP call using `transport.api` config
7. Reads response transform from `yaml` config
8. Transforms API response → deliverable format
9. Saves deliverable via DeliverablesService
10. Returns TaskResponseDto

### Flow 5: External Agent BUILD
1. User sends BUILD request to external agent
2. Router calls `ExternalAgentRunner.execute()`
3. Runner calls `handleBuild()`
4. Validates request conforms to A2A protocol
5. Makes HTTP POST to external endpoint using `transport.external` config
6. Validates response conforms to A2A protocol
7. Extracts deliverable from response
8. Returns TaskResponseDto

### Flow 6: Orchestration with Human Checkpoint
1. Context agent starts orchestration
2. Executes step 1 (calls product agent)
3. Executes step 2 (calls data agent)
4. Reaches human checkpoint (defined in config)
5. Calls `handleOrchestration('pause', ...)`
6. Creates human approval record
7. Returns TaskResponseDto with approval ID
8. User approves via separate request
9. User sends `orchestrationAction: 'human-response'` with approval
10. Calls `handleOrchestration('human-response', ...)`
11. Validates approval
12. Calls `continueOrchestration()`
13. Executes remaining steps
14. Returns final TaskResponseDto

## Technical Specifications

### File Structure

```
apps/api/src/agent2agent/
├── interfaces/
│   └── agent-runner.interface.ts (IAgentRunner)
├── services/
│   ├── base-agent-runner.service.ts (BaseAgentRunner abstract class)
│   ├── context-agent-runner.service.ts (ContextAgentRunnerService)
│   ├── tool-agent-runner.service.ts (ToolAgentRunnerService)
│   ├── api-agent-runner.service.ts (ApiAgentRunnerService)
│   ├── external-agent-runner.service.ts (ExternalAgentRunnerService)
│   ├── function-agent-runner.service.ts (FunctionAgentRunnerService - refactored)
│   ├── agent-runner-registry.service.ts (Registry/factory)
│   └── agent-mode-router.service.ts (Updated routing)
```

### Interface Definition

```typescript
// apps/api/src/agent2agent/interfaces/agent-runner.interface.ts

export interface IAgentRunner {
  execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null
  ): Promise<TaskResponseDto>;
}
```

### Runner Registry

```typescript
// apps/api/src/agent2agent/services/agent-runner-registry.service.ts

@Injectable()
export class AgentRunnerRegistryService {
  private runners: Map<string, IAgentRunner>;

  constructor(
    private readonly contextRunner: ContextAgentRunnerService,
    private readonly toolRunner: ToolAgentRunnerService,
    private readonly apiRunner: ApiAgentRunnerService,
    private readonly externalRunner: ExternalAgentRunnerService,
    private readonly functionRunner: FunctionAgentRunnerService,
  ) {
    this.runners = new Map([
      ['context', this.contextRunner],
      ['tool', this.toolRunner],
      ['api', this.apiRunner],
      ['external', this.externalRunner],
      ['function', this.functionRunner],
    ]);
  }

  getRunner(agentType: string): IAgentRunner | null {
    return this.runners.get(agentType) || null;
  }
}
```

## Migration Path

### Phase 1: Foundation (Week 1)
1. Create base interface and abstract class
2. Create runner registry
3. Update config schema definitions (keep transport unchanged)

### Phase 2: Context Agent (Week 2)
1. Implement ContextAgentRunnerService
2. Integrate with ContextOptimizationService
3. Add context fetching from sources
4. Test with existing agents

### Phase 3: Tool Agent (Week 2-3)
1. Implement ToolAgentRunnerService
2. Integrate with MCPService
3. Add tool request parsing
4. Test with MCP tools

### Phase 4: API & External Agents (Week 3-4)
1. Implement ApiAgentRunnerService
2. Implement ExternalAgentRunnerService
3. Use existing transport configurations
4. Test with mock endpoints

### Phase 5: Function Agent Migration (Week 4)
1. Refactor FunctionAgentRunnerService to extend BaseAgentRunner
2. Ensure existing tests pass
3. No behavior changes

### Phase 6: Orchestration (Week 5-6)
1. Implement orchestration methods in BaseAgentRunner
2. Add sub-agent calling logic
3. Implement pause/resume/rollback
4. Add human checkpoint handling
5. Test orchestration flows

### Phase 7: Router Integration (Week 6)
1. Update AgentModeRouterService
2. Add routing by agentType
3. Integrate runner registry
4. Test all agent types

### Phase 8: Testing & Polish (Week 7-8)
1. Comprehensive integration tests
2. Performance testing
3. Documentation
4. Example agents

## Success Metrics

### Engineering Metrics
- All 5 agent types implemented with <300 lines each
- 100% backward compatibility with existing function agents
- No regression in existing functionality
- <100ms overhead for base class routing

### Product Metrics
- Agents can orchestrate 3+ sub-agents
- Context agents support 4+ context sources
- Tool agents support 10+ MCP tools
- API/External agents support 5+ real integrations

### Developer Experience
- New agent type can be added by extending BaseAgentRunner (<1 day)
- Clear separation of concerns (each type in own file)
- Easy to test each agent type independently

## Open Questions

1. **Streaming**: How should streaming work across all agent types? Context agents stream LLM, but what about tool/api/external agents?

2. **Context caching**: Should context agents cache fetched plans/deliverables? For how long?

3. **Tool selection**: Should tool agents use LLM to select which tool, or require explicit specification?

4. **Orchestration depth**: What's the max depth for orchestrations calling orchestrations? Default to 3?

5. **Error handling**: How do we standardize error responses when sub-agents fail during orchestration?

6. **Performance**: Should we parallelize context fetching from multiple sources?

## Future Enhancements

- **Multi-modal context agents**: Support for image/audio/video context
- **Agent composition UI**: Visual builder for orchestration definitions
- **Agent marketplace**: Share and discover pre-built agents
- **Agent analytics**: Usage tracking, performance metrics per agent type
- **Agent versioning**: Semantic versioning for agent definitions
- **Agent testing framework**: Unit/integration test harness

## References

- [Agent Execution Gateway](apps/api/src/agent2agent/services/agent-execution-gateway.service.ts)
- [Agent Mode Router](apps/api/src/agent2agent/services/agent-mode-router.service.ts)
- [Function Agent Runner](apps/api/src/agent2agent/services/function-agent-runner.service.ts)
- [Context Optimization Service](apps/api/src/agent2agent/context-optimization/context-optimization.service.ts)
- [MCP Service](apps/api/src/mcp/mcp.service.ts)
- [Agent Runtime Definition](apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts)
- [Orchestration Runner Service](apps/api/src/agent-platform/services/orchestration-runner.service.ts)
