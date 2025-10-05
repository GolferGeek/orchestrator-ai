# Plan-1.5: Plan & Build Mode Frontend Refactor

**Version**: 1.5
**Date**: 2025-10-05
**Status**: Active
**Related PRD**: [plan-build-frontend-refactor-prd.md](./plan-build-frontend-refactor-prd.md)

## Overview

Refactor frontend to align with backend Mode × Action architecture. Implement Plan mode first (9 actions), prove the pattern works, then copy exact pattern to Build mode (10 actions).

**Key Principle**: User Action → Store Method → API Service → HTTP Request → Backend Response → Store Update → UI Reaction

## Phase 0: Foundation & API Client

**Goal**: Fix the API client to call the real backend endpoint with correct URL and request structure.

**Status**: 🔴 Not Started

### Tasks

#### 0.1: Update Agent2AgentApi Constructor

**File**: `/apps/web/src/services/agent2agent/api/agent2agent.api.ts`

**Current Code**:
```typescript
export class Agent2AgentApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/agent2agent';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }
}
```

**Target Code**:
```typescript
import { useAuthStore } from '@/stores/authStore';

export class Agent2AgentApi {
  private baseUrl: string;
  private headers: Record<string, string>;
  private authStore: any;
  private agentSlug: string;

  constructor(agentSlug: string, config: ApiConfig = {}) {
    this.agentSlug = agentSlug;
    this.authStore = useAuthStore();
    this.baseUrl = config.baseUrl || '';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * Get organization slug from auth store (single source of truth)
   */
  private getOrgSlug(): string {
    return this.authStore.currentNamespace || 'global';
  }
}
```

**Acceptance Criteria**:
- ✅ Constructor takes `agentSlug` as first parameter
- ✅ Constructor imports and stores authStore reference
- ✅ Helper method `getOrgSlug()` returns `authStore.currentNamespace`

---

#### 0.2: Fix executeAction() Method

**File**: `/apps/web/src/services/agent2agent/api/agent2agent.api.ts`

**Current Code**:
```typescript
private async executeAction<T = any>(
  mode: TaskMode,
  request: any,
): Promise<T> {
  const endpoint = `${this.baseUrl}/execute`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        mode,
        action: request.action,
        conversationId: request.conversationId,
        params: request.params || {},
      }),
    });
    // ... rest
  }
}
```

**Target Code**:
```typescript
private async executeAction<T = any>(
  mode: TaskMode,
  request: any,
): Promise<T> {
  const org = this.getOrgSlug();
  const endpoint = `/agent-to-agent/${org}/${this.agentSlug}/tasks`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        mode,
        action: request.action,
        conversationId: request.conversationId,
        ...request.params,  // Flatten params into body
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `API request failed: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Agent2Agent API error (${mode}/${request.action}):`, error);
    throw error;
  }
}
```

**Acceptance Criteria**:
- ✅ URL is `/agent-to-agent/{org}/{agent}/tasks`
- ✅ Org comes from `getOrgSlug()`
- ✅ Agent comes from `this.agentSlug`
- ✅ Request body has `{mode, action, conversationId, ...actionParams}` (params flattened)
- ✅ Error handling remains intact

---

#### 0.3: Update Plan Convenience Methods

**File**: `/apps/web/src/services/agent2agent/api/agent2agent.api.ts`

**Current Code** (create example):
```typescript
plans = {
  create: async (conversationId: string, title: string, content: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'create',
      conversationId,
      params: { title, content },
    });
  },
  // ...
}
```

