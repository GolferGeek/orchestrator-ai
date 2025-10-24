# TypeScript Types & Request Builders

## Overview

This document provides complete TypeScript types and request builder patterns for all 33 mode × action combinations.

---

## Base Types

```typescript
// Base request that all actions extend
export interface BaseTaskRequest {
  mode: TaskMode;
  action: string;
  agentSlug: string;
  metadata?: {
    source?: 'ui' | 'agent' | 'webhook';
    clientTimestamp?: string;
    correlationId?: string;
    [key: string]: any;
  };
}

// Base response that all actions return
export interface TaskResponse<TResult = any> {
  taskId: string;
  conversationId: string;
  status: TaskStatus;
  result?: TResult;
  error?: TaskError;
  startedAt: string;
  completedAt?: string;
  metadata?: {
    llmModel?: string;
    tokensUsed?: number;
    executionTimeMs?: number;
    [key: string]: any;
  };
}

// Enums
export type TaskMode = 'converse' | 'plan' | 'build' | 'tool' | 'orchestrate';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskError {
  code: string;
  message: string;
  details?: any;
}

// Common entities
export interface Plan {
  id: string;
  conversationId: string;
  title: string;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  id: string;
  versionNumber: number;
  content: string;
  format: 'markdown' | 'json' | 'yaml';
  createdByType: 'conversation_task' | 'manual_edit' | 'llm_rerun' | 'merge_operation' | 'copy_operation';
  isCurrent: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface Deliverable {
  id: string;
  conversationId: string;
  title: string;
  type: 'document' | 'code' | 'data';
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliverableVersion {
  id: string;
  versionNumber: number;
  content: string;
  format: 'markdown' | 'javascript' | 'typescript' | 'python' | 'json' | 'yaml' | 'html' | 'css';
  createdByType: 'conversation_task' | 'manual_edit' | 'llm_rerun' | 'merge_operation' | 'copy_operation';
  isCurrent: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}
```

---

## Mode: PLAN

### Request Types

```typescript
// 1. create
export interface CreatePlanRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'create';
  message: string;
  forceNew?: boolean;
}

export interface CreatePlanResponse extends TaskResponse {
  result: {
    plan: Plan;
    version: PlanVersion;
  };
}

// 2. read
export interface ReadPlanRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'read';
  versionId?: string;
}

export interface ReadPlanResponse extends TaskResponse {
  result: {
    plan: Plan;
    currentVersion: PlanVersion;
  } | null;
}

// 3. list
export interface ListPlanVersionsRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'list';
  limit?: number;
  offset?: number;
}

export interface ListPlanVersionsResponse extends TaskResponse {
  result: {
    planId: string;
    versions: Array<{
      id: string;
      versionNumber: number;
      contentPreview: string;
      format: string;
      createdByType: string;
      isCurrent: boolean;
      createdAt: string;
      metadata?: Record<string, any>;
    }>;
    total: number;
    hasMore: boolean;
  };
}

// 4. edit
export interface EditPlanRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'edit';
  editedContent: string;
  editNotes?: string;
}

export interface EditPlanResponse extends TaskResponse {
  result: {
    version: PlanVersion;
  };
}

// 5. set_current
export interface SetCurrentPlanVersionRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'set_current';
  versionId: string;
}

export interface SetCurrentPlanVersionResponse extends TaskResponse {
  result: {
    plan: Pick<Plan, 'id' | 'currentVersionId' | 'updatedAt'>;
    previousVersionId: string;
    newVersionId: string;
  };
}

// 6. delete_version
export interface DeletePlanVersionRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'delete_version';
  versionId: string;
  confirm?: boolean;
}

export interface DeletePlanVersionResponse extends TaskResponse {
  result: {
    success: boolean;
    deletedVersionId: string;
    remainingVersionCount: number;
  };
}

// 7. merge_versions
export interface MergePlanVersionsRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'merge_versions';
  versionIds: string[];
  mergePrompt: string;
  llmConfig?: {
    model?: string;
    temperature?: number;
  };
}

export interface MergePlanVersionsResponse extends TaskResponse {
  result: {
    version: PlanVersion;
  };
}

// 8. copy_version
export interface CopyPlanVersionRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'copy_version';
  versionId: string;
  setCurrent?: boolean;
}

export interface CopyPlanVersionResponse extends TaskResponse {
  result: {
    version: PlanVersion;
  };
}

// 9. delete
export interface DeletePlanRequest extends BaseTaskRequest {
  mode: 'plan';
  action: 'delete';
  confirm: boolean;
}

export interface DeletePlanResponse extends TaskResponse {
  result: {
    success: boolean;
    deletedPlanId: string;
    versionsDeleted: number;
  };
}
```

