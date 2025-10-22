# Backend Standards and Practices

## Architecture Overview

The backend follows **A2A (Agent-to-Agent) protocol** with strict adherence to transport types:

```
Frontend Request (JSON-RPC 2.0)
    ↓
Controller (Routes to Runner)
    ↓
Agent Runner (Routes by Mode)
    ↓
Mode Handler (Routes by Action)
    ↓
Action Handler (Business Logic)
    ↓
Response (Transport Types)
```

## Core Principles

### 1. Transport Types are the Contract

**NEVER modify transport types**
- Transport types define the API contract between frontend and backend
- Both sides MUST agree on transport types
- Transport types live in `@orchestrator-ai/transport-types` package
- ANY change requires updating the package and both frontend and backend
- NO custom payload fields
- NO custom response fields

### 2. A2A Protocol Compliance

**All requests are JSON-RPC 2.0 format:**
```typescript
{
  jsonrpc: "2.0",
  method: "converse" | "plan" | "build" | "orchestrate",
  id: "task-uuid",
  params: {
    conversationId: string,
    userMessage: string,
    messages: Array<{role, content}>,
    mode: AgentTaskMode,
    payload: { ... },
    metadata: { ... }
  }
}
```

**All responses are A2A format:**
```typescript
{
  success: boolean,
  mode: AgentTaskMode,
  payload: {
    content: { ... },
    metadata: { ... }
  }
}
```

**DO NOT deviate from these formats!**

### 3. Use Transport Types for Everything

```typescript
// ✅ CORRECT
import {
  AgentTaskMode,
  PlanAction,
  PlanCreatePayload,
  PlanResponseMetadata,
} from '@orchestrator-ai/transport-types';

export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as PlanCreatePayload;

  // payload.action is guaranteed to be 'create'
  // All fields are type-safe from transport types
}

// ❌ WRONG
export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as any; // NO!

  // No type safety, can add custom fields
}
```

---

## Handler Organization

### Mode Handlers

Each mode has a handler file in `base-agent-runner/`:
- `converse.handlers.ts` - Handles CONVERSE mode
- `plan.handlers.ts` - Handles PLAN mode with actions
- `build.handlers.ts` - Handles BUILD mode with actions
- `orchestrate.handlers.ts` - Handles ORCHESTRATE mode with actions

### Action-Based Routing

Modes with actions (plan, build, orchestrate) route by action:

```typescript
// plan.handlers.ts structure
export async function handlePlanCreate(...) { }
export async function handlePlanRead(...) { }
export async function handlePlanEdit(...) { }
export async function handlePlanDelete(...) { }
// ... one function per action

// Called from base-agent-runner.service.ts
protected async handlePlan(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as { action?: string };
  const action = payload.action as PlanAction;

  switch (action) {
    case 'create':
      return handlePlanCreate(definition, request, organizationSlug, this.getDependencies());
    case 'read':
      return handlePlanRead(definition, request, organizationSlug, this.getDependencies());
    // ... route to appropriate handler
  }
}
```

---

## Handler Implementation Standards

### Handler Pattern

