# Architecture Consolidation Implementation Plan
## Detailed Execution Plan with Tasks, Subtasks & Testing

**Effort:** Architecture Consolidation & Domain Model Cleanup
**PRD Reference:** `obsidian/efforts/Matt/current/agent-stack-testing/PRD.md`
**Created:** 2025-10-17
**Owner:** Matt (GolferGeek)
**Status:** Ready for Execution

---

## Plan Overview

This plan breaks down the architecture consolidation effort into **5 phases**, each with specific tasks, subtasks, and testing requirements. Each item can be checked off as completed, allowing progress tracking across contexts. Phases align directly with the solution overview in the PRD to keep implementation and validation tightly coupled.

**Phases:**
1. Store Consolidation (1.5 weeks)
2. Service Migration to Actions (1 week)
3. Projects → Orchestrations Migration (1 week)
4. Store Method Migration (0.5 week)
5. Final Testing & Documentation (1 week)

**Legend:**
- `[ ]` = Not started
- `[~]` = In progress
- `[x]` = Completed
- `[!]` = Blocked

---

## Phase 1: Store Consolidation (1.5 weeks)

**Goal:** Consolidate fragmented stores into clean domain boundaries.

### Task 1.1: Create New Unified Conversations Store

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 2 days
**Priority:** High

#### Subtasks:
- [x] 1.1.1 Create `stores/conversationsStore.ts` file
- [x] 1.1.2 Define Conversation interface (merge from existing stores)
- [x] 1.1.3 Define Message interface
- [x] 1.1.4 Define Task interface (or import from taskStore)
- [x] 1.1.5 Implement state (conversations, messages, tasks Maps)
- [x] 1.1.6 Implement getters (conversationById, messagesByConversation, tasksByConversation)
- [x] 1.1.7 Implement mutations (addConversation, addMessage, addTask, removeConversation)
- [x] 1.1.8 Implement computed properties (activeConversation, allConversations)
- [x] 1.1.9 Export store from stores/index.ts (N/A - no index.ts file, import directly)

#### Unit Tests:
- [x] 1.1.T1 Test addConversation mutation
- [x] 1.1.T2 Test addMessage mutation
- [x] 1.1.T3 Test addTask mutation
- [x] 1.1.T4 Test removeConversation (cascade deletes messages/tasks)
- [x] 1.1.T5 Test conversationById getter
- [x] 1.1.T6 Test messagesByConversation getter
- [x] 1.1.T7 Test tasksByConversation getter
- [x] 1.1.T8 Test activeConversation computed
- [x] 1.1.T9 Test store initialization (empty state)

#### Acceptance Criteria:
- ✅ Store file created and compiles without errors
- ✅ All interfaces defined with proper types
- ✅ State uses Maps for O(1) lookups
- ✅ All getters return correct data
- ✅ Mutations are synchronous only
- ✅ All unit tests pass

---

### Task 1.2: Migrate Components to New Conversations Store

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 2 days
**Priority:** High
**Depends On:** Task 1.1

#### Subtasks:
- [ ] 1.2.1 Identify all components using `agentConversationsStore` (grep)
- [ ] 1.2.2 Identify all components using `conversationStore` (grep)
- [ ] 1.2.3 Create migration spreadsheet (component name, old store, new store, status)
- [ ] 1.2.4 Update TwoPaneConversationView.vue
- [ ] 1.2.5 Update AgentTreeView.vue
- [ ] 1.2.6 Update AgentsPage.vue
- [ ] 1.2.7 Update NewProjectPage.vue (if kept temporarily)
- [ ] 1.2.8 Update AgentTreeView_new.vue
- [ ] 1.2.9 Update any remaining components from spreadsheet
- [ ] 1.2.10 Update all imports to use new store
- [ ] 1.2.11 Verify no remaining imports of old stores (grep verification)

#### Integration Tests:
- [ ] 1.2.T1 Test conversation list renders correctly
- [ ] 1.2.T2 Test conversation creation from UI
- [ ] 1.2.T3 Test conversation deletion from UI
- [ ] 1.2.T4 Test message display in conversation
- [ ] 1.2.T5 Test task counts display correctly
- [ ] 1.2.T6 Test switching between conversations
- [ ] 1.2.T7 Test conversation search/filter (if applicable)

#### Acceptance Criteria:
- ✅ All components compile without errors
- ✅ No imports from old stores
- ✅ All conversation UI works correctly
- ✅ Vue reactivity works (UI updates when store changes)
- ✅ All integration tests pass

---

### Task 1.3: Delete Old Conversation Stores

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Medium
**Depends On:** Task 1.2

#### Subtasks:
- [ ] 1.3.1 Verify zero imports of `conversationStore.ts` (grep)
- [ ] 1.3.2 Verify zero imports of `agentConversationsStore.ts` (grep)
- [ ] 1.3.3 Delete `stores/conversationStore.ts`
- [ ] 1.3.4 Delete `stores/agentConversationsStore.ts`
- [ ] 1.3.5 Remove from `stores/index.ts` exports
- [ ] 1.3.6 Run TypeScript compilation
- [ ] 1.3.7 Run full test suite
- [ ] 1.3.8 Commit deletion with message

#### Verification Tests:
- [ ] 1.3.T1 Build succeeds without errors
- [ ] 1.3.T2 All existing tests pass
- [ ] 1.3.T3 No runtime errors in dev mode
- [ ] 1.3.T4 Manual smoke test of conversation features

#### Acceptance Criteria:
- ✅ Files deleted
- ✅ Build succeeds
- ✅ No broken imports
- ✅ All tests pass

---

### Task 1.4: Consolidate Agent Stores

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** Medium