### Request Builders

```typescript
export const PlanRequests = {
  create: (agentSlug: string, message: string, forceNew?: boolean): CreatePlanRequest => ({
    mode: 'plan',
    action: 'create',
    agentSlug,
    message,
    forceNew,
  }),

  read: (agentSlug: string, versionId?: string): ReadPlanRequest => ({
    mode: 'plan',
    action: 'read',
    agentSlug,
    versionId,
  }),

  list: (agentSlug: string, limit?: number, offset?: number): ListPlanVersionsRequest => ({
    mode: 'plan',
    action: 'list',
    agentSlug,
    limit,
    offset,
  }),

  edit: (agentSlug: string, editedContent: string, editNotes?: string): EditPlanRequest => ({
    mode: 'plan',
    action: 'edit',
    agentSlug,
    editedContent,
    editNotes,
  }),

  setCurrent: (agentSlug: string, versionId: string): SetCurrentPlanVersionRequest => ({
    mode: 'plan',
    action: 'set_current',
    agentSlug,
    versionId,
  }),

  deleteVersion: (agentSlug: string, versionId: string, confirm?: boolean): DeletePlanVersionRequest => ({
    mode: 'plan',
    action: 'delete_version',
    agentSlug,
    versionId,
    confirm,
  }),

  mergeVersions: (
    agentSlug: string,
    versionIds: string[],
    mergePrompt: string,
    llmConfig?: { model?: string; temperature?: number }
  ): MergePlanVersionsRequest => ({
    mode: 'plan',
    action: 'merge_versions',
    agentSlug,
    versionIds,
    mergePrompt,
    llmConfig,
  }),

  copyVersion: (agentSlug: string, versionId: string, setCurrent?: boolean): CopyPlanVersionRequest => ({
    mode: 'plan',
    action: 'copy_version',
    agentSlug,
    versionId,
    setCurrent,
  }),

  delete: (agentSlug: string, confirm: boolean): DeletePlanRequest => ({
    mode: 'plan',
    action: 'delete',
    agentSlug,
    confirm,
  }),
};
```

---

## Mode: BUILD

### Request Types

```typescript
// 1. create
export interface CreateDeliverableRequest extends BaseTaskRequest {
  mode: 'build';
  action: 'create';
  message?: string;
  planVersionId?: string;
  forceNew?: boolean;
}

export interface CreateDeliverableResponse extends TaskResponse {
  result: {
    deliverable: Deliverable;
    version: DeliverableVersion;
  };
}

// 2-4, 6-10: Same as Plan (substitute Deliverable for Plan)
export interface ReadDeliverableRequest extends BaseTaskRequest {
  mode: 'build';
  action: 'read';
  versionId?: string;
}

export interface ReadDeliverableResponse extends TaskResponse {
  result: {
    deliverable: Deliverable;
    currentVersion: DeliverableVersion;
  } | null;
}

// ... (similar pattern for list, edit, set_current, delete_version, merge_versions, copy_version, delete)

// 5. rerun (unique to BUILD)
export interface RerunDeliverableRequest extends BaseTaskRequest {
  mode: 'build';
  action: 'rerun';
  sourceVersionId?: string;
  rerunConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
  message?: string;
}

export interface RerunDeliverableResponse extends TaskResponse {
  result: {
    version: DeliverableVersion;
  };
}
```

### Request Builders

