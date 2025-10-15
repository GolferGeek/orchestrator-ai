# Store Refactor - Detailed Plan

## Current Status
- [x] Phase 1: Transport Types (Foundation)
- [x] Phase 2: Frontend Services (New Architecture)
- [x] Phase 3: Frontend Refactor (Store & Components)
- [ ] Phase 4: Backend Integration
- [ ] Phase 5: Testing & Validation

---

## Phase 1: Transport Types (Foundation)

**Goal:** Create proper transport types for orchestration to match existing plan/build patterns.

**Success Criteria:**
- `orchestrate.types.ts` exists with complete type definitions
- All orchestrate types exported from transport-types index
- Types follow same pattern as plan.types.ts and build.types.ts
- No breaking changes to existing transport types

### Tasks

- [x] **1.1: Create orchestrate.types.ts**
  - **Files:** `apps/web/src/types/orchestrate.types.ts` (new)
  - **Dependencies:** None
  - **Complexity:** Low
  - **Details:**
    - Created frontend-specific transport types file
    - Defined `AgentTaskMode` enum (CONVERSE, PLAN, BUILD, CONTEXT)
    - Defined `LLMSelection` interface for provider/model configuration
    - Created base request/response metadata interfaces
    - Created Converse mode request/response types
    - Created Plan mode types (actions, data structures, request/response types)
    - Created Build mode types (actions, data structures, request/response types)
    - Created SSE/streaming types
    - Added comprehensive JSDoc documentation
    - Added type guard functions for all major types
  - **Success Criteria:**
    - ✅ File compiles without errors
    - ✅ Comprehensive JSDoc documentation
    - ✅ All major modes covered (converse, plan, build)

- [x] **1.2: Verify types compile**
  - **Files:** N/A
  - **Dependencies:** 1.1
  - **Complexity:** Low
  - **Details:**
    - Ran TypeScript compiler with skipLibCheck
    - Verified no compilation errors
  - **Success Criteria:**
    - ✅ Build succeeds without errors
    - ✅ Types are properly structured

**Phase 1 Commit Message:**
```
feat(transport-types): add orchestrate mode types

- Add orchestrate.types.ts with action types and payloads
- Export orchestrate types from index
- Follow same pattern as plan/build modes
```

---

## Phase 2: Frontend Services (New Architecture)

**Goal:** Create service layer that handles all business logic, keeping store as pure state.

**Success Criteria:**
- Four services created with clear separation of concerns
- Services use transport types exclusively
- Response handler routes responses to correct service
- Facade service provides clean API for components
- No business logic remains in components or store

### Tasks

- [x] **2.1: Create base service types and utilities**
  - **Files:** `apps/web/src/services/agent-tasks/types.ts` (new)
  - **Dependencies:** Phase 1 complete
  - **Complexity:** Medium
  - **Details:**
    - Define common service interfaces
    - Create utility functions for request building
    - Define service response types
    - Create error handling utilities
  - **Success Criteria:**
    - Common patterns abstracted for reuse across services
    - Type-safe service contracts defined

- [x] **2.2: Create conversationService.ts**
  - **Files:** `apps/web/src/services/agent-tasks/conversationService.ts` (new)
  - **Dependencies:** 2.1
  - **Complexity:** High
  - **Details:**
    - **Methods:**
      - `sendConverse(params)` - Send converse request to backend
      - `handleResponse(response)` - Process converse response
      - `handleSuccess(response)` - Handle successful converse response
      - `handleError(response)` - Handle converse error response
      - `createConversation(params)` - Create new conversation
      - `loadConversation(id)` - Load existing conversation
      - `deleteConversation(id)` - Delete conversation
    - Use ConverseModePayload from transport-types
    - Extract message content from response
    - Update store with new messages (via simple store mutations)
    - Handle streaming responses if applicable
  - **Success Criteria:**
    - All converse operations work end-to-end
    - No business logic leaks into store
    - Uses transport types exclusively