#### Subtasks:
- [ ] 1.4.1 Analyze `agentStore.ts` for useful capabilities
- [ ] 1.4.2 Analyze `agentsStore.ts` (current catalog store)
- [ ] 1.4.3 Merge any useful agentStore features into agentsStore
- [ ] 1.4.4 Update agentsStore with merged capabilities
- [ ] 1.4.5 Update all component imports (from agentStore → agentsStore)
- [ ] 1.4.6 Delete `stores/agentStore.ts`
- [ ] 1.4.7 Run TypeScript compilation
- [ ] 1.4.8 Run tests

#### Unit Tests:
- [ ] 1.4.T1 Test agent catalog loading
- [ ] 1.4.T2 Test agent hierarchy structure
- [ ] 1.4.T3 Test agent capabilities access
- [ ] 1.4.T4 Test agent lookup by name
- [ ] 1.4.T5 Test agent filter by capability

#### Acceptance Criteria:
- ✅ Single agent store exists
- ✅ All agent features work
- ✅ Old store deleted
- ✅ Tests pass

---

### Task 1.5: Extract UI State to chatUiStore

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1.5 days
**Priority:** High

#### Subtasks:
- [ ] 1.5.1 Create `stores/ui/chatUiStore.ts`
- [ ] 1.5.2 Define UI-only state (activeConversationId, pendingAction, chatMode, lastMessageWasSpeech)
- [ ] 1.5.3 Implement simple mutations (setActiveConversation, setPendingAction, setChatMode)
- [ ] 1.5.4 Update components to import chatUiStore for UI state
- [ ] 1.5.5 Update components to import conversationsStore for domain data
- [ ] 1.5.6 Remove UI state from agentChatStore
- [ ] 1.5.7 Test split store usage

#### Unit Tests:
- [ ] 1.5.T1 Test setActiveConversation mutation
- [ ] 1.5.T2 Test setPendingAction mutation
- [ ] 1.5.T3 Test setChatMode mutation
- [ ] 1.5.T4 Test state isolation (no domain data in UI store)

#### Integration Tests:
- [ ] 1.5.T5 Test UI updates when active conversation changes
- [ ] 1.5.T6 Test pending action UI displays correctly
- [ ] 1.5.T7 Test chat mode switching

#### Acceptance Criteria:
- ✅ UI store created and working
- ✅ Clean separation: UI state vs domain data
- ✅ Components use both stores correctly
- ✅ Tests pass

---

### Task 1.6: Remove Plan/Deliverable Duplication from agentChatStore

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 2 days
**Priority:** High
**Depends On:** Task 1.5

#### Subtasks:
- [ ] 1.6.1 Identify all references to `agentChatStore.currentPlan`
- [ ] 1.6.2 Identify all references to `agentChatStore.latestPlan`
- [ ] 1.6.3 Identify all references to `agentChatStore.currentDeliverable`
- [ ] 1.6.4 Update components to use `plansStore.plansByConversation(id)`
- [ ] 1.6.5 Update components to use `deliverablesStore.deliverablesByConversation(id)`
- [ ] 1.6.6 Remove plan properties from agentChatStore
- [ ] 1.6.7 Remove deliverable properties from agentChatStore
- [ ] 1.6.8 Test all plan UI
- [ ] 1.6.9 Test all deliverable UI

#### Integration Tests:
- [ ] 1.6.T1 Test plan creation displays in UI
- [ ] 1.6.T2 Test plan editing works
- [ ] 1.6.T3 Test plan versions display
- [ ] 1.6.T4 Test deliverable creation displays in UI
- [ ] 1.6.T5 Test deliverable editing works
- [ ] 1.6.T6 Test deliverable versions display
- [ ] 1.6.T7 Test switching conversations updates plan/deliverable correctly

#### Acceptance Criteria:
- ✅ No duplicate plan state
- ✅ No duplicate deliverable state
- ✅ Single source of truth for each domain
- ✅ All UI works correctly
- ✅ Tests pass

---

### Task 1.7: Delete agentChatStore

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** High
**Depends On:** Task 1.6

#### Subtasks:
- [ ] 1.7.1 Verify all domain data moved to domain stores (grep check)
- [ ] 1.7.2 Verify all UI state moved to chatUiStore (grep check)
- [ ] 1.7.3 Verify zero imports of agentChatStore (grep)
- [ ] 1.7.4 Delete `stores/agentChatStore/` directory
- [ ] 1.7.5 Remove from stores/index.ts
- [ ] 1.7.6 Run TypeScript compilation
- [ ] 1.7.7 Run full test suite

#### Verification Tests:
- [ ] 1.7.T1 Build succeeds
- [ ] 1.7.T2 All tests pass
- [ ] 1.7.T3 No runtime errors
- [ ] 1.7.T4 Full smoke test of application

#### Acceptance Criteria:
- ✅ agentChatStore deleted
- ✅ Build succeeds
- ✅ All tests pass
- ✅ Application works end-to-end

---

### Phase 1 Testing Summary

#### Manual Test Scenarios:
- [ ] P1.M1 Create new conversation → Verify appears in list
- [ ] P1.M2 Send message in conversation → Verify displays correctly
- [ ] P1.M3 Delete conversation → Verify removed from list
- [ ] P1.M4 Switch between conversations → Verify UI updates
- [ ] P1.M5 Create plan in conversation → Verify stores in plansStore
- [ ] P1.M6 Create deliverable in conversation → Verify stores in deliverablesStore
- [ ] P1.M7 View agent list → Verify loads correctly
- [ ] P1.M8 Filter agents by capability → Verify works

