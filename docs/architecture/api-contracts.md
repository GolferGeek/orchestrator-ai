# API Contracts - Transport Layer

## Single Endpoint

```
POST /api/agent2agent/conversations/:conversationId/tasks
```

## Base Transport

### Every Request Has

```typescript
{
  mode: 'converse' | 'plan' | 'build' | 'tool' | 'orchestrate',
  action: string,
  agentSlug: string,
  // ... plus action-specific params
}
```

### Every Response Has

```typescript
{
  taskId: string,
  conversationId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  result?: { /* varies by action */ },
  error?: { code: string, message: string, details?: any },
  startedAt: string,  // ISO 8601
  completedAt?: string
}
```

---

## Mode: PLAN

### Actions Summary

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | `create` | ✅ | Generate/refine plan |
| 2 | `read` | ❌ | Get current version |
| 3 | `list` | ❌ | Get version history |
| 4 | `edit` | ❌ | Save manual edit |
| 5 | `set_current` | ❌ | Switch version |
| 6 | `delete_version` | ❌ | Delete version |
| 7 | `merge_versions` | ✅ | Merge versions |
| 8 | `copy_version` | ❌ | Duplicate version |
| 9 | `delete` | ❌ | Delete plan |

### Transport Details

#### 1. create

**Request adds:**
```typescript
{
  message: string,       // Required
  forceNew?: boolean
}
```

**Response result:**
```typescript
{
  plan: { id, conversationId, title, currentVersionId, createdAt, updatedAt },
  version: { id, versionNumber, content, format, createdByType, isCurrent, createdAt, metadata }
}
```

#### 2. read

**Request adds:**
```typescript
{
  versionId?: string  // Optional: get specific version
}
```

**Response result:**
```typescript
{
  plan: { id, conversationId, title, currentVersionId, ... },
  currentVersion: { id, versionNumber, content, format, ... }
} | null
```

#### 3. list

**Request adds:**
```typescript
{
  limit?: number,
  offset?: number
}
```

**Response result:**
```typescript
{
  planId: string,
  versions: [{ id, versionNumber, contentPreview, format, createdByType, isCurrent, createdAt, metadata }],
  total: number,
  hasMore: boolean
}
```

#### 4. edit

**Request adds:**
```typescript
{
  editedContent: string,  // Required: full new content
  editNotes?: string
}
```

**Response result:**
```typescript
{
  version: { id, versionNumber, content, format, createdByType: 'manual_edit', isCurrent, createdAt, metadata }
}
```

#### 5. set_current

**Request adds:**
```typescript
{
  versionId: string  // Required
}
```

**Response result:**
```typescript
{
  plan: { id, currentVersionId, updatedAt },
  previousVersionId: string,
  newVersionId: string
}
```

#### 6. delete_version

**Request adds:**
```typescript
{
  versionId: string,  // Required
  confirm?: boolean
}
```

**Response result:**
```typescript
{
  success: boolean,
  deletedVersionId: string,
  remainingVersionCount: number
}
```

#### 7. merge_versions

**Request adds:**
```typescript
{
  versionIds: string[],   // Required: 2+ versions
  mergePrompt: string,    // Required: how to merge
  llmConfig?: { model?: string, temperature?: number }
}
```

**Response result:**
```typescript
{
  version: {
    id, versionNumber, content, format,
    createdByType: 'merge_operation',
    metadata: { mergedFrom: string[], mergePrompt: string, llmModel: string }
  }
}
```

#### 8. copy_version

**Request adds:**
```typescript
{
  versionId: string,    // Required
  setCurrent?: boolean
}
```

**Response result:**
```typescript
{
  version: {
    id, versionNumber, content, format,
    createdByType: 'copy_operation',
    metadata: { copiedFrom: string, originalVersionNumber: number }
  }
}
```

#### 9. delete

**Request adds:**
```typescript
{
  confirm: boolean  // Required
}
```

**Response result:**
```typescript
{
  success: boolean,
  deletedPlanId: string,
  versionsDeleted: number
}
```

---

## Mode: BUILD

### Actions Summary

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | `create` | ✅ | Generate/refine deliverable |
| 2 | `read` | ❌ | Get current version |
| 3 | `list` | ❌ | Get version history |
| 4 | `edit` | ❌ | Save manual edit |
| 5 | `rerun` | ✅ | Re-execute with different LLM |
| 6 | `set_current` | ❌ | Switch version |
| 7 | `delete_version` | ❌ | Delete version |
| 8 | `merge_versions` | ✅ | Merge versions |
| 9 | `copy_version` | ❌ | Duplicate version |
| 10 | `delete` | ❌ | Delete deliverable |