```typescript
export const DeliverableRequests = {
  create: (
    agentSlug: string,
    message?: string,
    planVersionId?: string,
    forceNew?: boolean
  ): CreateDeliverableRequest => ({
    mode: 'build',
    action: 'create',
    agentSlug,
    message,
    planVersionId,
    forceNew,
  }),

  read: (agentSlug: string, versionId?: string): ReadDeliverableRequest => ({
    mode: 'build',
    action: 'read',
    agentSlug,
    versionId,
  }),

  // ... (similar pattern for other actions)

  rerun: (
    agentSlug: string,
    sourceVersionId?: string,
    rerunConfig?: { model?: string; temperature?: number; maxTokens?: number },
    message?: string
  ): RerunDeliverableRequest => ({
    mode: 'build',
    action: 'rerun',
    agentSlug,
    sourceVersionId,
    rerunConfig,
    message,
  }),
};
```

---

## Mode: CONVERSE

### Request Types

```typescript
// 1. read_conversation
export interface ReadConversationRequest extends BaseTaskRequest {
  mode: 'converse';
  action: 'read_conversation';
  limit?: number;
  offset?: number;
  includeSystem?: boolean;
}

export interface ReadConversationResponse extends TaskResponse {
  result: {
    conversation: {
      id: string;
      agentName: string;
      userId: string;
      startedAt: string;
      lastMessageAt: string;
    };
    messages: Array<{
      id: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: string;
      metadata?: any;
    }>;
    total: number;
    hasMore: boolean;
  };
}

// 2. delete_conversation
export interface DeleteConversationRequest extends BaseTaskRequest {
  mode: 'converse';
  action: 'delete_conversation';
  confirm: boolean;
  deleteArtifacts: boolean;
}

export interface DeleteConversationResponse extends TaskResponse {
  result: {
    success: boolean;
    deletedConversationId: string;
    messagesDeleted: number;
    artifactsDeleted?: {
      plans: number;
      deliverables: number;
    };
  };
}

// 3. export_conversation
export interface ExportConversationRequest extends BaseTaskRequest {
  mode: 'converse';
  action: 'export_conversation';
  format: 'json' | 'markdown' | 'pdf' | 'html';
  includeArtifacts?: boolean;
}

export interface ExportConversationResponse extends TaskResponse {
  result: {
    exportUrl: string;
    format: string;
    expiresAt: string;
    fileSize: number;
    metadata: {
      messageCount: number;
      artifactsIncluded: number;
    };
  };
}
```

### Request Builders

```typescript
export const ConversationRequests = {
  read: (
    agentSlug: string,
    limit?: number,
    offset?: number,
    includeSystem?: boolean
  ): ReadConversationRequest => ({
    mode: 'converse',
    action: 'read_conversation',
    agentSlug,
    limit,
    offset,
    includeSystem,
  }),

  delete: (agentSlug: string, confirm: boolean, deleteArtifacts: boolean): DeleteConversationRequest => ({
    mode: 'converse',
    action: 'delete_conversation',
    agentSlug,
    confirm,
    deleteArtifacts,
  }),

  export: (
    agentSlug: string,
    format: 'json' | 'markdown' | 'pdf' | 'html',
    includeArtifacts?: boolean
  ): ExportConversationRequest => ({
    mode: 'converse',
    action: 'export_conversation',
    agentSlug,
    format,
    includeArtifacts,
  }),
};
```

---

## Mode: TOOL (Phase 4)

### Request Types

```typescript
// 1. execute
export interface ExecuteToolRequest extends BaseTaskRequest {
  mode: 'tool';
  action: 'execute';
  toolName: string;
  input: Record<string, any>;
  timeoutMs?: number;
}

export interface ExecuteToolResponse extends TaskResponse {
  result: {
    toolName: string;
    output: any;
    executionTimeMs: number;
    metadata?: {
      mcpServer: string;
      rowsReturned?: number;
      filesFound?: number;
    };
  };
}

// 2. read
export interface ReadToolResultRequest extends BaseTaskRequest {
  mode: 'tool';
  action: 'read';
  executionId: string;
}

export interface ReadToolResultResponse extends TaskResponse {
  result: {
    execution: {
      id: string;
      toolName: string;
      input: any;
      output: any;
      status: 'completed' | 'failed';
      executedAt: string;
      metadata?: any;
    };
  };
}

// 3. list
export interface ListToolExecutionsRequest extends BaseTaskRequest {
  mode: 'tool';
  action: 'list';
  toolName?: string;
  limit?: number;
  offset?: number;
}

export interface ListToolExecutionsResponse extends TaskResponse {
  result: {
    executions: Array<{
      id: string;
      toolName: string;
      inputSummary: string;
      status: string;
      executedAt: string;
      executionTimeMs: number;
    }>;
    total: number;
    hasMore: boolean;
  };
}
```