#### Performance Tests:
- [ ] P1.P1 Load time equivalent or better than before
- [ ] P1.P2 Store lookup performance (O(1) with Maps)
- [ ] P1.P3 No memory leaks (check with Chrome DevTools)

---

## Phase 2: Service Migration to Actions (1 week)

**Goal:** Replace old `agent-tasks/` services with new `agent2agent/actions/` pattern.

### Task 2.1: Create build.actions.ts

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 2 days
**Priority:** High

#### Subtasks:
- [ ] 2.1.1 Create `services/agent2agent/actions/build.actions.ts`
- [ ] 2.1.2 Implement `createDeliverable()` action
- [ ] 2.1.3 Implement `readDeliverable()` action
- [ ] 2.1.4 Implement `editDeliverable()` action
- [ ] 2.1.5 Implement `listDeliverables()` action
- [ ] 2.1.6 Implement `rerunDeliverable()` action
- [ ] 2.1.7 Implement `setCurrentVersion()` action
- [ ] 2.1.8 Implement `deleteVersion()` action
- [ ] 2.1.9 Follow exact pattern from plan.actions.ts
- [ ] 2.1.10 Update deliverablesStore via mutations only
- [ ] 2.1.11 Export all actions from index.ts

#### Unit Tests:
- [ ] 2.1.T1 Test createDeliverable with mock API
- [ ] 2.1.T2 Test readDeliverable returns correct data
- [ ] 2.1.T3 Test editDeliverable updates store
- [ ] 2.1.T4 Test listDeliverables returns array
- [ ] 2.1.T5 Test rerunDeliverable creates new version
- [ ] 2.1.T6 Test error handling for failed API calls
- [ ] 2.1.T7 Test store mutations are called correctly

#### Acceptance Criteria:
- ✅ File follows plan.actions.ts pattern exactly
- ✅ All deliverable operations implemented
- ✅ Updates deliverablesStore correctly
- ✅ All tests pass
- ✅ TypeScript compiles without errors

---

### Task 2.2: Create converse.actions.ts

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** High

#### Subtasks:
- [ ] 2.2.1 Create `services/agent2agent/actions/converse.actions.ts`
- [ ] 2.2.2 Implement `sendMessage()` action
- [ ] 2.2.3 Implement `createConversation()` action
- [ ] 2.2.4 Follow actions pattern
- [ ] 2.2.5 Update conversationsStore via mutations
- [ ] 2.2.6 Export actions

#### Unit Tests:
- [ ] 2.2.T1 Test sendMessage adds user message to store
- [ ] 2.2.T2 Test sendMessage adds assistant response to store
- [ ] 2.2.T3 Test createConversation creates in store
- [ ] 2.2.T4 Test error handling

#### Acceptance Criteria:
- ✅ Follows actions pattern
- ✅ Updates conversationsStore correctly
- ✅ Tests pass

---

### Task 2.3: Update Components to Use Actions (Deliverables)

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** High
**Depends On:** Task 2.1

#### Subtasks:
- [ ] 2.3.1 Create component migration list (grep for deliverableService imports)
- [ ] 2.3.2 Update TwoPaneConversationView.vue (6 occurrences)
- [ ] 2.3.3 Update DeliverableDisplay.vue (5 occurrences)
- [ ] 2.3.4 Update AgentTreeView.vue (1 occurrence)
- [ ] 2.3.5 Update VersionManagementPanel.vue
- [ ] 2.3.6 Update DeliverablesListPage.vue
- [ ] 2.3.7 Update NewDeliverableDialog.vue
- [ ] 2.3.8 Verify no remaining imports of old service (grep)
- [ ] 2.3.9 Test each component individually

#### Integration Tests:
- [ ] 2.3.T1 Test deliverable creation from UI
- [ ] 2.3.T2 Test deliverable editing from UI
- [ ] 2.3.T3 Test deliverable version display
- [ ] 2.3.T4 Test deliverable list loading
- [ ] 2.3.T5 Test deliverable rerun with different LLM

#### Acceptance Criteria:
- ✅ All components use build.actions
- ✅ No imports of old deliverableService
- ✅ All deliverable features work
- ✅ Tests pass

---

### Task 2.4: Update Components to Use Actions (Conversations)

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Medium
**Depends On:** Task 2.2

#### Subtasks:
- [ ] 2.4.1 Find components using conversationService (grep)
- [ ] 2.4.2 Update to use converse.actions
- [ ] 2.4.3 Test updated components

#### Integration Tests:
- [ ] 2.4.T1 Test message sending
- [ ] 2.4.T2 Test conversation creation

#### Acceptance Criteria:
- ✅ All components use converse.actions
- ✅ Tests pass

---

### Task 2.5: Update Components to Use Actions (Plans)

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Medium

#### Subtasks:
- [ ] 2.5.1 Find components using old planService (grep)
- [ ] 2.5.2 Update to use plan.actions (already exists)
- [ ] 2.5.3 Test updated components

#### Integration Tests:
- [ ] 2.5.T1 Test plan creation
- [ ] 2.5.T2 Test plan editing
- [ ] 2.5.T3 Test plan rerun

#### Acceptance Criteria:
- ✅ All components use plan.actions
- ✅ Tests pass

---

### Task 2.6: Delete Old agent-tasks Services

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Medium
**Depends On:** Tasks 2.3, 2.4, 2.5