### Transport Details

**Actions 1-4, 6-10**: Identical to PLAN mode (substitute "deliverable" for "plan")

#### 5. rerun (Unique to BUILD)

**Request adds:**
```typescript
{
  sourceVersionId?: string,  // Optional: which version to rerun (default: current)
  rerunConfig?: {
    model?: string,
    temperature?: number,
    maxTokens?: number
  },
  message?: string  // Optional: additional instructions
}
```

**Response result:**
```typescript
{
  version: {
    id, versionNumber, content, format,
    createdByType: 'llm_rerun',
    metadata: {
      llmModel: string,
      tokensUsed: number,
      rerunFrom: string,  // Source version ID
      rerunConfig: any
    }
  }
}
```

---

## Mode: CONVERSE

### Actions Summary

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | `read_conversation` | ❌ | Get message history |
| 2 | `delete_conversation` | ❌ | Delete conversation + artifacts |
| 3 | `export_conversation` | ❌ | Export to file |

### Transport Details

#### 1. read_conversation

**Request adds:**
```typescript
{
  limit?: number,
  offset?: number,
  includeSystem?: boolean
}
```

**Response result:**
```typescript
{
  conversation: { id, agentName, userId, startedAt, lastMessageAt },
  messages: [{ id, role, content, timestamp, metadata }],
  total: number,
  hasMore: boolean
}
```

#### 2. delete_conversation

**Request adds:**
```typescript
{
  confirm: boolean,         // Required
  deleteArtifacts: boolean  // Required: cascade to plans/deliverables
}
```

**Response result:**
```typescript
{
  success: boolean,
  deletedConversationId: string,
  messagesDeleted: number,
  artifactsDeleted?: { plans: number, deliverables: number }
}
```

#### 3. export_conversation

**Request adds:**
```typescript
{
  format: 'json' | 'markdown' | 'pdf' | 'html',  // Required
  includeArtifacts?: boolean
}
```

**Response result:**
```typescript
{
  exportUrl: string,      // Presigned download URL
  format: string,
  expiresAt: string,
  fileSize: number,
  metadata: { messageCount: number, artifactsIncluded: number }
}
```

---

## Mode: TOOL (Phase 4)

### Actions Summary

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | `execute` | ❌ | Execute MCP tool |
| 2 | `read` | ❌ | Get cached result |
| 3 | `list` | ❌ | Get execution history |

### Transport Details

#### 1. execute

**Request adds:**
```typescript
{
  toolName: string,  // Required: e.g., 'supabase-query', 'obsidian-search'
  input: {
    // Tool-specific parameters
    // For Supabase:
    query?: { table, select?, where?, orderBy?, limit? },

    // For Obsidian:
    search?: { query, path?, limit? },

    // Generic:
    [key: string]: any
  },
  timeoutMs?: number
}
```

**Response result:**
```typescript
{
  toolName: string,
  output: any,  // Tool-specific output
  executionTimeMs: number,
  metadata?: { mcpServer: string, rowsReturned?: number, filesFound?: number }
}
```

**Example - Supabase Query:**
```typescript
// Request
{
  mode: 'tool',
  action: 'execute',
  agentSlug: 'supabase-agent',
  toolName: 'supabase-query',
  input: {
    query: {
      table: 'financial_transactions',
      select: ['date', 'amount', 'category'],
      where: { date_gte: '2025-01-01' },
      orderBy: 'date DESC'
    }
  }
}

// Response result
{
  toolName: 'supabase-query',
  output: {
    rows: [
      { date: '2025-03-31', amount: 1500.00, category: 'Revenue' },
      // ... more rows
    ],
    count: 145
  },
  executionTimeMs: 234,
  metadata: { mcpServer: 'supabase-mcp', rowsReturned: 145 }
}
```

#### 2. read

**Request adds:**
```typescript
{
  executionId: string  // Required
}
```

**Response result:**
```typescript
{
  execution: {
    id: string,
    toolName: string,
    input: any,
    output: any,
    status: 'completed' | 'failed',
    executedAt: string,
    metadata?: any
  }
}
```

#### 3. list

**Request adds:**
```typescript
{
  toolName?: string,  // Optional: filter
  limit?: number,
  offset?: number
}
```

**Response result:**
```typescript
{
  executions: [{ id, toolName, inputSummary, status, executedAt, executionTimeMs }],
  total: number,
  hasMore: boolean
}
```

---

## Mode: ORCHESTRATE (Phase 6)

### Actions Summary

