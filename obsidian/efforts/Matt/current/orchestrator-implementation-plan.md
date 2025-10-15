# Orchestrator Implementation Plan
## Single Mode with Action-Based Routing

## Overview
Convert Orchestrator from 24+ separate mode enums to a single `ORCHESTRATE` mode with 27 action-based operations, following the established Plan/Build pattern for consistency across the entire A2A system.

---

## Current State
- [x] Transport types created (`orchestrate.types.ts`)
- [ ] Backend uses transport types
- [ ] Frontend orchestration service
- [ ] Frontend/backend integration
- [ ] Testing and validation

---

## Architecture Principles

1. **Single Mode**: `mode: 'orchestrate'` for all orchestration operations
2. **Action-Based Routing**: Action field in payload discriminates operations
3. **Consistent Pattern**: Follow Plan/Build service architecture exactly
4. **Transport Types**: Shared types between frontend and backend
5. **No Mode Enum Explosion**: 27 actions instead of 24 mode enums

---

## Phase 1: Backend Transport Type Integration

**Goal:** Update backend orchestrator to use shared transport types exclusively.

**Success Criteria:**
- Backend imports orchestrate types from `@orchestrator-ai/transport-types`
- No local/duplicate type definitions
- All payloads use transport type interfaces
- Response metadata includes orchestration-specific fields

### Tasks

#### 1.1: Audit Current Backend Orchestrator Implementation
- **Files to review:**
  - `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
  - `apps/api/src/agent2agent/orchestration/orchestration.types.ts`
  - `apps/api/src/agent2agent/services/orchestration-step-executor.service.ts`
- **Dependencies:** None
- **Complexity:** Low
- **Details:**
  - Document current payload structures (OrchestratorStartPayload, OrchestratorResumePayload)
  - Identify which transport types map to which local types
  - Note any fields that need to be added to transport types
  - Check how handlePlan() and handleBuild() are currently used

#### 1.2: Create Orchestrate Handler
- **Files to create:**
  - `apps/api/src/agent2agent/services/base-agent-runner/orchestrate.handlers.ts` (new)
- **Dependencies:** 1.1
- **Complexity:** High
- **Details:**
  - Follow the exact pattern from `plan.handlers.ts` and `build.handlers.ts`
  - Create action routing function that dispatches to specific handlers
  - Implement handlers for each action:
    - **Core operations:** create, execute, continue, save_recipe
    - **Plan management:** plan_create, plan_update, plan_review, plan_approve, plan_reject, plan_archive
    - **Run management:** run_start, run_continue, run_pause, run_resume, run_cancel, run_evaluate, run_human_response, run_rollback_step
    - **Recipe management:** recipe_save, recipe_update, recipe_validate, recipe_delete, recipe_load, recipe_list
  - Extract LLM config from payload (no fallbacks - frontend must provide)
  - Import payload types from `@orchestrator-ai/transport-types`
  - Build proper `OrchestrateResponseMetadata` with orchestrationRunId
  - Use `TaskResponseDto.success()` and `TaskResponseDto.error()` for responses

#### 1.3: Update OrchestratorAgentRunnerService
- **Files to modify:**
  - `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.ts`
- **Dependencies:** 1.2
- **Complexity:** Medium
- **Details:**
  - Add `handleOrchestrate()` method that calls orchestrate handlers
  - Import action handlers from `orchestrate.handlers.ts`
  - Remove local payload type definitions (use transport types)
  - Update to use `AgentTaskMode.ORCHESTRATE` (not individual mode enums)
  - Ensure handlePlan() and handleBuild() are removed/deprecated for orchestrator
  - Update method signatures to match base class pattern

#### 1.4: Update BaseAgentRunner Routing
- **Files to modify:**
  - `apps/api/src/agent2agent/services/base-agent-runner.service.ts`
- **Dependencies:** 1.3
- **Complexity:** Low
- **Details:**
  - Add case for `AgentTaskMode.ORCHESTRATE` in execute() method
  - Route to `handleOrchestrate()` abstract method
  - Ensure all subclasses implement handleOrchestrate()

#### 1.5: Deprecate Old Orchestrator Mode Enums
- **Files to modify:**
  - `apps/transport-types/shared/enums.ts`
- **Dependencies:** 1.4
- **Complexity:** Low
- **Details:**
  - Add deprecation comments to old orchestrator modes:
    - `ORCHESTRATE_CREATE`, `ORCHESTRATE_EXECUTE`, `ORCHESTRATE_CONTINUE`, etc.
    - All `ORCHESTRATOR_*` modes
  - Mark them as `@deprecated Use AgentTaskMode.ORCHESTRATE with action-based routing`
  - Keep enums for backward compatibility (don't break existing code)
  - Plan eventual removal in future major version

#### 1.6: Update Tests
- **Files to modify:**
  - `apps/api/src/agent2agent/services/orchestrator-agent-runner.service.spec.ts`
  - New: `apps/api/src/agent2agent/services/base-agent-runner/orchestrate.handlers.spec.ts`
- **Dependencies:** 1.5
- **Complexity:** Medium
- **Details:**
  - Update existing tests to use new action-based format
  - Add tests for each orchestrate action handler
  - Test payload validation
  - Test response structure
  - Test error handling

**Phase 1 Commit Message:**
```
feat(backend): implement orchestrate handlers with transport types