- [x] **2.3: Create planService.ts**
  - **Files:** `apps/web/src/services/agent-tasks/planService.ts` (new)
  - **Dependencies:** 2.1
  - **Complexity:** High
  - **Details:**
    - **Methods:**
      - `handleAction(action, params)` - Route to correct action handler
      - `create(params)` - Handle plan create action
      - `read(params)` - Handle plan read action
      - `list(params)` - Handle plan list action
      - `edit(params)` - Handle plan edit action
      - `rerun(params)` - Handle plan rerun action
      - `setCurrent(params)` - Handle plan set_current action
      - `deleteVersion(params)` - Handle plan delete_version action
      - `mergeVersions(params)` - Handle plan merge_versions action
      - `copyVersion(params)` - Handle plan copy_version action
      - `delete(params)` - Handle plan delete action
      - `handleResponse(response)` - Process plan response
      - `handleSuccess(response)` - Handle successful plan response
      - `handleError(response)` - Handle plan error response
    - Use PlanAction and PlanModePayload from transport-types
    - Extract plan data from response (planId, plan object, etc.)
    - Update store with plan data via simple mutations
  - **Success Criteria:**
    - All plan actions work end-to-end
    - Uses PlanAction type for routing
    - No business logic in store

- [x] **2.4: Create deliverableService.ts**
  - **Files:** `apps/web/src/services/agent-tasks/deliverableService.ts` (new)
  - **Dependencies:** 2.1
  - **Complexity:** High
  - **Details:**
    - **Methods:**
      - `handleAction(action, params)` - Route to correct action handler
      - `create(params)` - Handle build create action
      - `read(params)` - Handle build read action
      - `list(params)` - Handle build list action
      - `edit(params)` - Handle build edit action
      - `rerun(params)` - Handle build rerun action
      - `setCurrent(params)` - Handle build set_current action
      - `deleteVersion(params)` - Handle build delete_version action
      - `mergeVersions(params)` - Handle build merge_versions action
      - `copyVersion(params)` - Handle build copy_version action
      - `delete(params)` - Handle build delete action
      - `handleResponse(response)` - Process build response
      - `handleSuccess(response)` - Handle successful build response
      - `handleError(response)` - Handle build error response
    - Use BuildAction and BuildModePayload from transport-types
    - Extract deliverable data from response (deliverableId, content, etc.)
    - Update store with deliverable data via simple mutations
  - **Success Criteria:**
    - All build actions work end-to-end
    - Uses BuildAction type for routing
    - No business logic in store

- [ ] **2.5: Create orchestrationService.ts** (SKIPPED - Not needed for current refactor)
  - **Files:** `apps/web/src/services/agent-tasks/orchestrationService.ts` (new)
  - **Dependencies:** 2.1, Phase 1 complete
  - **Complexity:** High
  - **Details:**
    - **Methods:**
      - `handleAction(action, params)` - Route to correct action handler
      - `create(params)` - Handle orchestrate create action
      - `execute(params)` - Handle orchestrate execute action
      - `continue(params)` - Handle orchestrate continue action
      - `pause(params)` - Handle orchestrate pause action
      - `resume(params)` - Handle orchestrate resume action
      - `cancel(params)` - Handle orchestrate cancel action
      - `humanResponse(params)` - Handle orchestrate human_response action
      - `saveRecipe(params)` - Handle orchestrate save_recipe action
      - `handleResponse(response)` - Process orchestration response
      - `handleSuccess(response)` - Handle successful orchestration response
      - `handleError(response)` - Handle orchestration error response
    - Use OrchestrateAction and OrchestrateModePayload from transport-types
    - Extract orchestration run data from response
    - Update store with orchestration data via simple mutations
    - Handle streaming orchestration updates
  - **Success Criteria:**
    - All orchestrate actions work end-to-end
    - Uses OrchestrateAction type for routing
    - No business logic in store

