# Domain Architecture Analysis
## AI Agent Orchestration Platform

**Date**: 2025-10-17
**Purpose**: Analyze current store/service architecture and recommend domain-driven restructuring

---

## Executive Summary

The current frontend architecture suffers from **domain fragmentation** and **overlapping responsibilities** across stores and services. Multiple stores manage the same domain concepts (conversations, agents, plans, deliverables), leading to synchronization issues, data duplication, and unclear ownership.

**Key Findings**:
- 3+ stores managing conversation-related state (`conversationStore`, `agentConversationsStore`, `agentChatStore`)
- 2 stores managing agent data (`agentStore`, `agentsStore`)
- Plan/deliverable domain split across stores and duplicated in `agentChatStore`
- Task/orchestration domains properly separated but rarely used
- Services have better domain alignment than stores

**Recommended Action**: Consolidate to **5 core domain stores** aligned with backend transport types.

---

## 1. Current State Analysis

### 1.1 Store Inventory

#### **Core Domain Stores** (Fragmented)
| Store | Purpose | Lines | Domain Overlap |
|-------|---------|-------|----------------|
| `conversationStore.ts` | Pure conversation/message management | 234 | **Overlaps with agentConversationsStore, agentChatStore** |
| `agentConversationsStore.ts` | Agent-specific conversations with task counts | 287 | **Overlaps with conversationStore, agentChatStore** |
| `agentChatStore/` | Agent chat UI state + conversations + plans + deliverables | 422+ | **Massive overlap - includes everything** |
| `agentStore.ts` | Agent runtime state (capabilities, status) | 305 | **Overlaps with agentsStore** |
| `agentsStore.ts` | Agent catalog and hierarchy | 245 | **Overlaps with agentStore** |
| `deliverablesStore.ts` | Deliverable/build management | 917 | Clean - but duplicated in agentChatStore |
| `planStore.ts` | Plan management | 340 | Clean - but duplicated in agentChatStore |
| `taskStore.ts` | Task lifecycle management | 229 | **Underutilized** |
| `orchestratorStore.ts` | Orchestration workflow state | 377 | **Underutilized** |

#### **Infrastructure Stores** (Well-Organized)
| Store | Purpose | Lines | Status |
|-------|---------|-------|--------|
| `authStore.ts` | Authentication state | 625 | ✅ Good |
| `errorStore.ts` | Error handling | 350 | ✅ Good |
| `loadingStore.ts` | Loading state | 57 | ✅ Good |
| `uiStore.ts` | UI preferences | 58 | ✅ Good |
| `llmUsageStore.ts` | LLM usage tracking | 191 | ✅ Good |

#### **Special Purpose Stores** (Domain-Specific)
| Store | Purpose | Lines | Status |
|-------|---------|-------|--------|
| `analyticsStore.ts` | Analytics data | 704 | ✅ Good |
| `evaluationsStore.ts` | Agent evaluations | 109 | ✅ Good |
| `llmMonitoringStore.ts` | LLM performance monitoring | 639 | ✅ Good |
| `validationStore.ts` | Input validation | 418 | ✅ Good |
| `userPreferencesStore.ts` | User preferences | 479 | ✅ Good |

### 1.2 Service Inventory

#### **Domain Services** (Better Organized)
| Service | Purpose | Domain |
|---------|---------|--------|
| `agent2agent/` | Agent-to-agent communication protocol | Agent execution |
| `agent-tasks/` | Agent task execution services | Task execution |
| `agentConversationsService.ts` | Agent conversation CRUD | Conversations |
| `deliverablesService.ts` | Deliverable CRUD | Deliverables |
| `tasksService.ts` | Task CRUD | Tasks |
| `apiService.ts` | Central API client | Infrastructure |

**Services are better aligned** - they map to specific backend APIs and don't overlap as much as stores.

### 1.3 Critical Overlaps Identified

#### **🔴 Conversation Domain Confusion**
```
conversationStore          → Generic conversation/message store
agentConversationsStore    → Agent-specific conversations with metadata
agentChatStore             → UI state + conversations + messages + plans + deliverables
```

**Problem**: Three stores manage conversations, but only `agentConversationsStore` is actively used. The others create confusion and data sync issues.

#### **🔴 Agent Domain Split**
```
agentStore     → Runtime agent state (status, capabilities)
agentsStore    → Agent catalog and hierarchy
```