- Created orchestrate.handlers.ts following Plan/Build pattern
- Added handleOrchestrate() to OrchestratorAgentRunnerService
- Updated BaseAgentRunner routing to support ORCHESTRATE mode
- Deprecated old ORCHESTRATOR_* mode enums in favor of actions
- All orchestrator operations now use shared transport types
- 27 actions supported: create, execute, continue, plan_*, run_*, recipe_*
```

---

## Phase 2: Frontend Orchestration Service

**Goal:** Create frontend orchestrationService following the exact pattern of planService and deliverableService.

**Success Criteria:**
- orchestrationService.ts created with action routing
- All 27 orchestrate actions have handler methods
- Service uses transport types exclusively
- Vue reactivity automatically updates UI

### Tasks

#### 2.1: Create Orchestration Service Structure
- **Files to create:**
  - `apps/web/src/services/agent-tasks/orchestrationService.ts` (new)
- **Dependencies:** Phase 1 complete
- **Complexity:** High
- **Details:**
  - Import types from `@orchestrator-ai/transport-types`
  - Follow exact pattern from planService.ts and deliverableService.ts
  - Create service class with:
    - `handleAction(action, params)` - Routes to specific action handler
    - `handleResponse(response)` - Processes orchestrate responses
    - Store reference for state updates
  - Implement action handlers:
    - **Core operations (4):** create(), execute(), continue(), saveRecipe()
    - **Plan management (6):** planCreate(), planUpdate(), planReview(), planApprove(), planReject(), planArchive()
    - **Run management (8):** runStart(), runContinue(), runPause(), runResume(), runCancel(), runEvaluate(), runHumanResponse(), runRollbackStep()
    - **Recipe management (6):** recipeSave(), recipeUpdate(), recipeValidate(), recipeDelete(), recipeLoad(), recipeList()
  - Each handler:
    - Validates required parameters
    - Builds proper request payload
    - Calls tasksService.createAgentTask()
    - Updates store via simple mutations
    - Returns typed response

#### 2.2: Update Store for Orchestration State
- **Files to modify:**
  - `apps/web/src/stores/agentChatStore/store.ts`
- **Dependencies:** 2.1
- **Complexity:** Medium
- **Details:**
  - Add orchestration state to store:
    ```typescript
    orchestrations: Map<string, {
      id: string;
      definitionId?: string;
      status: string;
      runs: Array<{
        id: string;
        status: string;
        currentStep?: string;
        progress?: { completed: number; total: number; };
      }>;
      recipes: Array<{
        id: string;
        name: string;
        description?: string;
      }>;
    }>;
    ```
  - Add synchronous mutations:
    - `setOrchestration(id, data)` - Update orchestration data
    - `setOrchestrationRun(orchestrationId, run)` - Update run data
    - `setOrchestrationRecipes(orchestrationId, recipes)` - Update recipes
    - `removeOrchestration(id)` - Remove orchestration
  - Keep mutations simple - NO async operations, NO API calls

#### 2.3: Update AgentTaskService Routing
- **Files to modify:**
  - `apps/web/src/services/agent-tasks/agentTaskService.ts`
- **Dependencies:** 2.2
- **Complexity:** Low
- **Details:**
  - Import orchestrationService
  - Add case for `mode === 'orchestrate'` in sendTask()
  - Extract action from params and route to orchestrationService.handleAction()
  - Ensure LLM selection is extracted from store if not provided
  - Follow exact pattern used for plan and build modes

#### 2.4: Update Types Export
- **Files to modify:**
  - `apps/web/src/services/agent-tasks/types.ts`
- **Dependencies:** 2.3
- **Complexity:** Low
- **Details:**
  - Import orchestrate types from `@orchestrator-ai/transport-types`:
    - `OrchestrateAction`
    - All payload types
    - Response content types
  - Re-export for convenience
  - Update `SendTaskParams` to support orchestrate mode

#### 2.5: Create Frontend Response Handler
- **Files to modify:**
  - `apps/web/src/services/agent-tasks/responseHandler.ts`
- **Dependencies:** 2.4
- **Complexity:** Low
- **Details:**
  - Add case for `mode === 'orchestrate'`
  - Route to orchestrationService.handleResponse()
  - Follow exact pattern from plan/build response handling

#### 2.6: Update Index Exports
- **Files to modify:**
  - `apps/web/src/services/agent-tasks/index.ts`
- **Dependencies:** 2.5
- **Complexity:** Trivial
- **Details:**
  - Export orchestrationService
  - Maintain clean public API

**Phase 2 Commit Message:**
```
feat(frontend): implement orchestration service following Plan/Build pattern