- [x] **2.6: Create responseHandler.ts**
  - **Files:** `apps/web/src/services/agent-tasks/responseHandler.ts` (new)
  - **Dependencies:** 2.2, 2.3, 2.4
  - **Complexity:** Medium
  - **Details:**
    - **Methods:**
      - `handleTaskResponse(response)` - Main router for all responses
      - Routes based on `response.mode` to correct service
    - **Routing logic:**
      - `mode === 'converse'` → `conversationService.handleResponse()`
      - `mode === 'plan'` → `planService.handleResponse()`
      - `mode === 'build'` → `deliverableService.handleResponse()`
      - `mode === 'orchestrate_*'` → `orchestrationService.handleResponse()`
    - Handle unknown modes gracefully with error
  - **Success Criteria:**
    - All response types route to correct service
    - Unknown modes handled gracefully
    - Clean separation of concerns

- [x] **2.7: Create agentTaskService.ts facade**
  - **Files:** `apps/web/src/services/agent-tasks/agentTaskService.ts` (new)
  - **Dependencies:** 2.2, 2.3, 2.4, 2.6
  - **Complexity:** Medium
  - **Details:**
    - **Methods:**
      - `sendTask(params: { mode, action?, conversationId, message?, ... })` - Main entry point
      - Routes based on mode to correct service
      - Handles response routing via responseHandler
    - **Routing logic:**
      - `mode === AgentTaskMode.CONVERSE` → `conversationService.sendConverse()`
      - `mode === AgentTaskMode.PLAN` → `planService.handleAction(action, params)`
      - `mode === AgentTaskMode.BUILD` → `deliverableService.handleAction(action, params)`
      - `mode === AgentTaskMode.ORCHESTRATE_*` → `orchestrationService.handleAction(action, params)`
    - Extract LLM selection from llmStore
    - Build proper request payload using transport types
    - Call backend via tasksService
    - Route response via responseHandler
  - **Success Criteria:**
    - Single entry point for all agent tasks
    - Components don't need to know about service implementation
    - Uses AgentTaskMode enum for routing

- [x] **2.8: Create service index file**
  - **Files:** `apps/web/src/services/agent-tasks/index.ts` (new)
  - **Dependencies:** 2.7
  - **Complexity:** Low
  - **Details:**
    - Export agentTaskService as default
    - Export individual services for direct access if needed
    - Export types
  - **Success Criteria:**
    - Clean import syntax for components: `import { agentTaskService } from '@/services/agent-tasks'`

**Phase 2 Commit Message:**
```
feat(web): create service layer for agent tasks

- Add conversationService for converse mode
- Add planService for plan mode with all actions
- Add deliverableService for build mode with all actions
- Add orchestrationService for orchestrate mode with all actions
- Add responseHandler to route responses
- Add agentTaskService facade as main entry point
- Services use transport types exclusively
- All business logic moved from store to services
```

---

## Phase 3: Frontend Refactor (Store & Components)

**Goal:** Refactor store to be state-only and update components to use new service layer.

**Success Criteria:**
- Store contains only state and simple getters/setters
- No business logic in store
- All components use service layer
- All existing functionality works with new architecture

### Tasks

- [ ] **3.1: Create new minimal agentChatStore**
  - **Files:** `apps/web/src/stores/agentChatStore/store-minimal.ts` (new)
  - **Dependencies:** Phase 2 complete
  - **Complexity:** High
  - **Details:**
    - **State only:**
      - `conversations: AgentConversation[]`
      - `activeConversationId: string | null`
      - `messages: Map<conversationId, messages[]>` (or nested in conversations)
      - `plans: Map<conversationId, plan>` (or nested in conversations)
      - `deliverables: Map<conversationId, deliverable>` (or nested in conversations)
    - **Simple mutations only (no async, no business logic):**
      - `setActiveConversation(id)`
      - `addConversation(conversation)`
      - `removeConversation(id)`
      - `addMessage(conversationId, message)`
      - `updateMessage(conversationId, messageId, updates)`
      - `setPlan(conversationId, plan)`
      - `setDeliverable(conversationId, deliverable)`
      - `setError(conversationId, error)`
      - `clearError(conversationId)`
    - **Simple getters only:**
      - `getActiveConversation()`
      - `getConversationById(id)`
      - `getMessages(conversationId)`
      - `getPlan(conversationId)`
      - `getDeliverable(conversationId)`
  - **Success Criteria:**
    - No async methods
    - No API calls
    - No business logic
    - Pure state management only