**Problem**: Conceptually these should be one store. `agentsStore` manages "what agents exist" while `agentStore` manages "what agents are doing". This split is artificial.

#### **🔴 Plan/Deliverable Duplication**
```
planStore           → Plans and versions
agentChatStore      → Contains latestPlan, currentPlan
deliverablesStore   → Deliverables and versions
agentChatStore      → Contains currentDeliverable
```

**Problem**: `agentChatStore` duplicates plan/deliverable state that already exists in domain stores.

---

## 2. Domain Model Map

### 2.1 Backend Domain Model (from Transport Types)

The backend uses a **clear 4-mode agent execution model**:

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT EXECUTION MODES                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CONVERSE    → Simple chat interaction                  │
│                   Output: Message                           │
│                                                             │
│  2. PLAN        → Create/manage plans                      │
│                   Output: Plan + PlanVersion               │
│                   Actions: create, read, list, edit,       │
│                           rerun, set_current, delete        │
│                                                             │
│  3. BUILD       → Create/manage deliverables               │
│                   Output: Deliverable + DeliverableVersion │
│                   Actions: create, read, list, edit,       │
│                           rerun, set_current, delete        │
│                                                             │
│  4. ORCHESTRATE → Coordinate multi-agent workflows         │
│                   Output: Orchestration + Run + Steps      │
│                   Actions: create, execute, plan_*, run_*, │
│                           recipe_*                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Domain Entities

Based on transport types, the **true domain entities** are:

#### **Conversation Domain**
```typescript
AgentConversation {
  id, userId, agentName, agentType,
  startedAt, endedAt, lastActiveAt,
  taskCount, completedTasks, failedTasks, activeTasks
  messages[]
}
```

#### **Agent Domain**
```typescript
Agent {
  id, name, type, namespace,
  configuration,
  capabilities: AgentCapability[]
  status: AgentStatus
  io_schema, plan_structure, deliverable_structure
}
```

#### **Plan Domain**
```typescript
Plan {
  id, conversationId, agentName, namespace, title
}
PlanVersion {
  id, planId, versionNumber, content, format,
  isCurrentVersion, taskId, metadata
}
```

#### **Deliverable Domain** (Build)
```typescript
Deliverable {
  id, conversationId, agentName, namespace, title, type
}
DeliverableVersion {
  id, deliverableId, versionNumber, content, format,
  isCurrentVersion, taskId, metadata
}
```

#### **Task Domain**
```typescript
Task {
  id, conversationId, mode, action, status,
  prompt, metadata
}
```

#### **Orchestration Domain**
```typescript
Orchestration {
  id, conversationId, type, status
}
OrchestrationRun {
  id, orchestrationId, status, steps[]
}
OrchestrationStep {
  id, runId, stepNumber, mode, action, status
}
```

### 2.3 Domain Relationships

```
User
 └─> AgentConversation (1:many)
      ├─> Messages (1:many)
      ├─> Tasks (1:many)
      │    └─> executes in mode: CONVERSE | PLAN | BUILD | ORCHESTRATE
      ├─> Plan (1:1) - created by PLAN mode
      │    └─> PlanVersions (1:many)
      └─> Deliverables (1:many) - created by BUILD mode
           └─> DeliverableVersions (1:many)

Agent
 ├─> AgentCapabilities (1:many)
 └─> AgentStatus (1:1)
```

**Key Insight**: The backend sees **Conversation** as the core aggregate root. Plans and Deliverables are created **within a conversation context** through agent tasks.

---

## 3. Misalignment Analysis

### 3.1 What's Wrong with Current Structure?

#### **Problem 1: Multiple Conversation Stores**
```
conversationStore          → Unused in practice
agentConversationsStore    → Actually used by UI
agentChatStore             → UI state bloated with domain data
```

**Impact**:
- Confusion about which store to use
- Data sync issues between stores
- Duplicate state management

**Root Cause**: `agentChatStore` started as UI state but grew into a "god store" that manages conversations, plans, deliverables, and UI state together.

#### **Problem 2: Agent Store Split**
```
agentStore     → Runtime state (unused in most components)
agentsStore    → Catalog (actively used)
```

**Impact**:
- Two stores for one domain concept
- `agentStore` provides detailed runtime tracking but is rarely used
- Most components only care about the agent catalog

