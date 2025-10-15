# PRD: Implement Agent Modes (Talk, Plan, Build)

**Effort Type**: feature-implementation
**Branch**: implement-agent-modes (to be created)
**Started**: 2025-10-14
**Owner**: Matt (GolferGeek)
**Priority**: HIGH (blocking Phase 1 testing)

---

## Problem Statement

Context agents currently return failure responses for CONVERSE and PLAN modes. This blocks:
- Phase 1 testing of the agent stack
- Natural conversational interaction with agents
- Plan creation and management workflow
- Complete agent functionality

**Current State**:
```typescript
// context-agent-runner.service.ts lines 67-97
protected async handleConverse(...) {
  return TaskResponseDto.failure(
    AgentTaskMode.CONVERSE,
    'CONVERSE mode not yet implemented for context agents',
  );
}

protected async handlePlan(...) {
  return TaskResponseDto.failure(
    AgentTaskMode.PLAN,
    'PLAN mode not yet implemented for context agents',
  );
}
```

---

## Solution Overview

Implement **user-controlled three-mode system** with base class implementations and A2A transport-types conformance.

**Three Modes, User-Driven**:
1. **Talk** (CONVERSE mode) - Natural conversation, no deliverables
2. **Plan** (PLAN mode) - Create/edit structured plans, no deliverables
3. **Build** (BUILD mode) - Execute plan or conversation, create deliverables

**User Controls Flow**:
- Type message → Choose how to send it: Talk / Plan / Build
- Keyboard shortcuts: `Ctrl+T` / `Ctrl+P` / `Ctrl+B`
- Visual mode indicator shows current state
- Users learn their own workflow

**Architecture**:
- Talk and Plan implemented in `BaseAgentRunner` (overridable)
- Build remains abstract (each runner implements specifically)
- All modes conform to A2A transport-types
- Support all mode+action combinations

---

## Mode + Action Matrix

### CONVERSE Mode

**Actions**: None (conversational only)

**Payload**: `ConverseModePayload`
```typescript
{
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}
```

**Response**: `ConverseResponseContent`
```typescript
{
  message: string;  // The assistant's response
}
```

**Metadata**: `ConverseResponseMetadata` (provider, model, usage)

---

### PLAN Mode

**Actions**: `create | read | list | edit | rerun | set_current | delete_version | merge_versions | copy_version | delete`

**Default Action**: `create` (if not specified)

#### Plan Actions Detail

**1. `create`** - Create new plan or return existing
```typescript
payload: {
  action: 'create',
  title?: string,
  content?: string,
  forceNew?: boolean
}
response: PlanCreateResponseContent (plan + version + isNew)
```

**2. `read`** - Read plan (current or specific version)
```typescript
payload: {
  action: 'read',
  versionId?: string
}
response: PlanReadResponseContent (plan + currentVersion)
```

**3. `list`** - List all plan versions
```typescript
payload: {
  action: 'list',
  includeArchived?: boolean
}
response: PlanListResponseContent (plan + versions array)
```

**4. `edit`** - Create new version with edited content
```typescript
payload: {
  action: 'edit',
  editedContent: string,
  comment?: string
}
response: PlanCreateResponseContent (plan + new version)
```

**5. `rerun`** - Regenerate plan with different LLM config
```typescript
payload: {
  action: 'rerun',
  versionId: string,
  rerunConfig: {
    provider: string,
    model: string,
    temperature?: number,
    maxTokens?: number
  }
}
response: PlanRerunResponseContent (plan + new version)
```

**6. `set_current`** - Set a version as current
```typescript
payload: {
  action: 'set_current',
  versionId: string
}
response: PlanReadResponseContent (plan with updated currentVersionId)
```

**7. `delete_version`** - Delete specific version
```typescript
payload: {
  action: 'delete_version',
  versionId: string
}
response: success/failure
```

**8. `merge_versions`** - Merge multiple versions
```typescript
payload: {
  action: 'merge_versions',
  versionIds: string[],
  mergePrompt: string
}
response: PlanCreateResponseContent (plan + merged version)
```

**9. `copy_version`** - Copy version as new version
```typescript
payload: {
  action: 'copy_version',
  versionId: string
}
response: PlanCreateResponseContent (plan + copied version)
```

**10. `delete`** - Delete entire plan
```typescript
payload: {
  action: 'delete'
}
response: success/failure
```

---

### BUILD Mode

**Actions**: `create | read | list | edit | rerun | set_current | delete_version | merge_versions | copy_version | delete`

**Default Action**: `create` (if not specified)

#### Build Actions Detail

**Same action structure as PLAN mode**, but operates on deliverables instead of plans.

**Key Difference**: `create` action in BUILD mode:
- Executes agent logic (LLM call, API call, function execution)
- Creates deliverable with result
- Uses plan context if available, otherwise uses conversation

```typescript
payload: {
  action: 'create',
  title?: string,
  type?: string,
  content?: string,
  planVersionId?: string  // Specific plan version to build from
}
response: BuildCreateResponseContent (deliverable + version + isNew)
```

---

## Architecture: Base Class Implementation

### BaseAgentRunner Structure