**Target Code**:
```typescript
plans = {
  create: async (conversationId: string, title: string, content: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'create',
      conversationId,
      params: {
        message: content,  // Backend expects 'message' not 'title' + 'content'
        forceNew: false,
      },
    });
  },

  read: async (conversationId: string, versionId?: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'read',
      conversationId,
      params: versionId ? { versionId } : {},
    });
  },

  list: async (conversationId: string, limit?: number, offset?: number) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'list',
      conversationId,
      params: { limit, offset },
    });
  },

  edit: async (conversationId: string, content: string, editNotes?: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'edit',
      conversationId,
      params: {
        editedContent: content,
        editNotes,
      },
    });
  },

  setCurrent: async (conversationId: string, versionId: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'set_current',
      conversationId,
      params: { versionId },
    });
  },

  deleteVersion: async (conversationId: string, versionId: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'delete_version',
      conversationId,
      params: { versionId },
    });
  },

  mergeVersions: async (
    conversationId: string,
    versionIds: string[],
    mergePrompt: string,
    llmConfig?: { model?: string; temperature?: number }
  ) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'merge_versions',
      conversationId,
      params: {
        versionIds,
        mergePrompt,
        llmConfig,
      },
    });
  },

  copyVersion: async (conversationId: string, versionId: string, setCurrent?: boolean) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'copy_version',
      conversationId,
      params: { versionId, setCurrent },
    });
  },

  delete: async (conversationId: string) => {
    return this.executePlanAction({
      mode: TaskMode.PLAN,
      action: 'delete',
      conversationId,
      params: { confirm: true },
    });
  },
}
```

**Acceptance Criteria**:
- ✅ All 9 plan actions match backend API contract
- ✅ Parameter names match backend expectations (e.g., `message` not `title+content`)
- ✅ Optional parameters handled correctly

---

#### 0.4: Update Build Convenience Methods

**File**: `/apps/web/src/services/agent2agent/api/agent2agent.api.ts`

**Target Code**:
```typescript
deliverables = {
  create: async (conversationId: string, title: string, content: string) => {
    return this.executeDeliverableAction({
      mode: TaskMode.BUILD,
      action: 'create',
      conversationId,
      params: {
        message: content,
        forceNew: false,
      },
    });
  },

  // read, list, edit, setCurrent, deleteVersion - IDENTICAL to plans
  // (just change mode to TaskMode.BUILD)

  // UNIQUE TO BUILD:
  rerun: async (
    conversationId: string,
    sourceVersionId?: string,
    rerunConfig?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    message?: string
  ) => {
    return this.executeDeliverableAction({
      mode: TaskMode.BUILD,
      action: 'rerun',
      conversationId,
      params: {
        sourceVersionId,
        rerunConfig,
        message,
      },
    });
  },

  // mergeVersions, copyVersion, delete - IDENTICAL to plans
}
```

**Acceptance Criteria**:
- ✅ All 10 build actions match backend API contract
- ✅ 9 actions identical to plan (just mode changed)
- ✅ `rerun` action unique to build

---

#### 0.5: Create API Client Instance Factory

**File**: `/apps/web/src/services/agent2agent/index.ts`

**Current Code**:
```typescript
export * from './api';
export * from './types';
```

**Target Code**:
```typescript
export * from './api';
export * from './types';

import { Agent2AgentApi } from './api/agent2agent.api';

/**
 * Create an API client for a specific agent
 * @param agentSlug - The agent's slug (e.g., 'blog_post_writer')
 * @returns Agent2AgentApi instance configured for that agent
 */
export function createAgent2AgentApi(agentSlug: string): Agent2AgentApi {
  return new Agent2AgentApi(agentSlug);
}

// Legacy exports for backward compatibility
export { createAgent2AgentApi as createPlanApi };
export { createAgent2AgentApi as createBuildApi };
```

**Acceptance Criteria**:
- ✅ Factory function takes agentSlug
- ✅ Returns configured API client
- ✅ Can be used from stores

---

### Phase 0 Verification

**Test Script**:
```typescript
// In browser console or test file:
import { createAgent2AgentApi } from '@/services/agent2agent';

const api = createAgent2AgentApi('blog_post_writer');

// Should call: POST /agent-to-agent/my-org/blog_post_writer/tasks
// Body: { mode: 'plan', action: 'create', conversationId: 'conv-123', message: 'test' }
await api.plans.create('conv-123', 'test', 'test content');
```

**Expected**:
- ✅ Network tab shows POST to `/agent-to-agent/my-org/blog_post_writer/tasks`
- ✅ Request body has `{mode: 'plan', action: 'create', conversationId, message}`
- ✅ Response has `{taskId, status, result}`

---

## Phase 1: Plan Service Integration

**Goal**: Wire the Plans service to use the fixed API client.

**Status**: 🔴 Not Started

### Tasks

#### 1.1: Update PlansService to Use API Client

**File**: `/apps/web/src/stores/agentChatStore/plans.ts`

