# Architecture Consolidation & Domain Model Cleanup
## Product Requirements Document (PRD)

**Date:** 2025-10-17
**Status:** Draft
**Owner:** Matt
**Priority:** High

---

## Executive Summary

This effort consolidates the frontend architecture to eliminate technical debt accumulated during organic growth. The system currently has fragmented domain models, duplicate services, and mixed responsibilities across stores and services. This PRD defines a comprehensive cleanup that will:

1. **Standardize service patterns** - Migrate from mixed `agent-tasks/` services to unified `agent2agent/actions/` pattern
2. **Consolidate stores** - Reduce from 10+ fragmented domain stores to 7 clean, focused stores
3. **Separate concerns** - Enforce strict separation: stores = state only, services = business logic only
4. **Migrate projects → orchestrations** - Remove legacy projects system, use orchestrations exclusively
5. **Align with backend** - Frontend stores match backend transport-types (mode*actions pattern)

**Expected Impact:**
- 50% reduction in architectural confusion
- Elimination of duplicate code and overlapping responsibilities
- Clear patterns for adding new features
- Improved testability and maintainability
- Foundation for scaling with small team

---

## 1. Problem Statement

### 1.1 Current Pain Points

**Fragmented Domain Model:**
- 3 stores managing conversations (`conversationStore`, `agentConversationsStore`, `agentChatStore`)
- 2 stores managing agents (`agentStore`, `agentsStore`)
- "God store" problem: `agentChatStore` contains conversations + plans + deliverables + UI state (422+ lines)
- Duplicate state: Plans and deliverables stored in both domain stores AND agentChatStore

**Mixed Service Patterns:**
- Old pattern: `agent-tasks/` services (conversationService, planService, deliverableService)
- New pattern: `agent2agent/actions/` (plan.actions, orchestrate.actions)
- Result: Confusion about which pattern to use, duplicate implementations

**Stores with Business Logic:**
- 65+ violations of "stores = state only" principle
- Components call `store.loadDeliverables()` instead of `service.loadDeliverables()`
- 10 stores contain API calls, async operations, complex orchestration
- Business logic scattered across stores instead of centralized in services

**Legacy Systems:**
- Projects and ProjectSteps still exist alongside Orchestrations
- Deliverables reference `projectStepId` (should be `orchestrationStepId`)
- Duplicate functionality: Projects (3 files, 1,454 lines) vs Orchestrations (74+ files, mature system)

### 1.2 Root Cause

**Organic Growth Without Governance:**
The system evolved rapidly to meet business needs without architectural oversight. Features were added using whatever pattern was closest at hand, leading to:
- Pattern proliferation (multiple ways to do the same thing)
- Copy-paste architecture (duplicate instead of consolidate)
- Unclear ownership (which store/service owns what?)

### 1.3 Impact

**Developer Productivity:**
- 30-40% of development time spent navigating architectural confusion
- New features require understanding multiple overlapping systems
- Bug fixes require changes across 3-4 stores/services

**System Stability:**
- State synchronization bugs between duplicate stores
- Race conditions from business logic in stores
- Difficult to test due to tight coupling

**Scalability:**
- Can't add new modes/features without understanding entire system
- Small team can't maintain multiple parallel systems

---

## 2. Goals & Success Criteria

### 2.1 Primary Goals

1. **Single Source of Truth**
   - One store per domain concept
   - No duplicate state management
   - Clear ownership boundaries

2. **Clean Separation of Concerns**
   - Stores = state only (reactive data)
   - Services = business logic only (orchestration, API calls)
   - Components = UI only (read from stores, call services)

3. **Consistent Patterns**
   - One way to handle each mode (converse, plan, build, orchestrate)
   - Predictable file structure
   - Clear naming conventions

4. **Reduced Complexity**
   - Consolidate 10+ domain stores → 7 core stores
   - Remove duplicate services
   - Delete legacy projects system

### 2.2 Success Metrics