```typescript
export abstract class BaseAgentRunner implements IAgentRunner {

  constructor(
    protected readonly llmService: LLMService,
    protected readonly contextOptimization: ContextOptimizationService,
    protected readonly plansService: PlansService,
    protected readonly conversationsService: ConversationsService,
    protected readonly deliverablesService: DeliverablesService,
  ) {}

  /**
   * Main execution - routes to mode handlers
   */
  async execute(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const mode = request.mode;

    switch (mode) {
      case AgentTaskMode.CONVERSE:
        return await this.handleConverse(definition, request, organizationSlug);
      case AgentTaskMode.PLAN:
        return await this.handlePlan(definition, request, organizationSlug);
      case AgentTaskMode.BUILD:
        return await this.handleBuild(definition, request, organizationSlug);
      default:
        return TaskResponseDto.failure(mode, 'Unsupported mode');
    }
  }

  /**
   * CONVERSE mode - Implemented in base, overridable
   * Pure conversation, no deliverables, no plans
   */
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Default implementation - runners can override
  }

  /**
   * PLAN mode - Implemented in base, overridable
   * Routes to action handlers based on payload.action
   */
  protected async handlePlan(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = request.payload as PlanModePayload;
    const action = payload?.action || 'create';

    // Route to appropriate action handler
    switch (action) {
      case 'create':
        return await this.handlePlanCreate(definition, request, organizationSlug);
      case 'read':
        return await this.handlePlanRead(definition, request, organizationSlug);
      case 'list':
        return await this.handlePlanList(definition, request, organizationSlug);
      case 'edit':
        return await this.handlePlanEdit(definition, request, organizationSlug);
      case 'rerun':
        return await this.handlePlanRerun(definition, request, organizationSlug);
      case 'set_current':
        return await this.handlePlanSetCurrent(definition, request, organizationSlug);
      case 'delete_version':
        return await this.handlePlanDeleteVersion(definition, request, organizationSlug);
      case 'merge_versions':
        return await this.handlePlanMergeVersions(definition, request, organizationSlug);
      case 'copy_version':
        return await this.handlePlanCopyVersion(definition, request, organizationSlug);
      case 'delete':
        return await this.handlePlanDelete(definition, request, organizationSlug);
      default:
        return TaskResponseDto.failure(AgentTaskMode.PLAN, `Unsupported plan action: ${action}`);
    }
  }

  /**
   * BUILD mode - Implemented in base, routes to action handlers
   * Only the 'create' action execution is delegated to runner-specific implementation
   */
  protected async handleBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    const payload = request.payload as BuildModePayload;
    const action = payload?.action || 'create';

    // Route to appropriate action handler
    switch (action) {
      case 'create':
        // Delegate actual work to runner-specific implementation
        return await this.executeBuild(definition, request, organizationSlug);
      case 'read':
        return await this.handleBuildRead(definition, request, organizationSlug);
      case 'list':
        return await this.handleBuildList(definition, request, organizationSlug);
      case 'edit':
        return await this.handleBuildEdit(definition, request, organizationSlug);
      case 'rerun':
        return await this.handleBuildRerun(definition, request, organizationSlug);
      case 'set_current':
        return await this.handleBuildSetCurrent(definition, request, organizationSlug);
      case 'delete_version':
        return await this.handleBuildDeleteVersion(definition, request, organizationSlug);
      case 'merge_versions':
        return await this.handleBuildMergeVersions(definition, request, organizationSlug);
      case 'copy_version':
        return await this.handleBuildCopyVersion(definition, request, organizationSlug);
      case 'delete':
        return await this.handleBuildDelete(definition, request, organizationSlug);
      default:
        return TaskResponseDto.failure(AgentTaskMode.BUILD, `Unsupported build action: ${action}`);
    }
  }

  /**
   * Execute build - Abstract, each runner implements specific build logic
   * This is the only method runners MUST implement
   */
  protected abstract executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto>;

  // ===== PLAN ACTION HANDLERS (Base Implementation) =====

  protected async handlePlanCreate(...): Promise<TaskResponseDto> {
    // Check if plan already exists for this conversation
    // If exists and !forceNew, return existing
    // Otherwise, create new plan from conversation history
  }

  protected async handlePlanRead(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  protected async handlePlanList(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  protected async handlePlanEdit(...): Promise<TaskResponseDto> {
    // Create new version with edited content
  }

  protected async handlePlanRerun(...): Promise<TaskResponseDto> {
    // Fetch version, regenerate with new LLM config
  }

  protected async handlePlanSetCurrent(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  protected async handlePlanDeleteVersion(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  protected async handlePlanMergeVersions(...): Promise<TaskResponseDto> {
    // Fetch versions, merge with LLM, create new version
  }

  protected async handlePlanCopyVersion(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  protected async handlePlanDelete(...): Promise<TaskResponseDto> {
    // Delegate to PlansService
  }

  // ===== BUILD ACTION HANDLERS (Base Implementation - CRUD only) =====

  protected async handleBuildRead(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  protected async handleBuildList(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  protected async handleBuildEdit(...): Promise<TaskResponseDto> {
    // Create new deliverable version with edited content
  }

  protected async handleBuildRerun(...): Promise<TaskResponseDto> {
    // Fetch deliverable version, regenerate with new config
    // Calls executeBuild() with rerun context
  }

  protected async handleBuildSetCurrent(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  protected async handleBuildDeleteVersion(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  protected async handleBuildMergeVersions(...): Promise<TaskResponseDto> {
    // Fetch deliverable versions, merge, create new version
    // Calls executeBuild() with merged context
  }

  protected async handleBuildCopyVersion(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  protected async handleBuildDelete(...): Promise<TaskResponseDto> {
    // Delegate to DeliverablesService
  }

  // ===== HELPER METHODS (Available to all runners) =====

  protected async fetchConversationHistory(request: TaskRequestDto): Promise<any[]> {}
  protected async fetchExistingPlan(request: TaskRequestDto): Promise<any> {}
  protected async optimizeContext(history: any[], definition: AgentRuntimeDefinition): Promise<any> {}
  protected buildConversationalPrompt(definition: AgentRuntimeDefinition, context: any): string {}
  protected buildPlanningPrompt(definition: AgentRuntimeDefinition, context: any): string {}
  protected async callLLM(...): Promise<any> {}
  protected handleError(mode: AgentTaskMode, error: Error): TaskResponseDto {}
  protected resolveUserId(request: TaskRequestDto): string | null {}
  protected resolveConversationId(request: TaskRequestDto): string | null {}
}
```

---

## Runner-Specific Implementations

### ContextAgentRunner