**Root Cause**: Over-engineering. The system doesn't need real-time agent status tracking yet.

#### **Problem 3: agentChatStore as a "God Store"**
Current state of `agentChatStore`:
```typescript
AgentChatState {
  conversations: AgentConversation[]  // Should be in conversationStore
  activeConversationId: string        // UI state ✅
  globalError: string                 // Should be in errorStore
  pendingAction: PendingAction        // UI state ✅
  lastMessageWasSpeech: boolean       // UI state ✅
}

AgentConversation {
  messages: Message[]                 // Domain data (should be separate)
  currentPlan: Plan                   // Duplicates planStore
  latestPlan: Plan                    // Duplicates planStore
  currentDeliverable: Deliverable     // Duplicates deliverablesStore
  agent: Agent                        // Duplicates agentsStore
  chatMode: AgentChatMode            // UI state ✅
  isLoading: boolean                 // Should be in loadingStore
  error: string                      // Should be in errorStore
}
```

**Impact**:
- Massive store (422+ lines just for the store file, plus 7 supporting files)
- Tight coupling between UI and domain logic
- Difficult to test or reuse domain logic
- Changes ripple across multiple concerns

#### **Problem 4: Underutilized Domain Stores**
- `taskStore` exists but tasks are tracked in `agentConversationsStore.taskCount`
- `orchestratorStore` exists but orchestrations aren't used in UI yet
- `conversationStore` exists but `agentConversationsStore` is used instead

**Impact**: Dead code and unclear patterns for developers.

### 3.2 Naming Inconsistencies

| Current Name | Better Name | Reason |
|--------------|-------------|--------|
| `agentConversationsStore` | `conversationsStore` | It's THE conversation store, not just for agents |
| `agentsStore` | `agentCatalogStore` | Clarifies it's about available agents, not runtime |
| `agentChatStore` | `chatUiStore` | It should ONLY be UI state |
| `deliverablesStore` | `buildsStore` or keep `deliverablesStore` | Align with BUILD mode or keep business term |

---

## 4. Recommended Domain Architecture

### 4.1 Core Principle: Align with Backend Transport Types

**Rule**: Each agent execution mode gets its own domain store.

```
Transport Mode    →    Frontend Store
─────────────────────────────────────
CONVERSE         →    conversationsStore
PLAN             →    plansStore
BUILD            →    deliverablesStore
ORCHESTRATE      →    orchestrationsStore
(Supporting)     →    agentsStore
(Supporting)     →    tasksStore
```

### 4.2 Proposed Store Structure

#### **🎯 Core Domain Stores**

##### **1. conversationsStore** (consolidate 3 stores)
```typescript
// Replaces: conversationStore, agentConversationsStore, agentChatStore (domain part)
// Responsibility: Agent conversations and messages

State:
  conversations: Map<conversationId, AgentConversation>
  messages: Map<conversationId, Message[]>
  activeConversationId: string | null

Getters:
  - conversationById(id)
  - messagesByConversation(id)
  - activeConversation
  - conversationsByAgent(agentName)

Actions:
  - createConversation()
  - addMessage()
  - deleteConversation()
  - loadConversations()
```

**Rationale**: One conversation store with ALL conversation data. No duplication.

##### **2. agentsStore** (merge 2 stores)
```typescript
// Replaces: agentStore + agentsStore
// Responsibility: Agent catalog, capabilities, and hierarchy

State:
  agents: Map<agentId, Agent>
  agentHierarchy: HierarchyNode[]
  capabilities: Map<agentId, AgentCapability[]>

Getters:
  - agentById(id)
  - agentByName(name)
  - availableAgents
  - agentsByCapability(mode)

Actions:
  - loadAgents()
  - loadHierarchy()
  - updateAgent()
```

**Rationale**: Runtime agent status (busy/idle) is premature. Consolidate into one agent store focused on catalog.

##### **3. plansStore**
```typescript
// Keep existing planStore - it's well-designed
// Responsibility: Plan management (PLAN mode outputs)

State:
  plans: Map<planId, Plan>
  versions: Map<planId, PlanVersion[]>
  currentVersionId: Map<planId, versionId>
  conversationPlans: Map<conversationId, planId[]>

Actions:
  - addPlan()
  - addVersion()
  - loadPlansByConversation()
  - rerunWithDifferentLLM()
```