- [ ] **3.2: Create migration helper to map old store calls to new service calls**
  - **Files:** `apps/web/src/services/agent-tasks/migrationHelper.ts` (new)
  - **Dependencies:** 3.1
  - **Complexity:** Medium
  - **Details:**
    - Document mapping of old store methods to new service methods
    - Create helper functions to ease migration
    - Example: `oldStore.sendMessage()` → `agentTaskService.sendTask({ mode: CONVERSE, ... })`
  - **Success Criteria:**
    - Clear migration path documented
    - Helper functions created for common patterns

- [ ] **3.3: Update AgentChatView.vue to use new service layer**
  - **Files:** `apps/web/src/components/AgentChatView.vue` (modify)
  - **Dependencies:** 3.2
  - **Complexity:** High
  - **Details:**
    - Replace all `chatStore.sendMessage()` calls with `agentTaskService.sendTask()`
    - Replace all `chatStore.executeFromLastUserMessage()` with appropriate service calls
    - Use store only for reading state and calling simple mutations
    - Use services for all business logic
  - **Success Criteria:**
    - Component works exactly as before
    - No business logic in component
    - Only uses store for state and simple mutations

- [ ] **3.4: Update TwoPaneConversationView.vue to use new service layer**
  - **Files:** `apps/web/src/components/TwoPaneConversationView.vue` (modify)
  - **Dependencies:** 3.2
  - **Complexity:** Medium
  - **Details:**
    - Replace store business logic calls with service calls
    - Use store only for reading state
  - **Success Criteria:**
    - Component works exactly as before
    - Only uses store for state

- [ ] **3.5: Update AgentTaskItem.vue to use new service layer**
  - **Files:** `apps/web/src/components/AgentTaskItem.vue` (modify)
  - **Dependencies:** 3.2
  - **Complexity:** Low
  - **Details:**
    - Update Plan/Build button handlers to use service layer
    - Replace `chatStore.executeFromLastUserMessage()` with `agentTaskService.sendTask()`
  - **Success Criteria:**
    - Plan and Build buttons work correctly
    - Uses service layer instead of store methods

- [ ] **3.6: Search for all remaining chatStore method calls and migrate**
  - **Files:** Various component files (modify)
  - **Dependencies:** 3.5
  - **Complexity:** High
  - **Details:**
    - Search codebase for all `chatStore.` method calls
    - Identify which are business logic (need migration) vs state access (keep)
    - Migrate all business logic calls to service layer
    - Document any edge cases
  - **Success Criteria:**
    - No business logic method calls to chatStore remain
    - All components use service layer for business logic

- [ ] **3.7: Replace old store.ts with store-minimal.ts**
  - **Files:**
    - `apps/web/src/stores/agentChatStore/store.ts` (modify/replace)
    - `apps/web/src/stores/agentChatStore/store-old.ts` (backup)
  - **Dependencies:** 3.6
  - **Complexity:** Medium
  - **Details:**
    - Rename current store.ts to store-old.ts (keep as backup)
    - Rename store-minimal.ts to store.ts
    - Verify all imports still work
    - Run app and test basic functionality
  - **Success Criteria:**
    - App compiles and runs
    - No import errors
    - Basic navigation works

- [ ] **3.8: Remove old store helper files that are no longer needed**
  - **Files:**
    - Review and potentially remove:
      - `messageFormatting.ts` (logic moved to services)
      - `taskExecution.ts` (logic moved to services)
      - Other helper files with business logic
  - **Dependencies:** 3.7
  - **Complexity:** Medium
  - **Details:**
    - Identify helper files that contained business logic now in services
    - Verify they're no longer imported anywhere
    - Remove or document why keeping
  - **Success Criteria:**
    - No orphaned files
    - Clear separation between state (store) and logic (services)