```typescript
export class ContextAgentRunnerService extends BaseAgentRunner {

  // Uses base handleConverse() - no override needed

  // Uses base handlePlan() - no override needed

  // Uses base handleBuild() - no override needed (all routing done in base)

  // Only implements the actual build execution
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // 1. Fetch plan (if planVersionId specified, use that; otherwise current plan)
    const plan = await this.fetchExistingPlan(request);

    // 2. If no plan, fetch conversation history
    const context = plan
      ? plan.content
      : await this.fetchConversationHistory(request);

    // 3. Build system prompt with agent definition
    const systemPrompt = this.buildExecutionPrompt(definition, context);

    // 4. Call LLM
    const llmResponse = await this.callLLM(
      definition.llmConfig,
      systemPrompt,
      request.userMessage,
    );

    // 5. Create deliverable via DeliverablesService
    const deliverable = await this.deliverablesService.create({
      conversationId: this.resolveConversationId(request),
      userId: this.resolveUserId(request),
      agentSlug: definition.slug,
      title: request.payload.title || 'Deliverable',
      type: request.payload.type || 'text',
      content: llmResponse.content,
      planVersionId: request.payload.planVersionId,
    });

    // 6. Return BuildCreateResponseContent
    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      deliverable,
      version: deliverable.currentVersion,
      isNew: true,
    });
  }

  // Helper for building execution prompt
  private buildExecutionPrompt(
    definition: AgentRuntimeDefinition,
    context: any,
  ): string {
    return `${definition.systemPrompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;
  }
}
```

### ApiAgentRunner

```typescript
export class ApiAgentRunnerService extends BaseAgentRunner {

  // Uses base handleConverse()

  // Uses base handlePlan()

  // Uses base handleBuild() - all routing in base

  // Implements actual build execution for API agents
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // 1. Fetch plan or conversation
    const plan = await this.fetchExistingPlan(request);
    const context = plan
      ? plan.content
      : await this.fetchConversationHistory(request);

    // 2. Call external API
    const apiResponse = await this.callExternalAPI(
      definition.apiConfig,
      context,
      request.userMessage,
    );

    // 3. Handle polling/webhooks/SSE for async API agents
    const finalResult = await this.waitForAPICompletion(apiResponse);

    // 4. Create deliverable from API response
    const deliverable = await this.deliverablesService.create({
      conversationId: this.resolveConversationId(request),
      userId: this.resolveUserId(request),
      agentSlug: definition.slug,
      title: request.payload.title || 'API Result',
      type: request.payload.type || 'api_response',
      content: finalResult.data,
      planVersionId: request.payload.planVersionId,
    });

    // 5. Return BuildCreateResponseContent
    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      deliverable,
      version: deliverable.currentVersion,
      isNew: true,
    });
  }

  private async callExternalAPI(...): Promise<any> { /* API call logic */ }
  private async waitForAPICompletion(...): Promise<any> { /* Polling/webhook logic */ }
}
```

### OrchestratorAgentRunner

```typescript
export class OrchestratorAgentRunnerService extends BaseAgentRunner {

  // Override CONVERSE for orchestrator-specific conversation
  protected async handleConverse(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Show available sub-agents, explain orchestration capabilities
    const subAgents = await this.getSubAgents(organizationSlug);
    const conversationHistory = await this.fetchConversationHistory(request);

    const systemPrompt = `${definition.systemPrompt}\n\nAvailable agents:\n${subAgents.map(a => `- ${a.slug}: ${a.description}`).join('\n')}`;

    const response = await this.callLLM(
      definition.llmConfig,
      systemPrompt,
      request.userMessage,
    );

    return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
      message: response.content,
    });
  }

  // Override PLAN create for DAG planning
  protected async handlePlanCreate(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // Create orchestration DAG instead of simple plan
    const conversationHistory = await this.fetchConversationHistory(request);
    const subAgents = await this.getSubAgents(organizationSlug);

    const dagPrompt = `Create an orchestration DAG for the following request:\n${request.userMessage}\n\nAvailable agents: ${subAgents.map(a => a.slug).join(', ')}`;

    const dagPlan = await this.callLLM(
      definition.llmConfig,
      dagPrompt,
      conversationHistory,
    );

    const plan = await this.plansService.create({
      conversationId: this.resolveConversationId(request),
      title: request.payload.title || 'Orchestration Plan',
      content: dagPlan.content,
      type: 'dag',
    });

    return TaskResponseDto.success(AgentTaskMode.PLAN, {
      plan,
      version: plan.currentVersion,
      isNew: true,
    });
  }

  // Implement BUILD for orchestration
  protected async executeBuild(
    definition: AgentRuntimeDefinition,
    request: TaskRequestDto,
    organizationSlug: string | null,
  ): Promise<TaskResponseDto> {
    // 1. Fetch DAG plan
    const plan = await this.fetchExistingPlan(request);

    // 2. Parse DAG
    const dag = this.parseDAG(plan.content);

    // 3. Execute orchestration DAG
    const results = await this.executeDAG(dag, organizationSlug);

    // 4. Aggregate results into deliverable
    const deliverable = await this.deliverablesService.create({
      conversationId: this.resolveConversationId(request),
      userId: this.resolveUserId(request),
      agentSlug: definition.slug,
      title: request.payload.title || 'Orchestration Result',
      type: 'orchestration',
      content: results,
      planVersionId: plan.currentVersionId,
    });

    return TaskResponseDto.success(AgentTaskMode.BUILD, {
      deliverable,
      version: deliverable.currentVersion,
      isNew: true,
    });
  }

  private async getSubAgents(organizationSlug: string | null): Promise<any[]> { /* ... */ }
  private parseDAG(content: any): any { /* ... */ }
  private async executeDAG(dag: any, organizationSlug: string | null): Promise<any> { /* ... */ }
}
```

---

## File Organization Strategy

To avoid overly large files, the base class implementation will be split into focused modules:

### File Structure

**Base Agent Runner**:
```
apps/api/src/agent2agent/services/
├── base-agent-runner.service.ts          (~200 lines)
│   ├── execute() - Main router
│   ├── handleConverse() - Entry point
│   ├── handlePlan() - Entry point
│   ├── handleBuild() - Entry point
│   ├── executeBuild() - Abstract method
│   └── Constructor + DI
│
├── base-agent-runner/
│   ├── converse.handlers.ts              (~150 lines)
│   │   ├── executeConverse()
│   │   ├── buildConversationalPrompt()
│   │   └── Conversation-specific helpers
│   │
│   ├── plan.handlers.ts                  (~400 lines)
│   │   ├── handlePlanCreate()
│   │   ├── handlePlanEdit()
│   │   ├── handlePlanRerun()
│   │   ├── handlePlanMergeVersions()
│   │   ├── buildPlanningPrompt()
│   │   ├── validatePlanStructure()
│   │   └── Plan-specific helpers
│   │
│   ├── build.handlers.ts                 (~400 lines)
│   │   ├── handleBuildRead()
│   │   ├── handleBuildList()
│   │   ├── handleBuildEdit()
│   │   ├── handleBuildRerun()
│   │   ├── handleBuildMergeVersions()
│   │   ├── validateDeliverableIO()
│   │   └── Deliverable-specific helpers
│   │
│   └── shared.helpers.ts                 (~150 lines)
│       ├── fetchConversationHistory()
│       ├── fetchExistingPlan()
│       ├── optimizeContext()
│       ├── callLLM()
│       ├── handleError()
│       └── Common utilities
```

**Total**: ~1300 lines across 5 files vs ~1300 lines in one file

**Benefits**:
- Each file focused on single responsibility
- Easy to test individual handlers
- Clear separation between modes
- Easier to navigate and maintain
- Supports parallel development

---

## Database Schema Updates

### Agents Table

Add three new JSONB columns to the `agents` table:

```sql
-- Migration: add plan_structure, deliverable_structure, and io_schema columns
ALTER TABLE public.agents
ADD COLUMN plan_structure JSONB DEFAULT NULL,
ADD COLUMN deliverable_structure JSONB DEFAULT NULL,
ADD COLUMN io_schema JSONB DEFAULT NULL;

