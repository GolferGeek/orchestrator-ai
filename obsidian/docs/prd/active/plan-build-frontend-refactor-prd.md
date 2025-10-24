# PRD-1.5: Plan & Build Mode End-to-End Integration

**Version**: 1.5
**Date**: 2025-10-05
**Status**: Active
**Owner**: Frontend Team

## Executive Summary

Refactor the frontend to fully align with the backend's Mode × Action architecture. The backend already has a clean single endpoint (`/agent-to-agent/{org}/{agent}/tasks`) with modes (plan, build, converse, orchestrate). The frontend has partial Mode × Action code but it's not wired to the real backend yet. This PRD focuses on getting Plan and Build modes working end-to-end.

## Background

### Current State
- Backend has been refactored to Mode × Action architecture
- Single endpoint: `POST /agent-to-agent/{org}/{agent}/tasks`
- Request structure: `{ mode, action, ...actionParams }`
- Response structure: `{ taskId, status, result }`

### Problem
- Frontend has `agent2agent.api.ts` but it calls wrong endpoint (`/api/agent2agent/execute`)
- Frontend has `plans.ts` service but it's not fully wired
- No equivalent `builds.ts` service for deliverables
- Legacy orchestration code still exists and confuses the architecture

### Why Now
We just fixed backend routing to use `organization_slug` from conversations. Frontend is still trying to get org from multiple places. Time to clean up and align with the simple, clean backend.

## Goals

1. **Single API Pattern**: All Plan/Build actions call `/agent-to-agent/{org}/{agent}/tasks` with `{mode, action}` structure
2. **Single Org Source**: All requests use `authStore.currentNamespace` only
3. **Consistent Versioning**: Plan and Build both support full versioning (create, edit, merge, switch, etc.)
4. **Proven Pattern**: Implement Plan first, prove it works, copy exact pattern to Build
5. **Clean Up Legacy**: Remove old orchestration code once new code is proven

## Non-Goals

- Converse mode (different architecture, no versioning)
- Orchestrate mode (Phase 6, future work)
- UI redesign or new features
- Backend changes (already done)

## User Stories

### As a user creating a plan
- I click "Plan It" button
- System calls backend with `{mode: 'plan', action: 'create'}`
- I see plan content appear with version v1
- I can edit, create new versions, merge versions, switch versions

### As a user creating a deliverable
- I click "Build It" button
- System calls backend with `{mode: 'build', action: 'create'}`
- I see deliverable content appear with version v1
- I can edit, rerun with different LLM, merge versions, switch versions

## Technical Architecture

### The Complete Flow

```
USER ACTION (click button)
    ↓
UI COMPONENT (event handler)
    ↓
STORE METHOD (chatStore.executeFromLastUserMessage)
    ↓
SERVICE METHOD (plans.createPlan or builds.createDeliverable)
    ↓
API CLIENT (agent2agent.api.ts)
    ↓
HTTP REQUEST: POST /agent-to-agent/{org}/{agent}/tasks
    Body: { mode: 'plan', action: 'create', conversationId, message }
    ↓
BACKEND RESPONSE: { taskId, status: 'completed', result: { plan, version } }
    ↓
SERVICE RETURNS (result.data)
    ↓
STORE UPDATES (activeConversation.currentPlan = result.plan)
    ↓
UI REACTS (Vue reactivity, automatic update)
```

### File Structure

```
/services/agent2agent
  /api
    - agent2agent.api.ts     # Fix to call real endpoint
    - index.ts
  /types
    - plan.types.ts          # Plan-related types
    - build.types.ts         # Build-related types
    - index.ts
  - index.ts

/stores/agentChatStore
  - store.ts                 # Main store (clean up legacy)
  - conversation.ts          # Conversation management (EXISTS)
  - taskExecution.ts         # Task execution (EXISTS)
  - plans.ts                 # Plan service (UPDATE)
  - builds.ts                # Build service (NEW - copy from plans.ts)
  - planActions.ts           # Plan store actions (EXISTS)
  - buildActions.ts          # Build store actions (NEW - copy from planActions.ts)
  - types.ts                 # Store types
```

### API Client Interface

```typescript
export class Agent2AgentApi {
  constructor(
    private authStore: AuthStore,
    private agentSlug: string
  ) {}

  // Plan operations
  plans = {
    create: (conversationId, title, content) => POST {mode: 'plan', action: 'create'},
    read: (conversationId) => POST {mode: 'plan', action: 'read'},
    list: (conversationId) => POST {mode: 'plan', action: 'list'},
    edit: (conversationId, content) => POST {mode: 'plan', action: 'edit'},
    setCurrent: (conversationId, versionId) => POST {mode: 'plan', action: 'set_current'},
    deleteVersion: (conversationId, versionId) => POST {mode: 'plan', action: 'delete_version'},
    mergeVersions: (conversationId, versionIds, prompt) => POST {mode: 'plan', action: 'merge_versions'},
    copyVersion: (conversationId, versionId) => POST {mode: 'plan', action: 'copy_version'},
    delete: (conversationId) => POST {mode: 'plan', action: 'delete'}
  }

  // Build operations (same structure)
  deliverables = {
    // Same 9 actions as plans, plus:
    rerun: (conversationId, versionId, config) => POST {mode: 'build', action: 'rerun'}
  }
}
```