**Rationale**: Already well-structured. Matches PLAN mode transport types perfectly.

##### **4. deliverablesStore**
```typescript
// Keep existing deliverablesStore - it's well-designed
// Responsibility: Deliverable/build management (BUILD mode outputs)

State:
  deliverables: Map<deliverableId, Deliverable>
  versions: Map<deliverableId, DeliverableVersion[]>
  currentVersions: Map<deliverableId, version>
  conversationDeliverables: Map<conversationId, deliverableId[]>

Actions:
  - addDeliverable()
  - addVersion()
  - loadDeliverablesByConversation()
  - rerunWithDifferentLLM()
```

**Rationale**: Already well-structured. Matches BUILD mode transport types perfectly.

##### **5. orchestrationsStore**
```typescript
// Keep existing orchestratorStore
// Responsibility: Multi-agent workflow coordination (ORCHESTRATE mode)

State:
  orchestrations: Map<orchestrationId, Orchestration>
  runs: Map<runId, OrchestrationRun>
  steps: Map<runId, OrchestrationStep[]>

Actions:
  - startOrchestration()
  - executeRun()
  - pauseRun()
  - cancelRun()
```

**Rationale**: Orchestrations are underutilized but will be critical for multi-agent workflows.

#### **🎯 Support Domain Stores**

##### **6. tasksStore**
```typescript
// Keep existing taskStore
// Responsibility: Track agent task execution

State:
  tasks: Map<taskId, Task>
  tasksByConversation: Map<conversationId, taskId[]>

Actions:
  - createTask()
  - updateTaskStatus()
  - setTaskResult()
```

**Rationale**: Tasks are the execution units. This store should be more prominent.

#### **🎯 UI State Stores**

##### **7. chatUiStore** (replaces agentChatStore)
```typescript
// New: Pure UI state for chat interface
// NO domain data - only UI concerns

State:
  activeConversationId: string | null  // Current tab
  pendingAction: PendingAction | null  // Pending plan/build
  lastMessageWasSpeech: boolean        // Speech mode flag
  chatModeByConversation: Map<conversationId, AgentChatMode>

Actions:
  - setActiveConversation()
  - setPendingAction()
  - setChatMode()
```

**Rationale**: Separate UI concerns from domain data completely.

### 4.3 Store Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                      UI STORES                          │
│  chatUiStore, loadingStore, errorStore, uiStore        │
└────────────┬────────────────────────────────────────────┘
             │ reads from ↓
┌────────────┴────────────────────────────────────────────┐
│                   CORE DOMAIN STORES                    │
│                                                          │
│  ┌─────────────────────┐     ┌─────────────────────┐  │
│  │ conversationsStore  │────→│   agentsStore       │  │
│  │  (conversations +   │     │ (agent catalog)     │  │
│  │   messages)         │     └─────────────────────┘  │
│  └──────────┬──────────┘                               │
│             │                                           │
│             │ creates ↓                                 │
│  ┌──────────┴──────────┐     ┌─────────────────────┐  │
│  │    plansStore       │     │ deliverablesStore   │  │
│  │  (plans + versions) │     │ (builds + versions) │  │
│  └─────────────────────┘     └─────────────────────┘  │
│             │                           │               │
│             └───────────┬───────────────┘               │
│                         │ orchestrated by ↓            │
│              ┌──────────┴──────────────┐               │
│              │  orchestrationsStore    │               │
│              │  (workflows + runs)     │               │
│              └─────────────────────────┘               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │              tasksStore                         │  │
│  │  (tracks all task executions)                   │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Key Principles**:
1. UI stores read from domain stores (never write domain data)
2. Domain stores are independent (loose coupling)
3. Task store tracks execution across all modes
4. Conversation is the aggregate root

---

## 5. Migration Strategy

### 5.1 Phase 1: Extract UI State from agentChatStore
**Goal**: Separate UI concerns from domain data

**Steps**:
1. Create `chatUiStore` with only UI state
2. Move these from `agentChatStore` to `chatUiStore`:
   - `activeConversationId`
   - `pendingAction`
   - `lastMessageWasSpeech`
   - `chatMode` per conversation
3. Update components to use both stores
4. Test thoroughly

**Risk**: Low - just moving state, not changing logic

### 5.2 Phase 2: Consolidate Conversation Stores
**Goal**: One source of truth for conversations