**Current Code**:
```typescript
export class PlansService {
  async createPlan(
    conversationId: string,
    title: string,
    content: string,
  ): Promise<{ plan: Plan; version: PlanVersion; isNew: boolean } | null> {
    try {
      const response = await planApi.create(conversationId, title, content);
      // ...
    }
  }
}
```

**Target Code**:
```typescript
import { createAgent2AgentApi } from '@/services/agent2agent';
import type { Plan, PlanVersion } from '@/services/agent2agent/types';

export class PlansService {
  private api: Agent2AgentApi;

  constructor(agentSlug: string) {
    this.api = createAgent2AgentApi(agentSlug);
  }

  async createPlan(
    conversationId: string,
    title: string,
    content: string,
  ): Promise<{ plan: Plan; version: PlanVersion; isNew: boolean } | null> {
    try {
      const response = await this.api.plans.create(conversationId, title, content);

      if (response.status === 'completed' && response.result) {
        return {
          plan: response.result.plan,
          version: response.result.version,
          isNew: response.result.isNew || false,
        };
      }

      console.error('Failed to create plan:', response.error);
      return null;
    } catch (error) {
      console.error('Error creating plan:', error);
      return null;
    }
  }

  // Update all other methods similarly
}

// Export singleton factory
export function createPlansService(agentSlug: string): PlansService {
  return new PlansService(agentSlug);
}
```

**Acceptance Criteria**:
- ✅ PlansService takes agentSlug in constructor
- ✅ Uses createAgent2AgentApi() to get API client
- ✅ All methods updated to use this.api.plans.*
- ✅ Response structure matches backend contract

---

#### 1.2: Update Store to Use Plans Service

**File**: `/apps/web/src/stores/agentChatStore/store.ts`

**Current Code**:
```typescript
import { plans } from './plans';

// In executeFromLastUserMessage:
const result = await plans.createPlan(conversationId, basePrompt, basePrompt);
```

**Target Code**:
```typescript
import { createPlansService } from './plans';

// In store definition:
const plansService = computed(() => {
  const activeConv = getActiveConversation();
  if (!activeConv) return null;
  return createPlansService(activeConv.agent.name);
});

// In executeFromLastUserMessage:
const service = plansService.value;
if (!service) {
  throw new Error('No plans service available');
}

const result = await service.createPlan(conversationId, basePrompt, basePrompt);
if (result) {
  activeConversation.currentPlan = result.plan;
}
```

**Acceptance Criteria**:
- ✅ Plans service created with agent slug from active conversation
- ✅ Service updates reactively when conversation changes
- ✅ All plan operations use the service

---

### Phase 1 Verification

**Manual Test**:
1. Open chat with blog_post_writer agent
2. Type "write about golf"
3. Click "Plan It" button
4. Verify:
   - ✅ Network request to `/agent-to-agent/my-org/blog_post_writer/tasks`
   - ✅ Request has `{mode: 'plan', action: 'create'}`
   - ✅ Plan appears in UI with version v1
   - ✅ Edit button appears

---

## Phase 2: Plan Actions Integration

**Goal**: Wire all 9 plan actions end-to-end.

**Status**: 🔴 Not Started

### Tasks

#### 2.1: Test CREATE Action

**User Flow**:
1. User types message
2. User clicks "Plan It"
3. Plan created with v1

**Files**:
- UI: `/apps/web/src/components/AgentTaskItem.vue` (Plan It button)
- Store: `/apps/web/src/stores/agentChatStore/store.ts` (executeFromLastUserMessage)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (createPlan)
- API: `/apps/web/src/services/agent2agent/api/agent2agent.api.ts` (plans.create)

**Acceptance**: Plan appears with v1, edit button shows

---

#### 2.2: Test READ Action

**User Flow**:
1. User opens conversation that has existing plan
2. Plan loads automatically

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (loadCurrentPlan)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (readPlan)

**Acceptance**: Existing plan loads on conversation open

---

#### 2.3: Test LIST Action

**User Flow**:
1. User clicks version dropdown
2. All versions listed

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (loadPlanVersions)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (listPlanVersions)

**Acceptance**: Version dropdown shows all versions

---

#### 2.4: Test EDIT Action