#### Subtasks:
- [ ] 2.6.1 Verify zero imports of deliverableService (grep)
- [ ] 2.6.2 Verify zero imports of conversationService (grep)
- [ ] 2.6.3 Verify zero imports of planService (grep)
- [ ] 2.6.4 Verify zero imports of agentTaskService (grep)
- [ ] 2.6.5 Move responseHandler.ts to agent2agent/utils/handlers/
- [ ] 2.6.6 Delete agent-tasks/deliverableService.ts
- [ ] 2.6.7 Delete agent-tasks/conversationService.ts
- [ ] 2.6.8 Delete agent-tasks/planService.ts
- [ ] 2.6.9 Delete agent-tasks/agentTaskService.ts
- [ ] 2.6.10 Delete agent-tasks/migrationHelper.ts
- [ ] 2.6.11 Delete agent-tasks/types.ts (if no longer needed)
- [ ] 2.6.12 Delete agent-tasks/ directory if empty
- [ ] 2.6.13 Run TypeScript compilation
- [ ] 2.6.14 Run full test suite

#### Verification Tests:
- [ ] 2.6.T1 Build succeeds
- [ ] 2.6.T2 All tests pass
- [ ] 2.6.T3 No runtime errors
- [ ] 2.6.T4 Full application smoke test

#### Acceptance Criteria:
- ✅ Old services deleted
- ✅ responseHandler moved
- ✅ Build succeeds
- ✅ All tests pass

---

### Phase 2 Testing Summary

#### Manual Test Scenarios:
- [ ] P2.M1 Create deliverable via agent → Verify appears in UI
- [ ] P2.M2 Edit deliverable → Verify changes persist
- [ ] P2.M3 Rerun deliverable with different LLM → Verify new version
- [ ] P2.M4 Send message in conversation → Verify displays
- [ ] P2.M5 Create plan → Verify appears in UI
- [ ] P2.M6 Edit plan → Verify changes persist

#### End-to-End Tests:
- [ ] P2.E1 Full workflow: Create conversation → Create plan → Create deliverable
- [ ] P2.E2 Full workflow: Edit deliverable → Create new version → Set as current
- [ ] P2.E3 Full workflow: Delete conversation → Deliverable preserved

---

## Phase 3: Projects → Orchestrations Migration (1 week)

**Goal:** Remove legacy projects system, use orchestrations exclusively.

### Task 3.1: Confirm No-Data Assumption & Proceed

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.25 days
**Priority:** Critical

#### Subtasks:
- [ ] 3.1.1 Document assumption that `projects` and `project_steps` contain no critical data
- [ ] 3.1.2 Notify stakeholders that tables will be dropped without backup
- [ ] 3.1.3 Update runbook/notes to reflect the assumption

#### Acceptance Criteria:
- ✅ Assumption captured in project notes
- ✅ Stakeholders acknowledge no-backup approach
- ✅ Ready to execute schema changes without data safeguards

---

### Task 3.2: Database Migration - Add Orchestration Column

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.5 days
**Priority:** High
**Depends On:** Task 3.1

#### Subtasks:
- [ ] 3.2.1 Create migration file: `add_orchestration_step_id_to_deliverables.sql`
- [ ] 3.2.2 Write SQL: `ALTER TABLE deliverables ADD COLUMN orchestration_step_id UUID;`
- [ ] 3.2.3 Note: skip data migration (assumed unused)
- [ ] 3.2.4 Test migration on dev database
- [ ] 3.2.5 Run migration on staging database
- [ ] 3.2.6 Verify migration successful
- [ ] 3.2.7 Run migration on production database
- [ ] 3.2.8 Verify production migration

#### Verification Tests:
- [ ] 3.2.T1 Column exists: `\d deliverables` shows orchestration_step_id
- [ ] 3.2.T2 Data migrated correctly (if applicable)
- [ ] 3.2.T3 No data loss
- [ ] 3.2.T4 Deliverables still accessible via API

#### Acceptance Criteria:
- ✅ New column added
- ✅ No data migration required (documented)
- ✅ No schema errors
- ✅ Migration tested on all environments

---

### Task 3.3: Database Migration - Remove Project Columns

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.5 days
**Priority:** High
**Depends On:** Task 3.2

#### Subtasks:
- [ ] 3.3.1 Create migration file: `remove_project_step_id_from_deliverables.sql`
- [ ] 3.3.2 Write SQL: `ALTER TABLE deliverables DROP COLUMN project_step_id;`
- [ ] 3.3.3 Test on dev database
- [ ] 3.3.4 Run on staging
- [ ] 3.3.5 Verify staging
- [ ] 3.3.6 Run on production
- [ ] 3.3.7 Verify production

#### Verification Tests:
- [ ] 3.3.T1 Column removed: `\d deliverables` shows no project_step_id
- [ ] 3.3.T2 Deliverables still functional
- [ ] 3.3.T3 No foreign key errors

#### Acceptance Criteria:
- ✅ Old column removed
- ✅ No errors
- ✅ Deliverables work correctly

---

### Task 3.4: Database Migration - Drop Project Tables

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.5 days
**Priority:** Medium
**Depends On:** Task 3.3

#### Subtasks:
- [ ] 3.4.1 Create migration file: `drop_project_tables.sql`
- [ ] 3.4.2 Write SQL: `DROP TABLE IF EXISTS project_steps;`
- [ ] 3.4.3 Write SQL: `DROP TABLE IF EXISTS projects;`
- [ ] 3.4.4 Test on dev
- [ ] 3.4.5 Run on staging
- [ ] 3.4.6 Verify staging
- [ ] 3.4.7 Run on production
- [ ] 3.4.8 Verify production

#### Verification Tests:
- [ ] 3.4.T1 Tables dropped: `\dt` shows no projects/project_steps
- [ ] 3.4.T2 No errors in application logs
- [ ] 3.4.T3 All features still work

#### Acceptance Criteria:
- ✅ Tables dropped
- ✅ No application errors

---

