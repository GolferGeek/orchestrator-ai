# Agent Runners Implementation Plan

## Overview

Implementation plan for the Agent Runners architecture - an OOP class hierarchy where 5 agent types (Context, Tool, API, External, Function) extend a base runner class. All agents inherit orchestration capabilities.

**Key Principles:**
- Each agent type in its own file (150-300 lines)
- Orchestration is a capability, not a separate type
- Transport definitions unchanged (A2A protocol)
- Base class provides shared CONVERSE/PLAN, agents implement BUILD

---

## Phase 1: Foundation

**Goal**: Create base interfaces, abstract class, and registry

**Duration**: 3-5 days

### Task 1.1: Create Base Interface
- [x] Create `apps/api/src/agent2agent/interfaces/agent-runner.interface.ts`
- [x] Define `IAgentRunner` interface with `execute()` method
- [x] Add JSDoc documentation
- **Notes:**

### Task 1.2: Create Base Abstract Class
- [x] Create `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- [x] Implement `BaseAgentRunner` abstract class
- [x] Add `execute()` method with mode routing
- [x] Add `handleConverse()` default implementation
- [x] Add `handlePlan()` default implementation
- [x] Add abstract `handleBuild()` method
- [ ] Add `handleOrchestration()` with orchestration actions (defer to Phase 6)
- [x] Add utility methods: `canExecuteMode()`, `resolveUserId()`, `buildMetadata()`
- [ ] Write unit tests for base class
- **Notes:**

### Task 1.3: Create Runner Registry
- [ ] Create `apps/api/src/agent2agent/services/agent-runner-registry.service.ts`
- [ ] Implement registry to map agentType → runner instance
- [ ] Add `getRunner(agentType: string)` method
- [ ] Add to Agent2AgentModule providers
- [ ] Write unit tests
- **Notes:**

### Task 1.4: Update Config Schema (if needed)
- [x] Config schema extensions already in place (AgentConfigPlanDefinition, etc.)
- [ ] Verify config can store orchestration metadata
- **Notes:**

---

## Phase 2: Context Agent Runner

**Goal**: Implement Context Agent (most common type)

**Duration**: 5-7 days

### Task 2.1: Create Context Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/context-agent-runner.service.ts`
- [ ] Extend `BaseAgentRunner`
- [ ] Inject: `ContextOptimizationService`, `LLMService`, `PlansService`, `DeliverablesService`
- [ ] Add constructor with DI
- **Notes:**

### Task 2.2: Implement Context Fetching
- [ ] Add `fetchContextFromSources()` method
  - [ ] Support 'plans' source: fetch current plan for conversation
  - [ ] Support 'deliverables' source: fetch deliverables
  - [ ] Support 'conversations' source: fetch conversation history
  - [ ] Support 'projects' source (if applicable)
- [ ] Read markdown from `context` column (via `definition.context`)
- [ ] Return structured context object
- **Notes:**

### Task 2.3: Implement System Prompt Building
- [ ] Add `buildSystemPrompt()` method
- [ ] Combine markdown from `context` column with fetched context
- [ ] Apply simple template interpolation (e.g., replace {{plan.content}})
- [ ] Return complete system prompt
- **Notes:**

### Task 2.4: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Fetch context using `fetchContextFromSources()`
  - [ ] Optimize context using `ContextOptimizationService`
  - [ ] Build system prompt
  - [ ] Call LLM via `LLMService.generateResponse()`
  - [ ] Check if action is 'create' (requires LLM) vs other actions
  - [ ] Save deliverable via `DeliverablesService.executeAction('create', ...)`
  - [ ] Support custom deliverable schemas from `definition.config.deliverable`
  - [ ] Return `TaskResponseDto.success()` with deliverable
- [ ] Handle errors gracefully
- **Notes:**

### Task 2.5: Test Context Agent
- [ ] Write unit tests
  - [ ] Test context fetching from each source
  - [ ] Test system prompt building
  - [ ] Test BUILD mode execution
  - [ ] Test error handling
- [ ] Write integration test with real agent definition
- [ ] Test end-to-end BUILD flow
- **Notes:**

---

## Phase 3: Tool Agent Runner

**Goal**: Implement Tool Agent for MCP execution

**Duration**: 4-6 days

### Task 3.1: Create Tool Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/tool-agent-runner.service.ts`
- [ ] Extend `BaseAgentRunner`
- [ ] Inject `MCPService`
- **Notes:**