COMMENT ON COLUMN public.agents.plan_structure IS 'JSON Schema defining the expected structure of plans created by this agent';
COMMENT ON COLUMN public.agents.deliverable_structure IS 'JSON Schema defining the expected structure of deliverables created by this agent';
COMMENT ON COLUMN public.agents.io_schema IS 'JSON Schema defining technical input and output validation (types, constraints)';
```

**Distinction**:
- **plan_structure**: Semantic structure for plans (sections, outline, etc.)
- **deliverable_structure**: Semantic structure for deliverables (chapters, components, etc.)
- **io_schema**: Technical validation (data types, required fields, constraints)

**Why separate deliverable_structure from io_schema.output**:
- `deliverable_structure`: Describes **what** sections/components the deliverable should have (semantic)
- `io_schema.output`: Describes **how** the data is shaped (technical validation)
- Allows agents to have structured deliverables without strict technical schemas
- Example: Blog post needs `{introduction, body, conclusion}` (deliverable_structure) but output could be JSON or Markdown (io_schema)

**Example agent record**:

```typescript
{
  id: "uuid",
  slug: "blog-post-writer",
  name: "Blog Post Writer",
  agent_type: "context",
  organization_slug: "demo",
  system_prompt: "You are a professional blog post writer...",
  llm_config: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7
  },
  capabilities: ["conversation", "planning", "content-generation"],

  // NEW COLUMNS:

  // Semantic structure for planning
  plan_structure: {
    type: "object",
    required: ["sections", "target_audience"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            key_points: { type: "array", items: { type: "string" } }
          }
        }
      },
      target_audience: { type: "string" },
      keywords: { type: "array", items: { type: "string" } },
      tone: { type: "string", enum: ["professional", "casual", "technical"] }
    }
  },

  // Semantic structure for deliverables
  deliverable_structure: {
    type: "object",
    required: ["introduction", "body", "conclusion"],
    properties: {
      introduction: {
        type: "object",
        properties: {
          hook: { type: "string" },
          thesis: { type: "string" }
        }
      },
      body: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section_title: { type: "string" },
            paragraphs: { type: "array", items: { type: "string" } }
          }
        }
      },
      conclusion: {
        type: "object",
        properties: {
          summary: { type: "string" },
          call_to_action: { type: "string" }
        }
      }
    }
  },

  // Technical input/output validation
  io_schema: {
    input: {
      type: "object",
      properties: {
        topic: { type: "string" },
        length: { type: "number", minimum: 500 }
      }
    },
    output: {
      type: "object",
      required: ["content", "metadata"],
      properties: {
        content: {
          type: "string",
          minLength: 500,
          description: "The blog post content (could be Markdown, HTML, or structured JSON)"
        },
        metadata: {
          type: "object",
          required: ["word_count"],
          properties: {
            word_count: { type: "number" },
            reading_time: { type: "number" },
            keywords_used: { type: "array", items: { type: "string" } }
          }
        }
      }
    }
  }
}
```

### Plans, Plan Versions, Deliverables, Deliverable Versions Tables

**No changes needed.** These tables remain untouched. The agent's `plan_structure` and `deliverable_structure` are used as guidance in the system prompt when creating plans and deliverables, but we don't track which version was used.

---

## Data Migration & Backward Compatibility

### Migration Strategy

**Phase 0 Migration** adds nullable columns, so existing agents continue working:

```sql
-- Migration: add plan_structure, deliverable_structure, and io_schema columns
ALTER TABLE public.agents
ADD COLUMN plan_structure JSONB DEFAULT NULL,
ADD COLUMN deliverable_structure JSONB DEFAULT NULL,
ADD COLUMN io_schema JSONB DEFAULT NULL;
```

**Backward Compatibility Guarantees**:
1. ✅ All three new columns are `DEFAULT NULL`
2. ✅ Existing agents work without schemas (no validation if null)
3. ✅ Code checks `if (definition.planStructure)` before using
4. ✅ UI disables Plan button when `plan_structure` is null
5. ✅ Agents can be updated incrementally (no big-bang migration)

### Seed Data Updates

**New Agents** created after migration should include schemas:

```typescript
// scripts/seed-agents.ts or similar
const blogPostWriter = {
  slug: 'blog-post-writer',
  name: 'Blog Post Writer',
  agent_type: 'context',
  system_prompt: 'You are a professional blog post writer...',

  // NEW: Add schemas for new agents
  plan_structure: {
    type: 'object',
    required: ['sections', 'target_audience'],
    properties: { /* ... */ }
  },

  deliverable_structure: {
    type: 'object',
    required: ['introduction', 'body', 'conclusion'],
    properties: { /* ... */ }
  },

  io_schema: {
    input: { /* ... */ },
    output: { /* ... */ }
  }
};
```

### Existing Agent Backfill

**Option 1: Manual Update** (Recommended for Phase 1)
- Update Blog Post Writer agent only (needed for Phase 1 tests)
- Other agents updated as needed, incrementally
- No disruption to existing functionality

```sql
-- Update Blog Post Writer with schemas
UPDATE public.agents
SET
  plan_structure = '{"type": "object", "required": ["sections", "target_audience"], ...}'::jsonb,
  deliverable_structure = '{"type": "object", "required": ["introduction", "body", "conclusion"], ...}'::jsonb,
  io_schema = '{"input": {...}, "output": {...}}'::jsonb