| # | Action | LLM | Description |
|---|--------|-----|-------------|
| 1 | `create` | ✅ | Create/execute orchestration |
| 2 | `read` | ❌ | Get orchestration state |
| 3 | `list` | ❌ | Get run history |
| 4 | `pause` | ❌ | Pause execution |
| 5 | `resume` | ❌ | Resume execution |
| 6 | `cancel` | ❌ | Cancel execution |
| 7 | `retry_step` | ❌ | Retry failed step |
| 8 | `delete` | ❌ | Delete orchestration |

### Transport Details

#### 1. create

**Request adds:**
```typescript
{
  message: string,  // Required: what to orchestrate
  config?: {
    maxParallelSteps?: number,
    stepTimeoutMs?: number,
    autoRetry?: boolean,
    maxRetries?: number
  }
}
```

**Response result:**
```typescript
{
  orchestration: {
    id: string,
    conversationId: string,
    status: 'planning' | 'running' | 'paused' | 'completed' | 'failed',
    plan: {
      steps: [{
        stepId: string,
        agentSlug: string,
        mode: string,
        action: string,
        dependsOn: string[],
        status: 'pending' | 'running' | 'completed' | 'failed'
      }]
    },
    currentStep: number,
    totalSteps: number,
    startedAt: string,
    estimatedCompletionAt?: string
  }
}
```

**Example:**
```typescript
// Request
{
  mode: 'orchestrate',
  action: 'create',
  agentSlug: 'finance-manager',
  message: 'Generate Q1 2025 financial report with charts'
}

// Response result
{
  orchestration: {
    id: 'orch-001',
    status: 'running',
    plan: {
      steps: [
        { stepId: 'step-001', agentSlug: 'supabase-query', mode: 'tool', action: 'execute', dependsOn: [], status: 'completed' },
        { stepId: 'step-002', agentSlug: 'chart-generator', mode: 'tool', action: 'execute', dependsOn: ['step-001'], status: 'running' },
        { stepId: 'step-003', agentSlug: 'report-compiler', mode: 'build', action: 'create', dependsOn: ['step-001', 'step-002'], status: 'pending' }
      ]
    },
    currentStep: 2,
    totalSteps: 3,
    startedAt: '2025-10-04T18:00:00Z'
  }
}
```

#### 2. read

**Request adds:**
```typescript
{
  orchestrationId?: string  // Optional: defaults to current
}
```

**Response result:**
```typescript
{
  orchestration: {
    id: string,
    status: string,
    plan: { steps: [...] },
    currentStep: number,
    totalSteps: number,
    completedSteps: number,
    failedSteps: number,
    results: Record<string, any>,  // Step results keyed by stepId
    startedAt: string,
    completedAt?: string,
    error?: any
  }
}
```

#### 3. list

**Request adds:**
```typescript
{
  status?: 'running' | 'completed' | 'failed',
  limit?: number,
  offset?: number
}
```

**Response result:**
```typescript
{
  orchestrations: [{ id, status, totalSteps, completedSteps, startedAt, completedAt }],
  total: number,
  hasMore: boolean
}
```

#### 4. pause

**Request adds:** (none)

**Response result:**
```typescript
{
  orchestrationId: string,
  status: 'paused',
  pausedAt: string,
  currentStep: number
}
```

#### 5. resume

**Request adds:** (none)

**Response result:**
```typescript
{
  orchestrationId: string,
  status: 'running',
  resumedAt: string,
  currentStep: number
}
```

#### 6. cancel

**Request adds:**
```typescript
{
  confirm?: boolean
}
```

**Response result:**
```typescript
{
  orchestrationId: string,
  status: 'cancelled',
  cancelledAt: string,
  completedSteps: number,
  cancelledSteps: number
}
```

#### 7. retry_step

**Request adds:**
```typescript
{
  stepId: string  // Required
}
```

**Response result:**
```typescript
{
  orchestrationId: string,
  step: {
    stepId: string,
    status: 'running' | 'completed' | 'failed',
    retryCount: number,
    result?: any
  }
}
```

#### 8. delete

**Request adds:**
```typescript
{
  confirm: boolean  // Required
}
```

**Response result:**
```typescript
{
  success: boolean,
  deletedOrchestrationId: string
}
```