**Quantitative:**
- ✅ Reduce store count from 10+ to 7 core domain stores
- ✅ Eliminate 65+ store business logic violations
- ✅ Remove 1,454 lines of projects code
- ✅ Consolidate 3 conversation stores → 1
- ✅ Delete 4+ duplicate/overlapping service files
- ✅ 100% of components use actions (not old services)

**Qualitative:**
- ✅ New developers can find code in <5 minutes
- ✅ New features follow obvious patterns
- ✅ Store changes don't cause cascade of updates
- ✅ Tests can mock services without mocking stores

### 2.3 Non-Goals

**Out of Scope for This Effort:**
- ❌ Rewriting to support multiple conversations per deliverable (future architecture)
- ❌ Complete store type safety overhaul (incremental improvement only)
- ❌ UI/UX redesign
- ❌ Backend refactoring (frontend only, except projects cleanup)
- ❌ Performance optimization (architectural cleanup may improve performance, but not primary goal)

---

## 3. Architecture Vision

### 3.1 Domain Model Alignment

**Core Principle:** Frontend stores align 1:1 with backend transport-types.

```
Backend Mode       →    Frontend Store        →    Frontend Actions
────────────────────────────────────────────────────────────────────
CONVERSE           →    conversationsStore    →    converse.actions.ts
PLAN               →    plansStore           →    plan.actions.ts
BUILD              →    deliverablesStore    →    build.actions.ts
ORCHESTRATE        →    orchestrationsStore  →    orchestrate.actions.ts
(supporting)       →    agentsStore          →    (REST service)
(supporting)       →    tasksStore           →    (REST service)
```

### 3.2 Target Store Structure

**Core Domain Stores (7 total):**

1. **conversationsStore** - Consolidates 3 existing stores
   - State: conversations, messages, tasks
   - Replaces: `conversationStore`, `agentConversationsStore`, `agentChatStore` (domain part)

2. **agentsStore** - Consolidates 2 existing stores
   - State: agent catalog, capabilities, hierarchy
   - Replaces: `agentStore`, `agentsStore`

3. **plansStore** - Keep existing (already clean)
   - State: plans, versions, conversation associations

4. **deliverablesStore** - Keep existing (already clean)
   - State: deliverables, versions, conversation associations

5. **orchestrationsStore** - Keep existing (underutilized but correct)
   - State: orchestrations, runs, steps

6. **tasksStore** - Keep existing (well-designed)
   - State: tasks, results, execution tracking

7. **chatUiStore** - NEW: Extract from agentChatStore
   - State: UI-only concerns (active conversation, pending actions, chat mode)

**Infrastructure Stores (Keep as-is):**
- authStore, errorStore, loadingStore, uiStore, llmStore, etc.

### 3.3 Target Service Structure

**Mode-Based Actions (Agent Interactions):**
```
services/agent2agent/actions/
  ├─ converse.actions.ts      → CONVERSE mode operations
  ├─ plan.actions.ts          → PLAN mode operations
  ├─ build.actions.ts         → BUILD mode operations
  └─ orchestrate.actions.ts   → ORCHESTRATE mode operations
```

**Direct REST Services (CRUD Operations):**
```
services/
  ├─ deliverablesService.ts         → Deliverable CRUD
  ├─ agentConversationsService.ts   → Conversation CRUD
  ├─ tasksService.ts                → Task CRUD
  └─ apiService.ts                  → HTTP client
```

**Supporting Infrastructure:**
```
services/agent2agent/
  ├─ api/agent2agent.api.ts         → API client for mode operations
  ├─ utils/handlers/                → Response validators
  └─ utils/builders/                → Request builders
```

### 3.4 Actions Pattern (Standard)

Every action file follows this pattern:

