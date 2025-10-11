# Agent Runners Implementation Plan

## Overview

This document outlines the phased implementation plan for the Agent Runners architecture. Each phase contains tasks with sub-tasks that can be tracked and checked off as completed.

---

## Phase 1: Foundation & Interfaces

**Goal**: Establish base interfaces, abstract classes, and type definitions

### Task 1.1: Create Base Agent Runner Interface
- [ ] Create `apps/api/src/agent2agent/services/base-agent-runner.interface.ts`
  - [ ] Define `IAgentRunner` interface with `execute()` method signature
  - [ ] Add JSDoc documentation
  - [ ] Export interface
- [ ] Create unit tests for interface (validation only)
- [ ] **Notes:**

### Task 1.2: Create Base Agent Runner Abstract Class
- [ ] Create `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
  - [ ] Implement `BaseAgentRunner` abstract class
  - [ ] Add `execute()` method with mode routing logic
  - [ ] Add abstract methods: `handleConverse()`, `handlePlan()`, `handleBuild()`
  - [ ] Add utility methods: `canExecuteMode()`, `resolveUserId()`, `buildMetadata()`
  - [ ] Add error handling for unsupported modes
- [ ] Write unit tests for base class utilities
  - [ ] Test mode capability validation
  - [ ] Test userId resolution from multiple sources
  - [ ] Test metadata merging
- [ ] **Notes:**

### Task 1.3: Update Transport Type Definitions
- [ ] Update `apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts`
  - [ ] Add `AgentTransportContextDefinition` interface
  - [ ] Add `AgentTransportToolDefinition` interface
  - [ ] Add `AgentTransportOrchestratorDefinition` interface
  - [ ] Update `AgentTransportDefinition.kind` to include new types: `'context' | 'tool' | 'orchestrator'`
  - [ ] Add optional fields to `AgentTransportDefinition`
- [ ] Update schema validation if applicable
- [ ] **Notes:**

### Task 1.4: Update Agent Config Schema Definitions
- [ ] Update `apps/api/src/agent-platform/interfaces/database-agent-definition.interface.ts`
  - [ ] Add `AgentConfigPlanDefinition` interface
  - [ ] Add `AgentConfigDeliverableDefinition` interface
  - [ ] Update `AgentRuntimeDefinition.config` type to support plan/deliverable schemas
- [ ] **Notes:**

### Task 1.5: Create Runner Registry/Factory
- [ ] Create `apps/api/src/agent2agent/services/agent-runner-registry.service.ts`
  - [ ] Implement registry to map transport.kind → runner instance
  - [ ] Add `registerRunner()` method
  - [ ] Add `getRunner(kind: string)` method
  - [ ] Initialize with all runner types
- [ ] Add unit tests for registry
- [ ] **Notes:**

---

## Phase 2: Context Agent Runner

**Goal**: Implement Context Agent Runner (replaces pure LLM agents)

### Task 2.1: Create Context Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
  - [ ] Extend `BaseAgentRunner`
  - [ ] Inject dependencies: `ContextOptimizationService`, `LLMService`, `PlansService`, `DeliverablesService`
  - [ ] Add constructor with dependency injection
- [ ] **Notes:**

### Task 2.2: Implement Context Fetching
- [ ] Add `fetchContext()` private method
  - [ ] Support 'plans' source: fetch current plan for conversation
  - [ ] Support 'deliverables' source: fetch deliverables for conversation
  - [ ] Support 'conversations' source: fetch conversation history
  - [ ] Support 'projects' source: fetch project context (if applicable)
  - [ ] Return structured context object
- [ ] Add `fetchPlanContext()` helper method
- [ ] Add `fetchDeliverableContext()` helper method
- [ ] Add `fetchConversationHistory()` helper method
- [ ] **Notes:**

### Task 2.3: Implement System Prompt Building
- [ ] Add `buildSystemPrompt()` method
  - [ ] Parse `systemPromptTemplate` from transport config
  - [ ] Interpolate context variables using template engine (e.g., Handlebars or simple replace)
  - [ ] Support nested context access (e.g., `{{plan.content}}`)
  - [ ] Return interpolated system prompt
- [ ] Add unit tests for prompt interpolation
- [ ] **Notes:**

### Task 2.4: Implement CONVERSE Mode
- [ ] Implement `handleConverse()` method
  - [ ] Fetch context using `fetchContext()`
  - [ ] Optimize context using `ContextOptimizationService`
  - [ ] Build system prompt using `buildSystemPrompt()`
  - [ ] Call LLM via `LLMService.generateResponse()`
  - [ ] Return `TaskResponseDto.success()` with response
- [ ] Handle errors and return appropriate failures
- [ ] **Notes:**

### Task 2.5: Implement PLAN Mode
- [ ] Implement `handlePlan()` method
  - [ ] Check if action is 'create' (requires LLM)
  - [ ] If 'create': fetch context, build plan-specific prompt, call LLM
  - [ ] Extract plan content from LLM response
  - [ ] Save plan using `PlansService.executeAction('create', ...)`
  - [ ] Support agent-specific plan schemas from `definition.config.plan.schema`
  - [ ] If not 'create': route directly to PlansService without LLM
  - [ ] Return `TaskResponseDto.success()` with plan data
- [ ] Handle errors
- [ ] **Notes:**

### Task 2.6: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Check if action is 'create' (requires LLM)
  - [ ] If 'create': fetch context (including current plan if available)
  - [ ] Build deliverable-specific prompt
  - [ ] Call LLM
  - [ ] Extract deliverable content from LLM response
  - [ ] Save deliverable using `DeliverablesService.executeAction('create', ...)`
  - [ ] Support agent-specific deliverable schemas from `definition.config.deliverable.schema`
  - [ ] If not 'create': route directly to DeliverablesService without LLM
  - [ ] Return `TaskResponseDto.success()` with deliverable data
- [ ] Handle errors
- [ ] **Notes:**

### Task 2.7: Add Unit Tests for Context Agent Runner
- [ ] Test context fetching from each source
- [ ] Test system prompt interpolation with various templates
- [ ] Test CONVERSE mode execution
- [ ] Test PLAN mode with 'create' action
- [ ] Test BUILD mode with 'create' action
- [ ] Test error handling
- [ ] **Notes:**

### Task 2.8: Add Integration Tests
- [ ] Create test context agent definition
- [ ] Test end-to-end CONVERSE flow
- [ ] Test end-to-end PLAN flow
- [ ] Test end-to-end BUILD flow
- [ ] **Notes:**

---

## Phase 3: Tool Agent Runner

**Goal**: Implement Tool Agent Runner for MCP tool execution

### Task 3.1: Create Tool Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/tool-agent-runner.service.ts`
  - [ ] Extend `BaseAgentRunner`
  - [ ] Inject `MCPService`
  - [ ] Add constructor
