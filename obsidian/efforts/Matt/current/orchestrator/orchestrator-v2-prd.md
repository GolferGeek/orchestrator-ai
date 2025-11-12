# Orchestrator V2 — Product Requirements Document

**Project**: Orchestrator-AI Platform  
**Initiative**: Orchestrator V2 Cleanup & Simplification  
**Author**: Matt Weber (GolferGeek)  
**Date**: October 28, 2025  
**Version**: 2.0 (Revised)

---

## Executive Summary

Orchestrator V2 is **primarily a cleanup effort** to remove complex, over-engineered orchestration infrastructure and replace it with minimal proxy logic in the existing agent runner. We are removing all orchestration-specific tables, services, endpoints, transport types, and frontend UI, then adding simple sub-agent delegation logic to the standard agent execution flow.

###Key Changes

- **Remove**: All orchestration infrastructure (tables, services, endpoints, transport types, frontend UI)
- **Keep**: Hierarchical agent structure via `reports_to`
- **Add**: Minimal orchestrator detection + proxy logic in agent runner
- **Use**: Standard agent endpoints (no new orchestrator-specific routes)
- **Defer to V3**: Complex orchestration features, separate transport types

---

## Strategic Vision

### Current Problem

We built a complex orchestration system (recipes, runs, steps, approvals) that treats orchestrators like workflow engines. This is over-engineered for our actual need: **simple agent delegation**.

### Desired End State

**Orchestrators are just agents that know their team and delegate work.**

- User calls standard agent endpoint: `POST /agent-to-agent/{orgSlug}/{orchestratorSlug}/tasks`
- Agent runner detects `agent_type = 'orchestrator'`
- Runner queries hierarchy for sub-agents
- Runner selects best match based on request
- Runner proxies to sub-agent via A2A
- Response includes attribution metadata
- Done

### What This Is NOT

- ❌ Not building new orchestrator endpoints
- ❌ Not creating new transport types
- ❌ Not adding workflow orchestration
- ❌ Not building frontend workflow UI
- ❌ Not preserving orchestration tables

**This is a REMOVAL effort with minimal new code.**

---

## Current Architecture Analysis

### What Exists (Keep Unchanged)

| Component | Location | Notes |
|-----------|----------|-------|
| **Agent Hierarchy** | `apps/api/src/agent-platform/hierarchy/` | Uses `reports_to` field |
| **Agent Registry** | `agent-registry.service.ts` | Knows all agents |
| **A2A Protocol** | `apps/api/src/agent2agent/` | Agent-to-agent communication |
| **Standard Agent Endpoints** | `/agent-to-agent/{orgSlug}/{agentSlug}/tasks` | With org scoping |
| **Agent Runner/Executor** | Agent execution services | Will be minimally updated |

### What Exists (REMOVE Completely)

| Component | Location | Files | Action |
|-----------|----------|-------|--------|
| **Orchestration Tables** | Database | 6 tables | Drop all tables |
| **Backend Services** | `orchestration-*.service.ts` | 15 files | Delete entirely |
| **Backend Handlers** | `base-agent-runner/orchestrate.*` | 2 files | Delete entirely |
| **Backend Controllers** | `orchestrations.controller.ts` | 1 file | Delete entirely |
| **Backend Repositories** | `orchestration-*.repository.ts` | 4 files | Delete entirely |
| **Backend Entities** | `orchestration-*.entity.ts` | 3 files | Delete entirely |
| **Backend Interfaces** | `orchestration-*.interface.ts` | 4 files | Delete entirely |
| **Backend Types** | `orchestration-*.types.ts` | 5 files | Delete entirely |
| **Backend DTOs** | `orchestrations.dto.ts` | 1 file | Delete entirely |
| **Backend Tests** | `*.spec.ts` | 15 files | Delete entirely |
| **Orchestrate Mode** | `modes/orchestrate.types.ts` | 1 file | Delete entirely - use standard modes |
| **Frontend Files** | Stores, actions, types, builders | 4 files | Delete entirely |

**Total removal**: 50 backend + 4 frontend + 1 transport = **55 files + 6 tables**  
**Estimated lines removed**: ~10,500-15,500 lines

---

## Functional Requirements

### FR-1: Use Standard Agent Endpoints

**Requirement**: Orchestrators invoked via standard agent task endpoints (no new routes)