## Backend API Contract (Reference)

### Plan Mode - 9 Actions

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | create | ✅ | Generate/refine plan |
| 2 | read | ❌ | Get current version |
| 3 | list | ❌ | Get version history |
| 4 | edit | ❌ | Save manual edit |
| 5 | set_current | ❌ | Switch version |
| 6 | delete_version | ❌ | Delete version |
| 7 | merge_versions | ✅ | Merge versions |
| 8 | copy_version | ❌ | Duplicate version |
| 9 | delete | ❌ | Delete plan |

### Build Mode - 10 Actions

Same 9 as Plan, plus:

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 5 | rerun | ✅ | Re-execute with different LLM |

### Request/Response Format

**Request**:
```typescript
POST /agent-to-agent/{orgSlug}/{agentSlug}/tasks
{
  mode: 'plan' | 'build',
  action: string,
  conversationId: string,
  // Action-specific params:
  message?: string,           // For create
  editedContent?: string,     // For edit
  versionId?: string,         // For set_current, delete_version, copy_version
  versionIds?: string[],      // For merge_versions
  mergePrompt?: string,       // For merge_versions
  rerunConfig?: object        // For rerun (build only)
}
```

**Response**:
```typescript
{
  taskId: string,
  conversationId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  result?: {
    plan?: { id, conversationId, title, currentVersionId, createdAt, updatedAt },
    version?: { id, versionNumber, content, format, isCurrent, createdAt, metadata },
    versions?: [...],  // For list action
    // ... action-specific fields
  },
  error?: { code, message, details },
  startedAt: string,
  completedAt?: string
}
```

## Implementation Strategy

### Phase 1: Plan Mode (Prove the Pattern)
1. Fix API client to call real endpoint
2. Update plans.ts to use fixed API client
3. Test all 9 plan actions end-to-end
4. Verify UI updates reactively

### Phase 2: Build Mode (Copy the Pattern)
1. Create builds.ts (exact copy of plans.ts structure)
2. Create buildActions.ts (exact copy of planActions.ts structure)
3. Test all 10 build actions end-to-end
4. Verify UI updates reactively

### Phase 3: Cleanup
1. Remove old `createOrchestrationDraft()` from store
2. Remove legacy task routing code
3. Remove org lookup from conversations
4. Document the pattern for future modes

## Acceptance Criteria

### Functional
- ✅ User clicks "Plan It" → plan created, version v1 shown
- ✅ User edits plan → new version v2 created
- ✅ User switches to v1 → content updates to v1
- ✅ User merges v1+v2 → new v3 created with merged content
- ✅ Same flow works for Build/deliverables
- ✅ Build has additional "Rerun with different LLM" option

### Technical
- ✅ All API calls go to `/agent-to-agent/{org}/{agent}/tasks`
- ✅ All requests use `authStore.currentNamespace` for org
- ✅ All requests have structure `{mode, action, ...params}`
- ✅ All responses have structure `{taskId, status, result}`
- ✅ Store updates are reactive (no manual UI updates needed)
- ✅ planActions.ts and buildActions.ts are nearly identical (proves pattern)

### Quality
- ✅ No console errors
- ✅ No failed API calls
- ✅ No legacy orchestration code remains
- ✅ Code coverage for all 9+10 actions

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing Plan functionality | High | Implement incrementally, test each action |
| Build pattern diverges from Plan | Medium | Copy Plan exactly, only add rerun |
| Missing edge cases | Medium | Comprehensive testing matrix |
| User confusion during transition | Low | Keep UI identical during refactor |

## Success Metrics

- **0** calls to old orchestration endpoints
- **19** actions working (9 plan + 10 build)
- **100%** of requests use `authStore.currentNamespace`
- **<50%** lines of code in refactored files (cleaner)

## Timeline

- **Week 1**: Fix API client, update plans.ts, test Plan mode
- **Week 2**: Create builds.ts/buildActions.ts, test Build mode
- **Week 3**: Cleanup legacy code, documentation

## Dependencies

- Backend Mode × Action architecture (✅ Complete)
- `authStore.currentNamespace` as org source (✅ Complete)
- Plan versioning backend (✅ Complete)
- Build versioning backend (✅ Complete)

## Related Documents

- [API Contracts](../../architecture/api-contracts.md)
- [Phase 0 Plan](./plan-build-frontend-refactor-plan.md)
- [Original Converse/Plan/Build PRD](./converse-plan-build-modes-prd.md)