**Steps**:
1. Keep `agentConversationsStore` as the primary store
2. Rename to `conversationsStore`
3. Delete unused `conversationStore`
4. Move conversation data from `agentChatStore` to `conversationsStore`
5. Update all components

**Risk**: Medium - affects many components

### 5.3 Phase 3: Merge Agent Stores
**Goal**: Simplify agent management

**Steps**:
1. Merge `agentStore` runtime capabilities into `agentsStore`
2. Remove unused status tracking (idle/busy)
3. Rename `agentsStore` → `agentsStore` (keep name)
4. Update components

**Risk**: Low - `agentStore` is barely used

### 5.4 Phase 4: Remove Plan/Deliverable Duplication
**Goal**: Eliminate duplicate state in agentChatStore

**Steps**:
1. Remove `currentPlan`, `latestPlan` from `agentChatStore`
2. Components read plans from `plansStore.plansByConversationId()`
3. Remove `currentDeliverable` from `agentChatStore`
4. Components read deliverables from `deliverablesStore.getDeliverablesByConversation()`
5. Test all plan/deliverable UI

**Risk**: High - requires careful refactoring of components

### 5.5 Phase 5: Delete agentChatStore
**Goal**: Complete separation of concerns

**Steps**:
1. Verify all domain data moved to proper stores
2. Verify all UI state moved to `chatUiStore`
3. Update all components to use new stores
4. Delete `agentChatStore/` directory
5. Remove from store index

**Risk**: High - requires comprehensive testing

### 5.6 Migration Priority

```
Priority 1 (High Impact, Low Risk):
  ✅ Phase 1: Extract UI state (1-2 days)
  ✅ Phase 3: Merge agent stores (1 day)

Priority 2 (High Impact, Medium Risk):
  ⚠️ Phase 2: Consolidate conversations (2-3 days)

Priority 3 (High Impact, High Risk):
  🔴 Phase 4: Remove duplication (3-5 days)
  🔴 Phase 5: Delete agentChatStore (2-3 days)
```

**Total Estimated Time**: 2-3 weeks with testing

---

## 6. Service Recommendations

### 6.1 Keep Service Structure (It's Good!)

The service layer is **already well-aligned** with domain boundaries:

```
✅ agent2agent/          → Agent protocol services
✅ agent-tasks/          → Task execution services
✅ deliverablesService   → Deliverable CRUD
✅ tasksService          → Task CRUD
✅ agentConversationsService → Conversation CRUD
✅ apiService            → Central HTTP client
```

**No changes needed** to services. The problem is in the store layer.

### 6.2 Add Service Layer for Plans

**Missing**: Dedicated plan service

```typescript
// Create: services/plansService.ts
export const plansService = {
  getPlansByConversation(conversationId: string): Promise<Plan[]>
  createPlan(conversationId: string, data: CreatePlanDto): Promise<Plan>
  updatePlanVersion(planId: string, data: UpdateVersionDto): Promise<PlanVersion>
  rerunPlan(versionId: string, llmConfig: LLMConfig): Promise<PlanVersion>
  deletePlan(planId: string): Promise<void>
}
```

**Rationale**: Currently plan operations are scattered. Centralize in one service.

---

## 7. Benefits of Recommended Architecture

### 7.1 Clarity
- **One store per domain** - no confusion about where to put data
- **Clear responsibilities** - each store has a single purpose
- **Naming matches backend** - PLAN → plansStore, BUILD → deliverablesStore

### 7.2 Maintainability
- **Smaller stores** - easier to understand and modify
- **Loose coupling** - changes in one store don't break others
- **Testability** - each store can be tested independently

### 7.3 Scalability
- **Add new features easily** - new modes map to new stores
- **No god stores** - avoid the bloat that killed agentChatStore
- **Performance** - smaller stores are more efficient

### 7.4 Developer Experience
- **Predictable patterns** - developers know where to look
- **Less cognitive load** - no need to understand massive stores
- **Better TypeScript** - smaller types are easier to work with

---

## 8. Implementation Guidelines

### 8.1 Store Design Principles

**DO**:
- ✅ One store per domain concept
- ✅ Keep stores focused (< 400 lines)
- ✅ Use Maps for O(1) lookups
- ✅ Expose read-only state
- ✅ Actions are the only way to mutate state
- ✅ Name actions as commands: `createX()`, `updateX()`, `deleteX()`