- Created orchestrationService with 27 action handlers
- Added orchestration state to agentChatStore (orchestrations, runs, recipes)
- Updated agentTaskService to route orchestrate mode
- Updated responseHandler for orchestrate responses
- Service uses shared transport types exclusively
- Follows exact architecture pattern from planService/deliverableService
```

---

## Phase 3: Frontend/Backend Integration

**Goal:** Wire up frontend orchestration UI to use the new service.

**Success Criteria:**
- Frontend can trigger all orchestration actions
- Backend processes using action-based routing
- Store updates automatically trigger UI updates
- Error handling works end-to-end

### Tasks

#### 3.1: Create Orchestration UI Components (If Needed)
- **Files to review/modify:**
  - Check if orchestration UI already exists
  - `apps/web/src/components/*Orchestrat*.vue`
  - `apps/web/src/stores/orchestratorStore.ts` (if exists)
- **Dependencies:** Phase 2 complete
- **Complexity:** Medium
- **Details:**
  - Audit existing orchestration UI components
  - Update components to use agentTaskService.sendTask() instead of direct API calls
  - Remove any duplicate orchestration state management
  - Ensure components use the agentChatStore for orchestration state

#### 3.2: Update Migration Helper
- **Files to modify:**
  - `apps/web/src/services/agent-tasks/migrationHelper.ts`
- **Dependencies:** 3.1
- **Complexity:** Low
- **Details:**
  - Add orchestration examples to migration map
  - Document OLD vs NEW patterns for orchestration
  - Provide helper functions for common orchestration operations

#### 3.3: Integration Testing
- **Files to create/modify:**
  - `apps/web/src/services/agent-tasks/__tests__/orchestrationService.spec.ts` (new)
  - Update E2E tests if they exist
- **Dependencies:** 3.2
- **Complexity:** Medium
- **Details:**
  - Unit tests for orchestrationService
  - Test each action handler
  - Test error handling
  - Test store mutations
  - Mock tasksService responses
  - Verify Vue reactivity works correctly

**Phase 3 Commit Message:**
```
feat(integration): wire up orchestration UI with new service architecture

- Updated orchestration components to use agentTaskService
- Removed duplicate orchestration state management
- Added orchestration examples to migration helper
- Comprehensive unit tests for orchestrationService
- Verified Vue reactivity updates UI automatically
```

---

## Phase 4: Testing & Validation

**Goal:** Comprehensive testing of the entire orchestration flow.

**Success Criteria:**
- All 27 actions tested end-to-end
- Frontend and backend communicate properly
- Store state updates correctly
- Error cases handled gracefully
- Performance is acceptable

### Tasks

#### 4.1: Backend Integration Tests
- **Files to create/modify:**
  - Test files for orchestrate handlers
- **Dependencies:** Phase 3 complete
- **Complexity:** High
- **Details:**
  - Test each action handler with real payloads
  - Test action routing works correctly
  - Test response metadata includes orchestrationRunId
  - Test error responses
  - Test LLM integration for actions that use it
  - Test database persistence (orchestrations, runs, steps)

#### 4.2: Frontend Integration Tests
- **Files to create:**
  - E2E test scenarios for orchestration
- **Dependencies:** 4.1
- **Complexity:** Medium
- **Details:**
  - Test creating orchestration from UI
  - Test running orchestration
  - Test pausing/resuming
  - Test human-in-the-loop scenarios
  - Test recipe management
  - Verify store state updates trigger UI changes

#### 4.3: Performance Testing
- **Files to create:**
  - Performance test suite for orchestration
- **Dependencies:** 4.2
- **Complexity:** Medium
- **Details:**
  - Test orchestration with many steps (10+)
  - Test concurrent orchestration runs
  - Test recipe loading performance
  - Measure response times for each action
  - Identify bottlenecks

#### 4.4: Documentation
- **Files to create/modify:**
  - `docs/orchestration/README.md` (new)
  - `docs/orchestration/actions.md` (new)
  - `docs/architecture/orchestration-pattern.md` (new)
- **Dependencies:** 4.3
- **Complexity:** Low
- **Details:**
  - Document orchestration architecture
  - List all 27 actions with examples
  - Show frontend usage patterns
  - Explain action-based routing
  - Provide migration guide from old mode enums

**Phase 4 Commit Message:**
```
test(orchestration): comprehensive testing and documentation

- Backend integration tests for all 27 actions
- Frontend E2E tests for orchestration flows
- Performance testing for complex orchestrations
- Complete documentation of orchestration architecture
- Migration guide from old mode enums to actions
```

---

## Phase 5: Cleanup & Optimization

**Goal:** Remove deprecated code and optimize implementation.

**Success Criteria:**
- Old orchestrator mode enums marked for removal
- No duplicate type definitions
- Clean separation of concerns
- Performance optimized

### Tasks

#### 5.1: Remove Deprecated Code
- **Files to modify:**
  - Various files with deprecated orchestrator code
- **Dependencies:** Phase 4 complete
- **Complexity:** Medium
- **Details:**
  - Search for usages of old `ORCHESTRATOR_*` mode enums
  - Replace with new action-based calls
  - Remove old payload type definitions in backend
  - Update any remaining components/services

#### 5.2: Optimize Action Handlers
- **Files to modify:**
  - `orchestrate.handlers.ts`
  - `orchestrationService.ts`
- **Dependencies:** 5.1
- **Complexity:** Low
- **Details:**
  - Identify common patterns across handlers
  - Extract reusable helper functions
  - Optimize database queries
  - Add caching where appropriate
  - Reduce payload sizes

#### 5.3: Final Documentation Update
- **Files to modify:**
  - All orchestration documentation
- **Dependencies:** 5.2
- **Complexity:** Low
- **Details:**
  - Update README with final architecture
  - Document optimization decisions
  - Add troubleshooting guide
  - Create quick reference guide

**Phase 5 Commit Message:**
```
refactor(orchestration): cleanup and optimization

- Removed all deprecated ORCHESTRATOR_* mode enum usages
- Optimized action handlers with shared utilities
- Reduced payload sizes and improved caching
- Final documentation updates
- Clean separation of concerns maintained
```

---

## Risk Assessment

### High Risk
1. **Breaking Changes**: Existing orchestration calls may break
   - **Mitigation**: Keep old mode enums temporarily, provide migration guide

2. **State Migration**: Existing orchestration state may be incompatible
   - **Mitigation**: Add migration script for existing data

### Medium Risk
1. **Complexity**: 27 actions is a lot to implement correctly
   - **Mitigation**: Follow established pattern exactly, test thoroughly

2. **Performance**: More actions = more routing overhead
   - **Mitigation**: Profile and optimize action routing

### Low Risk
1. **Type Safety**: TypeScript should catch most issues
   - **Mitigation**: Compile with strict mode, use transport types

---

## Success Metrics

1. **Code Quality**
   - Zero TypeScript errors
   - All tests passing
   - No duplicate type definitions

2. **Architecture**
   - Orchestrator follows exact Plan/Build pattern
   - Single mode with action-based routing
   - Shared transport types used everywhere

3. **Functionality**
   - All 27 actions working end-to-end
   - Store state updates correctly
   - Error handling works properly

4. **Performance**
   - Action routing < 5ms overhead
   - Store updates trigger UI in < 100ms
   - Complex orchestrations (10+ steps) complete successfully

---

## Timeline Estimate

- **Phase 1**: 2-3 days (Backend transport type integration)
- **Phase 2**: 2-3 days (Frontend service creation)
- **Phase 3**: 1-2 days (Integration)
- **Phase 4**: 2-3 days (Testing & validation)
- **Phase 5**: 1 day (Cleanup & optimization)

**Total**: 8-12 days of focused work

---

## Notes

- This plan assumes no major architectural changes needed beyond what's outlined
- Each phase should be committed separately for easier review and rollback
- Testing should happen continuously, not just in Phase 4
- Documentation should be updated alongside code changes
- Performance profiling should happen early to catch issues

---

## Questions to Resolve

1. Should old `ORCHESTRATOR_*` mode enums be removed immediately or kept for backward compatibility?
2. Are there existing orchestration UI components that need to be updated?
3. What's the migration path for existing orchestration data in the database?
4. Should we add orchestration-specific middleware/interceptors?
5. Do we need orchestration-specific analytics/telemetry?