**User Flow**:
1. User edits plan markdown
2. User clicks "Save"
3. New version created

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (editPlan)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (editPlan)

**Acceptance**: Version v2 created, marked as current

---

#### 2.5: Test SET_CURRENT Action

**User Flow**:
1. User selects v1 from dropdown
2. Content switches to v1

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (setCurrentPlanVersion)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (setCurrentVersion)

**Acceptance**: Content updates, dropdown shows v1 as current

---

#### 2.6: Test DELETE_VERSION Action

**User Flow**:
1. User clicks "Delete" on v1
2. Confirms
3. Version deleted

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (deletePlanVersion)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (deleteVersion)

**Acceptance**: Version removed from list

---

#### 2.7: Test MERGE_VERSIONS Action

**User Flow**:
1. User selects v1 + v2
2. Enters "combine best ideas"
3. Clicks "Merge"
4. v3 created

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (mergePlanVersions)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (mergeVersions)

**Acceptance**: v3 created with merged content

---

#### 2.8: Test COPY_VERSION Action

**User Flow**:
1. User clicks "Duplicate" on v1
2. v4 created

**Files**:
- Store: `/apps/web/src/stores/agentChatStore/planActions.ts` (copyPlanVersion)
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (copyVersion)

**Acceptance**: v4 created, identical to v1

---

#### 2.9: Test DELETE Action

**User Flow**:
1. User clicks "Delete Plan"
2. Confirms
3. Entire plan deleted

**Files**:
- Service: `/apps/web/src/stores/agentChatStore/plans.ts` (deletePlan)

**Acceptance**: Plan removed, UI shows "no plan"

---

### Phase 2 Verification

**Checklist**:
- ✅ All 9 actions tested manually
- ✅ Network requests all go to correct endpoint
- ✅ All requests have correct `{mode, action}` structure
- ✅ Store updates reactively
- ✅ UI updates automatically

---

## Phase 3: Build Service (Copy Pattern)

**Goal**: Create Build service and actions by copying Plan pattern exactly.

**Status**: 🔴 Not Started

### Tasks

#### 3.1: Create BuildsService

**File**: `/apps/web/src/stores/agentChatStore/builds.ts` (NEW)

**Instructions**:
1. Copy entire `plans.ts` file
2. Rename class: `PlansService` → `BuildsService`
3. Rename all methods: `createPlan` → `createDeliverable`, etc.
4. Change all API calls: `this.api.plans.*` → `this.api.deliverables.*`
5. Add `rerun()` method unique to Build

**Target Code** (partial):
```typescript
import { createAgent2AgentApi } from '@/services/agent2agent';
import type { Deliverable, DeliverableVersion } from '@/services/agent2agent/types';

export class BuildsService {
  private api: Agent2AgentApi;

  constructor(agentSlug: string) {
    this.api = createAgent2AgentApi(agentSlug);
  }

  async createDeliverable(
    conversationId: string,
    title: string,
    content: string,
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion; isNew: boolean } | null> {
    try {
      const response = await this.api.deliverables.create(conversationId, title, content);

      if (response.status === 'completed' && response.result) {
        return {
          deliverable: response.result.deliverable,
          version: response.result.version,
          isNew: response.result.isNew || false,
        };
      }

      console.error('Failed to create deliverable:', response.error);
      return null;
    } catch (error) {
      console.error('Error creating deliverable:', error);
      return null;
    }
  }

  // Copy all other methods from PlansService (9 methods)

  // UNIQUE TO BUILD:
  async rerunDeliverable(
    conversationId: string,
    sourceVersionId?: string,
    rerunConfig?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    message?: string
  ): Promise<{ deliverable: Deliverable; version: DeliverableVersion } | null> {
    try {
      const response = await this.api.deliverables.rerun(
        conversationId,
        sourceVersionId,
        rerunConfig,
        message
      );

      if (response.status === 'completed' && response.result) {
        return {
          deliverable: response.result.deliverable,
          version: response.result.version,
        };
      }

      console.error('Failed to rerun deliverable:', response.error);
      return null;
    } catch (error) {
      console.error('Error rerunning deliverable:', error);
      return null;
    }
  }
}

export function createBuildsService(agentSlug: string): BuildsService {
  return new BuildsService(agentSlug);
}
```