WHERE slug = 'blog-post-writer';
```

**Option 2: Bulk Backfill Script** (Future enhancement)
- Create script to generate default schemas for all context agents
- Apply intelligent defaults based on agent_type and capabilities
- Run as separate migration after Phase 1

### Null Handling in Code

**All code defensively handles null schemas**:

```typescript
// In plan.handlers.ts
protected async handlePlanCreate(...) {
  const conversationHistory = await this.fetchConversationHistory(request);

  // Only include structure if defined
  const planningPrompt = this.buildPlanningPrompt(
    definition,
    conversationHistory,
    definition.planStructure, // May be null - prompt builder handles it
  );

  const llmResponse = await this.callLLM(...);

  // Only validate if structure defined
  if (definition.planStructure) {
    this.validatePlanStructure(llmResponse.content, definition.planStructure);
  }

  return plan;
}
```

**Prompt Builder Graceful Degradation**:

```typescript
protected buildPlanningPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: any[],
  planStructure?: any, // Optional
): string {
  let prompt = `${definition.systemPrompt}\n\nConversation history:\n`;
  prompt += conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  // Only add structure guidance if provided
  if (planStructure) {
    prompt += `\n\nYour plan must follow this structure:\n${JSON.stringify(planStructure, null, 2)}`;
  } else {
    prompt += `\n\nGenerate a structured plan based on the conversation.`;
  }

  return prompt;
}
```

### Agent Configuration Tooling

**role-agent-adder.md** and **role-agent-updater.md** already exist for agent management:
- ✅ Update these roles to prompt for new schema columns
- ✅ Make schemas optional (can skip and add later)
- ✅ Provide examples of valid JSON Schema structures
- ✅ Validate JSON Schema format before saving

**No new tooling required** - existing agent management flows handle new columns.

---

## Agent Configuration Integration

### Plan Structure Usage

Agents can define a `plan_structure` in the database:

```typescript
{
  slug: "blog-post-writer",
  agent_type: "context",
  plan_structure: {
    type: "object",
    required: ["sections", "target_audience", "keywords"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            key_points: { type: "array", items: { type: "string" } }
          }
        }
      },
      target_audience: { type: "string" },
      keywords: { type: "array", items: { type: "string" } },
      tone: { type: "string", enum: ["professional", "casual", "technical"] }
    }
  }
}
```

**How it's used in PLAN mode**:

```typescript
// In plan.handlers.ts > handlePlanCreate()
protected async handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const conversationHistory = await this.fetchConversationHistory(request);

  // Build planning prompt with structure guidance
  const planningPrompt = this.buildPlanningPrompt(
    definition,
    conversationHistory,
    definition.planStructure, // <-- Use plan_structure from agent config
  );

  const llmResponse = await this.callLLM(
    definition.llmConfig,
    planningPrompt,
    'Generate a structured plan based on our conversation.',
  );

  // Validate plan conforms to structure
  if (definition.planStructure) {
    this.validatePlanStructure(llmResponse.content, definition.planStructure);
  }

  const plan = await this.plansService.create({
    conversationId: this.resolveConversationId(request),
    title: request.payload.title || 'Plan',
    content: llmResponse.content,
  });

  return TaskResponseDto.success(AgentTaskMode.PLAN, {
    plan,
    version: plan.currentVersion,
    isNew: true,
  });
}
```

### IO Schema Usage

Agents define `io_schema` for deliverables:

```typescript
{
  slug: "blog-post-writer",
  io_schema: {
    input: {
      type: "object",
      properties: {
        topic: { type: "string" },
        length: { type: "number", minimum: 500 }
      }
    },
    output: {
      type: "object",
      required: ["content", "metadata"],
      properties: {
        content: { type: "string", minLength: 500 },
        metadata: {
          type: "object",
          properties: {
            word_count: { type: "number" },
            reading_time: { type: "number" },
            keywords_used: { type: "array" }
          }
        }
      }
    }
  }
}
```

**How it's used in BUILD mode**:

```typescript
// In context-agent-runner.service.ts > executeBuild()
protected async executeBuild(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const plan = await this.fetchExistingPlan(request);
  const context = plan ? plan.content : await this.fetchConversationHistory(request);

  // Build execution prompt with both structure and schema guidance
  const systemPrompt = this.buildExecutionPrompt(
    definition,
    context,
    definition.deliverableStructure, // <-- Semantic structure
    definition.ioSchema?.output,      // <-- Technical validation
  );

  const llmResponse = await this.callLLM(
    definition.llmConfig,
    systemPrompt,
    request.userMessage,
  );

  // Validate deliverable conforms to structure
  if (definition.deliverableStructure) {
    this.validateDeliverableStructure(llmResponse.content, definition.deliverableStructure);
  }

  // Validate output conforms to technical schema
  if (definition.ioSchema?.output) {
    this.validateDeliverableSchema(llmResponse.content, definition.ioSchema.output);
  }

  const deliverable = await this.deliverablesService.create({
    conversationId: this.resolveConversationId(request),
    userId: this.resolveUserId(request),
    agentSlug: definition.slug,
    title: request.payload.title || 'Deliverable',
    type: request.payload.type || 'text',
    content: llmResponse.content,
    planVersionId: request.payload.planVersionId,
  });

  return TaskResponseDto.success(AgentTaskMode.BUILD, {
    deliverable,
    version: deliverable.currentVersion,
    isNew: true,
  });
}
```

**Schema Validation Helpers** (in build.handlers.ts and plan.handlers.ts):

```typescript
// plan.handlers.ts
protected validatePlanStructure(content: any, structure: any): void {
  const ajv = new Ajv();
  const valid = ajv.validate(structure, content);
  if (!valid) {
    throw new ValidationError('Plan does not conform to agent structure', ajv.errors);
  }
}

