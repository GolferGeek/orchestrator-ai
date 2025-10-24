# Phase 1: Mode × Action Architecture - Execution Plan

## Overview
This document tracks the execution of Phase 1: implementing the complete mode × action architecture for context agents (Plans & Deliverables) as defined in `phase-1-context-agents-prd.md`.

**Architecture Documents:**
- [Service Hierarchy](../../../architecture/service-hierarchy.md)
- [API Contracts](../../../architecture/api-contracts.md)
- [TypeScript Types](../../../architecture/typescript-types.md)

**Goal:** Implement mode × action routing system with all 33 operations across 5 modes, starting with Plan (9 actions) and Build (10 actions).

---

## Phase 1.0: Architecture Foundation (1 day)

### Phase 1.0.1: Backend Base Types
- [ ] Create `apps/api/src/agent2agent/common/types/task.types.ts`
  - [ ] Define `TaskMode` enum
  - [ ] Define `TaskAction` type
  - [ ] Define `BaseTaskRequest` interface
  - [ ] Define `TaskResponse<TResult>` interface
  - [ ] Define `TaskError` interface
  - [ ] Define `TaskStatus` enum
- [ ] Create `apps/api/src/agent2agent/common/interfaces/action-handler.interface.ts`
  - [ ] Define `IActionHandler` interface with `executeAction(action, params)` method
  - [ ] Define `ActionExecutionContext` interface
  - [ ] Define `ActionResult<T>` interface

### Phase 1.0.2: Frontend Base Types
- [ ] Create `apps/web/src/services/agent2agent/types/index.ts`
  - [ ] Copy all base types from architecture/typescript-types.md
  - [ ] Define `TaskMode`, `TaskStatus`, `TaskAction` types
  - [ ] Define `BaseTaskRequest` and `TaskResponse<TResult>` interfaces
  - [ ] Export all common entity types (Plan, PlanVersion, Deliverable, DeliverableVersion)

### Notes
- Base types must be shared and consistent between frontend and backend
- Use exact same naming conventions as architecture documents

---

## Phase 1.1: Database Schema (0.5 days)

### Phase 1.1.1: Create Plans Tables Migration
- [ ] Create migration file: `apps/api/supabase/migrations/YYYYMMDD_create_plans_tables.sql`
  - [ ] Drop old `conversation_plan` table (CASCADE)
  - [ ] Create `plans` table (exact mirror of `deliverables` structure)
  - [ ] Create `plan_versions` table (exact mirror of `deliverable_versions` structure)
  - [ ] Add indexes on `conversation_id`, `user_id`, `is_current_version`
  - [ ] Add foreign key constraints with CASCADE delete
  - [ ] Add unique constraint on `(conversation_id)` for plans (one per conversation)
  - [ ] Add unique constraint on `(plan_id, version_number)` for versions
- [ ] Run migration locally and verify schema
- [ ] Document migration in ARCHIVE-DECISIONS.md

### Phase 1.1.2: Verify Database Schema
- [ ] Test plans table creation
- [ ] Test plan_versions table creation
- [ ] Verify foreign key constraints work
- [ ] Verify unique constraints work
- [ ] Test CASCADE delete behavior

### Notes
- Plans and Deliverables must have IDENTICAL table structures
- One plan per conversation (enforced by unique constraint)
- Version history is immutable (never update in place)

---

## Phase 1.2: Backend Plans Service (2 days)

### Phase 1.2.1: Create Plans Repositories
- [ ] Create `apps/api/src/agent2agent/plans/repositories/plans.repository.ts`
  - [ ] Implement `create(data)` - Create new plan
  - [ ] Implement `findByConversationId(conversationId, userId)` - Get plan for conversation
  - [ ] Implement `findById(id, userId)` - Get specific plan
  - [ ] Implement `update(id, data)` - Update plan metadata
  - [ ] Implement `delete(id, userId)` - Delete plan
  - [ ] Implement `setCurrentVersion(id, versionId)` - Update current_version_id
- [ ] Create `apps/api/src/agent2agent/plans/repositories/plan-versions.repository.ts`
  - [ ] Implement `create(planId, versionData)` - Create new version
  - [ ] Implement `findById(versionId)` - Get specific version
  - [ ] Implement `findByPlanId(planId)` - Get all versions for plan
  - [ ] Implement `getCurrentVersion(planId)` - Get current version
  - [ ] Implement `deleteVersion(versionId)` - Delete specific version
  - [ ] Implement `markAsCurrent(versionId)` - Set is_current_version flag