**Acceptance**:
- ✅ File mirrors plans.ts structure exactly
- ✅ All 9 shared methods copied
- ✅ 1 unique method (rerun) added
- ✅ Total 10 methods

---

#### 3.2: Create buildActions

**File**: `/apps/web/src/stores/agentChatStore/buildActions.ts` (NEW)

**Instructions**:
1. Copy entire `planActions.ts` file
2. Rename all: `Plan` → `Deliverable`
3. Change properties: `currentPlan` → `currentDeliverable`
4. Change service calls: `plans.*` → `builds.*`
5. Add `rerunDeliverable` action

**Target Code** (partial):
```typescript
import type { AgentConversation } from './types';
import { builds } from './builds';

export const buildActions = {
  /**
   * Load current deliverable for active conversation
   */
  async loadCurrentDeliverable(this: any) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const result = await builds.readDeliverable(conversation.id);

    if (result) {
      conversation.currentDeliverable = result;
    }
  },

  // Copy all methods from planActions (9 methods)

  /**
   * Rerun deliverable with different LLM (unique to Build)
   */
  async rerunDeliverable(
    this: any,
    sourceVersionId?: string,
    rerunConfig?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    message?: string
  ) {
    const conversation = this.conversations.find(
      (c: AgentConversation) => c.id === this.activeConversationId,
    );
    if (!conversation) return;

    const result = await builds.rerunDeliverable(
      conversation.id,
      sourceVersionId,
      rerunConfig,
      message
    );

    if (result) {
      conversation.currentDeliverable = result.deliverable;
      // Reload versions to show new rerun version
      await this.loadDeliverableVersions();
    }
  },
};
```

**Acceptance**:
- ✅ File mirrors planActions.ts exactly
- ✅ All property names updated
- ✅ All service calls updated
- ✅ Rerun action added

---

#### 3.3: Integrate Build Actions into Store

**File**: `/apps/web/src/stores/agentChatStore/store.ts`

**Changes**:
```typescript
import { planActions } from './planActions';
import { buildActions } from './buildActions';  // NEW
import { createPlansService } from './plans';
import { createBuildsService } from './builds';  // NEW

// Create computed services
const plansService = computed(() => {
  const activeConv = getActiveConversation();
  if (!activeConv) return null;
  return createPlansService(activeConv.agent.name);
});

const buildsService = computed(() => {  // NEW
  const activeConv = getActiveConversation();
  if (!activeConv) return null;
  return createBuildsService(activeConv.agent.name);
});

export const useAgentChatStore = defineStore('agentChat', {
  actions: {
    ...planActions,
    ...buildActions,  // NEW
    // ... other actions
  }
});
```

**Acceptance**:
- ✅ buildActions imported and spread
- ✅ buildsService computed property created
- ✅ Both services reactive to conversation changes

---

### Phase 3 Verification

**Manual Test** (mirror of Phase 2):
1. Open chat with blog_post_writer
2. Type "write blog about golf"
3. Click "Build It" button
4. Verify:
   - ✅ Deliverable created with v1
   - ✅ Network: POST `/agent-to-agent/my-org/blog_post_writer/tasks`
   - ✅ Body: `{mode: 'build', action: 'create'}`
5. Click "Edit", save → v2 created
6. Click "Rerun with GPT-4" → v3 created
7. Test all 10 actions same as Phase 2

---

## Phase 4: Cleanup Legacy Code

**Goal**: Remove old orchestration code now that Plan and Build work.

**Status**: 🔴 Not Started

### Tasks

#### 4.1: Remove Old Orchestration Methods

**File**: `/apps/web/src/stores/agentChatStore/store.ts`

**Remove**:
- `createOrchestrationDraft()`
- `executeOrchestrationRun()`
- `continueOrchestrationRun()`
- `saveOrchestrationRecipe()`

**Acceptance**:
- ✅ Methods removed
- ✅ No references to these methods remain
- ✅ Tests still pass

---

#### 4.2: Remove Legacy agentExecutionService

**File**: `/apps/web/src/services/agentExecutionService.ts`

**Current**: Has fallback URL logic, primary + fallback endpoints

**Action**: Delete entire file (no longer needed)