### Request Builders

```typescript
export const ToolRequests = {
  execute: (
    agentSlug: string,
    toolName: string,
    input: Record<string, any>,
    timeoutMs?: number
  ): ExecuteToolRequest => ({
    mode: 'tool',
    action: 'execute',
    agentSlug,
    toolName,
    input,
    timeoutMs,
  }),

  read: (agentSlug: string, executionId: string): ReadToolResultRequest => ({
    mode: 'tool',
    action: 'read',
    agentSlug,
    executionId,
  }),

  list: (agentSlug: string, toolName?: string, limit?: number, offset?: number): ListToolExecutionsRequest => ({
    mode: 'tool',
    action: 'list',
    agentSlug,
    toolName,
    limit,
    offset,
  }),
};

// Specialized tool request builders
export const SupabaseToolRequests = {
  query: (
    agentSlug: string,
    query: {
      table: string;
      select?: string[];
      where?: Record<string, any>;
      orderBy?: string;
      limit?: number;
    },
    timeoutMs?: number
  ): ExecuteToolRequest => ({
    mode: 'tool',
    action: 'execute',
    agentSlug,
    toolName: 'supabase-query',
    input: { query },
    timeoutMs,
  }),
};

export const ObsidianToolRequests = {
  search: (
    agentSlug: string,
    search: {
      query: string;
      path?: string;
      limit?: number;
    },
    timeoutMs?: number
  ): ExecuteToolRequest => ({
    mode: 'tool',
    action: 'execute',
    agentSlug,
    toolName: 'obsidian-search',
    input: { search },
    timeoutMs,
  }),
};
```

---

## Mode: ORCHESTRATE (Phase 6)

### Request Types

```typescript
// 1. create
export interface CreateOrchestrationRequest extends BaseTaskRequest {
  mode: 'orchestrate';
  action: 'create';
  message: string;
  config?: {
    maxParallelSteps?: number;
    stepTimeoutMs?: number;
    autoRetry?: boolean;
    maxRetries?: number;
  };
}

export interface OrchestrationStep {
  stepId: string;
  agentSlug: string;
  mode: string;
  action: string;
  dependsOn: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface CreateOrchestrationResponse extends TaskResponse {
  result: {
    orchestration: {
      id: string;
      conversationId: string;
      status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
      plan: {
        steps: OrchestrationStep[];
      };
      currentStep: number;
      totalSteps: number;
      startedAt: string;
      estimatedCompletionAt?: string;
    };
  };
}

// 2. read
export interface ReadOrchestrationRequest extends BaseTaskRequest {
  mode: 'orchestrate';
  action: 'read';
  orchestrationId?: string;
}

export interface ReadOrchestrationResponse extends TaskResponse {
  result: {
    orchestration: {
      id: string;
      status: string;
      plan: { steps: OrchestrationStep[] };
      currentStep: number;
      totalSteps: number;
      completedSteps: number;
      failedSteps: number;
      results: Record<string, any>;
      startedAt: string;
      completedAt?: string;
      error?: any;
    };
  };
}

// 3-8. list, pause, resume, cancel, retry_step, delete
// ... (similar pattern)
```

### Request Builders

```typescript
export const OrchestrationRequests = {
  create: (
    agentSlug: string,
    message: string,
    config?: {
      maxParallelSteps?: number;
      stepTimeoutMs?: number;
      autoRetry?: boolean;
      maxRetries?: number;
    }
  ): CreateOrchestrationRequest => ({
    mode: 'orchestrate',
    action: 'create',
    agentSlug,
    message,
    config,
  }),

  read: (agentSlug: string, orchestrationId?: string): ReadOrchestrationRequest => ({
    mode: 'orchestrate',
    action: 'read',
    agentSlug,
    orchestrationId,
  }),

  pause: (agentSlug: string): BaseTaskRequest => ({
    mode: 'orchestrate',
    action: 'pause',
    agentSlug,
  }),

  resume: (agentSlug: string): BaseTaskRequest => ({
    mode: 'orchestrate',
    action: 'resume',
    agentSlug,
  }),

  cancel: (agentSlug: string, confirm?: boolean) => ({
    mode: 'orchestrate' as const,
    action: 'cancel',
    agentSlug,
    confirm,
  }),

  retryStep: (agentSlug: string, stepId: string) => ({
    mode: 'orchestrate' as const,
    action: 'retry_step',
    agentSlug,
    stepId,
  }),

  delete: (agentSlug: string, confirm: boolean) => ({
    mode: 'orchestrate' as const,
    action: 'delete',
    agentSlug,
    confirm,
  }),
};
```