```typescript
// 1. Read from store (if needed for context)
const store = useXStore();
const existing = store.getExisting();

// 2. Create API client
const api = createAgent2AgentApi(agentName);

// 3. Build and send request
const response = await api.mode.action(conversationId, payload);

// 4. Validate response with handler
if (!response.success) throw new Error();
const result = handler.validate(response);

// 5. Update store via mutations
store.addItem(result.item);

// 6. Return result (for logging/testing)
return result;
```

**Key characteristics:**
- ✅ Orchestration only (no business logic)
- ✅ Store updates via simple mutations
- ✅ Handler validates responses
- ✅ Component gets automatic UI updates via Vue reactivity

---

## 4. Detailed Requirements

### 4.1 Store Consolidation

#### 4.1.1 Consolidate Conversations (3 stores → 1)

**Current State:**
- `conversationStore` (234 lines) - Generic, barely used
- `agentConversationsStore` (287 lines) - Agent-specific, actively used
- `agentChatStore` (422+ lines) - Everything (conversations + plans + deliverables + UI)

**Target State:**
```typescript
// stores/conversationsStore.ts
export const useConversationsStore = defineStore('conversations', () => {
  // STATE
  const conversations = ref<Map<string, Conversation>>(new Map());
  const messages = ref<Map<string, Message[]>>(new Map());
  const tasks = ref<Map<string, Task[]>>(new Map());
  const activeConversationId = ref<string | null>(null);

  // GETTERS
  const conversationById = (id: string) => conversations.value.get(id);
  const messagesByConversation = (id: string) => messages.value.get(id) || [];
  const tasksByConversation = (id: string) => tasks.value.get(id) || [];

  // MUTATIONS (simple, synchronous only)
  function addConversation(conversation: Conversation) { ... }
  function addMessage(conversationId: string, message: Message) { ... }
  function addTask(conversationId: string, task: Task) { ... }

  return { /* read-only state + mutations */ };
});
```

**Migration Steps:**
1. Create new unified `conversationsStore.ts`
2. Migrate data from `agentConversationsStore` (primary source)
3. Update all component imports
4. Delete old stores
5. Test thoroughly

**Acceptance Criteria:**
- ✅ Single store contains all conversation data
- ✅ No duplicate state
- ✅ All components use new store
- ✅ Old stores deleted
- ✅ Tests pass

#### 4.1.2 Consolidate Agents (2 stores → 1)

**Current State:**
- `agentStore` (305 lines) - Runtime state (barely used)
- `agentsStore` (245 lines) - Catalog (actively used)

**Target State:**
```typescript
// stores/agentsStore.ts (keep this name)
export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<Map<string, Agent>>(new Map());
  const hierarchy = ref<HierarchyNode[]>([]);
  const capabilities = ref<Map<string, AgentCapability[]>>(new Map());

  // Mutations only
  function setAgents(agents: Agent[]) { ... }
  function setHierarchy(hierarchy: HierarchyNode[]) { ... }

  return { /* state + mutations */ };
});
```

**Migration Steps:**
1. Merge runtime capabilities from `agentStore` into `agentsStore`
2. Remove unused status tracking (idle/busy - premature)
3. Update component imports
4. Delete `agentStore`
5. Test

**Acceptance Criteria:**
- ✅ Single agent store
- ✅ Catalog + capabilities in one place
- ✅ Runtime status removed (not needed yet)
- ✅ Tests pass

#### 4.1.3 Extract UI State from agentChatStore

**Current Problem:**
`agentChatStore` contains:
- Domain data (conversations, plans, deliverables) → Move to domain stores
- UI state (activeConversationId, chatMode, pendingAction) → Extract to new store

**Target State:**
```typescript
// stores/ui/chatUiStore.ts
export const useChatUiStore = defineStore('chatUi', () => {
  const activeConversationId = ref<string | null>(null);
  const pendingAction = ref<PendingAction | null>(null);
  const lastMessageWasSpeech = ref(false);
  const chatModeByConversation = ref<Map<string, AgentChatMode>>(new Map());

  return { /* UI state only */ };
});
```

