# Orchestrator V2 — Complete Removal Inventory

**Date**: October 28, 2025  
**Purpose**: Comprehensive list of all tables, backend files, and frontend files to remove

---

## 📊 Database Tables to Remove

### Primary Tables
1. **`orchestration_runs`** — Main orchestration execution records
2. **`orchestration_steps`** — Individual step execution within runs
3. **`orchestration_definitions`** — Orchestration templates/recipes
4. **`orchestration_checkpoints`** — Human-in-loop checkpoints for orchestration
5. **`orchestration_credentials`** — Credentials for orchestration execution
6. **`agent_orchestrations`** — Agent-specific orchestration configurations

**Total**: 6 tables

---

## 🔧 Backend Files to Remove

### Services (15 files to delete)
1. `apps/api/src/agent-platform/services/orchestration-execution.service.ts`
2. `apps/api/src/agent-platform/services/orchestration-runner.service.ts`
3. `apps/api/src/agent-platform/services/orchestration-state.service.ts`
4. `apps/api/src/agent-platform/services/orchestration-run-factory.service.ts`
5. `apps/api/src/agent-platform/services/orchestration-dashboard.service.ts`
6. `apps/api/src/agent-platform/services/orchestration-progress-events.service.ts`
7. `apps/api/src/agent-platform/services/orchestration-checkpoint-events.service.ts`
8. `apps/api/src/agent-platform/services/orchestration-status.service.ts`
9. `apps/api/src/agent-platform/services/orchestration-cache.service.ts`
10. `apps/api/src/agent-platform/services/orchestration-metrics.service.ts`
11. `apps/api/src/agent-platform/services/orchestration-checkpoint.service.ts`
12. `apps/api/src/agent-platform/services/orchestration-definition.service.ts`
13. `apps/api/src/agent-platform/services/orchestration-events.service.ts`
14. `apps/api/src/agent-platform/services/orchestration-output-mapper.service.ts`
15. `apps/api/src/agent2agent/services/orchestration-step-executor.service.ts`

### Handlers (2 files to delete)
16. `apps/api/src/agent2agent/services/base-agent-runner/orchestrate.handlers.ts`
17. `apps/api/src/agent2agent/services/base-agent-runner/orchestrate.handlers.spec.ts`

### Services (1 file to KEEP and rewrite)
18. ⚠️ **`apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`** — KEEP but completely rewrite with new proxy logic (~581 lines → ~150 lines)

### Controllers (1 file)
19. `apps/api/src/agent-platform/controllers/orchestrations.controller.ts`

### Repositories (4 files)
20. `apps/api/src/agent-platform/repositories/orchestration-runs.repository.ts`
21. `apps/api/src/agent-platform/repositories/orchestration-steps.repository.ts`
22. `apps/api/src/agent-platform/repositories/orchestration-definitions.repository.ts`
23. `apps/api/src/agent-platform/repositories/agent-orchestrations.repository.ts`

### Entities (3 files)
24. `apps/api/src/agent-platform/entities/orchestration-run.entity.ts`
25. `apps/api/src/agent-platform/entities/orchestration-step.entity.ts`
26. `apps/api/src/agent-platform/entities/orchestration-definition.entity.ts`

### Interfaces (4 files)
27. `apps/api/src/agent-platform/interfaces/orchestration-run-record.interface.ts`
28. `apps/api/src/agent-platform/interfaces/orchestration-step-record.interface.ts`
29. `apps/api/src/agent-platform/interfaces/orchestration-definition.interface.ts`
30. `apps/api/src/agent-platform/interfaces/agent-orchestration-record.interface.ts`

### Types (5 files)
31. `apps/api/src/agent-platform/types/orchestration-run.types.ts`
32. `apps/api/src/agent-platform/types/orchestration-dashboard.types.ts`
33. `apps/api/src/agent-platform/types/orchestration-events.types.ts`
34. `apps/api/src/agent-platform/types/orchestration-definition.types.ts`
35. `apps/api/src/agent2agent/orchestration/orchestration.types.ts`