### Task 3.5: Backend Code - Update Deliverable Entity

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.5 days
**Priority:** High
**Depends On:** Task 3.2

#### Subtasks:
- [ ] 3.5.1 Update `deliverable.entity.ts` - Change `projectStepId` → `orchestrationStepId`
- [ ] 3.5.2 Update `create-deliverable.dto.ts` - Change field
- [ ] 3.5.3 Update `deliverables.service.ts` - Update references
- [ ] 3.5.4 Update any other references (grep for projectStepId)
- [ ] 3.5.5 Run TypeScript compilation
- [ ] 3.5.6 Run backend tests

#### Unit Tests:
- [ ] 3.5.T1 Test deliverable creation with orchestrationStepId
- [ ] 3.5.T2 Test deliverable query by orchestrationStepId
- [ ] 3.5.T3 Test deliverable update

#### Acceptance Criteria:
- ✅ Entity updated
- ✅ DTOs updated
- ✅ Service updated
- ✅ Tests pass

---

### Task 3.6: Backend Code - Delete Projects Services

**Owner:** Backend Team (API & Data)
**Estimated Time:** 0.5 days
**Priority:** Medium
**Depends On:** Task 3.4

#### Subtasks:
- [ ] 3.6.1 Verify zero imports of ProjectsService (grep)
- [ ] 3.6.2 Verify zero imports of ProjectsController (grep)
- [ ] 3.6.3 Delete `agent2agent/projects/projects.service.ts`
- [ ] 3.6.4 Delete `agent2agent/projects/projects.controller.ts`
- [ ] 3.6.5 Delete `agent2agent/projects/dto/` directory
- [ ] 3.6.6 Delete `agent2agent/projects/` directory if empty
- [ ] 3.6.7 Remove from module imports
- [ ] 3.6.8 Run TypeScript compilation
- [ ] 3.6.9 Run backend tests

#### Verification Tests:
- [ ] 3.6.T1 Backend compiles
- [ ] 3.6.T2 All tests pass
- [ ] 3.6.T3 Server starts without errors
- [ ] 3.6.T4 Swagger docs generate correctly

#### Acceptance Criteria:
- ✅ Projects code deleted
- ✅ Backend compiles
- ✅ Tests pass
- ✅ Server runs

---

### Task 3.7: Frontend Code - Update Deliverable Service

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** High
**Depends On:** Task 3.5

#### Subtasks:
- [ ] 3.7.1 Update `deliverablesService.ts` - Change `projectStepId` → `orchestrationStepId`
- [ ] 3.7.2 Update Deliverable interface
- [ ] 3.7.3 Update CreateDeliverableDto
- [ ] 3.7.4 Search for any projectStepId references (grep)
- [ ] 3.7.5 Run TypeScript compilation
- [ ] 3.7.6 Run frontend tests

#### Unit Tests:
- [ ] 3.7.T1 Test deliverable creation with new field
- [ ] 3.7.T2 Test deliverable fetch
- [ ] 3.7.T3 Test type safety

#### Acceptance Criteria:
- ✅ Service updated
- ✅ Types updated
- ✅ Tests pass

---

### Task 3.8: Frontend Code - Delete Project Pages/Components

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** Medium
**Depends On:** Task 3.6

#### Subtasks:
- [ ] 3.8.1 Delete `views/NewProjectPage.vue`
- [ ] 3.8.2 Delete `views/ProjectDetailPage.vue`
- [ ] 3.8.3 Delete `views/ProjectsListPage.vue`
- [ ] 3.8.4 Delete `components/ProjectDisplay.vue`
- [ ] 3.8.5 Delete `services/projectsService.ts`
- [ ] 3.8.6 Remove project routes from router
- [ ] 3.8.7 Remove project nav items (if any)
- [ ] 3.8.8 Remove project types from types/
- [ ] 3.8.9 Search for any remaining project references (grep)
- [ ] 3.8.10 Run TypeScript compilation
- [ ] 3.8.11 Run frontend tests

#### Verification Tests:
- [ ] 3.8.T1 Frontend compiles
- [ ] 3.8.T2 All tests pass
- [ ] 3.8.T3 Dev server starts without errors
- [ ] 3.8.T4 No 404 routes

#### Acceptance Criteria:
- ✅ All project UI deleted
- ✅ Routes removed
- ✅ Build succeeds
- ✅ Tests pass

---

### Phase 3 Testing Summary

#### Manual Test Scenarios:
- [ ] P3.M1 Create deliverable (no orchestration) → Verify works
- [ ] P3.M2 Create deliverable with orchestration → Verify orchestrationStepId saved
- [ ] P3.M3 View deliverable list → Verify displays correctly
- [ ] P3.M4 Navigate to old project routes → Verify 404 or redirect
- [ ] P3.M5 Check all nav menus → Verify no project links

#### Database Verification:
- [ ] P3.D1 Query deliverables → Verify no project_step_id column
- [ ] P3.D2 Query deliverables → Verify orchestration_step_id exists
- [ ] P3.D3 Verify projects/project_steps tables don't exist
- [ ] P3.D4 Verify no orphaned data

---

## Phase 4: Store Method Migration (1 week)

**Goal:** Move all async operations from stores to services, refactor privacy/sanitization architecture, and harden type safety across Pinia modules.

### Task 4.1: Refactor deliverablesStore

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** High