**Migration Steps:**
1. Create `chatUiStore.ts`
2. Move UI-only state from `agentChatStore`
3. Update components to use both stores (chatUi for UI, conversations for data)
4. Remove UI state from `agentChatStore`
5. Eventually delete `agentChatStore` entirely

**Acceptance Criteria:**
- ✅ UI state completely separated
- ✅ No domain data in chatUiStore
- ✅ Components work correctly with split stores

#### 4.1.4 Remove Plan/Deliverable Duplication

**Current Problem:**
- Plans stored in both `plansStore` AND `agentChatStore.currentPlan`
- Deliverables stored in both `deliverablesStore` AND `agentChatStore.currentDeliverable`

**Target State:**
- Plans ONLY in `plansStore`
- Deliverables ONLY in `deliverablesStore`
- Components use: `plansStore.plansByConversation(conversationId)`

**Migration Steps:**
1. Update components to read from domain stores
2. Remove `currentPlan`, `latestPlan`, `currentDeliverable` from agentChatStore
3. Test all plan/deliverable UI

**Acceptance Criteria:**
- ✅ No duplicate state
- ✅ Single source of truth per domain
- ✅ All UI works correctly

### 4.2 Service Migration (agent-tasks → agent2agent/actions)

#### 4.2.1 Create build.actions.ts

**Purpose:** Migrate deliverable operations from `deliverableService.ts` to actions pattern.

**Actions to Implement:**
```typescript
// services/agent2agent/actions/build.actions.ts

export async function createDeliverable(
  agentName: string,
  conversationId: string,
  userMessage: string,
  options?: { planId?, title?, description? }
): Promise<BuildCreateResponseContent>

export async function readDeliverable(
  agentName: string,
  conversationId: string,
  deliverableId: string
): Promise<BuildReadResponseContent>

export async function editDeliverable(
  agentName: string,
  conversationId: string,
  deliverableId: string,
  editInstructions: string
): Promise<BuildEditResponseContent>

export async function listDeliverables(
  agentName: string,
  conversationId: string
): Promise<BuildListResponseContent>

export async function rerunDeliverable(
  agentName: string,
  conversationId: string,
  deliverableId: string,
  versionId: string,
  llmConfig: LLMConfig
): Promise<BuildRerunResponseContent>
```

**Acceptance Criteria:**
- ✅ Follows plan.actions.ts pattern exactly
- ✅ Updates deliverablesStore via mutations
- ✅ All deliverable operations migrated
- ✅ Tests pass

#### 4.2.2 Create converse.actions.ts

**Purpose:** Migrate conversation operations from `conversationService.ts` to actions pattern.

**Actions to Implement:**
```typescript
// services/agent2agent/actions/converse.actions.ts

export async function sendMessage(
  agentName: string,
  conversationId: string,
  userMessage: string
): Promise<ConverseResponseContent>

export async function createConversation(
  agentName: string,
  title?: string
): Promise<{ conversationId: string }>
```

**Acceptance Criteria:**
- ✅ Follows actions pattern
- ✅ Updates conversationsStore
- ✅ Tests pass

#### 4.2.3 Update Components to Use Actions

**Scope:** Update all components that currently import old services.

**Before:**
```typescript
import { deliverableService } from '@/services/agent-tasks/deliverableService';
await deliverableService.create({ ... });
```

**After:**
```typescript
import { createDeliverable } from '@/services/agent2agent/actions/build.actions';
await createDeliverable(agentName, conversationId, message, options);
```

**Files to Update (from audit):**
- TwoPaneConversationView.vue
- DeliverableDisplay.vue
- AgentTreeView.vue
- NewDeliverableDialog.vue
- (12+ component files total)

**Acceptance Criteria:**
- ✅ Zero imports from `agent-tasks/` services
- ✅ All use `agent2agent/actions/`
- ✅ Application works end-to-end

#### 4.2.4 Delete Old Services