- [ ] **Notes:**

### Task 3.2: Implement Tool Request Parsing
- [ ] Add `parseToolRequest()` method
  - [ ] Extract tool name from request (explicit or inferred)
  - [ ] Extract tool arguments from `request.payload`
  - [ ] If `transport.tool.argumentMapping.llmParse` is true, use LLM to parse natural language into tool arguments
  - [ ] Validate required arguments against tool schema
  - [ ] Return `{ toolName, args }`
- [ ] Add unit tests for parsing logic
- [ ] **Notes:**

### Task 3.3: Implement CONVERSE Mode
- [ ] Implement `handleConverse()` method
  - [ ] Parse tool request
  - [ ] Call `MCPService.callTool({ name, arguments })`
  - [ ] Normalize `MCPToolResponse` to `TaskResponseDto`
  - [ ] Return response
- [ ] Handle MCP errors
- [ ] **Notes:**

### Task 3.4: Implement PLAN Mode
- [ ] Implement `handlePlan()` method
  - [ ] Tool agents can create plans (e.g., "plan to query these 3 tables")
  - [ ] Parse request to determine plan structure
  - [ ] Optionally invoke tool to gather planning data
  - [ ] Save plan via PlansService
  - [ ] Return plan
- [ ] **Notes:**

### Task 3.5: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Parse tool request
  - [ ] Execute tool(s) via MCP
  - [ ] Format tool results as deliverable content
  - [ ] Save deliverable via DeliverablesService
  - [ ] Return deliverable