// build.handlers.ts
protected validateDeliverableStructure(content: any, structure: any): void {
  const ajv = new Ajv();
  const valid = ajv.validate(structure, content);
  if (!valid) {
    throw new ValidationError('Deliverable does not conform to agent structure', ajv.errors);
  }
}

protected validateDeliverableSchema(content: any, schema: any): void {
  const ajv = new Ajv();
  const valid = ajv.validate(schema, content);
  if (!valid) {
    throw new ValidationError('Deliverable output does not conform to io_schema', ajv.errors);
  }
}
```

### Prompt Building with Schemas

```typescript
// In plan.handlers.ts
protected buildPlanningPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: any[],
  planStructure?: any,
): string {
  let prompt = `${definition.systemPrompt}\n\nConversation history:\n`;
  prompt += conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  if (planStructure) {
    prompt += `\n\nYour plan must follow this structure:\n${JSON.stringify(planStructure, null, 2)}`;
    prompt += `\n\nPlease generate a plan that conforms to this structure.`;
  }

  return prompt;
}

// In context-agent-runner.service.ts
private buildExecutionPrompt(
  definition: AgentRuntimeDefinition,
  context: any,
  deliverableStructure?: any,
  outputSchema?: any,
): string {
  let prompt = `${definition.systemPrompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;

  if (deliverableStructure) {
    prompt += `\n\nYour deliverable must follow this structure:\n${JSON.stringify(deliverableStructure, null, 2)}`;
  }

  if (outputSchema) {
    prompt += `\n\nYour output must also conform to this technical schema:\n${JSON.stringify(outputSchema, null, 2)}`;
  }

  if (deliverableStructure || outputSchema) {
    prompt += `\n\nPlease generate output that validates against both the structure and schema.`;
  }

  return prompt;
}
```

---

## UI/UX Design

### Message Input Controls

```
┌───────────────────────────────────────────────────────┐
│ Type your message...                                  │
├───────────────────────────────────────────────────────┤
│ [Talk]  [Plan]  [Build]      Mode: 💬 Talking        │
│ Ctrl+T  Ctrl+P  Ctrl+B                                │
└───────────────────────────────────────────────────────┘
```

### Mode Indicator (Chat Header)

```
┌───────────────────────────────────────────────────────┐
│ 💬 Talking with Blog Post Writer                     │
│    Building conversation naturally...                 │
└───────────────────────────────────────────────────────┘

// After creating plan:
┌───────────────────────────────────────────────────────┐
│ 📋 Planning with Blog Post Writer                    │
│    Plan: "AI Agent Orchestration Patterns" v3        │
└───────────────────────────────────────────────────────┘

// During build:
┌───────────────────────────────────────────────────────┐
│ 🔨 Building with Blog Post Writer                    │
│    Creating deliverable... [Cancel]                   │
└───────────────────────────────────────────────────────┘
```

### Conversation-Only Agents

For agents without planning capability:
```typescript
{
  slug: "golf-rules-helper",
  capabilities: ["conversation"],  // Only Talk + Build enabled
  plan_structure: null
}
```

UI adapts:
- Only **Talk** and **Build** buttons enabled
- **Plan** button disabled/hidden
- Mode indicator: "💬 Talking" or "🔨 Building"

---

## Request/Response Conformance

### Task Request Structure

```typescript
{
  mode: 'converse' | 'plan' | 'build',
  userMessage: string,
  conversationId: string,
  sessionId: string,
  payload: ConverseModePayload | PlanModePayload | BuildModePayload,
  metadata: ConverseRequestMetadata | PlanRequestMetadata | BuildRequestMetadata
}
```

### Task Response Structure

```typescript
{
  success: boolean,
  mode: 'converse' | 'plan' | 'build',
  content: ConverseResponseContent | PlanCreateResponseContent | BuildCreateResponseContent | ...,
  metadata: ConverseResponseMetadata | PlanResponseMetadata | BuildResponseMetadata,
  error?: string
}
```

---

## Implementation Plan

### Phase 0: Database Migration
**Files**: `supabase/migrations/YYYYMMDDHHMMSS_add_agent_schemas.sql`

1. Create migration file
2. Add `plan_structure` JSONB column to `agents` table
3. Add `deliverable_structure` JSONB column to `agents` table
4. Add `io_schema` JSONB column to `agents` table
5. Run migration on local database
6. Verify columns exist

**Note**: No changes to plans, plan_versions, deliverables, or deliverable_versions tables.

### Phase 1: File Organization & Base Structure
**Files**:
- `base-agent-runner.service.ts`
- `base-agent-runner/converse.handlers.ts`
- `base-agent-runner/plan.handlers.ts`
- `base-agent-runner/build.handlers.ts`
- `base-agent-runner/shared.helpers.ts`

1. Create directory structure
2. Set up main base-agent-runner.service.ts with routing
3. Create handler files with empty method stubs
4. Add shared helpers file
5. Update imports and module registration

### Phase 2: CONVERSE Mode Implementation
**Files**: `base-agent-runner/converse.handlers.ts`, `base-agent-runner/shared.helpers.ts`

1. Implement `executeConverse()` in converse.handlers.ts
2. Implement helper methods in shared.helpers.ts:
   - `fetchConversationHistory()`
   - `callLLM()`
3. Implement `buildConversationalPrompt()` in converse.handlers.ts
4. Return `ConverseResponseContent` conforming to transport-types
5. Write unit tests

### Phase 3: PLAN Mode Implementation
**Files**: `base-agent-runner/plan.handlers.ts`, `base-agent-runner/shared.helpers.ts`

1. Implement action router in handlePlan() (base-agent-runner.service.ts)
2. Implement all 10 plan action handlers in plan.handlers.ts:
   - `handlePlanCreate()` - Generate plan from conversation with LLM, use plan_structure
   - `handlePlanRead()` - Delegate to PlansService
   - `handlePlanList()` - Delegate to PlansService
   - `handlePlanEdit()` - Create new version
   - `handlePlanRerun()` - Regenerate with new LLM config
   - `handlePlanSetCurrent()` - Delegate to PlansService
   - `handlePlanDeleteVersion()` - Delegate to PlansService
   - `handlePlanMergeVersions()` - Merge with LLM, create new version
   - `handlePlanCopyVersion()` - Delegate to PlansService
   - `handlePlanDelete()` - Delegate to PlansService
3. Implement helper methods:
   - `fetchExistingPlan()`
   - `buildPlanningPrompt()` (with plan_structure integration)
   - `validatePlanStructure()`
4. Return `PlanResponseContent` conforming to transport-types
5. Write unit tests for each action

### Phase 4: BUILD Mode Implementation (Base)
**Files**: `base-agent-runner/build.handlers.ts`

1. Implement action router in handleBuild() (base-agent-runner.service.ts)
2. Implement all 9 BUILD CRUD action handlers (not 'create') in build.handlers.ts:
   - `handleBuildRead()` - Delegate to DeliverablesService
   - `handleBuildList()` - Delegate to DeliverablesService
   - `handleBuildEdit()` - Create new deliverable version
   - `handleBuildRerun()` - Calls executeBuild() with rerun context
   - `handleBuildSetCurrent()` - Delegate to DeliverablesService
   - `handleBuildDeleteVersion()` - Delegate to DeliverablesService
   - `handleBuildMergeVersions()` - Calls executeBuild() with merged context
   - `handleBuildCopyVersion()` - Delegate to DeliverablesService
   - `handleBuildDelete()` - Delegate to DeliverablesService
3. Implement helper methods:
   - `validateDeliverableOutput()`
4. Return `BuildResponseContent` conforming to transport-types
5. Write unit tests for each action

### Phase 5: Context Agent - BUILD Execution
**Files**: `context-agent-runner.service.ts`

1. Implement `executeBuild()`:
   - Fetch plan or conversation
   - Call LLM to generate deliverable
   - Use io_schema output for validation
   - Save via DeliverablesService
   - Return `BuildCreateResponseContent`
2. Implement `buildExecutionPrompt()` with io_schema integration
3. Write unit tests

### Phase 6: Integration & Testing
1. Test mode transitions (Talk → Plan → Build)
2. Test all action combinations
3. Verify transport-types conformance
4. Test plan_structure validation
5. Test io_schema validation
6. Test conversation-only agents
7. Test with Blog Post Writer agent

### Phase 7: Frontend Implementation
**Files**:
- `apps/web/components/chat/MessageInput.tsx`
- `apps/web/components/chat/ModeSelector.tsx` (new)
- `apps/web/components/chat/ChatHeader.tsx`
- `apps/web/hooks/useKeyboardShortcuts.ts`
- `apps/web/stores/conversationStore.ts`

1. **Mode Selector Component** (~150 lines):
   - Create ModeSelector component with Talk/Plan/Build buttons
   - Implement keyboard shortcuts (Ctrl+T, Ctrl+P, Ctrl+B)
   - Handle mode state and selection
   - Disable Plan button for agents without plan_structure

2. **Chat Header Updates** (~50 lines):
   - Add mode indicator (💬 Talking, 📋 Planning, 🔨 Building)
   - Show current plan/deliverable context
   - Display agent capabilities

3. **Message Input Integration** (~100 lines):
   - Integrate ModeSelector into MessageInput
   - Update submit handler to include selected mode
   - Pass mode to API in TaskRequestDto
   - Visual feedback for current mode

4. **State Management** (~100 lines):
   - Add currentMode to conversation store
   - Track last plan/deliverable for conversation
   - Sync mode state across components
   - Persist mode preference per conversation

5. **Keyboard Shortcuts Hook** (~80 lines):
   - Register Ctrl+T/P/B shortcuts
   - Handle focus management
   - Prevent conflicts with browser shortcuts
   - Visual feedback when shortcut triggered

6. **Agent Capabilities UI** (~60 lines):
   - Read plan_structure from agent definition
   - Conditionally show/hide Plan button
   - Display "conversation-only" badge for agents without planning
   - Tooltip explaining agent capabilities

### Phase 8: Integration & Testing
1. Test mode transitions (Talk → Plan → Build)
2. Test all action combinations
3. Verify transport-types conformance
4. Test plan_structure validation
5. Test io_schema validation
6. Test conversation-only agents
7. Test keyboard shortcuts
8. Test UI state synchronization
9. Test with Blog Post Writer agent

### Phase 9: Unblock Phase 1 Testing
1. Update Blog Post Writer agent with plan_structure and io_schema
2. Run Phase 1 Tests 1-8
3. Fix any issues discovered
4. Document any deviations

---

## Success Criteria

### Backend Implementation Complete When:
- ✅ CONVERSE mode implemented in BaseAgentRunner (overridable)
- ✅ PLAN mode with all 10 actions implemented in BaseAgentRunner (overridable)
- ✅ BUILD mode with all 10 action handlers implemented in BaseAgentRunner (CRUD operations)
- ✅ `executeBuild()` abstract method implemented in ContextAgentRunner
- ✅ All responses conform to A2A transport-types
- ✅ Unit tests passing for all modes and actions
- ✅ Integration tests passing
- ✅ Database migration applied (agents table only)
- ✅ No breaking changes to existing code

### Frontend Implementation Complete When:
- ✅ ModeSelector component with Talk/Plan/Build buttons
- ✅ Keyboard shortcuts (Ctrl+T/P/B) working
- ✅ Mode indicator in chat header
- ✅ Mode state synchronized across components
- ✅ Plan button disabled for agents without plan_structure
- ✅ UI shows mode transitions correctly

### Phase 1 Unblocked When:
- ✅ Blog Post Writer agent can talk (CONVERSE mode)
- ✅ Agent can create plans from conversation (PLAN create)
- ✅ Agent can edit/update plans (PLAN edit)
- ✅ Agent can build from plan (BUILD create via executeBuild)
- ✅ UI mode selector works with all three modes
- ✅ Keyboard shortcuts functional
- ✅ Phase 1 Tests 1-8 pass

---

## Transport-Types Conformance Checklist

### CONVERSE Mode
- ✅ Payload: `ConverseModePayload` (temperature, maxTokens, stop)
- ✅ Request Metadata: `ConverseRequestMetadata` (source, userId, context)
- ✅ Response Content: `ConverseResponseContent` (message)
- ✅ Response Metadata: `ConverseResponseMetadata` (provider, model, usage)

### PLAN Mode
- ✅ All 10 actions supported (create, read, list, edit, rerun, set_current, delete_version, merge_versions, copy_version, delete)
- ✅ Each action has proper payload type
- ✅ Request Metadata: `PlanRequestMetadata` (source, userId)
- ✅ Response Content: Action-specific (PlanCreateResponseContent, PlanReadResponseContent, etc.)
- ✅ Response Metadata: `PlanResponseMetadata` (provider, model, usage, routingDecision)

### BUILD Mode
- ✅ All 10 actions supported (same as PLAN)
- ✅ Each action has proper payload type
- ✅ Request Metadata: `BuildRequestMetadata` (source, userId, deliverableType, format)
- ✅ Response Content: Action-specific (BuildCreateResponseContent, etc.)
- ✅ Response Metadata: `BuildResponseMetadata` (provider, model, usage, usedPlanContext)

---

## Testing Strategy

### Unit Tests

**BaseAgentRunner Tests**:
- CONVERSE mode returns conversational response
- CONVERSE mode does not create deliverable or plan
- PLAN create action generates plan from conversation
- PLAN read action retrieves plan
- PLAN edit action creates new version
- All 10 PLAN actions work correctly
- Error handling for all modes

**ContextAgentRunner Tests**:
- BUILD create executes from plan
- BUILD create executes from conversation (no plan)
- BUILD read retrieves deliverable
- All 10 BUILD actions work correctly
- BUILD mode creates deliverable correctly

### Integration Tests

**End-to-End Flows**:
1. Talk → Plan → Build (full workflow)
2. Talk → Build (skip planning)
3. Plan edit → Build (iterate plan, then build)
4. Multiple plan versions
5. Multiple deliverable versions

### Manual Testing (Phase 1)
Once implemented, execute Phase 1 test plan:
- Test 1: Start Conversation (CONVERSE mode)
- Test 2: Converse Back-and-Forth
- Test 3: Transition to Plan Mode (PLAN create)
- Test 4: Navigate Between Talk and Plan
- Test 5: Update Plan (PLAN edit)
- Test 6: Merge Plan (PLAN merge_versions)
- Test 7: Delete Plan (PLAN delete)
- Test 8: Build Button Presence

---

## Rollout Plan

1. **Week 1**: Implement base class (CONVERSE + PLAN)
2. **Week 1**: Implement ContextAgentRunner (BUILD)
3. **Week 2**: Unit tests + integration tests
4. **Week 2**: Manual testing with Blog Post Writer
5. **Week 2**: Unblock Phase 1 testing

---

## Effort Estimate

**Backend Implementation**: 3-5 days
- Database migration: 1-2 hours
- Base CONVERSE: 4-6 hours
- Base PLAN (10 actions): 8-12 hours
- Base BUILD (9 CRUD actions): 4-6 hours
- Context BUILD execution (executeBuild): 2-4 hours
- Helper methods: 4-6 hours
- Unit tests: 8-10 hours

**Frontend Implementation**: 2-3 days
- ModeSelector component: 4-6 hours
- Keyboard shortcuts: 2-3 hours
- Chat header updates: 2-3 hours
- State management: 3-4 hours
- Agent capabilities UI: 2-3 hours
- Frontend testing: 3-4 hours

**Integration & Testing**: 2-3 days
- Backend integration tests: 4-6 hours
- Frontend-backend integration: 4-6 hours
- Manual testing: 4-6 hours
- Bug fixes: 6-10 hours

**Total**: 7-11 days

---

## Open Questions

1. Should PLAN create always generate from conversation, or support direct content input?
2. How should we handle very long conversation histories (truncation strategy)?
3. Should CONVERSE mode support streaming (SSE) in the future?
4. Should validation failures (plan_structure, deliverable_structure, io_schema) be hard errors or warnings?
5. How should we handle schema evolution when agents update their structures?

---

## Related Documents

- [Transport Types: Converse](../../../apps/transport-types/modes/converse.types.ts)
- [Transport Types: Plan](../../../apps/transport-types/modes/plan.types.ts)
- [Transport Types: Build](../../../apps/transport-types/modes/build.types.ts)
- [Agent Task Mode Enum](../../../apps/transport-types/shared/enums.ts)
- [Base Agent Runner](../../../apps/api/src/agent2agent/services/base-agent-runner.service.ts)
- [Context Agent Runner](../../../apps/api/src/agent2agent/services/context-agent-runner.service.ts)
- [Phase 1 Testing Plan](../agent-stack-testing/phase-1-plan.md)

---

**Next Step**: Review this PRD with GolferGeek, then create implementation plan with detailed tasks.