### DTOs (1 file)
36. `apps/api/src/agent-platform/dto/orchestrations.dto.ts`

### Test Files (15 files)
37. `apps/api/src/agent-platform/services/orchestration-dashboard.service.spec.ts`
38. `apps/api/src/agent-platform/services/orchestration-checkpoint.service.spec.ts`
39. `apps/api/src/agent-platform/services/orchestration-progress-events.service.spec.ts`
40. `apps/api/src/agent-platform/services/orchestration-runner.service.spec.ts`
41. `apps/api/src/agent-platform/services/orchestration-checkpoint-events.service.spec.ts`
42. `apps/api/src/agent-platform/services/orchestration-status.service.spec.ts`
43. `apps/api/src/agent-platform/services/orchestration-output-mapper.service.spec.ts`
44. `apps/api/src/agent-platform/services/orchestration-execution.service.spec.ts`
45. `apps/api/src/agent-platform/services/__tests__/orchestration-run-factory.service.spec.ts`
46. `apps/api/src/agent-platform/controllers/orchestrations.controller.spec.ts`
47. `apps/api/src/agent-platform/repositories/orchestration-runs.repository.spec.ts`
48. `apps/api/src/agent-platform/repositories/agent-orchestrations.repository.spec.ts`
49. `apps/api/src/agent2agent/services/orchestration-step-executor.service.spec.ts`
50. `apps/api/src/agent2agent/services/__tests__/orchestration-step-executor-suborchestration.service.spec.ts`
51. `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.spec.ts`

**Backend Total**: 50 files to delete

---

## 🎨 Frontend Files to Remove

### Stores (1 file)
1. `apps/web/src/stores/orchestratorStore.ts`

### Actions (1 file)
2. `apps/web/src/services/agent2agent/actions/orchestrate.actions.ts`

### Types (1 file)
3. `apps/web/src/types/orchestration.ts`

### Builders (1 file)
4. `apps/web/src/services/agent2agent/utils/builders/orchestrate.builder.ts`

**Frontend Total**: 4 files to delete (minimal orchestration UI - mostly already removed)

---

## 🔄 Backend Files to Modify

### Remove ORCHESTRATE Mode References

#### 1. Transport Types
**File**: `apps/transport-types/shared/enums.ts`
- Remove `ORCHESTRATE = 'orchestrate'` from `AgentTaskMode` enum
- Remove orchestrate methods from `JsonRpcMethod` type:
  - `'orchestrate'`
  - `'agent.orchestrate'`
  - `'tasks.orchestrate'`
  - `'orchestrate.create'`
  - `'orchestrate.execute'`
  - `'orchestrate.continue'`

**File**: `apps/transport-types/modes/orchestrate.types.ts`
- **DELETE ENTIRE FILE**

**File**: `apps/transport-types/index.ts`
- Remove all orchestrate type exports

#### 2. Agent Runner
**File**: `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- Remove `case AgentTaskMode.ORCHESTRATE:` block (lines ~127-132)
- Remove `handleOrchestrate()` method

**File**: `apps/api/src/agent2agent/services/agent-execution-gateway.service.ts`
- Remove `case AgentTaskMode.ORCHESTRATE:` block (lines ~120-129)

#### 3. Test Helpers
**File**: `apps/api/src/__tests__/helpers/database-helper.ts`
- Remove orchestration table truncation/deletion lines:
  - Line 193: `orchestration_steps` delete
  - Line 195: `orchestration_runs` delete
  - Line 198-200: `orchestration_definitions` delete
  - Lines 254-268: All orchestration table cleanup

---

## ✏️ Backend Files to Rewrite

### Orchestrator Agent Runner (COMPLETE REWRITE)
**File**: `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- **Current**: 581 lines with complex orchestration logic, dependencies on 10+ orchestration services
- **New**: ~150 lines with simple agent selection and forwarding logic
- **Remove all dependencies on**:
  - OrchestrationDefinitionService
  - OrchestrationStateService
  - OrchestrationRunnerService
  - OrchestrationExecutionService
  - OrchestrationCheckpointService
  - OrchestrationEventsService
  - OrchestrationStepExecutorService
  - OrchestrationRunFactoryService