**DON'T**:
- ❌ Put UI state in domain stores
- ❌ Duplicate data across stores
- ❌ Make stores depend on each other
- ❌ Put business logic in stores (move to services)
- ❌ Create "god stores" that do everything

### 8.2 Component Guidelines

**DO**:
- ✅ Use multiple stores in components
- ✅ Read from domain stores, write through actions
- ✅ Keep component logic simple
- ✅ Use computed properties for derived data

**DON'T**:
- ❌ Cache store data in component state
- ❌ Modify store data directly
- ❌ Put domain logic in components

### 8.3 Testing Strategy

**Unit Tests**:
- Test each store independently
- Mock services, not stores
- Test all actions and getters

**Integration Tests**:
- Test store interactions through components
- Test data flow: user action → service → store → UI update

---

## 9. Open Questions

1. **Should tasks be more prominent?**
   - Current: Tasks tracked but not prominently displayed
   - Proposal: Make task store central, show task progress in UI

2. **How to handle optimistic updates?**
   - Current: Some stores update optimistically, others don't
   - Proposal: Standardize pattern across all stores

3. **What about caching strategies?**
   - Current: Some stores cache, some always fetch
   - Proposal: Define cache invalidation strategy

4. **Should we keep agentConversationsStore name or rename?**
   - Current: `agentConversationsStore`
   - Proposal A: Rename to `conversationsStore`
   - Proposal B: Keep existing name

---

## 10. Conclusion

The current store architecture suffers from **domain fragmentation** and **overlapping responsibilities**. By consolidating to **5 core domain stores** aligned with backend transport types, we achieve:

1. **Clear domain boundaries** - one store per execution mode
2. **No duplication** - single source of truth for each domain
3. **Better maintainability** - smaller, focused stores
4. **Scalability** - easy to add new features

**Recommended Action**: Execute migration in phases, starting with low-risk UI state extraction, followed by careful consolidation of domain stores.

**Success Metrics**:
- Reduce store count from 10+ domain stores to 6 core stores
- Eliminate duplicate state management
- Improve component clarity by 50% (fewer store imports)
- Reduce bug count related to state synchronization

---

## Appendix A: Store Comparison Table

| Current Store | Lines | Responsibility | Keep/Merge/Delete |
|---------------|-------|----------------|-------------------|
| conversationStore | 234 | Generic conversations | ❌ DELETE (unused) |
| agentConversationsStore | 287 | Agent conversations | ✅ KEEP (rename) |
| agentChatStore | 422+ | Everything | ❌ DELETE (split) |
| agentStore | 305 | Agent runtime | 🔄 MERGE → agentsStore |
| agentsStore | 245 | Agent catalog | ✅ KEEP |
| deliverablesStore | 917 | Deliverable mgmt | ✅ KEEP |
| planStore | 340 | Plan management | ✅ KEEP |
| taskStore | 229 | Task lifecycle | ✅ KEEP |
| orchestratorStore | 377 | Orchestrations | ✅ KEEP |
| authStore | 625 | Authentication | ✅ KEEP |
| errorStore | 350 | Error handling | ✅ KEEP |
| loadingStore | 57 | Loading state | ✅ KEEP |
| uiStore | 58 | UI preferences | ✅ KEEP |

## Appendix B: Recommended File Structure

```
stores/
├── domains/
│   ├── conversations/
│   │   ├── conversationsStore.ts       (merged from 3 stores)
│   │   └── types.ts
│   ├── agents/
│   │   ├── agentsStore.ts              (merged from 2 stores)
│   │   └── types.ts
│   ├── plans/
│   │   ├── plansStore.ts
│   │   └── types.ts
│   ├── deliverables/
│   │   ├── deliverablesStore.ts
│   │   └── types.ts
│   ├── orchestrations/
│   │   ├── orchestrationsStore.ts
│   │   └── types.ts
│   └── tasks/
│       ├── tasksStore.ts
│       └── types.ts
├── ui/
│   ├── chatUiStore.ts                  (extracted from agentChatStore)
│   ├── loadingStore.ts
│   ├── errorStore.ts
│   └── uiStore.ts
├── infrastructure/
│   ├── authStore.ts
│   ├── apiConfigStore.ts
│   └── userPreferencesStore.ts
└── index.ts
```

---

**End of Analysis**