**Phase 3 Commit Message:**
```
refactor(web): migrate store to state-only with service layer

- Replace agentChatStore with minimal state-only version
- Update all components to use agentTaskService
- Remove business logic from store
- Remove old helper files with business logic
- All functionality preserved with cleaner architecture
```

---

## Phase 4: Backend Integration

**Goal:** Update backend to use new orchestrate transport types and ensure A2A protocol compliance.

**Success Criteria:**
- Backend uses OrchestrateAction type for routing
- Backend handlers use orchestrate payload types from transport-types
- No custom modifications to transport types
- A2A protocol strictly followed

### Tasks

- [ ] **4.1: Update backend to import orchestrate transport types**
  - **Files:**
    - `apps/api/src/agent2agent/dto/task-request.dto.ts` (modify)
    - `apps/api/src/agent2agent/agent2agent.controller.ts` (modify)
  - **Dependencies:** Phase 1 complete
  - **Complexity:** Low
  - **Details:**
    - Import OrchestrateAction from transport-types
    - Import orchestrate payload types
    - Add to existing imports alongside PlanAction, BuildAction
  - **Success Criteria:**
    - Types imported successfully
    - No compilation errors

- [ ] **4.2: Create orchestrate.handlers.ts in base-agent-runner**
  - **Files:** `apps/api/src/agent2agent/services/base-agent-runner/orchestrate.handlers.ts` (new)
  - **Dependencies:** 4.1
  - **Complexity:** High
  - **Details:**
    - Create handler functions for each OrchestrateAction:
      - `handleOrchestrateCreate()`
      - `handleOrchestrateExecute()`
      - `handleOrchestrateContinue()`
      - `handleOrchestratePause()`
      - `handleOrchestrateResume()`
      - `handleOrchestrateCancel()`
      - `handleOrchestrateHumanResponse()`
      - `handleOrchestrateSaveRecipe()`
    - Use orchestrate payload types from transport-types
    - Follow same pattern as plan.handlers.ts and build.handlers.ts
    - Use OrchestrateAction type for action routing
  - **Success Criteria:**
    - Handlers follow same pattern as plan/build
    - Use transport types exclusively
    - No custom payload modifications

- [ ] **4.3: Update base-agent-runner.service.ts to handle orchestrate mode**
  - **Files:** `apps/api/src/agent2agent/services/base-agent-runner.service.ts` (modify)
  - **Dependencies:** 4.2
  - **Complexity:** Medium
  - **Details:**
    - Add `handleOrchestrate()` method similar to `handlePlan()` and `handleBuild()`
    - Route orchestrate actions to appropriate handlers
    - Use OrchestrateAction type for routing
  - **Success Criteria:**
    - Orchestrate mode routes correctly
    - Uses OrchestrateAction for action routing
    - Follows same pattern as plan/build

- [ ] **4.4: Update agent2agent.controller.ts mode mapping**
  - **Files:** `apps/api/src/agent2agent/agent2agent.controller.ts` (modify)
  - **Dependencies:** 4.3
  - **Complexity:** Low
  - **Details:**
    - Update `mapMethodToMode()` to handle orchestrate actions as single ORCHESTRATE mode
    - Map all orchestrate.* methods to AgentTaskMode.ORCHESTRATE
    - Remove individual ORCHESTRATE_CREATE, ORCHESTRATE_EXECUTE modes (or deprecate)
  - **Success Criteria:**
    - Orchestrate methods route to ORCHESTRATE mode
    - Action extracted and passed to handler

- [ ] **4.5: Verify backend uses transport types without modifications**
  - **Files:** All backend handler files (review)
  - **Dependencies:** 4.4
  - **Complexity:** Medium
  - **Details:**
    - Review all handlers (converse, plan, build, orchestrate)
    - Verify they use transport types directly
    - Verify no custom payload modifications
    - Verify A2A protocol compliance (JSON-RPC 2.0)
  - **Success Criteria:**
    - No custom type modifications
    - Transport types used as-is
    - A2A protocol followed strictly