**Acceptance Criteria**:
- `POST /agent-to-agent/{orgSlug}/{agentSlug}/tasks` works for orchestrator agents
- No `/orchestrate/*` endpoints exist
- Organization scoping preserved
- All standard agent modes supported (converse, plan, deliverable)

### FR-2: Agent Runner Orchestrator Detection

**Requirement**: Agent runner must detect orchestrator type and handle differently

**Acceptance Criteria**:
- Check if `agent_record.agent_type === 'orchestrator'`
- If orchestrator → invoke orchestrator proxy logic
- If standard agent → existing execution path
- No breaking changes to standard agent flow

### FR-3: Sub-Agent Selection & Routing

**Requirement**: Orchestrator selects sub-agent on first message, then routes all subsequent messages to same agent

**Acceptance Criteria**:
- **First message**: 
  - Check if `request.metadata.current_sub_agent` exists
  - If not: Query hierarchy for sub-agents, use LLM to select best match
  - Set `response.metadata.current_sub_agent = selected_agent_slug`
- **Subsequent messages**:
  - If `request.metadata.current_sub_agent` exists: route directly (skip selection)
  - Preserve conversational flow with same sub-agent
- Filter by organization scope (org + global)
- Log routing decision for debugging
- **No UI display** of available agents

### FR-4: Direct Sub-Agent Execution

**Requirement**: Orchestrator executes sub-agent via HTTP and processes response

**Acceptance Criteria**:
- Make direct HTTP call: `POST /agent-to-agent/{org}/{subAgent}/tasks`
- Preserve `conversation_id`, `user_id`, `task_id`, `mode`
- Wait for sub-agent response (deliverable/plan/converse)
- **Process response** (orchestrator can transform/augment if needed)
- Return processed response to frontend
- **Not a transparent proxy** - orchestrator actively handles response

### FR-5: Response Attribution & Current Sub-Agent Tracking

**Requirement**: Response indicates which sub-agent fulfilled request and tracks current sub-agent

**Acceptance Criteria**:
- Add `metadata.resolvedBy = sub_agent_slug`
- Add `metadata.resolvedByDisplayName = sub_agent.display_name`
- Add `metadata.current_sub_agent = sub_agent_slug` (for routing persistence)
- Frontend echoes `current_sub_agent` back in next request metadata
- Orchestrator uses `current_sub_agent` to route directly (skip selection)
- Frontend can display attribution

### FR-6: Converse Mode Delegation

**Requirement**: If converse is delegated, sub-agent handles conversational flow

**Acceptance Criteria**:
- If orchestrator selects sub-agent for converse mode → delegate
- Sub-agent handles back-and-forth conversation
- Attribution shows sub-agent handled conversation
- Original behavior from V1

---

## Non-Functional Requirements

### NFR-1: Minimal Code Addition

- Rewritten orchestrator-agent-runner: ~150 lines
- Transport type metadata additions: ~40 lines
- Frontend attribution + metadata: ~50 lines
- Total new code: ~240 lines

### NFR-2: Maximum Code Removal

- Remove ~10,500-15,500 lines
- Remove 50 backend files (services, controllers, entities, types, tests, handlers)
- Remove 4 frontend files (stores, actions, types, builders)
- Drop 6 database tables

### NFR-3: No Breaking Changes

- Standard agents unaffected
- Existing agent endpoints unchanged
- Existing conversation flow preserved

### NFR-4: Performance

- Sub-agent selection: <500ms
- Proxy overhead: <200ms
- Total added latency: <700ms

---

## Technical Specifications

### Database Schema Changes

#### Tables to Drop

```sql
DROP TABLE IF EXISTS orchestration_runs CASCADE;
DROP TABLE IF EXISTS orchestration_steps CASCADE;
DROP TABLE IF EXISTS orchestration_definitions CASCADE;
DROP TABLE IF EXISTS orchestration_checkpoints CASCADE;
DROP TABLE IF EXISTS orchestration_credentials CASCADE;
DROP TABLE IF EXISTS agent_orchestrations CASCADE;
```

**Migration Strategy**:
1. Drop tables (no data export needed)
2. Clean up any foreign key references

### Backend Implementation

#### Rewrite OrchestratorAgentRunnerService

**File**: `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`

**Current**: 581 lines with complex orchestration logic, dependencies on 10+ orchestration services

**New**: ~150 lines with simple agent selection and forwarding logic