- [ ] Support sequential and parallel tool execution modes
- [ ] **Notes:**

### Task 3.6: Add Multi-Tool Support
- [ ] Implement sequential tool execution
  - [ ] Execute tools in order specified in `transport.tool.tools`
  - [ ] Pass output of tool N as input to tool N+1
- [ ] Implement parallel tool execution
  - [ ] Execute all tools concurrently
  - [ ] Aggregate results
- [ ] **Notes:**

### Task 3.7: Add Unit Tests
- [ ] Test tool request parsing
- [ ] Test MCP service integration
- [ ] Test CONVERSE mode
- [ ] Test PLAN mode
- [ ] Test BUILD mode
- [ ] Test multi-tool sequential execution
- [ ] Test multi-tool parallel execution
- [ ] **Notes:**

### Task 3.8: Add Integration Tests
- [ ] Create test tool agent definition
- [ ] Test with real MCP tools (supabase/query-db, etc.)
- [ ] Test error scenarios
- [ ] **Notes:**

---

## Phase 4: API Agent Runner

**Goal**: Implement API Agent Runner for HTTP calls with custom transforms

### Task 4.1: Create API Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
  - [ ] Extend `BaseAgentRunner`
  - [ ] Inject HTTP client service
  - [ ] Add constructor
- [ ] **Notes:**

### Task 4.2: Implement Request Transformation
- [ ] Add `transformRequest()` method
  - [ ] Parse `transport.api.requestTransform`
  - [ ] Apply template/mapping to transform TaskRequestDto → API format
  - [ ] Support JSONata or simple template strings
  - [ ] Return transformed request body
- [ ] Add unit tests
- [ ] **Notes:**

### Task 4.3: Implement Response Transformation
- [ ] Add `transformResponse()` method
  - [ ] Parse `transport.api.responseTransform`
  - [ ] Apply template/mapping to transform API response → TaskResponseDto format
  - [ ] Support JSONata or simple template strings
  - [ ] Return normalized response
- [ ] Add unit tests
- [ ] **Notes:**

### Task 4.4: Implement HTTP Call Logic
- [ ] Add `executeHttpCall()` method
  - [ ] Build HTTP request from transport config (endpoint, method, headers)
  - [ ] Apply authentication (bearer, API key, OAuth)
  - [ ] Set timeout from config
  - [ ] Execute HTTP call
  - [ ] Handle HTTP errors (4xx, 5xx)
  - [ ] Return raw response
- [ ] Add retry logic if specified in config
- [ ] **Notes:**

### Task 4.5: Implement CONVERSE Mode
- [ ] Implement `handleConverse()` method
  - [ ] Transform request
  - [ ] Execute HTTP call
  - [ ] Transform response
  - [ ] Return TaskResponseDto
- [ ] **Notes:**

### Task 4.6: Implement PLAN Mode
- [ ] Implement `handlePlan()` method
  - [ ] API call to generate plan data
  - [ ] Transform response to plan structure
  - [ ] Save via PlansService
  - [ ] Return plan
- [ ] **Notes:**

### Task 4.7: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] API call to generate deliverable
  - [ ] Transform response to deliverable structure
  - [ ] Save via DeliverablesService
  - [ ] Return deliverable
- [ ] **Notes:**