**Phase 4 Commit Message:**
```
feat(api): add orchestrate mode with transport types

- Create orchestrate.handlers.ts with action handlers
- Update base-agent-runner to handle orchestrate mode
- Use OrchestrateAction from transport types
- Ensure A2A protocol compliance
- No custom transport type modifications
```

---

## Phase 5: Testing & Validation

**Goal:** Comprehensive testing of all modes and actions to ensure nothing broke during refactor.

**Success Criteria:**
- All modes work end-to-end (converse, plan, build, orchestrate)
- All actions work for each mode
- Frontend and backend communicate correctly
- Store stays in sync with backend state
- No regressions in functionality

### Tasks

- [ ] **5.1: Test Converse mode end-to-end**
  - **Dependencies:** Phases 1-4 complete
  - **Complexity:** Medium
  - **Test Cases:**
    - Send message in converse mode
    - Verify response appears in UI
    - Verify message stored correctly
    - Verify LLM provider/model sent correctly
    - Test error handling
    - Test streaming (if applicable)
  - **Success Criteria:**
    - All test cases pass
    - No console errors
    - UI updates correctly

- [ ] **5.2: Test Plan mode all actions**
  - **Dependencies:** 5.1
  - **Complexity:** High
  - **Test Cases:**
    - Create plan (action: create)
    - Read plan (action: read)
    - List plans (action: list)
    - Edit plan (action: edit)
    - Rerun plan (action: rerun)
    - Set current version (action: set_current)
    - Delete version (action: delete_version)
    - Merge versions (action: merge_versions)
    - Copy version (action: copy_version)
    - Delete plan (action: delete)
    - Verify plan pane opens automatically on create
    - Verify plan data loads correctly
    - Test error handling for each action
  - **Success Criteria:**
    - All actions work correctly
    - Plan pane opens/closes properly
    - Store updates correctly
    - No console errors

- [ ] **5.3: Test Build mode all actions**
  - **Dependencies:** 5.2
  - **Complexity:** High
  - **Test Cases:**
    - Create deliverable (action: create)
    - Verify LLM provider/model sent correctly
    - Verify deliverable pane opens automatically
    - Read deliverable (action: read)
    - List deliverables (action: list)
    - Edit deliverable (action: edit)
    - Rerun deliverable (action: rerun)
    - Set current version (action: set_current)
    - Delete version (action: delete_version)
    - Merge versions (action: merge_versions)
    - Copy version (action: copy_version)
    - Delete deliverable (action: delete)
    - Test error handling for each action
  - **Success Criteria:**
    - All actions work correctly
    - Deliverable pane opens/closes properly
    - Store updates correctly
    - No console errors

- [ ] **5.4: Test Orchestrate mode all actions**
  - **Dependencies:** 5.3
  - **Complexity:** High
  - **Test Cases:**
    - Create orchestration (action: create)
    - Execute orchestration (action: execute)
    - Continue orchestration (action: continue)
    - Pause orchestration (action: pause)
    - Resume orchestration (action: resume)
    - Cancel orchestration (action: cancel)
    - Human response (action: human_response)
    - Save recipe (action: save_recipe)
    - Test error handling for each action
    - Verify orchestration state updates correctly
  - **Success Criteria:**
    - All actions work correctly
    - Orchestration state tracked properly
    - Store updates correctly
    - No console errors

- [ ] **5.5: Test Plan and Build buttons in AgentTaskItem**
  - **Dependencies:** 5.3
  - **Complexity:** Medium
  - **Test Cases:**
    - Click "Plan" button on assistant message
    - Verify plan mode executed with last user message
    - Verify plan created correctly
    - Click "Build" button on assistant message
    - Verify build mode executed with last user message
    - Verify deliverable created correctly
    - Test on multiple message types
  - **Success Criteria:**
    - Both buttons work correctly
    - Use existing conversation context
    - Create plan/deliverable successfully