---

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_MODE` | 400 | Unsupported mode |
| `INVALID_ACTION` | 400 | Action not supported for mode |
| `MISSING_REQUIRED_PARAM` | 400 | Required parameter missing |
| `CAPABILITY_NOT_FOUND` | 403 | Agent lacks A2A capability |
| `PLAN_NOT_FOUND` | 404 | No plan exists |
| `DELIVERABLE_NOT_FOUND` | 404 | No deliverable exists |
| `VERSION_NOT_FOUND` | 404 | Version doesn't exist |
| `CONVERSATION_NOT_FOUND` | 404 | Conversation doesn't exist |
| `LLM_EXECUTION_FAILED` | 500 | LLM execution error |
| `TOOL_EXECUTION_FAILED` | 500 | MCP tool error |
| `DATABASE_ERROR` | 500 | Database operation failed |

**Error Response Example:**
```typescript
{
  taskId: 'task-466',
  conversationId: 'conv-123',
  status: 'failed',
  error: {
    code: 'CAPABILITY_NOT_FOUND',
    message: 'Agent blog_post_writer does not have capability: merge_plan_versions',
    details: {
      agentSlug: 'blog_post_writer',
      requestedCapability: 'merge_plan_versions'
    }
  },
  startedAt: '2025-10-04T18:30:00Z',
  completedAt: '2025-10-04T18:30:01Z'
}
```

---

## Complete Mode × Action Matrix

| Mode | Actions | Total |
|------|---------|-------|
| **plan** | create, read, list, edit, set_current, delete_version, merge_versions, copy_version, delete | **9** |
| **build** | create, read, list, edit, rerun, set_current, delete_version, merge_versions, copy_version, delete | **10** |
| **converse** | read_conversation, delete_conversation, export_conversation | **3** |
| **tool** | execute, read, list | **3** |
| **orchestrate** | create, read, list, pause, resume, cancel, retry_step, delete | **8** |
| | **TOTAL** | **33** |

---

## Frontend TypeScript SDK Pattern

```typescript
// Clean API for frontend to use
class Agent2AgentAPI {
  // PLAN mode
  async createPlan(conversationId, agentSlug, message, forceNew?)
  async readPlan(conversationId, agentSlug, versionId?)
  async listPlanVersions(conversationId, agentSlug, limit?, offset?)
  async editPlan(conversationId, agentSlug, editedContent, editNotes?)
  async setCurrentPlanVersion(conversationId, agentSlug, versionId)
  async deletePlanVersion(conversationId, agentSlug, versionId, confirm?)
  async mergePlanVersions(conversationId, agentSlug, versionIds, mergePrompt, llmConfig?)
  async copyPlanVersion(conversationId, agentSlug, versionId, setCurrent?)
  async deletePlan(conversationId, agentSlug, confirm)

  // BUILD mode
  async createDeliverable(conversationId, agentSlug, message?, planVersionId?, forceNew?)
  async readDeliverable(conversationId, agentSlug, versionId?)
  async listDeliverableVersions(conversationId, agentSlug, limit?, offset?)
  async editDeliverable(conversationId, agentSlug, editedContent, editNotes?)
  async rerunDeliverable(conversationId, agentSlug, sourceVersionId?, rerunConfig?, message?)
  async setCurrentDeliverableVersion(conversationId, agentSlug, versionId)
  async deleteDeliverableVersion(conversationId, agentSlug, versionId, confirm?)
  async mergeDeliverableVersions(conversationId, agentSlug, versionIds, mergePrompt, llmConfig?)
  async copyDeliverableVersion(conversationId, agentSlug, versionId, setCurrent?)
  async deleteDeliverable(conversationId, agentSlug, confirm)

  // CONVERSE mode
  async readConversation(conversationId, agentSlug, limit?, offset?, includeSystem?)
  async deleteConversation(conversationId, agentSlug, confirm, deleteArtifacts)
  async exportConversation(conversationId, agentSlug, format, includeArtifacts?)

  // TOOL mode (Phase 4)
  async executeTool(conversationId, agentSlug, toolName, input, timeoutMs?)
  async readToolResult(conversationId, agentSlug, executionId)
  async listToolExecutions(conversationId, agentSlug, toolName?, limit?, offset?)

  // ORCHESTRATE mode (Phase 6)
  async createOrchestration(conversationId, agentSlug, message, config?)
  async readOrchestration(conversationId, agentSlug, orchestrationId?)
  async listOrchestrations(conversationId, agentSlug, status?, limit?, offset?)
  async pauseOrchestration(conversationId, agentSlug)
  async resumeOrchestration(conversationId, agentSlug)
  async cancelOrchestration(conversationId, agentSlug, confirm?)
  async retryOrchestrationStep(conversationId, agentSlug, stepId)
  async deleteOrchestration(conversationId, agentSlug, confirm)
}
```

---

## Next Steps

1. ✅ Generate TypeScript types from these contracts
2. ⏳ Create frontend SDK (`agent2AgentAPI` service)
3. ⏳ Implement backend validation schemas
4. ⏳ Generate OpenAPI/Swagger docs
5. ⏳ Create integration tests for all 33 operations