### Task 4.8: Add Unit Tests
- [ ] Test request transformation
- [ ] Test response transformation
- [ ] Test authentication injection
- [ ] Test HTTP error handling
- [ ] Test retry logic
- [ ] **Notes:**

### Task 4.9: Add Integration Tests
- [ ] Create test API agent definition
- [ ] Test with mock HTTP server
- [ ] Test authentication flows
- [ ] **Notes:**

---

## Phase 5: External Agent Runner

**Goal**: Implement External Agent Runner for A2A protocol-compliant agents

### Task 5.1: Create External Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/external-agent-runner.service.ts`
  - [ ] Extend `BaseAgentRunner`
  - [ ] Inject HTTP client
  - [ ] Add constructor
- [ ] **Notes:**

### Task 5.2: Implement A2A Protocol Validation
- [ ] Add `validateA2ARequest()` method
  - [ ] Ensure request conforms to TaskRequestDto schema
  - [ ] Validate required fields
- [ ] Add `validateA2AResponse()` method
  - [ ] Ensure response conforms to TaskResponseDto schema
  - [ ] Validate required fields
- [ ] Add unit tests
- [ ] **Notes:**

### Task 5.3: Implement Health Check
- [ ] Add `performHealthCheck()` method
  - [ ] Call health check endpoint if configured
  - [ ] Validate agent capabilities
  - [ ] Return health status
- [ ] Add circuit breaker logic (open/closed/half-open states)
- [ ] **Notes:**

### Task 5.4: Implement A2A HTTP Call
- [ ] Add `executeA2ACall()` method
  - [ ] Build HTTP POST to `/agent-to-agent/tasks` endpoint
  - [ ] Include authentication headers
  - [ ] Set timeout
  - [ ] Execute call
  - [ ] Validate response conforms to A2A protocol
  - [ ] Return TaskResponseDto
- [ ] Add retry logic with backoff
- [ ] **Notes:**

### Task 5.5: Implement All Modes (CONVERSE, PLAN, BUILD)
- [ ] Implement `handleConverse()` - forward request to external agent
- [ ] Implement `handlePlan()` - forward request to external agent
- [ ] Implement `handleBuild()` - forward request to external agent
- [ ] All modes just proxy to external agent with protocol validation
- [ ] **Notes:**

### Task 5.6: Add Unit Tests
- [ ] Test A2A request validation
- [ ] Test A2A response validation
- [ ] Test health check logic
- [ ] Test circuit breaker
- [ ] Test retry with backoff
- [ ] **Notes:**

### Task 5.7: Add Integration Tests
- [ ] Create test external agent definition
- [ ] Set up mock A2A-compliant server
- [ ] Test end-to-end A2A calls
- [ ] Test protocol violations (should fail gracefully)
- [ ] **Notes:**

---

## Phase 6: Update Function Agent Runner

**Goal**: Migrate existing Function Agent Runner to extend BaseAgentRunner

### Task 6.1: Refactor Function Agent Runner
- [ ] Update `apps/api/src/agent2agent/services/function-agent-runner.service.ts`
  - [ ] Change to extend `BaseAgentRunner`
  - [ ] Keep existing `execute()` logic but wrap in base class pattern
  - [ ] Extract current logic into `handleConverse()`, `handlePlan()`, `handleBuild()`
  - [ ] Use base class utilities where applicable
- [ ] **Notes:**

### Task 6.2: Update Tests
- [ ] Ensure existing function agent tests still pass
- [ ] Add tests for base class integration
- [ ] **Notes:**

---

## Phase 7: Orchestrator Agent Runner

**Goal**: Implement Orchestrator Agent Runner for graph-based workflow execution

### Task 7.1: Create Orchestrator Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
  - [ ] Extend `BaseAgentRunner`
  - [ ] Inject `OrchestrationRunnerService`, `AgentExecutionGateway`, `AgentRegistry`
  - [ ] Add constructor