**Files to Delete:**
```
apps/web/src/services/agent-tasks/
  ├─ deliverableService.ts      ❌ DELETE
  ├─ planService.ts             ❌ DELETE
  ├─ conversationService.ts     ❌ DELETE
  ├─ agentTaskService.ts        ❌ DELETE (facade no longer needed)
  ├─ responseHandler.ts         → MOVE to agent2agent/utils/handlers/
  └─ migrationHelper.ts         ❌ DELETE
```

**Acceptance Criteria:**
- ✅ Files deleted
- ✅ No broken imports
- ✅ Build succeeds

### 4.3 Projects → Orchestrations Migration

#### 4.3.1 Database Migration

**Current Tables:**
- `projects` (legacy)
- `project_steps` (legacy)
- `deliverables.project_step_id` (references legacy)

**Target Tables:**
- `orchestrations` (exists, mature)
- `orchestration_runs` (exists)
- `orchestration_steps` (exists)
- `deliverables.orchestration_step_id` (new column)

**Migration SQL:**
```sql
-- 1. Add new column
ALTER TABLE deliverables
ADD COLUMN orchestration_step_id UUID;

-- 2. Migrate data (if any project deliverables exist)
-- Note: Likely few/zero records, projects were experimental
UPDATE deliverables
SET orchestration_step_id = project_step_id
WHERE project_step_id IS NOT NULL;

-- 3. Drop old column
ALTER TABLE deliverables
DROP COLUMN project_step_id;

-- 4. Drop old tables (after backup)
DROP TABLE IF EXISTS project_steps;
DROP TABLE IF EXISTS projects;
```

**Acceptance Criteria:**
- ✅ Backup created before migration
- ✅ Data migrated (if any exists)
- ✅ Old tables dropped
- ✅ deliverables use orchestration_step_id

#### 4.3.2 Backend Code Cleanup

**Files to Delete:**
```
apps/api/src/agent2agent/projects/
  ├─ projects.service.ts        ❌ DELETE (1,454 lines)
  ├─ projects.controller.ts     ❌ DELETE
  └─ dto/                       ❌ DELETE
```

**Files to Update:**
```
apps/api/src/agent2agent/deliverables/
  ├─ entities/deliverable.entity.ts    → Update projectStepId → orchestrationStepId
  ├─ dto/create-deliverable.dto.ts     → Update field
  └─ deliverables.service.ts           → Update references
```

**Acceptance Criteria:**
- ✅ Projects files deleted
- ✅ Deliverables use orchestration references
- ✅ API tests pass
- ✅ No broken imports

#### 4.3.3 Frontend Code Cleanup

**Files to Delete:**
```
apps/web/src/views/
  ├─ NewProjectPage.vue         ❌ DELETE
  ├─ ProjectDetailPage.vue      ❌ DELETE
  └─ ProjectsListPage.vue       ❌ DELETE

apps/web/src/components/
  └─ ProjectDisplay.vue         ❌ DELETE

apps/web/src/services/
  └─ projectsService.ts         ❌ DELETE
```

**Files to Update:**
```
apps/web/src/services/
  └─ deliverablesService.ts     → Update projectStepId → orchestrationStepId

apps/web/src/types/
  └─ *.ts                       → Remove Project types
```

**Acceptance Criteria:**
- ✅ Project files deleted
- ✅ Deliverable service updated
- ✅ Types updated
- ✅ Build succeeds
- ✅ No orphan routes

### 4.4 Store Method Migration (Store calls → Service calls)

**Scope:** Fix 65+ violations where components call async store methods.

**Pattern (Before - WRONG):**
```typescript
// Component
await deliverablesStore.loadDeliverables();  // ❌ Business logic in store
```

**Pattern (After - CORRECT):**
```typescript
// Component
await deliverablesService.loadDeliverables();  // ✅ Service handles logic

// Service
async loadDeliverables() {
  const data = await api.get('/deliverables');
  deliverablesStore.setDeliverables(data);  // Simple mutation
}
```