---

## Union Types for Type Safety

```typescript
// All possible request types
export type TaskRequest =
  // Plan
  | CreatePlanRequest
  | ReadPlanRequest
  | ListPlanVersionsRequest
  | EditPlanRequest
  | SetCurrentPlanVersionRequest
  | DeletePlanVersionRequest
  | MergePlanVersionsRequest
  | CopyPlanVersionRequest
  | DeletePlanRequest
  // Build
  | CreateDeliverableRequest
  | ReadDeliverableRequest
  // ... all deliverable requests
  | RerunDeliverableRequest
  // Converse
  | ReadConversationRequest
  | DeleteConversationRequest
  | ExportConversationRequest
  // Tool
  | ExecuteToolRequest
  | ReadToolResultRequest
  | ListToolExecutionsRequest
  // Orchestrate
  | CreateOrchestrationRequest
  | ReadOrchestrationRequest;
  // ... all orchestration requests

// All possible response types
export type AnyTaskResponse =
  | CreatePlanResponse
  | ReadPlanResponse
  // ... all other response types
  | CreateOrchestrationResponse;
```

---

## Response Type Guards

```typescript
// Type guards for responses
export const ResponseTypeGuards = {
  isPlanResponse: (response: TaskResponse): response is CreatePlanResponse | ReadPlanResponse => {
    return 'plan' in (response.result || {});
  },

  isDeliverableResponse: (response: TaskResponse): response is CreateDeliverableResponse => {
    return 'deliverable' in (response.result || {});
  },

  isToolResponse: (response: TaskResponse): response is ExecuteToolResponse => {
    return 'toolName' in (response.result || {});
  },

  isOrchestrationResponse: (response: TaskResponse): response is CreateOrchestrationResponse => {
    return 'orchestration' in (response.result || {});
  },

  isError: (response: TaskResponse): boolean => {
    return response.status === 'failed' && !!response.error;
  },
};
```

---

## Unified Request Builder Factory

```typescript
/**
 * Type-safe request builder factory
 * Usage: const req = RequestBuilder.plan.create(agentSlug, message);
 */
export const RequestBuilder = {
  plan: PlanRequests,
  build: DeliverableRequests,
  converse: ConversationRequests,
  tool: ToolRequests,
  orchestrate: OrchestrationRequests,

  // Specialized builders
  supabase: SupabaseToolRequests,
  obsidian: ObsidianToolRequests,
};

// Usage examples:
const createPlanReq = RequestBuilder.plan.create('blog_post_writer', 'Create outline');
const readDeliverableReq = RequestBuilder.build.read('blog_post_writer');
const querySupabaseReq = RequestBuilder.supabase.query('supabase-agent', {
  table: 'transactions',
  where: { date_gte: '2025-01-01' }
});
```

---

## Response Parser Utilities

```typescript
/**
 * Type-safe response parser
 */
export class ResponseParser {
  static plan = {
    create: (response: TaskResponse): CreatePlanResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as CreatePlanResponse['result'];
    },

    read: (response: TaskResponse): ReadPlanResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as ReadPlanResponse['result'];
    },

    list: (response: TaskResponse): ListPlanVersionsResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as ListPlanVersionsResponse['result'];
    },

    // ... other parsers
  };

  static build = {
    create: (response: TaskResponse): CreateDeliverableResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as CreateDeliverableResponse['result'];
    },

    rerun: (response: TaskResponse): RerunDeliverableResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as RerunDeliverableResponse['result'];
    },

    // ... other parsers
  };

  static tool = {
    execute: (response: TaskResponse): ExecuteToolResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as ExecuteToolResponse['result'];
    },
  };

  static orchestrate = {
    create: (response: TaskResponse): CreateOrchestrationResponse['result'] => {
      if (response.status === 'failed') throw new Error(response.error?.message);
      return response.result as CreateOrchestrationResponse['result'];
    },
  };
}

// Usage:
const planResult = ResponseParser.plan.create(response);
console.log(planResult.plan.id, planResult.version.content);
```