- [ ] **Notes:**

### Task 7.2: Implement Graph Parsing
- [ ] Add `parseOrchestrationGraph()` method
  - [ ] Parse orchestration definition from agent config or saved orchestration
  - [ ] Build DAG (Directed Acyclic Graph) from nodes and dependencies
  - [ ] Validate graph (no cycles, valid agent references)
  - [ ] Return graph structure
- [ ] Add unit tests for graph parsing and validation
- [ ] **Notes:**

### Task 7.3: Implement DAG Execution Engine
- [ ] Add `executeGraph()` method
  - [ ] Topologically sort nodes
  - [ ] Execute nodes in dependency order
  - [ ] For each node:
    - [ ] Resolve agent by slug
    - [ ] Gather inputs from completed dependency nodes
    - [ ] Call `AgentExecutionGateway.execute()` for sub-agent
    - [ ] Store node output
  - [ ] Handle node failures (continue, stop, retry)
  - [ ] Return aggregated results
- [ ] Support parallel execution of independent nodes
- [ ] **Notes:**

### Task 7.4: Implement Human Checkpoint Handling
- [ ] Add `handleHumanCheckpoint()` method
  - [ ] Pause execution at checkpoint
  - [ ] Create approval record in `HumanApprovalsRepository`
  - [ ] Return pending state
- [ ] Add `resumeFromCheckpoint()` method
  - [ ] Validate approval
  - [ ] Resume graph execution from checkpoint node
- [ ] **Notes:**

### Task 7.5: Implement CONVERSE Mode
- [ ] Implement `handleConverse()` method
  - [ ] Orchestrators cannot converse directly
  - [ ] Return `TaskResponseDto.failure()` with clear message
- [ ] **Notes:**

### Task 7.6: Implement PLAN Mode
- [ ] Implement `handlePlan()` method
  - [ ] Analyze user request to determine required sub-agents
  - [ ] Build orchestration graph (DAG)
  - [ ] Save orchestration plan via PlansService or OrchestrationRunnerService
  - [ ] Return plan with graph structure
- [ ] **Notes:**

### Task 7.7: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Start orchestration run via `OrchestrationRunnerService.startRun()`
  - [ ] Execute graph using `executeGraph()`
  - [ ] Handle checkpoints
  - [ ] Update run progress via `OrchestrationRunnerService.updateRun()`
  - [ ] Mark run complete
  - [ ] Return final deliverable aggregating sub-agent outputs
- [ ] **Notes:**

### Task 7.8: Add Recursion Prevention
- [ ] Add `maxDepth` tracking to prevent infinite orchestrator → orchestrator loops
- [ ] Add execution depth to metadata
- [ ] Fail if depth exceeds `transport.orchestrator.maxDepth`
- [ ] **Notes:**

### Task 7.9: Add Unit Tests
- [ ] Test graph parsing
- [ ] Test DAG validation (cycle detection)
- [ ] Test topological sort
- [ ] Test sequential execution
- [ ] Test parallel execution
- [ ] Test human checkpoint handling
- [ ] Test recursion prevention
- [ ] **Notes:**

### Task 7.10: Add Integration Tests
- [ ] Create test orchestrator agent with 3+ sub-agents
- [ ] Test PLAN mode
- [ ] Test BUILD mode with full graph execution
- [ ] Test checkpoint flow
- [ ] **Notes:**

---

## Phase 8: Router Integration

**Goal**: Update AgentModeRouterService to route to appropriate runners

### Task 8.1: Update AgentModeRouterService Routing Logic
- [ ] Update `apps/api/src/agent2agent/services/agent-mode-router.service.ts`
  - [ ] Inject `AgentRunnerRegistryService`
  - [ ] Update `handleConverse()`, `handlePlan()`, `handleBuild()` methods
  - [ ] Check `transport.kind` and route to appropriate runner
  - [ ] Use runner registry to get runner instance
  - [ ] Call `runner.execute(definition, request, organizationSlug)`
  - [ ] Return result