### Task 3.2: Implement Tool Request Parsing
- [ ] Add `parseToolRequest()` method
  - [ ] Read tools from `definition.config` (parsed from yaml)
  - [ ] Extract tool name from request (explicit or first in list)
  - [ ] Extract arguments from `request.payload`
  - [ ] If `config.tool.argumentMapping.llmParse` is true, use LLM to parse
  - [ ] Return `{ toolName, args }`
- [ ] Write unit tests for parsing
- **Notes:**

### Task 3.3: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Parse tool request
  - [ ] Call `MCPService.callTool({ name, arguments })`
  - [ ] Normalize `MCPToolResponse` to deliverable format
  - [ ] Save deliverable via `DeliverablesService.executeAction('create', ...)`
  - [ ] Return `TaskResponseDto.success()` with deliverable
- [ ] Handle MCP errors
- **Notes:**

### Task 3.4: Add Multi-Tool Support (if needed)
- [ ] Implement sequential tool execution
  - [ ] Execute tools in order
  - [ ] Pass output of tool N as input to tool N+1
- [ ] Implement parallel tool execution
  - [ ] Execute all tools concurrently
  - [ ] Aggregate results
- **Notes:**

### Task 3.5: Test Tool Agent
- [ ] Unit tests for tool parsing and execution
- [ ] Integration tests with real MCP tools (supabase/query-db)
- [ ] Test error scenarios
- **Notes:**

---

## Phase 4: API Agent Runner

**Goal**: Implement API Agent for HTTP calls

**Duration**: 4-6 days

### Task 4.1: Create API Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/api-agent-runner.service.ts`
- [ ] Extend `BaseAgentRunner`
- [ ] Inject HTTP client service (or use built-in fetch/axios)
- **Notes:**

### Task 4.2: Implement Request/Response Transforms
- [ ] Add `transformRequest()` method
  - [ ] Read transform config from `definition.config.requestTransform`
  - [ ] Apply mapping (JSONata or template)
  - [ ] Transform TaskRequestDto → API format
- [ ] Add `transformResponse()` method
  - [ ] Read transform config from `definition.config.responseTransform`
  - [ ] Apply mapping
  - [ ] Transform API response → deliverable format
- [ ] Unit tests for transforms
- **Notes:**

### Task 4.3: Implement HTTP Call Logic
- [ ] Add `executeHttpCall()` method
  - [ ] Build request from `definition.transport.api` config
  - [ ] Apply authentication (bearer, API key, etc.)
  - [ ] Set timeout
  - [ ] Execute HTTP call
  - [ ] Handle HTTP errors (4xx, 5xx)
  - [ ] Return raw response
- [ ] Add retry logic if specified
- **Notes:**

### Task 4.4: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Transform request
  - [ ] Execute HTTP call
  - [ ] Transform response
  - [ ] Save deliverable
  - [ ] Return `TaskResponseDto.success()`
- **Notes:**

### Task 4.5: Test API Agent
- [ ] Unit tests for transforms and HTTP logic
- [ ] Integration tests with mock HTTP server
- [ ] Test authentication flows
- **Notes:**

---

## Phase 5: External Agent Runner

**Goal**: Implement External Agent for A2A calls

**Duration**: 3-5 days

### Task 5.1: Create External Agent Runner Service
- [ ] Create `apps/api/src/agent2agent/services/external-agent-runner.service.ts`
- [ ] Extend `BaseAgentRunner`
- [ ] Inject HTTP client
- **Notes:**

### Task 5.2: Implement A2A Protocol Validation
- [ ] Add `validateA2ARequest()` method
  - [ ] Ensure request conforms to TaskRequestDto schema
- [ ] Add `validateA2AResponse()` method
  - [ ] Ensure response conforms to TaskResponseDto schema
- [ ] Unit tests for validation
- **Notes:**

### Task 5.3: Implement Health Check & Circuit Breaker
- [ ] Add `performHealthCheck()` method
  - [ ] Call health endpoint if configured in `definition.transport.external.healthCheck`
  - [ ] Return health status
- [ ] Add circuit breaker logic (open/closed/half-open states)
- **Notes:**

### Task 5.4: Implement BUILD Mode
- [ ] Implement `handleBuild()` method
  - [ ] Validate request conforms to A2A
  - [ ] Make HTTP POST to `/agent-to-agent/tasks` using `definition.transport.external`
  - [ ] Include authentication
  - [ ] Validate response conforms to A2A
  - [ ] Extract deliverable from response
  - [ ] Return `TaskResponseDto`