**Approach**:
- **Keep**: Extend `BaseAgentRunner` (maintain runner pattern)
- **Remove all dependencies on**: OrchestrationDefinitionService, OrchestrationExecutionService, OrchestrationRunnerService, OrchestrationStateService, OrchestrationRunFactoryService, OrchestrationDashboardService, OrchestrationProgressEventsService, OrchestrationCheckpointService, OrchestrationEventsService, OrchestrationOutputMapperService
- **Remove**: All `handleOrchestrate()` mode logic
- **Add**: Override `handleConverse()`, `handlePlan()`, `handleBuild()` methods with delegation logic

**New Implementation**:

```typescript
@Injectable()
export class OrchestratorAgentRunnerService extends BaseAgentRunner {
  // Override each standard mode handler
  async handleConverse(request: TaskRequest): Promise<TaskResponse> {
    return this.delegateToSubAgent(request);
  }

  async handlePlan(request: TaskRequest): Promise<TaskResponse> {
    return this.delegateToSubAgent(request);
  }

  async handleBuild(request: TaskRequest): Promise<TaskResponse> {
    return this.delegateToSubAgent(request);
  }

  private async delegateToSubAgent(request: TaskRequest): Promise<TaskResponse> {
    // 1. Get available sub-agents from hierarchy
    const subAgents = await this.hierarchyService.getSubAgents(
      this.agent.slug,
      this.agent.organization_slug
    );
    
    // 2. Check for sticky routing (current_sub_agent in metadata)
    let selectedAgent: AgentRecord;
    if (request.metadata?.current_sub_agent) {
      selectedAgent = subAgents.find(a => a.slug === request.metadata.current_sub_agent);
    }
    
    // 3. If no current agent, select best match using LLM
    if (!selectedAgent) {
      selectedAgent = await this.selectBestAgent(request, subAgents);
    }
    
    // 4. Forward request to selected agent (direct HTTP call)
    const response = await this.a2aService.executeTask(
      selectedAgent.organization_slug,
      selectedAgent.slug,
      {
        ...request,
        // Preserve conversation_id, user_id, task_id, mode
      }
    );
    
    // 5. Add attribution metadata
    response.metadata = {
      ...response.metadata,
      resolvedBy: selectedAgent.slug,
      resolvedByDisplayName: selectedAgent.display_name,
      current_sub_agent: selectedAgent.slug, // For sticky routing
    };
    
    return response;
  }

  private async selectBestAgent(
    request: TaskRequest,
    subAgents: AgentRecord[]
  ): Promise<AgentRecord> {
    // Use LLM to match request intent to agent capabilities
    // Implementation details...
  }
}
```

**Net Change**: -431 lines (581 → ~150)

### Files to DELETE

**Total: 50 backend files + 4 frontend files + 1 transport type file = 55 files**

#### Backend Services (15 files)
1. `orchestration-execution.service.ts`
2. `orchestration-runner.service.ts`
3. `orchestration-state.service.ts`
4. `orchestration-run-factory.service.ts`
5. `orchestration-dashboard.service.ts`
6. `orchestration-progress-events.service.ts`
7. `orchestration-checkpoint-events.service.ts`
8. `orchestration-status.service.ts`
9. `orchestration-cache.service.ts`
10. `orchestration-metrics.service.ts`
11. `orchestration-checkpoint.service.ts`
12. `orchestration-definition.service.ts`
13. `orchestration-events.service.ts`
14. `orchestration-output-mapper.service.ts`
15. `orchestration-step-executor.service.ts`

#### Backend Handlers (2 files)
16. `base-agent-runner/orchestrate.handlers.ts`
17. `base-agent-runner/orchestrate.handlers.spec.ts`

#### Backend Controllers (1 file)
18. `orchestrations.controller.ts`

#### Backend Repositories (4 files)
19. `orchestration-runs.repository.ts`
20. `orchestration-steps.repository.ts`
21. `orchestration-definitions.repository.ts`
22. `agent-orchestrations.repository.ts`

#### Backend Entities (3 files)
23. `orchestration-run.entity.ts`
24. `orchestration-step.entity.ts`
25. `orchestration-definition.entity.ts`

#### Backend Interfaces (4 files)
26. `orchestration-run-record.interface.ts`
27. `orchestration-step-record.interface.ts`
28. `orchestration-definition.interface.ts`
29. `agent-orchestration-record.interface.ts`