- [ ] **Notes:**

### Task 8.2: Update Routing for Each Mode
- [ ] Update CONVERSE mode routing
  - [ ] Check for function agent (legacy check)
  - [ ] Check transport.kind
  - [ ] Route to runner or fall through to existing LLM logic
- [ ] Update PLAN mode routing
  - [ ] Check transport.kind
  - [ ] Route to runner or fall through
- [ ] Update BUILD mode routing
  - [ ] Check transport.kind
  - [ ] Route to runner or fall through
- [ ] **Notes:**

### Task 8.3: Handle Backward Compatibility
- [ ] Ensure agents without `transport.kind` still work
- [ ] Default to context runner for agents with LLM config but no transport
- [ ] Log warnings for deprecated patterns
- [ ] **Notes:**

### Task 8.4: Add Tests
- [ ] Test routing for each transport.kind
- [ ] Test fallback behavior
- [ ] Test backward compatibility
- [ ] **Notes:**

---

## Phase 9: Example Agents & Documentation

**Goal**: Create example agents for each type and document usage

### Task 9.1: Create Example Context Agent
- [ ] Create agent definition for "Plan Analyzer" context agent
  - [ ] Sources: plans, deliverables
  - [ ] System prompt template analyzing plan quality
  - [ ] Save to fixtures or seed data
- [ ] Test agent via API
- [ ] Document usage in PRD or README
- [ ] **Notes:**

### Task 9.2: Create Example Tool Agent
- [ ] Create agent definition for "Database Query Agent"
  - [ ] Tools: supabase/query-db
  - [ ] Test with sample queries
- [ ] Create agent definition for "Multi-Tool Agent" (sequential)
  - [ ] Tools: supabase/query-db → slack/send-message
- [ ] Document usage
- [ ] **Notes:**

### Task 9.3: Create Example API Agent
- [ ] Create agent definition for third-party API integration (e.g., Stripe, Twilio)
  - [ ] Configure request/response transforms
  - [ ] Test with mock API
- [ ] Document usage
- [ ] **Notes:**

### Task 9.4: Create Example External Agent
- [ ] Set up mock external A2A-compliant agent
- [ ] Create agent definition pointing to mock
- [ ] Test end-to-end
- [ ] Document usage
- [ ] **Notes:**

### Task 9.5: Create Example Orchestrator Agent
- [ ] Create "Marketing Workflow Orchestrator"
  - [ ] Sub-agents: plan-context-agent, db-query-agent, report-generator-agent, slack-notifier
  - [ ] Define graph with dependencies
  - [ ] Test PLAN mode
  - [ ] Test BUILD mode
- [ ] Document usage
- [ ] **Notes:**

### Task 9.6: Create Developer Documentation
- [ ] Write "Creating a New Agent Type" guide
- [ ] Write "Extending BaseAgentRunner" guide
- [ ] Write "Agent Transport Configuration" reference
- [ ] Write "Agent Output Schemas" guide
- [ ] Add API documentation for each runner
- [ ] **Notes:**

---

## Phase 10: Migration & Testing

**Goal**: Migrate existing agents and ensure no regressions

### Task 10.1: Identify Existing LLM Agents
- [ ] Audit database for agents with no transport.kind or transport.kind = 'none'
- [ ] List agents that need migration to context agents
- [ ] **Notes:**

### Task 10.2: Migrate LLM Agents to Context Agents
- [ ] For each agent:
  - [ ] Determine if context sources are needed
  - [ ] Set transport.kind = 'context'
  - [ ] Define transport.context with appropriate config
  - [ ] Update agent record in database
  - [ ] Test agent still works
- [ ] **Notes:**

### Task 10.3: Update Agent Builder Service
- [ ] Update `AgentBuilderService` to generate correct transport config
- [ ] Support UI selections for transport type
- [ ] Generate appropriate config based on agent type
- [ ] **Notes:**