### Phase 1.2.2: Create Plans Services
- [ ] Create `apps/api/src/agent2agent/plans/services/plan-versions.service.ts`
  - [ ] Implement `createVersion(planId, content, format, createdByType, taskId?, metadata?)` - Create new version
  - [ ] Implement `getCurrentVersion(planId)` - Get current version
  - [ ] Implement `getVersionHistory(planId)` - Get all versions with metadata
  - [ ] Implement `setCurrentVersion(planId, versionId)` - Switch current version
  - [ ] Implement `findOne(versionId)` - Get specific version
  - [ ] Implement `update(versionId, content, metadata?)` - Update version (for manual edits)
  - [ ] Implement `copyVersion(versionId)` - Duplicate version as new version
  - [ ] Implement `deleteVersion(versionId)` - Delete specific version
- [ ] Create `apps/api/src/agent2agent/plans/services/plans.service.ts`
  - [ ] Implement `create(conversationId, userId, agentName, namespace, title, content, format)` - Create plan
  - [ ] Implement `findByConversationId(conversationId, userId)` - Get plan for conversation
  - [ ] Implement `findOne(planId, userId)` - Get specific plan
  - [ ] Implement `update(planId, userId, updates)` - Update plan metadata
  - [ ] Implement `delete(planId, userId)` - Delete plan and all versions
  - [ ] Implement `listPlans(userId, filters?)` - List all plans for user
  - [ ] **Implement `executeAction(action: string, params: any)` - Mode × action dispatcher**
    - [ ] Route 'create' → createOrRefine()
    - [ ] Route 'read' → getCurrentPlan()
    - [ ] Route 'list' → getVersionHistory()
    - [ ] Route 'edit' → saveManualEdit()
    - [ ] Route 'set_current' → setCurrentVersion()
    - [ ] Route 'delete_version' → deleteVersion()
    - [ ] Route 'merge_versions' → mergeVersions()
    - [ ] Route 'copy_version' → copyVersion()
    - [ ] Route 'delete' → deletePlan()

### Phase 1.2.3: Create Plans Module
- [ ] Create `apps/api/src/agent2agent/plans/plans.module.ts`
  - [ ] Import SupabaseModule
  - [ ] Import LLMModule (for rerun functionality)
  - [ ] Import forwardRef(() => Agent2AgentModule)
  - [ ] Register PlansService, PlanVersionsService
  - [ ] Register PlansRepository, PlanVersionsRepository
  - [ ] Export PlansService, PlanVersionsService
- [ ] Register PlansModule in Agent2AgentModule imports

### Notes
- PlansService must implement IActionHandler interface
- executeAction() is the ONLY public method for operations
- All action methods are private helpers
- Mirror the exact pattern from DeliverablesService

---

## Phase 1.3: Backend Plans Adapter (0.5 days)

### Phase 1.3.1: Create AgentRuntimePlansAdapter
- [ ] Create `apps/api/src/agent-platform/services/agent-runtime-plans.adapter.ts`
  - [ ] Implement `maybeCreateFromPlanTask(ctx, agentResult)` - Create plan from agent execution
  - [ ] Implement `createVersionFromManualEdit(ctx, editedContent)` - Save manual edit as version
  - [ ] Implement `mergeVersions(ctx, versionIds, mergePrompt)` - LLM-based merge
  - [ ] Implement `copyVersion(ctx, versionId)` - Duplicate version
  - [ ] Add context assembly helpers
  - [ ] Add metadata enrichment helpers
- [ ] Register adapter in AgentPlatformModule
- [ ] Export adapter for use in TasksService

### Notes
- Adapter translates between AgentRuntime results and PlansService operations
- Determines if plan should be created based on mode === 'plan'
- Handles all metadata enrichment (LLM model, task ID, etc.)

---

## Phase 1.4: Backend TasksService Refactor (2 days)

### Phase 1.4.1: Add Mode × Action Routing
- [ ] Update `apps/api/src/agent2agent/tasks/tasks.service.ts`
  - [ ] Add mode routing: switch (mode) { case 'plan': → PlansService }
  - [ ] Add mode routing: switch (mode) { case 'build': → DeliverablesService }
  - [ ] Add mode routing: switch (mode) { case 'converse': → ConversationsService }
  - [ ] Add action parameter to executeTask()
  - [ ] Route to service.executeAction(action, params)
  - [ ] Remove direct plan/deliverable creation logic (replaced by adapters)