#### Subtasks:
- [ ] 4.1.1 Identify all async methods in deliverablesStore (grep for `async function`)
- [ ] 4.1.2 Move `loadDeliverables()` logic to deliverablesService
- [ ] 4.1.3 Move `loadDeliverableVersions()` logic to deliverablesService
- [ ] 4.1.4 Move `loadDeliverablesByConversation()` logic to deliverablesService
- [ ] 4.1.5 Move `createVersion()` logic to deliverablesService
- [ ] 4.1.6 Move `rerunWithDifferentLLM()` logic to deliverablesService
- [ ] 4.1.7 Replace store methods with simple mutations
- [ ] 4.1.8 Update components to call service (not store)
- [ ] 4.1.9 Test all deliverable operations

#### Acceptance Criteria:
- ✅ No async methods in store
- ✅ All logic moved to service
- ✅ Components call service
- ✅ Store has only mutations
- ✅ Tests pass

---

### Task 4.2: Refactor agentsStore

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Medium

#### Subtasks:
- [ ] 4.2.1 Move `fetchAvailableAgents()` to agentsService (create if needed)
- [ ] 4.2.2 Move `fetchAgentHierarchy()` to agentsService
- [ ] 4.2.3 Replace with simple mutations
- [ ] 4.2.4 Update components

#### Acceptance Criteria:
- ✅ No async methods in store
- ✅ Service handles fetching
- ✅ Tests pass

---

### Task 4.3: Refactor Privacy/Sanitization Stores & Services

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 2 days
**Priority:** Medium

#### Context:
Privacy features (PII detection, pseudonymization, sanitization) violate architectural standards. Stores contain async methods; services aren't organized. Privacy metadata must be returned in A2A response metadata, but privacy management itself is NOT an A2A action.

#### Subtasks:
- [ ] 4.3.1 Audit all 6 privacy stores for async violations (pseudonymMappingsStore, pseudonymDictionariesStore, privacyIndicatorsStore, privacyDashboardStore, piiPatternsStore, sovereignPolicyStore)
- [ ] 4.3.2 Create services/privacy/ folder structure
- [ ] 4.3.3 Move piiService.ts → services/privacy/piiService.ts
- [ ] 4.3.4 Move pseudonymService.ts → services/privacy/pseudonymService.ts
- [ ] 4.3.5 Move sanitizationAnalyticsService.ts → services/privacy/sanitizationService.ts
- [ ] 4.3.6 Move sovereignPolicyService.ts → services/privacy/sovereignPolicyService.ts
- [ ] 4.3.7 Extract async methods from pseudonymMappingsStore → pseudonymService (5 methods: fetchMappings, fetchMappingsFiltered, fetchMapping, fetchStats, getMappingsByRunId)
- [ ] 4.3.8 Extract async methods from pseudonymDictionariesStore → pseudonymService (9 methods)
- [ ] 4.3.9 Extract async methods from piiPatternsStore → piiService
- [ ] 4.3.10 Extract async methods from privacyIndicatorsStore → privacy services
- [ ] 4.3.11 Extract async methods from privacyDashboardStore → sanitizationService
- [ ] 4.3.12 Extract async methods from sovereignPolicyStore → sovereignPolicyService
- [ ] 4.3.13 Update privacy stores to have only simple mutations (setState, addItem, removeItem)
- [ ] 4.3.14 Update components to call privacy services (not store async methods)
- [ ] 4.3.15 Verify A2A handlers extract privacy metadata from responses correctly
- [ ] 4.3.16 Run TypeScript compilation
- [ ] 4.3.17 Run privacy feature tests

#### Unit Tests:
- [ ] 4.3.T1 Test each privacy store mutation (synchronous only)
- [ ] 4.3.T2 Test pseudonymService methods call correct APIs
- [ ] 4.3.T3 Test piiService methods call correct APIs
- [ ] 4.3.T4 Test privacy stores update correctly from service calls
- [ ] 4.3.T5 Test A2A response handlers extract privacy metadata

#### Acceptance Criteria:
- ✅ All 6 privacy stores have zero async methods
- ✅ Privacy services organized in services/privacy/
- ✅ All privacy stores follow "state only" pattern
- ✅ Components call privacy services, not store methods
- ✅ A2A handlers correctly extract privacy metadata from response.metadata.privacy
- ✅ Tests pass

---

### Task 4.4: Refactor Other Stores (As Needed)

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.5 days
**Priority:** Low

#### Subtasks:
- [ ] 4.4.1 Review llmUsageStore (15+ violations)
- [ ] 4.4.2 Prioritize critical stores beyond privacy
- [ ] 4.4.3 Refactor selected stores if time permits
- [ ] 4.4.4 Update components

#### Acceptance Criteria:
- ✅ Critical stores refactored
- ✅ Violations reduced
- ✅ Tests pass

---

### Task 4.5: Incremental Store Type-Safety Hardening

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 1 day
**Priority:** High

#### Subtasks:
- [ ] 4.5.1 Audit all Pinia stores for `any`, implicit `as` casts, or untyped payloads
- [ ] 4.5.2 Introduce shared store interface definitions aligned with domain models
- [ ] 4.5.3 Update store state, getters, and mutations to use explicit types
- [ ] 4.5.4 Replace untyped component interactions with typed helpers/selectors
- [ ] 4.5.5 Add TypeScript assertion tests or `satisfies` checks for critical stores
- [ ] 4.5.6 Run TypeScript compilation and affected unit tests

#### Acceptance Criteria:
- ✅ No remaining `any` or implicit casts in Pinia stores
- ✅ Stores rely on shared typed interfaces
- ✅ Components compile with updated types
- ✅ Unit/type assertion tests pass

---

### Phase 4 Testing Summary

#### Unit Tests:
- [ ] P4.U1 All store mutations are synchronous
- [ ] P4.U2 All services update stores correctly
- [ ] P4.U3 All services handle errors correctly
- [ ] P4.U4 Store type assertions/TS satisfies checks succeed