### Task 10.4: Comprehensive Integration Testing
- [ ] Test all agent types (context, tool, api, external, function, orchestrator)
- [ ] Test all modes (CONVERSE, PLAN, BUILD)
- [ ] Test error scenarios
- [ ] Test concurrent execution
- [ ] **Notes:**

### Task 10.5: Performance Testing
- [ ] Measure overhead of base class routing
- [ ] Profile context fetching performance
- [ ] Profile orchestrator graph execution
- [ ] Optimize bottlenecks
- [ ] **Notes:**

### Task 10.6: Regression Testing
- [ ] Run existing agent test suite
- [ ] Ensure no functionality broken
- [ ] Fix any regressions
- [ ] **Notes:**

---

## Phase 11: Advanced Features & Polish

**Goal**: Add advanced features and polish

### Task 11.1: Add Streaming Support
- [ ] Define streaming interface for runners
- [ ] Implement streaming in Context Agent Runner
- [ ] Implement streaming in Tool Agent Runner (if applicable)
- [ ] Update router to handle streaming requests
- [ ] **Notes:**

### Task 11.2: Add Caching for Context Agents
- [ ] Implement context cache (in-memory or Redis)
- [ ] Cache fetched plans/deliverables with TTL
- [ ] Add cache invalidation logic
- [ ] **Notes:**

### Task 11.3: Add Rate Limiting per Transport Type
- [ ] Define rate limit config per transport
- [ ] Implement rate limiter middleware
- [ ] Apply limits before runner execution
- [ ] **Notes:**

### Task 11.4: Add Runner Metrics
- [ ] Track execution time per runner type
- [ ] Track success/failure rates
- [ ] Track token usage for context agents
- [ ] Track tool invocation counts
- [ ] Emit metrics to monitoring system
- [ ] **Notes:**

### Task 11.5: Add Agent Analytics Dashboard
- [ ] Create endpoint for agent usage stats
- [ ] Create endpoint for runner performance metrics
- [ ] (Optional) Build simple UI to visualize metrics
- [ ] **Notes:**

### Task 11.6: Error Handling Standardization
- [ ] Define standard error codes for each transport type
- [ ] Ensure consistent error response format
- [ ] Add error logging and alerting
- [ ] **Notes:**

### Task 11.7: Add Agent Versioning Support
- [ ] Define versioning strategy for agent definitions
- [ ] Support multiple versions of same agent
- [ ] Allow pinning to specific version in orchestrations
- [ ] **Notes:**

---

## Phase 12: Documentation & Launch

**Goal**: Finalize documentation and launch

### Task 12.1: Update API Documentation
- [ ] Document all new endpoints (if any)
- [ ] Update OpenAPI/Swagger specs
- [ ] Document TaskRequestDto/TaskResponseDto changes
- [ ] **Notes:**

### Task 12.2: Write User-Facing Documentation
- [ ] Write "Agent Types Overview" for users
- [ ] Write "Creating Your First Context Agent" tutorial
- [ ] Write "Creating Your First Tool Agent" tutorial
- [ ] Write "Building Orchestrations" guide
- [ ] **Notes:**

### Task 12.3: Create Video Tutorials (Optional)
- [ ] Record demo of creating context agent
- [ ] Record demo of creating tool agent
- [ ] Record demo of creating orchestrator agent
- [ ] **Notes:**

### Task 12.4: Prepare Release Notes
- [ ] Document new features
- [ ] Document breaking changes (if any)
- [ ] Document migration steps for existing agents
- [ ] **Notes:**

### Task 12.5: Launch Checklist
- [ ] All tests passing (unit + integration)
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Example agents deployed
- [ ] Monitoring/alerting configured
- [ ] Feature flag enabled (if applicable)
- [ ] Announce to team
- [ ] **Notes:**

---

## Dependencies & Blockers