#### Backend Types (5 files)
30. `orchestration-run.types.ts`
31. `orchestration-dashboard.types.ts`
32. `orchestration-events.types.ts`
33. `orchestration-definition.types.ts`
34. `agent2agent/orchestration/orchestration.types.ts`

#### Backend DTOs (1 file)
35. `orchestrations.dto.ts`

#### Backend Test Files (15 files)
36. `orchestration-dashboard.service.spec.ts`
37. `orchestration-checkpoint.service.spec.ts`
38. `orchestration-progress-events.service.spec.ts`
39. `orchestration-runner.service.spec.ts`
40. `orchestration-checkpoint-events.service.spec.ts`
41. `orchestration-status.service.spec.ts`
42. `orchestration-output-mapper.service.spec.ts`
43. `orchestration-execution.service.spec.ts`
44. `__tests__/orchestration-run-factory.service.spec.ts`
45. `orchestrations.controller.spec.ts`
46. `orchestration-runs.repository.spec.ts`
47. `agent-orchestrations.repository.spec.ts`
48. `orchestration-step-executor.service.spec.ts`
49. `__tests__/orchestration-step-executor-suborchestration.service.spec.ts`
50. `orchestrator-agent-runner.service.spec.ts`

#### Frontend Files (4 files)
1. `orchestratorStore.ts` (store)
2. `orchestrate.actions.ts` (actions)
3. `orchestration.ts` (types)
4. `orchestrate.builder.ts` (builder)

#### Transport Types (1 file)
- `apps/transport-types/modes/orchestrate.types.ts` (entire file)
- Remove orchestrate exports from `apps/transport-types/index.ts`

### Files to UPDATE (Minimal Changes)

#### Backend (~5 files)
1. **`orchestrator-agent-runner.service.ts`** — Complete rewrite (581 → ~150 lines)
2. **`base-agent-runner.service.ts`** — Remove `ORCHESTRATE` mode case from execute method
3. **`agent-execution-gateway.service.ts`** — Remove `ORCHESTRATE` mode case
4. **`agent-platform.module.ts`** — Remove orchestration module imports
5. **`app.module.ts`** — Remove orchestration module imports

#### Frontend (~2 files)
1. **Message display component** — Add attribution badge (~20 lines)
2. **Conversation service/store** — Preserve `current_sub_agent` in request metadata (~30 lines)

#### Transport Types (~4 files)
1. **`shared/enums.ts`** — Remove `ORCHESTRATE` from `AgentTaskMode` and `JsonRpcMethod`
2. **Request metadata types** — Add `current_sub_agent?: string | null`
3. **Response metadata types** — Add `current_sub_agent?: string | null`
4. **`index.ts`** — Remove orchestrate exports

---

## Implementation Phases

### Phase 1: Audit & Documentation
- [ ] Inventory all orchestration files/tables/routes
- [ ] Confirm no production data in orchestration tables
- [ ] Document removal plan
- [ ] Get approval on PRD

### Phase 2: Database Cleanup
- [ ] Verify no production dependencies on orchestration tables
- [ ] Create migration to drop tables (no export needed)
- [ ] Test migration on dev
- [ ] Apply to staging

### Phase 3: Backend Removal
- [ ] Delete orchestration service files
- [ ] Delete orchestration controller files
- [ ] Remove orchestration module from imports
- [ ] Remove orchestration routes
- [ ] Update tests (remove orchestration tests)

### Phase 4: Transport Type Changes
- [ ] **REMOVAL**: Delete `modes/orchestrate.types.ts` entirely
- [ ] **REMOVAL**: Remove orchestrate exports from `index.ts`
- [ ] **REMOVAL**: Remove `ORCHESTRATE = 'orchestrate'` from `AgentTaskMode` enum in `shared/enums.ts`
- [ ] **REMOVAL**: Remove orchestrate methods from `JsonRpcMethod` type
- [ ] **ADDITION**: Add `current_sub_agent?: string | null` to metadata for mode × action combinations:
  - **Converse**: All actions (execute/continue)
  - **Plan**: Create, Read, Edit, SetCurrent actions (not Delete)
  - **Build/Deliverable**: Create, Read, Edit, Rerun, SetCurrent actions (not Delete)
  - Add to both request metadata and response metadata types
- [ ] Rebuild transport-types package
- [ ] **Note**: These are the ONLY transport type changes - no others without approval

### Phase 5: Frontend Removal
- [ ] Delete orchestration UI components
- [ ] Remove orchestration routes
- [ ] Remove orchestration store/state
- [ ] Clean up imports