**Affected Stores (from audit):**
- deliverablesStore: 15+ violations
- agentsStore: 6 violations
- agentConversationsStore: 4 violations
- planStore: 1 violation
- llmUsageStore: 15+ violations
- pseudonymDictionariesStore: 9 violations

**Acceptance Criteria:**
- ✅ Zero async methods in stores
- ✅ All async operations in services
- ✅ Stores have only simple mutations
- ✅ Components call services, not store methods

---

## 5. Conversation Deletion Rules

**Current Implementation:** ✅ Already correct (no changes needed)

**Behavior:**
```typescript
DELETE Conversation:
  CASCADE: messages, tasks, plan + versions
  PRESERVE: deliverable (conversationId → NULL, becomes standalone)
  USER CHOICE: Optional checkbox to also delete deliverable
```

**UI Flow (Already Implemented):**
1. User clicks delete conversation
2. Modal shows: "Delete conversation? This will delete messages, tasks, and plan."
3. If deliverable exists: Checkbox "Also delete the deliverable" (unchecked by default)
4. User confirms
5. Backend deletes based on checkbox state

**No Action Required:** This is already correctly implemented.

---

## 6. Testing Requirements

### 6.1 Unit Tests

**Store Tests:**
- Test each store mutation in isolation
- Verify state changes correctly
- No async operations in stores

**Action Tests:**
- Mock API responses
- Verify correct store mutations called
- Test error handling

**Service Tests:**
- Mock HTTP requests
- Verify correct endpoints called
- Test response handling

### 6.2 Integration Tests

**Store + Service Integration:**
- Service calls → Store updates → Verify state
- Test complete workflows (create deliverable → appears in store)

**Component + Store Integration:**
- Component renders → Calls action → Store updates → UI updates
- Verify Vue reactivity works

### 6.3 End-to-End Tests

**Critical Workflows:**
1. Create conversation → Send message → View in UI
2. Create plan → Create deliverable from plan → View deliverable
3. Delete conversation → Deliverable preserved → View in deliverables list
4. Delete conversation + deliverable → Both deleted
5. Rerun deliverable with different LLM → New version created

### 6.4 Migration Tests

**Before Migration:**
- Document current state (screenshots, API calls, store state)
- Create test data in old system

**After Each Phase:**
- Verify test data still accessible
- Verify workflows still work
- Compare against documented state

**Final Verification:**
- All old code deleted
- All tests pass
- No console errors
- Performance equivalent or better

---

## 7. Risks & Mitigations

### 7.1 High Risk Items

**Store Consolidation (Conversations):**
- **Risk:** Breaking all conversation-related components
- **Mitigation:**
  - Phase incrementally (create new, migrate components one by one, delete old)
  - Comprehensive testing at each step
  - Keep old stores temporarily during migration

**Component Import Updates:**
- **Risk:** Missing some component imports, broken UI
- **Mitigation:**
  - Use grep/find to locate all imports
  - Update systematically (one file type at a time)
  - TypeScript will catch many errors

**Database Migration (Projects → Orchestrations):**
- **Risk:** Data loss, broken references
- **Mitigation:**
  - Full backup before migration
  - Test on staging/dev first
  - Verify minimal/zero project data exists before migration
  - Rollback plan prepared

### 7.2 Medium Risk Items

**Vue Reactivity Issues:**
- **Risk:** Store changes don't trigger UI updates
- **Mitigation:**
  - Use computed properties (not methods)
  - Test reactivity explicitly
  - Document patterns

**State Synchronization:**
- **Risk:** During migration, old and new stores out of sync
- **Mitigation:**
  - Short migration phases
  - Update both stores temporarily during transition
  - Delete old stores as soon as safe

### 7.3 Low Risk Items

**Service Deletion:**
- **Risk:** Missing some service reference
- **Mitigation:** TypeScript compilation will catch