- [ ] **5.6: Test error scenarios**
  - **Dependencies:** 5.4
  - **Complexity:** Medium
  - **Test Cases:**
    - Backend returns error response
    - Network failure during request
    - Invalid action for mode
    - Missing required parameters
    - LLM provider/model not set
    - Verify error messages shown to user
    - Verify store not corrupted on error
  - **Success Criteria:**
    - All errors handled gracefully
    - User sees appropriate error messages
    - App doesn't crash
    - Store remains consistent

- [ ] **5.7: Test LLM provider/model selection for all modes**
  - **Dependencies:** 5.6
  - **Complexity:** Medium
  - **Test Cases:**
    - Change LLM provider/model in UI
    - Send converse request - verify correct provider/model used
    - Create plan - verify correct provider/model used
    - Create deliverable - verify correct provider/model used
    - Check backend logs to confirm provider/model received
    - Verify no fallback to Anthropic happens
    - Verify error if provider/model not set
  - **Success Criteria:**
    - Selected provider/model used for all modes
    - No fallbacks occur
    - Backend receives correct configuration

- [ ] **5.8: Test conversation lifecycle**
  - **Dependencies:** 5.7
  - **Complexity:** Medium
  - **Test Cases:**
    - Create new conversation
    - Send multiple messages
    - Create plan in conversation
    - Create deliverable from plan
    - Switch between conversations
    - Verify state preserved for each conversation
    - Delete conversation
  - **Success Criteria:**
    - Full conversation lifecycle works
    - State isolated per conversation
    - Switching conversations works correctly
    - Delete cleans up properly

- [ ] **5.9: Performance and cleanup review**
  - **Dependencies:** 5.8
  - **Complexity:** Low
  - **Test Cases:**
    - Check for memory leaks (open/close many conversations)
    - Verify event listeners cleaned up
    - Check bundle size impact
    - Verify no unnecessary re-renders
    - Check console for warnings
  - **Success Criteria:**
    - No memory leaks
    - Clean event listener cleanup
    - Bundle size reasonable
    - Performance acceptable

- [ ] **5.10: Code cleanup and final review**
  - **Dependencies:** 5.9
  - **Complexity:** Low
  - **Details:**
    - Remove any commented-out code
    - Remove console.log statements (or convert to proper logging)
    - Verify all TODOs addressed
    - Run linter and fix any issues
    - Update any outdated comments
    - Remove backup files (store-old.ts, etc.)
  - **Success Criteria:**
    - Code clean and production-ready
    - No linter errors
    - No leftover debug code

**Phase 5 Commit Message:**
```
test: validate store refactor across all modes

- Test converse, plan, build, orchestrate modes
- Test all actions for each mode
- Verify error handling
- Validate LLM configuration
- Confirm no regressions
- All tests passing
```

---

## Rollback Strategy

If issues arise during implementation:

1. **Phase 1 Issues:** Revert transport-types changes, rebuild package
2. **Phase 2 Issues:** Don't integrate services yet, keep using old store
3. **Phase 3 Issues:** Restore store-old.ts, revert component changes
4. **Phase 4 Issues:** Revert backend handler changes
5. **Phase 5 Issues:** Fix bugs found during testing before proceeding

Each phase should be committed separately to allow easy rollback.

---

## Dependencies Map

```
Phase 1 (Transport Types)
  ↓
Phase 2 (Frontend Services) - depends on Phase 1
  ↓
Phase 3 (Store Refactor) - depends on Phase 2
  ↓
Phase 4 (Backend Integration) - depends on Phase 1
  ↓
Phase 5 (Testing) - depends on Phases 1-4
```

---

## Estimated Complexity

- **Phase 1:** Low - ~2 hours
- **Phase 2:** High - ~8-10 hours
- **Phase 3:** High - ~6-8 hours
- **Phase 4:** Medium - ~4-6 hours
- **Phase 5:** High - ~6-8 hours

**Total Estimated Time:** 26-34 hours

---

## Notes

- Services should be stateless - all state in store
- Transport types are the contract - never modify them in handlers
- A2A protocol must be followed strictly
- Each service should be independently testable
- Store mutations should be synchronous and simple
- All async operations in services