- [ ] Add retry logic with backoff
- **Notes:**

### Task 5.5: Test External Agent
- [ ] Unit tests for A2A validation
- [ ] Integration tests with mock A2A-compliant server
- [ ] Test protocol violations (should fail gracefully)
- **Notes:**

---

## Phase 6: Function Agent Migration

**Goal**: Refactor existing Function Agent to extend BaseAgentRunner

**Duration**: 2-3 days

### Task 6.1: Refactor Function Agent Runner
- [ ] Update `apps/api/src/agent2agent/services/function-agent-runner.service.ts`
- [ ] Change to extend `BaseAgentRunner`
- [ ] Move existing `execute()` logic into `handleBuild()`
- [ ] Remove duplicate mode routing (use base class)
- [ ] Use base class utility methods where applicable
- **Notes:**

### Task 6.2: Test Function Agent
- [ ] Ensure existing function agent tests still pass
- [ ] Add tests for base class integration
- [ ] No behavior changes expected
- **Notes:**

---

## Phase 7: Orchestration Implementation

**Goal**: Add orchestration capability to BaseAgentRunner

**Duration**: 7-10 days

### Task 7.1: Add Orchestration Method to Base Class
- [ ] In `BaseAgentRunner`, implement `handleOrchestration()` method
- [ ] Support orchestration actions:
  - [ ] `execute`: Start new orchestration
  - [ ] `continue`: Continue paused orchestration
  - [ ] `pause`: Pause orchestration
  - [ ] `resume`: Resume from pause
  - [ ] `human-response`: Handle human approval
  - [ ] `rollback`: Roll back to previous step
- **Notes:**

### Task 7.2: Implement Sub-Agent Calling
- [ ] Add `callSubAgent()` method in BaseAgentRunner
  - [ ] Resolve agent by slug via `AgentRegistryService`
  - [ ] Build TaskRequestDto for sub-agent
  - [ ] Call `AgentExecutionGateway.execute()`
  - [ ] Return sub-agent response
- [ ] Add `executeSequentialAgents()` method
  - [ ] Call agents in order
  - [ ] Pass output of agent N as input to agent N+1
- [ ] Add `executeParallelAgents()` method
  - [ ] Call agents concurrently
  - [ ] Aggregate results
- **Notes:**

### Task 7.3: Implement Orchestration Execution
- [ ] Add `executeOrchestration()` method
  - [ ] Parse orchestration definition from `definition.config.orchestration`
  - [ ] Determine sub-agents needed
  - [ ] Call sub-agents (sequential or parallel based on config)
  - [ ] Aggregate results
  - [ ] Return final TaskResponseDto
- [ ] Start orchestration run via `OrchestrationRunnerService.startRun()`
- [ ] Update run progress via `OrchestrationRunnerService.updateRun()`
- **Notes:**

### Task 7.4: Implement Pause/Resume/Continue
- [ ] Add `pauseOrchestration()` method
  - [ ] Save current state
  - [ ] Return pause token in TaskResponseDto
- [ ] Add `continueOrchestration()` method
  - [ ] Load saved state from run ID
  - [ ] Resume execution from last step
- [ ] Add `resumeOrchestration()` method (alias for continue)
- **Notes:**

### Task 7.5: Implement Human Checkpoint Handling
- [ ] Add `handleHumanResponse()` method
  - [ ] Extract approval decision from request
  - [ ] Validate approval via `HumanApprovalsRepository`
  - [ ] If approved: continue orchestration
  - [ ] If rejected: fail orchestration
- [ ] Create approval records when checkpoint reached
- **Notes:**

### Task 7.6: Implement Rollback
- [ ] Add `rollbackOrchestration()` method
  - [ ] Load orchestration run state
  - [ ] Undo last step (if possible)
  - [ ] Restart from previous checkpoint
- **Notes:**

### Task 7.7: Add Recursion Prevention
- [ ] Track orchestration depth in metadata
- [ ] Fail if depth exceeds `config.orchestration.maxDepth` (default 3)
- **Notes:**

### Task 7.8: Test Orchestration
- [ ] Unit tests for each orchestration action
- [ ] Integration tests with 3+ sub-agents
- [ ] Test sequential and parallel execution
- [ ] Test pause/resume/continue flows
- [ ] Test human checkpoint handling
- [ ] Test rollback
- [ ] Test recursion prevention
- **Notes:**

---

## Phase 8: Router Integration

**Goal**: Update AgentModeRouterService to route to runners