- [ ] Inject PlansService dependency
- [ ] Inject PlansAdapter dependency
- [ ] Update executeTask() signature to accept action parameter

### Phase 1.4.2: Implement A2A Capability Checking
- [ ] Add `checkA2ACapability(agentSlug: string, mode: string, action: string): Promise<void>`
  - [ ] Load agent by slug
  - [ ] Construct capability name: `${action}_${mode}` (e.g., 'merge_plan_versions')
  - [ ] Check if agent.a2a_capabilities includes capability
  - [ ] Throw ForbiddenException if not found
  - [ ] Include available capabilities in error details
- [ ] Call checkA2ACapability() at start of executeTask()
- [ ] Add integration test for capability enforcement

### Phase 1.4.3: Update Context Assembly
- [ ] Modify context loading to support action-based operations
  - [ ] For action='create': load conversation history + current plan/deliverable
  - [ ] For action='read': skip LLM, just retrieve from database
  - [ ] For action='list': skip LLM, just retrieve version history
  - [ ] For action='edit': skip LLM, save directly via adapter
  - [ ] For action='merge_versions': load specified versions for LLM merge
  - [ ] For action='rerun': load original task context for re-execution
- [ ] Update adapters to handle all action types

### Notes
- TasksService becomes pure orchestration layer - no business logic
- All business logic lives in domain services (PlansService, DeliverablesService)
- TasksService just routes mode → service → action

---

## Phase 1.5: Backend Deliverables Service Refactor (1 day)

### Phase 1.5.1: Add executeAction() to DeliverablesService
- [ ] Update `apps/api/src/agent2agent/deliverables/deliverables.service.ts`
  - [ ] Add `executeAction(action: string, params: any)` method
  - [ ] Route 'create' → createOrRefine()
  - [ ] Route 'read' → getCurrentDeliverable()
  - [ ] Route 'list' → getVersionHistory()
  - [ ] Route 'edit' → saveManualEdit()
  - [ ] Route 'rerun' → rerunWithLLM()
  - [ ] Route 'set_current' → setCurrentVersion()
  - [ ] Route 'delete_version' → deleteVersion()
  - [ ] Route 'merge_versions' → mergeVersions()
  - [ ] Route 'copy_version' → copyVersion()
  - [ ] Route 'delete' → deleteDeliverable()
- [ ] Implement missing actions (merge, copy, set_current, etc.)
- [ ] Make all action methods private (only executeAction is public)

### Phase 1.5.2: Update AgentRuntimeDeliverablesAdapter
- [ ] Add `mergeVersions(ctx, versionIds, mergePrompt)` method
- [ ] Add `copyVersion(ctx, versionId)` method
- [ ] Update `maybeCreateFromBuild()` to handle all action types
- [ ] Add support for rerunConfig parameter

### Notes
- DeliverablesService already exists - just refactoring to add executeAction()
- Must maintain backward compatibility during refactor
- Follow exact same pattern as PlansService

---

## Phase 1.6: Frontend TypeScript Types (1 day)

### Phase 1.6.1: Create Type Definitions
- [ ] Create `apps/web/src/services/agent2agent/types/plan.types.ts`
  - [ ] Define all 9 plan request types (CreatePlanRequest, ReadPlanRequest, etc.)
  - [ ] Define all 9 plan response types (CreatePlanResponse, ReadPlanResponse, etc.)
  - [ ] Export Plan and PlanVersion entity types
- [ ] Create `apps/web/src/services/agent2agent/types/deliverable.types.ts`
  - [ ] Define all 10 deliverable request types
  - [ ] Define all 10 deliverable response types
  - [ ] Export Deliverable and DeliverableVersion entity types
- [ ] Create `apps/web/src/services/agent2agent/types/conversation.types.ts`
  - [ ] Define all 3 conversation request types
  - [ ] Define all 3 conversation response types
- [ ] Create `apps/web/src/services/agent2agent/types/index.ts`
  - [ ] Export all types from plan.types, deliverable.types, conversation.types
  - [ ] Export base types (BaseTaskRequest, TaskResponse, etc.)
  - [ ] Export union types (TaskRequest, AnyTaskResponse)