**Documentation:**
- **Risk:** Docs get out of date
- **Mitigation:** Update docs as part of each PR

---

## 8. Timeline & Effort Estimate

**Total Effort:** 4-5 weeks (1 developer, full-time equivalent)

**Phase Breakdown:**
- Phase 1: Store Consolidation (1.5 weeks)
- Phase 2: Service Migration (1 week)
- Phase 3: Projects Cleanup (1 week)
- Phase 4: Store Method Migration (0.5 week)
- Phase 5: Testing & Documentation (1 week)

**Dependencies:**
- None external
- Phases can partially overlap with caution
- Testing should be continuous, not just Phase 5

---

## 9. Open Questions

1. **Q:** Should we rename `agentConversationsStore` → `conversationsStore` during consolidation?
   - **A:** Yes, simpler name better reflects purpose.

2. **Q:** What about existing data in projects tables?
   - **A:** Query database first. If zero records, just drop tables. If records exist, migrate.

3. **Q:** Keep `deliverablesService.ts` (REST API client)?
   - **A:** Yes, it serves different purpose than `build.actions.ts`. Actions = mode-based, service = direct CRUD.

4. **Q:** Handle in-flight conversations/deliverables during migration?
   - **A:** Migration is frontend-only (except projects). No disruption to existing data.

5. **Q:** Versioning strategy for breaking changes?
   - **A:** This is internal refactor, no API changes. No version bump needed.

---

## 10. Success Criteria (Final Checklist)

**Architecture:**
- ✅ 7 core domain stores (down from 10+)
- ✅ All stores < 400 lines
- ✅ Zero business logic in stores
- ✅ Single pattern for all modes (actions)
- ✅ Zero duplicate services

**Code Quality:**
- ✅ All TypeScript errors resolved
- ✅ All tests pass (100% pass rate)
- ✅ Zero console errors in production build
- ✅ No orphan files (deleted properly)

**Functionality:**
- ✅ All existing features work
- ✅ Conversation creation/deletion works
- ✅ Plan creation works
- ✅ Deliverable creation works
- ✅ Orchestrations work (projects removed)

**Documentation:**
- ✅ Architecture docs updated
- ✅ Store/service patterns documented
- ✅ Migration guide created (for future reference)
- ✅ Code comments added where needed

**Performance:**
- ✅ No performance regression
- ✅ Bundle size equivalent or smaller
- ✅ Load times equivalent or faster

---

## 11. Appendix

### 11.1 Reference Documents

- Store/Service Architecture Audit Report
- Domain Architecture Analysis
- UI Anti-Patterns Report
- Project-to-Orchestration Migration Audit

### 11.2 Key Files Affected

**Stores (Create/Modify/Delete):**
- Create: `conversationsStore.ts`, `chatUiStore.ts`
- Modify: `agentsStore.ts`, `deliverablesStore.ts`
- Delete: `conversationStore.ts`, `agentConversationsStore.ts`, `agentChatStore/`, `agentStore.ts`

**Services (Create/Delete):**
- Create: `converse.actions.ts`, `build.actions.ts`
- Delete: `agent-tasks/` (entire directory)

**Components (Update):**
- 12+ component files need import updates
- 3 project pages to delete
- Multiple deliverable/plan components to update

**Database (Modify):**
- deliverables table (column change)
- projects/project_steps tables (delete)

### 11.3 Glossary

- **Actions:** Orchestration functions that coordinate between stores, API, and handlers
- **Store:** Pinia store containing reactive state (Vue composition API)
- **Service:** Business logic layer that makes API calls and updates stores
- **Mode:** Agent execution mode (converse, plan, build, orchestrate)
- **Transport Types:** Shared TypeScript types defining backend API contracts
- **God Store:** Anti-pattern where one store contains too many responsibilities
- **Cascade Delete:** When deleting parent automatically deletes children
- **Standalone:** Entity not associated with a conversation (conversationId = null)

---

**END OF PRD**