**Duration**: 2-3 days

### Task 8.1: Update Router for BUILD Mode
- [ ] Update `apps/api/src/agent2agent/services/agent-mode-router.service.ts`
- [ ] Inject `AgentRunnerRegistryService`
- [ ] In `handleBuild()` method:
  - [ ] Check if orchestration requested (`request.payload?.orchestrate`)
  - [ ] If orchestration: route to runner's `handleOrchestration()`
  - [ ] Otherwise: route by `definition.agentType` to appropriate runner
  - [ ] Use registry to get runner instance
  - [ ] Call `runner.execute(definition, request, organizationSlug)`
- **Notes:**

### Task 8.2: Handle Backward Compatibility
- [ ] Ensure agents without `agentType` still work (fall back to existing logic)
- [ ] Log warnings for deprecated patterns
- **Notes:**

### Task 8.3: Test Router Integration
- [ ] Test routing for each agentType
- [ ] Test orchestration routing
- [ ] Test fallback behavior
- [ ] Test backward compatibility
- **Notes:**

---

## Phase 9: Example Agents & Testing

**Goal**: Create example agents and comprehensive tests

**Duration**: 3-4 days

### Task 9.1: Create Example Context Agent
- [ ] Create "Plan Analyzer" context agent
  - [ ] Sources: plans, deliverables
  - [ ] Context: markdown instructions
  - [ ] Test BUILD mode
- [ ] Save to fixtures or seed data
- **Notes:**

### Task 9.2: Create Example Tool Agent
- [ ] Create "Database Query Agent"
  - [ ] Tools: supabase/query-db
  - [ ] Test with sample queries
- **Notes:**

### Task 9.3: Create Example API Agent
- [ ] Create API agent with mock endpoint
  - [ ] Configure request/response transforms
  - [ ] Test BUILD mode
- **Notes:**

### Task 9.4: Create Example External Agent
- [ ] Set up mock A2A-compliant agent
- [ ] Create external agent pointing to mock
- [ ] Test end-to-end
- **Notes:**

### Task 9.5: Create Orchestration Example
- [ ] Create context agent that orchestrates sub-agents
  - [ ] Define 3+ sub-agents
  - [ ] Test sequential execution
  - [ ] Test with human checkpoint
- **Notes:**

### Task 9.6: Comprehensive Integration Testing
- [ ] Test all 5 agent types
- [ ] Test all modes (CONVERSE, PLAN, BUILD)
- [ ] Test orchestration across agent types
- [ ] Test error scenarios
- **Notes:**

---

## Phase 10: Performance & Polish

**Goal**: Optimize and polish

**Duration**: 3-5 days

### Task 10.1: Performance Testing
- [ ] Measure overhead of base class routing (<100ms target)
- [ ] Profile context fetching
- [ ] Profile orchestration execution
- [ ] Optimize bottlenecks
- **Notes:**

### Task 10.2: Error Handling Improvements
- [ ] Standardize error responses across runners
- [ ] Add detailed error logging
- [ ] Add error recovery where possible
- **Notes:**

### Task 10.3: Add Streaming Support (if needed)
- [ ] Define streaming interface for runners
- [ ] Implement in ContextAgentRunner
- [ ] Update router to handle streaming
- **Notes:**

### Task 10.4: Add Caching (if needed)
- [ ] Implement context cache for plans/deliverables
- [ ] Add TTL and invalidation logic
- **Notes:**

---

## Phase 11: Documentation & Launch

**Goal**: Finalize docs and launch

**Duration**: 2-3 days

### Task 11.1: Developer Documentation
- [ ] Write "Extending BaseAgentRunner" guide
- [ ] Write "Creating a New Agent Type" guide
- [ ] Write "Orchestration API" reference
- [ ] Document config schema for each agent type
- **Notes:**

### Task 11.2: User Documentation
- [ ] Write "Agent Types Overview"
- [ ] Write "Using Context Agents" guide
- [ ] Write "Orchestrating Agents" guide
- **Notes:**

### Task 11.3: API Documentation
- [ ] Update OpenAPI/Swagger specs
- [ ] Document TaskRequestDto/TaskResponseDto changes
- **Notes:**

### Task 11.4: Release Preparation
- [ ] Prepare release notes
- [ ] Document breaking changes (if any)
- [ ] Create migration guide for existing agents
- **Notes:**

### Task 11.5: Launch Checklist
- [ ] All tests passing (unit + integration)
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Example agents deployed
- [ ] Monitoring/alerting configured
- [ ] Feature flag enabled (if applicable)
- [ ] Announce to team
- **Notes:**