- **New implementation**:
  - Extend BaseAgentRunner (keep this)
  - Override `handleConverse()`, `handlePlan()`, `handleBuild()` methods
  - Query hierarchy service for available sub-agents
  - Check `request.metadata.current_sub_agent` for routing
  - If not set, use LLM to select best agent for request
  - Forward entire request to selected agent via protocol call
  - Add attribution metadata (`resolvedBy`, `current_sub_agent`) to response
  - Return response to caller

**Net Change**: -431 lines (581 → ~150)

---

## 🎨 Frontend Files to Modify

### Add Attribution Display
**File**: `apps/web/src/components/MessageBubble.vue` (or equivalent message component)
- Add attribution badge when `metadata.resolvedBy` exists
- Display sub-agent name

**Estimated Addition**: ~20 lines

### Update Stores (if needed)
**File**: Conversation/message stores
- Ensure `metadata.current_sub_agent` is preserved when sending requests

**Estimated Change**: ~10 lines

---

## 📦 Transport Types — Additions Only

### Request Metadata
**Files to Update**:
- `apps/transport-types/modes/converse.types.ts` (ConverseRequestMetadata)
- `apps/transport-types/modes/plan.types.ts` (PlanRequestMetadata)
- `apps/transport-types/modes/build.types.ts` (BuildRequestMetadata)

**Addition**:
```typescript
export interface [Mode]RequestMetadata {
  // ... existing fields
  current_sub_agent?: string | null;
}
```

### Response Metadata
**Files to Update**:
- `apps/transport-types/modes/converse.types.ts` (ConverseResponseMetadata)
- `apps/transport-types/modes/plan.types.ts` (PlanResponseMetadata)
- `apps/transport-types/modes/build.types.ts` (BuildResponseMetadata)

**Addition**:
```typescript
export interface [Mode]ResponseMetadata {
  // ... existing fields
  resolvedBy?: string;
  resolvedByDisplayName?: string;
  current_sub_agent?: string | null;
}
```

**Add to specific action payloads**:
- Converse: All actions
- Plan: Create, Read, Edit, SetCurrent (not Delete)
- Build: Create, Read, Edit, Rerun, SetCurrent (not Delete)

---

## 📊 Summary

| Category | Count |
|----------|-------|
| **Database Tables** | 6 |
| **Backend Files to Delete** | 50 |
| **Frontend Files to Delete** | 4 |
| **Backend Files to Rewrite** | 1 (orchestrator-agent-runner) |
| **Backend Files to Modify** | ~5 |
| **Frontend Files to Modify** | ~2 |
| **Transport Type Files to Delete** | 1 |
| **Transport Type Files to Modify** | 4 |

---

## 📈 Estimated Impact

### Lines of Code
- **Removed**: ~10,500-15,500 lines (including 431 from orchestrator-agent-runner rewrite)
- **Added**: ~150 lines (rewritten orchestrator-agent-runner) + ~70 lines (transport types, frontend)
- **Net Reduction**: ~10,280-15,280 lines

### Complexity
- **Before**: 6 tables, 50 orchestration files, complex workflow engine with step execution
- **After**: 0 tables, 1 simple agent selection and forwarding service, standard agent modes

---

## ⚠️ Critical Dependencies to Check

Before removing, verify these are not referenced elsewhere:
1. Orchestration tables in active queries
2. Orchestration services in module imports
3. Orchestration types in shared interfaces
4. Orchestration routes in API documentation

---

**Next Step**: Use this inventory to generate Task Master task breakdown.