```typescript
import {
  AgentTaskMode,
  PlanAction,
  PlanCreatePayload,
  PlanResponseMetadata,
  PlanCreateResponseContent,
} from '@orchestrator-ai/transport-types';
import { TaskRequestDto } from '../../dto/task-request.dto';
import { TaskResponseDto } from '../../dto/task-response.dto';

/**
 * Handle PLAN create action
 */
export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: PlanHandlerDependencies,
): Promise<TaskResponseDto> {
  try {
    // 1. Extract and validate payload using transport types
    const payload = request.payload as PlanCreatePayload;

    if (payload.action !== 'create') {
      throw new Error('Invalid action for handlePlanCreate');
    }

    // 2. Extract required data
    const userId = resolveUserId(request);
    const conversationId = resolveConversationId(request);

    // 3. Extract LLM configuration from payload
    const llmConfig = {
      providerName: payload.config?.provider,
      modelName: payload.config?.model,
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      conversationId,
      userId,
      // ... other config
    };

    // Validate LLM config
    if (!llmConfig.providerName || !llmConfig.modelName) {
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        'LLM provider and model must be specified'
      );
    }

    // 4. Execute business logic
    const systemPrompt = buildPlanPrompt(definition, ...);
    const userMessage = payload.userMessage || 'Create a plan';

    const llmResponse = await callLLM(
      services.llmService,
      llmConfig,
      systemPrompt,
      userMessage,
      conversationHistory,
    );

    const planContent = llmResponse.content;

    // 5. Save to database
    const plan = await services.plansService.create({
      conversationId,
      userId,
      content: planContent,
      title: payload.title || 'Plan',
      // ...
    });

    // 6. Build response using transport types
    const content: PlanCreateResponseContent = {
      plan: {
        id: plan.id,
        conversationId: plan.conversationId,
        userId: plan.userId,
        title: plan.title,
        currentVersionId: plan.currentVersionId,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
      version: {
        id: plan.currentVersion.id,
        planId: plan.id,
        versionNumber: 1,
        content: planContent,
        // ...
      },
    };

    const metadata: PlanResponseMetadata = {
      planId: plan.id,
      provider: llmConfig.providerName,
      model: llmConfig.modelName,
      usage: llmResponse.usage,
      // ...
    };

    // 7. Return success response
    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      content,
      metadata,
    });

  } catch (error) {
    // 8. Handle errors
    return TaskResponseDto.failure(
      AgentTaskMode.PLAN,
      error instanceof Error ? error.message : 'Plan creation failed'
    );
  }
}
```

### Key Handler Rules

1. **Use transport types for payloads** - cast to correct type immediately
2. **Validate action matches handler** - throw if wrong action
3. **Extract LLM config from payload** - never use fallbacks
4. **Validate LLM config** - throw if provider/model missing
5. **Execute business logic** - call LLM, save to DB, etc.
6. **Build response with transport types** - use correct content/metadata types
7. **Return TaskResponseDto** - use .success() or .failure()
8. **Handle all errors** - catch and return failure response

---

## LLM Configuration Standards

### Extracting LLM Config

**ALWAYS extract from payload, NEVER use fallbacks:**

```typescript
// ✅ CORRECT
const llmConfig = {
  providerName: payload.config?.provider,
  modelName: payload.config?.model,
  temperature: payload.config?.temperature,
  maxTokens: payload.config?.maxTokens,
  // ... other config
};

if (!llmConfig.providerName || !llmConfig.modelName) {
  throw new Error('LLM provider and model must be explicitly specified');
}

// ❌ WRONG - NO FALLBACKS
const llmConfig = {
  providerName: payload.config?.provider || definition.llm?.provider || 'anthropic', // NO!
  modelName: payload.config?.model || definition.llm?.model || 'claude-3-5-sonnet', // NO!
};
```

### Why No Fallbacks?

- Frontend ALWAYS sends provider/model from user selection
- If not sent, it's a bug that must be fixed
- Fallbacks hide bugs and create unpredictable behavior
- User should always know which model is being used

### Validation

```typescript
function validateLLMConfig(config: any): void {
  if (!config.providerName || typeof config.providerName !== 'string') {
    throw new Error('providerName is required and must be a string');
  }

  if (!config.modelName || typeof config.modelName !== 'string') {
    throw new Error('modelName is required and must be a string');
  }

  // Optional fields don't need validation (have defaults in LLM service)
}
```

---

## Response Building Standards

### Success Response

```typescript
// Use transport types for content and metadata
import {
  PlanCreateResponseContent,
  PlanResponseMetadata,
} from '@orchestrator-ai/transport-types';

const content: PlanCreateResponseContent = {
  plan: { ... },
  version: { ... },
};

const metadata: PlanResponseMetadata = {
  planId: plan.id,
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  usage: {
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    cost: 0.01,
  },
};

return TaskResponseDto.success(AgentTaskMode.PLAN, {
  content,
  metadata,
});
```

### Error Response

```typescript
return TaskResponseDto.failure(
  AgentTaskMode.PLAN,
  'Validation failed: Plan content is empty'
);
```

### Streaming Response (if applicable)

```typescript
return TaskResponseDto.streaming(
  AgentTaskMode.PLAN,
  {
    streamEndpoint: `/agent-to-agent/${namespace}/${agentName}/tasks/${taskId}/stream`,
    streamTokenEndpoint: `/agent-to-agent/${namespace}/${agentName}/tasks/${taskId}/stream-token`,
  }
);
```