### Phase 1.6.2: Create Request Builders
- [ ] Create `apps/web/src/services/agent2agent/builders/plan.builders.ts`
  - [ ] Implement PlanRequests.create()
  - [ ] Implement PlanRequests.read()
  - [ ] Implement PlanRequests.list()
  - [ ] Implement PlanRequests.edit()
  - [ ] Implement PlanRequests.setCurrent()
  - [ ] Implement PlanRequests.deleteVersion()
  - [ ] Implement PlanRequests.mergeVersions()
  - [ ] Implement PlanRequests.copyVersion()
  - [ ] Implement PlanRequests.delete()
- [ ] Create `apps/web/src/services/agent2agent/builders/deliverable.builders.ts`
  - [ ] Implement all 10 deliverable request builders
- [ ] Create `apps/web/src/services/agent2agent/builders/conversation.builders.ts`
  - [ ] Implement all 3 conversation request builders
- [ ] Create `apps/web/src/services/agent2agent/builders/index.ts`
  - [ ] Export RequestBuilder factory object
  - [ ] Export specialized builders (SupabaseToolRequests, etc. - Phase 4)

### Phase 1.6.3: Create Response Parsers
- [ ] Create `apps/web/src/services/agent2agent/parsers/plan.parsers.ts`
  - [ ] Implement ResponseParser.plan.create()
  - [ ] Implement ResponseParser.plan.read()
  - [ ] Implement ResponseParser.plan.list()
  - [ ] Implement all 9 plan response parsers
- [ ] Create `apps/web/src/services/agent2agent/parsers/deliverable.parsers.ts`
  - [ ] Implement all 10 deliverable response parsers
- [ ] Create `apps/web/src/services/agent2agent/parsers/conversation.parsers.ts`
  - [ ] Implement all 3 conversation response parsers
- [ ] Create `apps/web/src/services/agent2agent/parsers/index.ts`
  - [ ] Export ResponseParser factory object
  - [ ] Export type guards (ResponseTypeGuards)

### Notes
- Types must exactly match backend types
- Request builders provide clean, type-safe API
- Response parsers extract typed results and handle errors

---

## Phase 1.7: Frontend API Service (1 day)

### Phase 1.7.1: Create Agent2Agent API Client
- [ ] Create `apps/web/src/services/agent2agent/agent2agent-api.service.ts`
  - [ ] Implement base `executeTask(conversationId, request)` method
  - [ ] Implement `POST /api/agent2agent/conversations/:id/tasks` HTTP call
  - [ ] Add error handling and retry logic
  - [ ] Add request/response logging
  - [ ] Add TypeScript generic for type-safe responses
- [ ] Create wrapper methods for all 22 operations (9 plan + 10 deliverable + 3 conversation)
  - [ ] Plan operations: createPlan, readPlan, listPlanVersions, editPlan, etc.
  - [ ] Deliverable operations: createDeliverable, readDeliverable, rerunDeliverable, etc.
  - [ ] Conversation operations: readConversation, deleteConversation, exportConversation
- [ ] Each method uses RequestBuilder internally and returns parsed response

### Phase 1.7.2: Integration with Existing Services
- [ ] Update or create `apps/web/src/services/agent2agent/index.ts`
  - [ ] Export agent2AgentAPI singleton instance
  - [ ] Export all types, builders, parsers
- [ ] Document API usage with examples

### Notes
- API service is the ONLY way frontend calls backend
- All methods are type-safe (request builders + response parsers)
- Provides clean abstraction over HTTP layer

---

## Phase 1.8: Frontend Store Integration (1.5 days)