### External Dependencies
- [ ] MCP service must be stable and reliable
- [ ] PlansService and DeliverablesService APIs must be finalized
- [ ] OrchestrationRunnerService must support graph execution

### Internal Dependencies
- [ ] Phase 1 must complete before Phase 2-7
- [ ] Phase 2-7 can be parallelized (independent runners)
- [ ] Phase 8 depends on Phase 2-7
- [ ] Phase 9-10 depend on Phase 8
- [ ] Phase 11-12 can run in parallel with Phase 10

### Known Blockers
- None identified yet

---

## Risk Assessment

### High Risk
- **Orchestrator graph execution complexity**: DAG execution with error handling is complex
  - *Mitigation*: Start with sequential execution, add parallelization later
- **Backward compatibility**: Existing agents must continue working
  - *Mitigation*: Thorough testing, feature flags, gradual rollout

### Medium Risk
- **Performance overhead**: Base class routing adds small overhead
  - *Mitigation*: Profile and optimize, acceptable if <200ms
- **Context fetching latency**: Fetching plans/deliverables adds latency
  - *Mitigation*: Implement caching, optimize queries

### Low Risk
- **Tool agent parsing accuracy**: LLM-based argument parsing may be unreliable
  - *Mitigation*: Allow explicit argument specification as fallback

---

## Success Criteria

### Phase 1-2 (Foundation + Context Agent)
- [ ] Base class and interface defined
- [ ] Context agent can fetch context and call LLM
- [ ] All tests passing

### Phase 3-6 (Atomic Agents)
- [ ] All 5 atomic agent types implemented
- [ ] Each agent type has example and tests
- [ ] Router can route to correct runner

### Phase 7 (Orchestrator)
- [ ] Orchestrator agent can compose sub-agents
- [ ] Graph execution works for 3+ node DAG
- [ ] Human checkpoints functional

### Phase 8-10 (Integration & Migration)
- [ ] All existing agents migrated
- [ ] No regressions detected
- [ ] Performance acceptable

### Phase 11-12 (Polish & Launch)
- [ ] Documentation complete
- [ ] Monitoring in place
- [ ] Feature launched

---

## Timeline Estimate

- **Phase 1 (Foundation)**: 3-5 days
- **Phase 2 (Context Agent)**: 5-7 days
- **Phase 3 (Tool Agent)**: 4-6 days
- **Phase 4 (API Agent)**: 4-6 days
- **Phase 5 (External Agent)**: 3-5 days
- **Phase 6 (Function Agent)**: 2-3 days
- **Phase 7 (Orchestrator)**: 7-10 days
- **Phase 8 (Router)**: 2-3 days
- **Phase 9 (Examples)**: 3-4 days
- **Phase 10 (Migration)**: 5-7 days
- **Phase 11 (Polish)**: 5-7 days
- **Phase 12 (Launch)**: 2-3 days

**Total Estimate**: 45-66 days (9-13 weeks)

**Note**: Phases 2-6 can be parallelized if multiple engineers work on different agent types.

---

## Notes & Open Items

- [ ] Decide on template engine for system prompt interpolation (Handlebars vs simple string replace)
- [ ] Decide on JSONata vs alternative for API transforms
- [ ] Finalize streaming support architecture
- [ ] Determine caching strategy (in-memory vs Redis vs none)
- [ ] Set performance SLAs for each agent type
- [ ] Define monitoring/alerting strategy

---

## Team Assignments

- **Phase 1-2**: [Assign engineer]
- **Phase 3**: [Assign engineer]
- **Phase 4**: [Assign engineer]
- **Phase 5**: [Assign engineer]
- **Phase 6**: [Assign engineer]
- **Phase 7**: [Assign engineer]
- **Phase 8**: [Assign engineer]
- **Phase 9-12**: [Assign engineer or team]

---

## Changelog

- **2025-01-XX**: Initial plan created