---

## Dependencies & Blockers

### External Dependencies
- [ ] MCP service must be stable
- [ ] PlansService and DeliverablesService APIs must be finalized
- [ ] OrchestrationRunnerService must be functional

### Internal Dependencies
- Phase 1 must complete before Phases 2-6
- Phases 2-6 can be parallelized (different agent types)
- Phase 7 depends on Phases 2-6 (orchestration needs runners)
- Phase 8 depends on Phases 2-7
- Phases 9-11 depend on Phase 8

### Known Blockers
- None identified yet

---

## Risk Assessment

### High Risk
- **Orchestration complexity**: Sub-agent calling, state management, pause/resume
  - *Mitigation*: Start with simple sequential orchestration, add features incrementally

### Medium Risk
- **Backward compatibility**: Existing agents must continue working
  - *Mitigation*: Thorough testing, feature flags, gradual rollout
- **Performance overhead**: Base class routing adds latency
  - *Mitigation*: Profile and optimize, acceptable if <100ms

### Low Risk
- **Context fetching latency**: Multiple source fetches may be slow
  - *Mitigation*: Implement caching, parallelize fetching

---

## Success Criteria

### Phase 1-2 Complete (Foundation + Context Agent)
- [ ] Base class and interface defined
- [ ] Context agent can fetch context and call LLM
- [ ] All tests passing

### Phases 2-6 Complete (All Agent Types)
- [ ] All 5 agent types implemented
- [ ] Each type has unit + integration tests
- [ ] Router can route to correct runner

### Phase 7 Complete (Orchestration)
- [ ] Any agent can orchestrate sub-agents
- [ ] Sequential and parallel execution working
- [ ] Pause/resume/human checkpoints functional

### Phases 8-11 Complete (Integration & Launch)
- [ ] Router integrated with all runners
- [ ] Example agents created
- [ ] Documentation complete
- [ ] Feature launched

---

## Timeline Estimate

- **Phase 1 (Foundation)**: 3-5 days
- **Phase 2 (Context Agent)**: 5-7 days
- **Phase 3 (Tool Agent)**: 4-6 days
- **Phase 4 (API Agent)**: 4-6 days
- **Phase 5 (External Agent)**: 3-5 days
- **Phase 6 (Function Agent)**: 2-3 days
- **Phase 7 (Orchestration)**: 7-10 days
- **Phase 8 (Router)**: 2-3 days
- **Phase 9 (Examples/Testing)**: 3-4 days
- **Phase 10 (Performance/Polish)**: 3-5 days
- **Phase 11 (Documentation/Launch)**: 2-3 days

**Total Estimate**: 38-57 days (7-11 weeks)

**Note**: Phases 2-6 can be parallelized if multiple engineers work on different agent types, potentially reducing total time to 5-7 weeks.

---

## Current Status

### Completed
- [x] Phase 1.1: Create IAgentRunner interface
- [x] Phase 1.2: Create BaseAgentRunner abstract class (partial - needs orchestration)

### In Progress
- [ ] Phase 1.3: Create runner registry

### Next Steps
1. Complete Phase 1 (runner registry, tests)
2. Start Phase 2 (Context Agent)
3. Parallel work on Phases 3-6 if resources available

---

## Notes & Decisions

### Architectural Decisions
- **OOP over functional**: Class hierarchy for clarity and separation of concerns
- **5 agent types**: context, tool, api, external, function (no separate orchestrator type)
- **Orchestration as capability**: Built into BaseAgentRunner, available to all
- **Transport unchanged**: A2A protocol definitions remain as-is
- **Data from columns**: context (markdown), yaml (parsed config), function_code (JS)

### Open Items
- [ ] Decide on template engine for system prompt interpolation
- [ ] Decide on JSONata vs alternative for API transforms
- [ ] Define streaming interface
- [ ] Determine caching strategy
- [ ] Set performance SLAs

---

## Team Assignments

- **Phase 1-2**: [Claude/Assigned Engineer]
- **Phase 3**: [Assigned Engineer]
- **Phase 4**: [Assigned Engineer]
- **Phase 5**: [Assigned Engineer]
- **Phase 6**: [Assigned Engineer]
- **Phase 7**: [Assigned Engineer/Team]
- **Phase 8-11**: [Team]

---

## Changelog

- **2025-01-11**: Initial v2 plan created with correct architecture (5 types + orchestration capability)