### Phase 1.8.1: Create/Update agent2AgentChatStore
- [ ] Create `apps/web/src/stores/agent2AgentChatStore/index.ts` (if doesn't exist)
  - [ ] Add state: currentPlan, planVersions
  - [ ] Add state: currentDeliverable, deliverableVersions
  - [ ] Add actions: createPlan(), editPlan(), mergePlanVersions(), etc.
  - [ ] Add actions: createDeliverable(), rerunDeliverable(), etc.
  - [ ] All actions use agent2AgentAPI service
  - [ ] Update state after successful operations
- [ ] Add WebSocket handling for task completion
  - [ ] Listen for 'task:completed' events
  - [ ] Update plan/deliverable state when task completes
  - [ ] Trigger UI refresh
- [ ] Add loading/error state management

### Phase 1.8.2: Update UI Components
- [ ] Update or create PlansPanel component
  - [ ] Display current plan
  - [ ] Show version history
  - [ ] Add "Edit" button → manual text editor
  - [ ] Add "Merge Versions" button → select versions + prompt
  - [ ] Add "Copy Version" button
  - [ ] Add version switcher
- [ ] Update or create DeliverablesPanel component
  - [ ] Display current deliverable
  - [ ] Show version history
  - [ ] Add "Edit" button
  - [ ] Add "Rerun with different LLM" button
  - [ ] Add "Merge Versions" button
  - [ ] Add version switcher
- [ ] Update ConversationView to support mode switching
  - [ ] Add Plan/Build/Converse mode buttons
  - [ ] Pass mode to executeTask
  - [ ] Show appropriate panels based on mode

### Notes
- Store provides reactive state management
- Components consume store state and actions
- WebSocket ensures real-time updates

---

## Phase 1.9: Agent Configuration (0.5 days)

### Phase 1.9.1: Update blog_post_writer Agent YAML
- [ ] Update `agents/blog_post_writer.yaml` (or database record)
  - [ ] Set agent_type: 'context'
  - [ ] Set execution_profile: 'autonomous_build'
  - [ ] Add execution_capabilities: { can_plan: true, can_build: true, can_converse: true }
  - [ ] Add complete a2a_capabilities section with all 22 capabilities:
    - [ ] create_plan, read_plan, list_plan_versions, edit_plan, set_current_plan_version
    - [ ] delete_plan_version, merge_plan_versions, copy_plan_version, delete_plan
    - [ ] create_deliverable, read_deliverable, list_deliverable_versions, edit_deliverable
    - [ ] rerun_deliverable, set_current_deliverable_version, delete_deliverable_version
    - [ ] merge_deliverable_versions, copy_deliverable_version, delete_deliverable
    - [ ] read_conversation, delete_conversation, export_conversation
  - [ ] Add mode, action, description, requires, returns for each capability
- [ ] Verify agent loads correctly
- [ ] Test capability checking works

### Notes
- Complete a2a_capabilities definition is critical for A2A protocol
- Each capability must specify mode, action, inputs, outputs
- This enables agents to discover what operations are available

---

## Phase 1.10: Integration Testing (2 days)

### Phase 1.10.1: Plan Actions Tests
- [ ] Create `apps/api/test/integration/plans/create-plan.spec.ts`
  - [ ] Test creating initial plan
  - [ ] Test refining existing plan
  - [ ] Verify version history
- [ ] Create `apps/api/test/integration/plans/read-plan.spec.ts`
  - [ ] Test reading current plan
  - [ ] Test reading specific version
  - [ ] Test plan not found scenario
- [ ] Create `apps/api/test/integration/plans/edit-plan.spec.ts`
  - [ ] Test manual text edit
  - [ ] Verify new version created
  - [ ] Verify metadata tracked
- [ ] Create `apps/api/test/integration/plans/merge-plan-versions.spec.ts`
  - [ ] Test merging 2+ versions
  - [ ] Verify LLM called with correct context
  - [ ] Verify merged version created
- [ ] Create tests for all other plan actions (list, set_current, delete_version, copy_version, delete)

### Phase 1.10.2: Deliverable Actions Tests
- [ ] Create `apps/api/test/integration/deliverables/create-deliverable.spec.ts`
  - [ ] Test creating deliverable from plan
  - [ ] Test refinement
  - [ ] Verify version history
- [ ] Create `apps/api/test/integration/deliverables/rerun-deliverable.spec.ts`
  - [ ] Test rerun with different LLM
  - [ ] Test rerun with different config
  - [ ] Verify new version created with rerun metadata
- [ ] Create tests for all other deliverable actions (read, list, edit, merge, copy, set_current, delete_version, delete)

### Phase 1.10.3: End-to-End Workflow Tests
- [ ] Create `apps/api/test/integration/workflows/complete-plan-build-workflow.spec.ts`
  - [ ] Test: create plan → edit plan → merge versions → build deliverable → rerun
  - [ ] Verify all artifacts created correctly
  - [ ] Verify version history maintained
  - [ ] Verify metadata tracked
- [ ] Create `apps/api/test/integration/workflows/a2a-capability-enforcement.spec.ts`
  - [ ] Test agent WITH capability can execute action
  - [ ] Test agent WITHOUT capability gets 403 error
  - [ ] Test error includes available capabilities

### Notes
- Integration tests use real database (test instance)
- Tests should be isolated (create/cleanup test data)
- Use test fixtures for agent configurations

---

## Phase 1.11: Documentation & Cleanup (0.5 days)

### Phase 1.11.1: Update Phase 1 PRD
- [ ] Update `phase-1-context-agents-prd.md` with final implementation details
  - [ ] Document actual service structure
  - [ ] Document executeAction() pattern
  - [ ] Update architecture diagrams
  - [ ] Add links to code files
- [ ] Mark completed sections as ✅

### Phase 1.11.2: Create Migration Guide
- [ ] Create `docs/migration/phase-0-to-phase-1.md`
  - [ ] Document breaking changes (if any)
  - [ ] Document new API patterns
  - [ ] Document how to use RequestBuilder/ResponseParser
  - [ ] Provide code migration examples

### Phase 1.11.3: Update README
- [ ] Update main README.md with Phase 1 status
- [ ] Update agent-rollout README.md
- [ ] Mark Phase 1 as complete in tracking table

### Notes
- Documentation is critical for future phases
- Migration guide helps other developers adopt new patterns

---

## Completion Criteria

- [ ] Database: plans and plan_versions tables created
- [ ] Backend: PlansService with executeAction() for all 9 actions
- [ ] Backend: DeliverablesService with executeAction() for all 10 actions
- [ ] Backend: TasksService with mode × action routing
- [ ] Backend: A2A capability checking enforced
- [ ] Frontend: TypeScript types for all 22 operations
- [ ] Frontend: RequestBuilder with all 22 methods
- [ ] Frontend: ResponseParser with all 22 methods
- [ ] Frontend: agent2AgentAPI service with all 22 operations
- [ ] Frontend: agent2AgentChatStore with plan/deliverable state management
- [ ] Frontend: UI components for plan/deliverable version management
- [ ] Agent: blog_post_writer with complete a2a_capabilities
- [ ] Tests: Integration tests for all 22 operations passing
- [ ] Tests: End-to-end workflow test passing
- [ ] Tests: A2A capability enforcement test passing
- [ ] Docs: Phase 1 PRD updated
- [ ] Docs: Migration guide created

---

## Notes & Decisions Log

### Architecture Decisions

**2025-10-04**: Created comprehensive architecture documents
- service-hierarchy.md - 5-layer service architecture
- api-contracts.md - Complete transport layer contracts for all 33 operations
- typescript-types.md - Full TypeScript types with request builders and response parsers

**Key Decisions:**
1. **Mode × Action Pattern**: All operations flow through single endpoint with mode + action parameters
2. **executeAction() Pattern**: All domain services implement executeAction() for routing
3. **Plans = Deliverables Pattern**: Identical table structure and versioning for both
4. **Immutable Versioning**: Always create new versions, never update in place
5. **A2A Capabilities**: All operations require capability definitions in agent YAML
6. **Request Builders**: Frontend uses RequestBuilder.{mode}.{action}() pattern
7. **Response Parsers**: Frontend uses ResponseParser.{mode}.{action}() pattern
8. **Type Safety**: Complete TypeScript types for all 33 operations

**Benefits:**
- "This will simplify our code so much!" (user quote)
- Single entry point (Tasks API)
- Consistent patterns across all modes
- Easy to extend with new modes/actions
- Type-safe frontend API

### Session Log
*Add timestamped notes here as work progresses*

- **2025-10-04**: Created phase-1-plan.md with complete task breakdown
- **2025-10-04**: Defined 33 total operations (9 plan + 10 build + 3 converse + 3 tool + 8 orchestrate)

---

## Current Status

**Current Phase:** 1.0 - Architecture Foundation
**Last Updated:** 2025-10-04
**Next Task:** Phase 1.0.1 - Create backend base types (task.types.ts)

---

## Quick Reference

### Total Operations by Mode
| Mode | Operations | Phase |
|------|-----------|-------|
| plan | 9 | Phase 1 ✅ |
| build | 10 | Phase 1 ✅ |
| converse | 3 | Phase 1 ✅ |
| tool | 3 | Phase 4 ⏳ |
| orchestrate | 8 | Phase 6 ⏳ |
| **TOTAL** | **33** | |

### Plan Actions (9)
1. create, 2. read, 3. list, 4. edit, 5. set_current, 6. delete_version, 7. merge_versions, 8. copy_version, 9. delete

### Build Actions (10)
1. create, 2. read, 3. list, 4. edit, 5. **rerun**, 6. set_current, 7. delete_version, 8. merge_versions, 9. copy_version, 10. delete

### Converse Actions (3)
1. read_conversation, 2. delete_conversation, 3. export_conversation