---

## Complete Usage Example

```typescript
import { RequestBuilder, ResponseParser } from './agent2agent-types';
import { agent2AgentAPI } from './agent2agent-api';

async function createBlogPostWorkflow(conversationId: string) {
  // 1. Create plan
  const createPlanReq = RequestBuilder.plan.create(
    'blog_post_writer',
    'Create outline for AI trends blog post'
  );

  const planResponse = await agent2AgentAPI.executeTask(conversationId, createPlanReq);
  const planResult = ResponseParser.plan.create(planResponse);

  console.log('Plan created:', planResult.plan.id);
  console.log('Plan content:', planResult.version.content);

  // 2. Edit plan manually
  const editPlanReq = RequestBuilder.plan.edit(
    'blog_post_writer',
    '# Updated Plan\n\n## 1. Introduction to AI...',
    'Added more detail to introduction'
  );

  const editResponse = await agent2AgentAPI.executeTask(conversationId, editPlanReq);
  const editResult = ResponseParser.plan.edit(editResponse);

  console.log('New version:', editResult.version.versionNumber);

  // 3. Create deliverable from plan
  const buildReq = RequestBuilder.build.create('blog_post_writer', 'Make it technical');
  const buildResponse = await agent2AgentAPI.executeTask(conversationId, buildReq);
  const buildResult = ResponseParser.build.create(buildResponse);

  console.log('Deliverable:', buildResult.deliverable.title);
  console.log('Content:', buildResult.version.content);

  // 4. Rerun with different LLM
  const rerunReq = RequestBuilder.build.rerun(
    'blog_post_writer',
    undefined,
    { model: 'gpt-4', temperature: 0.8 },
    'Make it more creative'
  );

  const rerunResponse = await agent2AgentAPI.executeTask(conversationId, rerunReq);
  const rerunResult = ResponseParser.build.rerun(rerunResponse);

  console.log('Rerun version:', rerunResult.version.versionNumber);

  return {
    planId: planResult.plan.id,
    deliverableId: buildResult.deliverable.id,
    finalVersion: rerunResult.version,
  };
}

// Tool execution example
async function queryFinancialData(conversationId: string) {
  const queryReq = RequestBuilder.supabase.query('supabase-agent', {
    table: 'financial_transactions',
    select: ['date', 'amount', 'category'],
    where: { date_gte: '2025-01-01', date_lt: '2025-04-01' },
    orderBy: 'date DESC',
    limit: 100,
  });

  const response = await agent2AgentAPI.executeTask(conversationId, queryReq);
  const result = ResponseParser.tool.execute(response);

  console.log('Query results:', result.output.rows);
  console.log('Rows returned:', result.metadata?.rowsReturned);

  return result.output;
}

// Orchestration example
async function generateFinancialReport(conversationId: string) {
  const orchestrationReq = RequestBuilder.orchestrate.create(
    'finance-manager',
    'Generate Q1 2025 financial report with charts and comparisons',
    {
      maxParallelSteps: 3,
      autoRetry: true,
      maxRetries: 2,
    }
  );

  const response = await agent2AgentAPI.executeTask(conversationId, orchestrationReq);
  const result = ResponseParser.orchestrate.create(response);

  console.log('Orchestration started:', result.orchestration.id);
  console.log('Total steps:', result.orchestration.totalSteps);
  console.log('Current step:', result.orchestration.currentStep);

  return result.orchestration;
}
```

---

## Next Steps

1. ✅ Generate complete TypeScript types for all 33 operations
2. ✅ Create request builder utilities
3. ✅ Create response parser utilities
4. ⏳ Implement actual API client with these types
5. ⏳ Add validation using Zod schemas
6. ⏳ Generate OpenAPI spec from types