### Phase 6: Rewrite Orchestrator Runner
- [ ] Completely rewrite `orchestrator-agent-runner.service.ts` (581 → ~150 lines)
- [ ] Remove all orchestration service dependencies
- [ ] Implement `delegateToSubAgent()` method with sticky routing
- [ ] Implement LLM-based agent selection
- [ ] Add attribution metadata to responses
- [ ] Remove `ORCHESTRATE` mode handling from base-agent-runner.service.ts

### Phase 7: Frontend Attribution
- [ ] Add attribution badge to message component
- [ ] Test display

### Phase 8: Testing & Deployment
- [ ] E2E test: Orchestrator delegates to sub-agent
- [ ] E2E test: Attribution displays correctly
- [ ] E2E test: Standard agents still work
- [ ] Deploy to staging
- [ ] Smoke test
- [ ] Deploy to production

---

## User Experience Flow

### Scenario: User Requests Blog Post via Orchestrator

1. **User**: Opens conversation with "Marketing Manager" orchestrator
2. **User**: Requests "Write a blog post about AI trends" (mode=deliverable)
3. **System**: 
   - Agent runner detects orchestrator type
   - Queries hierarchy for sub-agents
   - Selects "Blog Writer" as best match
   - Proxies request to Blog Writer
4. **Blog Writer**: Generates deliverable
5. **System**: Returns with `resolvedBy: "blog_writer"` metadata
6. **Frontend**: Displays deliverable with "✓ Resolved by: Blog Writer Agent" badge

### Scenario: Standard Agent (No Change)

1. **User**: Opens conversation with "Blog Writer" agent directly
2. **User**: Requests "Write a blog post"
3. **System**: Standard agent execution (no orchestrator logic)
4. **Blog Writer**: Generates deliverable
5. **System**: Returns standard response
6. **Frontend**: Displays normally (no attribution needed)

---

## Success Metrics

### Code Removal
- ✅ ~10,500-15,500 lines removed
- ✅ 50 backend files deleted
- ✅ 4 frontend files deleted
- ✅ 1 transport type file deleted
- ✅ 6 database tables dropped

### Code Addition
- ✅ ~150 lines for rewritten orchestrator-agent-runner
- ✅ ~40 lines for transport type metadata
- ✅ ~50 lines for frontend attribution
- ✅ **Total: ~240 lines added**

### Net Result
- ✅ **Net reduction: ~10,260-15,260 lines**

### Functionality
- ✅ Orchestrators delegate to sub-agents
- ✅ Standard agents work unchanged
- ✅ Attribution visible in UI
- ✅ No orchestration-specific endpoints exist

### Performance
- ✅ Sub-agent selection <500ms (p95)
- ✅ Proxy overhead <200ms (p95)
- ✅ No regression for standard agents

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Data Loss** | Low | Low | Orchestration tables confirmed unused; no export needed |
| **Breaking Standard Agents** | Low | High | Careful runner rewrite; test extensively |
| **Incomplete Removal** | Low | Low | Comprehensive inventory completed; 55 files identified |
| **Performance Regression** | Low | Medium | Benchmark; optimize selection logic; add sticky routing |

---

## Open Questions

~~1. **Are orchestration tables used in production?**~~ ✅ Confirmed unused, no export needed.
~~2. **Should we keep archived orchestration tables temporarily?**~~ ✅ Drop immediately.
~~3. **Is there any demo/test code that references orchestration?**~~ ✅ Will be caught by linter after deletion.
~~4. **Frontend components to remove**~~ ✅ Inventory complete: 4 files identified.

---

## Out of Scope (Deferred to V3)

- ❌ Multi-step orchestration workflows
- ❌ Recipe save/load functionality
- ❌ Orchestrator-specific transport types
- ❌ Complex orchestration UI
- ❌ Human-in-loop approvals
- ❌ Orchestration run history
- ❌ Ad hoc chaining within conversations

**V3 will revisit orchestration features if needed. V2 is about simplification and cleanup.**

---

## Approval & Sign-off

- [ ] **Product Owner**: Matt Weber
- [ ] **Technical Lead**: Matt Weber

---

**Document Status**: Draft → **Ready for Task Master Breakdown**

**Next Steps**: 
1. Review & approve PRD
2. Initialize Task Master
3. Parse PRD into tasks
4. Begin Phase 1 (Audit)