#### Integration Tests:
- [ ] P4.I1 Components call services, not stores
- [ ] P4.I2 Stores update, UI reacts
- [ ] P4.I3 Error states display correctly

---

## Phase 5: Final Testing & Documentation (1 week)

**Goal:** Comprehensive testing and documentation updates.

### Task 5.1: Unit Test Coverage

**Owner:** QA & Automation Team (Matt + QA)
**Estimated Time:** 2 days
**Priority:** High

#### Subtasks:
- [ ] 5.1.1 Run test coverage report
- [ ] 5.1.2 Identify untested stores
- [ ] 5.1.3 Identify untested actions
- [ ] 5.1.4 Write missing store tests
- [ ] 5.1.5 Write missing action tests
- [ ] 5.1.6 Write missing service tests
- [ ] 5.1.7 Achieve 80%+ coverage for new code
- [ ] 5.1.8 Run full test suite

#### Acceptance Criteria:
- ✅ 80%+ test coverage for stores
- ✅ 80%+ test coverage for actions
- ✅ 80%+ test coverage for services
- ✅ All tests pass

---

### Task 5.2: Integration Testing

**Owner:** QA & Front-end Team
**Estimated Time:** 2 days
**Priority:** High

#### Subtasks:
- [ ] 5.2.1 Test conversation creation → plan creation → deliverable creation (full flow)
- [ ] 5.2.2 Test deliverable editing → version creation → set current
- [ ] 5.2.3 Test conversation deletion → deliverable preserved
- [ ] 5.2.4 Test conversation + deliverable deletion
- [ ] 5.2.5 Test agent selection and agent hierarchy
- [ ] 5.2.6 Test task execution and status updates
- [ ] 5.2.7 Test orchestration workflows (if applicable)
- [ ] 5.2.8 Test error scenarios (network failures, validation errors)
- [ ] 5.2.9 Update `obsidian/efforts/Matt/current/agent-stack-testing/test-progress.md` with results

#### Acceptance Criteria:
- ✅ All critical workflows tested
- ✅ Error handling verified
- ✅ No regressions found

---

### Task 5.3: End-to-End Testing

**Owner:** QA Team (Automation)
**Estimated Time:** 1 day
**Priority:** High

#### Subtasks:
- [ ] 5.3.1 Test in Chrome
- [ ] 5.3.2 Test in Firefox
- [ ] 5.3.3 Test in Safari (if applicable)
- [ ] 5.3.4 Test on mobile viewport
- [ ] 5.3.5 Test with slow network (DevTools throttling)
- [ ] 5.3.6 Test with backend errors (mock 500 responses)
- [ ] 5.3.7 Test concurrent operations (open multiple tabs)
- [ ] 5.3.8 Performance test (check load times, bundle size)
- [ ] 5.3.9 Publish E2E execution notes to `obsidian/efforts/Matt/current/agent-stack-testing/progress.md`

#### Acceptance Criteria:
- ✅ Works in all browsers
- ✅ No console errors
- ✅ Performance acceptable
- ✅ Handles errors gracefully

---

### Task 5.4: Update Architecture Documentation

**Owner:** Architecture & Docs (Matt)
**Estimated Time:** 1 day
**Priority:** Medium

#### Subtasks:
- [ ] 5.4.1 Update DOMAIN_ARCHITECTURE_ANALYSIS.md
- [ ] 5.4.2 Create new Architecture Decision Records (ADRs)
- [ ] 5.4.3 Document store structure in README
- [ ] 5.4.4 Document actions pattern in README
- [ ] 5.4.5 Update contribution guidelines
- [ ] 5.4.6 Document conversation deletion rules
- [ ] 5.4.7 Create migration guide (for reference)
- [ ] 5.4.8 Update code comments where needed

#### Acceptance Criteria:
- ✅ All docs updated
- ✅ Patterns documented
- ✅ Examples provided
- ✅ Team reviewed docs

---

### Task 5.5: Performance Verification

**Owner:** Front-end Team (Performance)
**Estimated Time:** 0.5 days
**Priority:** Medium

#### Subtasks:
- [ ] 5.5.1 Measure initial load time
- [ ] 5.5.2 Measure conversation load time
- [ ] 5.5.3 Measure plan creation time
- [ ] 5.5.4 Measure deliverable creation time
- [ ] 5.5.5 Check bundle size
- [ ] 5.5.6 Check memory usage (Chrome DevTools)
- [ ] 5.5.7 Compare against baseline (before refactor)
- [ ] 5.5.8 Document any improvements

#### Acceptance Criteria:
- ✅ No performance regressions
- ✅ Metrics documented
- ✅ Any improvements noted

---

### Task 5.6: Final Code Review

**Owner:** Engineering Leads (Matt + API Lead)
**Estimated Time:** 0.5 days
**Priority:** Medium

#### Subtasks:
- [ ] 5.6.1 Review all changed files
- [ ] 5.6.2 Check for TODO comments
- [ ] 5.6.3 Check for console.logs (remove or convert to proper logging)
- [ ] 5.6.4 Check for commented-out code (remove)
- [ ] 5.6.5 Verify consistent code style
- [ ] 5.6.6 Verify TypeScript types (no `any` unless necessary)
- [ ] 5.6.7 Run linter
- [ ] 5.6.8 Run formatter

#### Acceptance Criteria:
- ✅ Code clean and consistent
- ✅ No debug code left
- ✅ Linter passes
- ✅ Formatter applied

---

### Task 5.7: Legacy Service Naming Cleanup

**Owner:** Front-end Team (Lead: Matt)
**Estimated Time:** 0.25 days
**Priority:** Low
**Depends On:** Task 2.6