---

## Action Routing Standards

### Mode Handler Routing

```typescript
// base-agent-runner.service.ts
protected async handlePlan(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as { action?: string };
  const action = (payload.action || 'create') as PlanAction;

  const services = this.getPlanHandlerDependencies();

  switch (action) {
    case 'create':
      return PlanHandlers.handlePlanCreate(definition, request, organizationSlug, services);
    case 'read':
      return PlanHandlers.handlePlanRead(definition, request, organizationSlug, services);
    case 'list':
      return PlanHandlers.handlePlanList(definition, request, organizationSlug, services);
    case 'edit':
      return PlanHandlers.handlePlanEdit(definition, request, organizationSlug, services);
    case 'rerun':
      return PlanHandlers.handlePlanRerun(definition, request, organizationSlug, services);
    case 'set_current':
      return PlanHandlers.handlePlanSetCurrent(definition, request, organizationSlug, services);
    case 'delete_version':
      return PlanHandlers.handlePlanDeleteVersion(definition, request, organizationSlug, services);
    case 'merge_versions':
      return PlanHandlers.handlePlanMergeVersions(definition, request, organizationSlug, services);
    case 'copy_version':
      return PlanHandlers.handlePlanCopyVersion(definition, request, organizationSlug, services);
    case 'delete':
      return PlanHandlers.handlePlanDelete(definition, request, organizationSlug, services);
    default:
      return TaskResponseDto.failure(
        AgentTaskMode.PLAN,
        `Unsupported plan action: ${action}`
      );
  }
}
```

### Use Action Types for Routing

```typescript
// ✅ CORRECT - use transport type
import { PlanAction } from '@orchestrator-ai/transport-types';

const action = payload.action as PlanAction;

switch (action) {
  case 'create': // Type-safe
  case 'read':   // Type-safe
  // ...
}

// ❌ WRONG - magic strings
switch (payload.action) {
  case 'create': // No type safety
  case 'raed':   // Typo not caught!
}
```

---

## Helper Functions Standards

### Shared Helpers

Common helpers in `shared.helpers.ts`:

```typescript
/**
 * Resolve user ID from request
 */
export function resolveUserId(request: TaskRequestDto): string {
  const userId = request.userId ?? request.metadata?.userId;
  if (!userId) {
    throw new Error('User ID is required');
  }
  return userId;
}

/**
 * Resolve conversation ID from request
 */
export function resolveConversationId(request: TaskRequestDto): string {
  const conversationId = request.conversationId ?? request.metadata?.conversationId;
  if (!conversationId) {
    throw new Error('Conversation ID is required');
  }
  return conversationId;
}

/**
 * Call LLM with proper configuration
 */
export async function callLLM(
  llmService: LLMService,
  config: Record<string, unknown>,
  systemPrompt: string,
  userMessage: string,
  conversationHistory: any[],
): Promise<any> {
  // Extract and validate provider/model
  const providerName = config.providerName ?? config.provider;
  const modelName = config.modelName ?? config.model;

  if (!providerName || !modelName) {
    throw new Error('LLM provider and model must be explicitly specified');
  }

  // Call LLM service
  return await llmService.generateResponse({
    providerName: String(providerName),
    modelName: String(modelName),
    temperature: config.temperature as number | undefined,
    maxTokens: config.maxTokens as number | undefined,
    systemPrompt,
    userMessage,
    conversationHistory,
    // ... other config
  });
}
```

---

## Error Handling Standards

### Error Response Pattern

```typescript
try {
  // Handler logic
} catch (error) {
  // Log the error
  this.logger.error(`Handler failed: ${error instanceof Error ? error.message : String(error)}`);

  // Return structured failure response
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    error instanceof Error ? error.message : 'Unknown error occurred'
  );
}
```

### Validation Errors

```typescript
// Validate early, fail fast
if (!payload.title || payload.title.trim().length === 0) {
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    'Plan title is required'
  );
}

if (!llmConfig.providerName || !llmConfig.modelName) {
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    'LLM provider and model must be specified'
  );
}
```

### Business Logic Errors