**Update imports**: Replace any remaining imports with direct API client usage

**Acceptance**:
- ✅ File deleted
- ✅ All imports updated
- ✅ No build errors

---

#### 4.3: Remove Org Lookups from Conversations

**File**: `/apps/web/src/stores/agentChatStore/store.ts`

**Remove** any code that tries to read organization_slug from:
- Conversation properties
- Agent properties
- Backend conversation API

**Reason**: We ONLY use `authStore.currentNamespace` now

**Acceptance**:
- ✅ No org lookups from conversations
- ✅ All routing uses authStore only

---

### Phase 4 Verification

**Code Check**:
```bash
# Should return 0 results:
grep -r "createOrchestrationDraft" apps/web/src
grep -r "executeOrchestrationRun" apps/web/src
grep -r "agentExecutionService" apps/web/src
grep -r "organization_slug.*conversation" apps/web/src
```

---

## Phase 5: Documentation & Testing

**Goal**: Document the pattern and create comprehensive tests.

**Status**: 🔴 Not Started

### Tasks

#### 5.1: Document the Pattern

**File**: `/docs/architecture/frontend-mode-action-pattern.md` (NEW)

**Contents**:
- User Action → Store → Service → API → Backend flow
- How to add a new mode (copy pattern)
- How to add a new action to existing mode
- Examples from Plan and Build

---

#### 5.2: Create Test Matrix

**File**: `/apps/web/src/__tests__/mode-action.spec.ts` (NEW)

**Tests**:
- Plan: All 9 actions
- Build: All 10 actions
- Verify request structure
- Verify response handling
- Verify store updates
- Verify UI reactions

---

## Success Criteria

### Phase 0 (API Client)
- ✅ API client calls `/agent-to-agent/{org}/{agent}/tasks`
- ✅ Org from `authStore.currentNamespace` only
- ✅ Request: `{mode, action, ...params}`
- ✅ All 9+10 convenience methods updated

### Phase 1 (Plan Service)
- ✅ Plans service uses API client
- ✅ All 9 plan methods work

### Phase 2 (Plan Actions)
- ✅ All 9 plan actions tested end-to-end
- ✅ UI updates reactively

### Phase 3 (Build)
- ✅ builds.ts mirrors plans.ts exactly
- ✅ buildActions.ts mirrors planActions.ts exactly
- ✅ All 10 build actions work

### Phase 4 (Cleanup)
- ✅ 0 references to old orchestration code
- ✅ 0 org lookups from conversations

### Phase 5 (Docs)
- ✅ Pattern documented
- ✅ Tests created

## Progress Tracking

| Phase | Status | Completed | Notes |
|-------|--------|-----------|-------|
| 0 - API Client | 🔴 Not Started | - | Fix executeAction URL |
| 1 - Plan Service | 🔴 Not Started | - | Wire to API client |
| 2 - Plan Actions | 🔴 Not Started | - | Test all 9 actions |
| 3 - Build | 🔴 Not Started | - | Copy Plan pattern |
| 4 - Cleanup | 🔴 Not Started | - | Remove legacy |
| 5 - Docs | 🔴 Not Started | - | Document pattern |

## Next Steps

**Immediate**:
1. Start Phase 0, Task 0.1: Update Agent2AgentApi constructor
2. Complete Phase 0 in sequence
3. Verify Phase 0 with test script

**After Phase 0**:
- Move to Phase 1 once API client is proven
- Don't start Phase 3 until Phase 2 is 100% complete
- Phase 4 cleanup only after Phases 1-3 proven stable

## Related Files

**To Create**:
- `/apps/web/src/stores/agentChatStore/builds.ts`
- `/apps/web/src/stores/agentChatStore/buildActions.ts`
- `/docs/architecture/frontend-mode-action-pattern.md`
- `/apps/web/src/__tests__/mode-action.spec.ts`

**To Modify**:
- `/apps/web/src/services/agent2agent/api/agent2agent.api.ts`
- `/apps/web/src/services/agent2agent/index.ts`
- `/apps/web/src/stores/agentChatStore/plans.ts`
- `/apps/web/src/stores/agentChatStore/store.ts`

**To Delete**:
- `/apps/web/src/services/agentExecutionService.ts`