#### Subtasks:
- [ ] 5.7.1 Confirm all components use `agent2agent/actions/converse.actions`
- [ ] 5.7.2 Rename `apps/web/src/services/agentConversationsService.ts` → `conversationsService.ts`
- [ ] 5.7.3 Update default export and imports to `conversationsService`
- [ ] 5.7.4 Run TypeScript compilation
- [ ] 5.7.5 Spot-check affected UI flows

#### Acceptance Criteria:
- ✅ File renamed and imports updated
- ✅ No references to `agentConversationsService` remain
- ✅ TypeScript build passes
- ✅ Conversations UI unaffected

---

### Phase 5 Testing Summary

#### Regression Testing:
- [ ] P5.R1 All features from before refactor still work
- [ ] P5.R2 No new bugs introduced
- [ ] P5.R3 Performance equivalent or better
- [ ] P5.R4 User experience unchanged (from user perspective)

#### Acceptance Testing:
- [ ] P5.A1 Meets all PRD success criteria
- [ ] P5.A2 All phases completed
- [ ] P5.A3 All tests pass
- [ ] P5.A4 Documentation complete
- [ ] P5.A5 Team sign-off

#### Progressive Agent Stack Validation:
- [ ] PA1 Context Agent (plans CRUD) scenarios pass
- [ ] PA2 Deliverables CRUD scenarios pass
- [ ] PA3 Plan + Deliverables integration scenarios pass
- [ ] PA4 API Agents real-time (SSE/webhook/polling) scenarios pass
- [ ] PA5 API Agents + Plan + Deliverables build workflow scenarios pass
- [ ] PA6 Function Agents (image writers) scenarios pass
- [ ] PA7 Orchestrator multi-agent coordination scenarios pass

---

## Progress Tracking

### Overall Progress

**Phase 1 - Store Consolidation:**
- [x] Task 1.1: Create Unified Conversations Store ✅
- [x] Task 1.2: Migrate Components ✅
- [x] Task 1.3: Delete Old Stores ✅
- [x] Task 1.4: Consolidate Agent Stores ✅
- [x] Task 1.5: Extract UI State ✅
- [ ] Task 1.6: Remove Duplication (⏭️ Deferred - requires component refactoring)
- [ ] Task 1.7: Delete agentChatStore (⏭️ Deferred - depends on 1.6)

**Phase 2 - Service Migration:**
- [ ] Task 2.1: Create build.actions.ts
- [ ] Task 2.2: Create converse.actions.ts
- [ ] Task 2.3: Update Components (Deliverables)
- [ ] Task 2.4: Update Components (Conversations)
- [ ] Task 2.5: Update Components (Plans)
- [ ] Task 2.6: Delete Old Services

**Phase 3 - Projects Migration:**
- [ ] Task 3.1: Assess Usage
- [ ] Task 3.2: Add Orchestration Column
- [ ] Task 3.3: Remove Project Column
- [ ] Task 3.4: Drop Project Tables
- [ ] Task 3.5: Update Backend Entity
- [ ] Task 3.6: Delete Backend Services
- [ ] Task 3.7: Update Frontend Service
- [ ] Task 3.8: Delete Frontend Pages

**Phase 4 - Store Method Migration:**
- [ ] Task 4.1: Refactor deliverablesStore
- [ ] Task 4.2: Refactor agentsStore
- [ ] Task 4.3: Refactor Privacy/Sanitization Stores & Services
- [ ] Task 4.4: Refactor Other Stores
- [ ] Task 4.5: Incremental Store Type-Safety Hardening

**Phase 5 - Final Testing:**
- [ ] Task 5.1: Unit Test Coverage
- [ ] Task 5.2: Integration Testing
- [ ] Task 5.3: End-to-End Testing
- [ ] Task 5.4: Update Documentation
- [ ] Task 5.5: Performance Verification
- [ ] Task 5.6: Final Code Review
- [ ] Task 5.7: Legacy Service Naming Cleanup

---

## Risk Mitigation Checklist

- [ ] Stakeholder confirmation captured before destructive migrations (backups optional)
- [ ] Staging environment tested before production
- [ ] Rollback plan documented for each phase
- [ ] Incremental commits (one task at a time)
- [ ] Branch strategy defined (feature branches + main)
- [ ] Team communication plan (daily standups)
- [ ] Production deployment plan (off-hours, monitored)

---

## Success Metrics

**Target Metrics (from PRD):**
- [ ] Store count reduced from >10 to ≤7 consolidated domain stores
- [ ] Zero async methods remain inside Pinia stores
- [ ] Zero imports from deprecated `agent-tasks` services
- [ ] ≥1,454 lines of legacy project-related code deleted
- [ ] ≥80% coverage across new/modified stores, actions, and services
- [ ] Front-end bundle size and key load metrics match or beat baseline
- [ ] End-to-end test suite passes for plan → deliverable → orchestration flows
- [ ] 100% of Pinia store APIs expose strict, explicit TypeScript types (no unchecked casts)

---

## Notes for Implementation

**Tips for Success:**
1. Complete tasks in order (dependencies matter)
2. Run tests after EVERY subtask (catch issues early)
3. Commit frequently (one subtask = one commit)
4. Update this plan as you go (mark completed, add notes)
5. If blocked, document blocker and move to next task
6. Keep PRD and PLAN in sync (update both if requirements change)

**How to Use This Plan:**
- Check off items as you complete them
- Use `[~]` for items in progress
- Use `[!]` for blocked items
- Add notes under tasks as needed
- Track time spent (compare to estimates)
- Update Phase progress regularly

---

**END OF PLAN**