```typescript
const plan = await services.plansService.findOne(planId);

if (!plan) {
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    `Plan not found: ${planId}`
  );
}

if (plan.userId !== userId) {
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    'Unauthorized: Plan belongs to another user'
  );
}
```

---

## Testing Standards

### Unit Tests for Handlers

```typescript
describe('handlePlanCreate', () => {
  it('should create plan with correct LLM config', async () => {
    const request: TaskRequestDto = {
      conversationId: 'conv-123',
      userId: 'user-123',
      userMessage: 'Create a plan',
      payload: {
        action: 'create',
        title: 'My Plan',
        config: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          temperature: 0.7,
        },
      } as PlanCreatePayload,
    };

    const response = await handlePlanCreate(
      mockDefinition,
      request,
      'test-org',
      mockServices,
    );

    expect(response.success).toBe(true);
    expect(response.mode).toBe(AgentTaskMode.PLAN);
    expect(response.payload.content.plan).toBeDefined();
    expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        providerName: 'anthropic',
        modelName: 'claude-3-5-sonnet',
        temperature: 0.7,
      })
    );
  });

  it('should fail if LLM provider not specified', async () => {
    const request: TaskRequestDto = {
      conversationId: 'conv-123',
      userId: 'user-123',
      payload: {
        action: 'create',
        // Missing config.provider and config.model
      } as PlanCreatePayload,
    };

    const response = await handlePlanCreate(
      mockDefinition,
      request,
      'test-org',
      mockServices,
    );

    expect(response.success).toBe(false);
    expect(response.payload.metadata.reason).toContain('provider');
  });
});
```

### Integration Tests

```typescript
describe('Plan API Integration', () => {
  it('should handle full plan create flow', async () => {
    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/demo/blog_post_writer/tasks')
      .send({
        jsonrpc: '2.0',
        method: 'plan',
        id: 'test-task-123',
        params: {
          conversationId: 'conv-123',
          userMessage: 'Create a plan',
          mode: 'plan',
          payload: {
            action: 'create',
            title: 'Blog Post Plan',
            config: {
              provider: 'anthropic',
              model: 'claude-3-5-sonnet',
            },
          },
        },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.mode).toBe('plan');
    expect(response.body.payload.content.plan).toBeDefined();
  });
});
```

---

## Migration from Old Code

### Finding Old Patterns

Look for these anti-patterns:

❌ **Fallback LLM config**
```typescript
const provider = payload.provider || definition.llm?.provider || 'anthropic';
```

❌ **Magic strings instead of enums**
```typescript
if (mode === 'plan') { }
```

❌ **Custom payload fields**
```typescript
payload.customField = 'value';
```

### Replacing with New Patterns

✅ **No fallbacks**
```typescript
const providerName = payload.config?.provider;
if (!providerName) {
  throw new Error('Provider must be specified');
}
```

✅ **Use transport types**
```typescript
import { AgentTaskMode } from '@orchestrator-ai/transport-types';
if (mode === AgentTaskMode.PLAN) { }
```

✅ **Only transport type fields**
```typescript
const payload: PlanCreatePayload = {
  action: 'create',
  title: 'Plan',
  config: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
  },
  // Only fields from transport types!
};
```

---

## Checklist for New Handlers

When creating a new handler:

- [ ] Import transport types for mode/action/payloads
- [ ] Use correct payload type (e.g., `PlanCreatePayload`)
- [ ] Validate action matches handler function
- [ ] Extract LLM config from payload (no fallbacks)
- [ ] Validate LLM config (throw if missing)
- [ ] Execute business logic
- [ ] Use transport types for response content/metadata
- [ ] Return TaskResponseDto.success() or .failure()
- [ ] Handle all errors with try/catch
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Follow existing handler patterns

---

## Quick Reference

**DO:**
✅ Use transport types from `@orchestrator-ai/transport-types`
✅ Extract LLM config from payload
✅ Validate LLM config (no fallbacks)
✅ Use action types for routing
✅ Return responses in A2A format
✅ Handle all errors gracefully
✅ Follow JSON-RPC 2.0 protocol

**DON'T:**
❌ Modify transport types
❌ Use fallback LLM configurations
❌ Add custom payload fields
❌ Add custom response fields
❌ Use magic strings (use enums)
❌ Return non-standard responses
❌ Deviate from A2A protocol
