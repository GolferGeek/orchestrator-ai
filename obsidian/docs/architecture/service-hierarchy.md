# Service Hierarchy - Mode × Action Architecture

## Overview

The orchestrator-ai backend uses a **two-dimensional gate system** where all operations are routed through a single Tasks API that dispatches based on:

1. **Mode** (what artifact type you're working with)
2. **Action** (what operation you're performing)

This creates a clean, extensible architecture where new modes and actions can be added without creating new controllers or endpoints.

## Two-Dimensional Gate System

```
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan' | 'build' | 'converse' | 'orchestrate' | 'tool',
  action: 'create' | 'read' | 'list' | 'edit' | 'delete' | 'set_current' | 'merge' | 'copy' | ...,
  ... operation-specific parameters
}
```

### Dimension 1: Mode (Artifact Type)

| Mode | Artifact | Purpose | Phase |
|------|----------|---------|-------|
| `converse` | Messages | Conversation-only chat | Phase 1, 2 |
| `plan` | Plans | Planning/outlining deliverables | Phase 1 |
| `build` | Deliverables | Creating final outputs | Phase 1 |
| `tool` | Tool Results | MCP tool agent execution | Phase 4 |
| `orchestrate` | Orchestration Runs | Multi-agent workflows | Phase 6+ |

### Dimension 2: Action (Operation Type)

| Action | Requires LLM | Description | Applies To |
|--------|--------------|-------------|------------|
| `create` | ✅ Yes | Generate new artifact or refine existing | plans, deliverables, orchestrations |
| `read` | ❌ No | Retrieve current version | plans, deliverables, orchestrations |
| `list` | ❌ No | Get version history or list items | plans, deliverables, orchestrations |
| `edit` | ❌ No | Manual text edit (save as new version) | plans, deliverables |
| `rerun` | ✅ Yes | Re-execute with different LLM config | deliverables |
| `set_current` | ❌ No | Change current version | plans, deliverables |
| `delete_version` | ❌ No | Delete specific version | plans, deliverables |
| `merge_versions` | ✅ Yes | Merge multiple versions with LLM | plans, deliverables |
| `copy_version` | ❌ No | Duplicate version as new version | plans, deliverables |
| `delete` | ❌ No | Delete entire artifact | plans, deliverables, orchestrations, conversations |
| `pause` | ❌ No | Pause execution | orchestrations |
| `resume` | ❌ No | Resume paused execution | orchestrations |
| `cancel` | ❌ No | Cancel execution | orchestrations |
| `retry_step` | ❌ No | Retry failed step | orchestrations |

## Service Hierarchy

### Level 1: Entry Point (Controller)

```
Agent2AgentTasksController
├── POST /conversations/:id/tasks
└── Routes ALL operations to TasksService
```

**Responsibilities:**
- HTTP request validation
- Authentication/authorization
- Route to TasksService
- Return HTTP responses

### Level 2: Orchestration (TasksService)

```
Agent2AgentTasksService
├── executeTask(params: { mode, action, ... })
│   ├── 1. Validate A2A capabilities
│   ├── 2. Route by MODE → Domain Service
│   ├── 3. Route by ACTION → Operation Handler
│   └── 4. Return unified response
```

**Responsibilities:**
- Mode-based routing (plan → PlansService, build → DeliverablesService, etc.)
- Action-based operation dispatch
- A2A capability checking
- Context assembly (conversation history, current artifacts)
- Adapter orchestration
- WebSocket notification triggering

**Key Method:**
```typescript
async executeTask(params: ExecuteTaskParams): Promise<TaskResult> {
  // 1. Check A2A capability
  await this.checkA2ACapability(params.agentSlug, params.mode, params.action);

  // 2. Route by mode
  const service = this.getServiceForMode(params.mode);

  // 3. Route by action
  const result = await service.executeAction(params.action, params);

  // 4. Notify via WebSocket
  await this.notifyTaskComplete(result);

  return result;
}
```

### Level 3: Domain Services (Mode-Specific)

Each mode has its own domain service that handles all actions for that artifact type.

#### 3.1 PlansService (mode: 'plan')

```
PlansService
├── executeAction(action, params)
│   ├── create → createOrRefine()
│   ├── read → getCurrentPlan()
│   ├── list → getVersionHistory()
│   ├── edit → saveManualEdit()
│   ├── set_current → setCurrentVersion()
│   ├── delete_version → deleteVersion()
│   ├── merge_versions → mergeVersions()
│   ├── copy_version → copyVersion()
│   └── delete → deletePlan()
```

**Responsibilities:**
- Plan CRUD operations
- Version management
- Business logic for plan-specific operations
- Delegates to PlanVersionsService for version operations
- Delegates to PlansRepository for data access

**Sub-Services:**
- `PlanVersionsService` - Version-specific operations
- `PlansRepository` - Database access

#### 3.2 DeliverablesService (mode: 'build')

```
Agent2AgentDeliverablesService
├── executeAction(action, params)
│   ├── create → createOrRefine()
│   ├── read → getCurrentDeliverable()
│   ├── list → getVersionHistory()
│   ├── edit → saveManualEdit()
│   ├── rerun → rerunWithLLM()
│   ├── set_current → setCurrentVersion()
│   ├── delete_version → deleteVersion()
│   ├── merge_versions → mergeVersions()
│   ├── copy_version → copyVersion()
│   └── delete → deleteDeliverable()
```

**Responsibilities:**
- Deliverable CRUD operations
- Version management
- LLM rerun logic
- Format detection (markdown, code, json, etc.)
- Delegates to DeliverableVersionsService for version operations
- Delegates to DeliverablesRepository for data access

**Sub-Services:**
- `DeliverableVersionsService` - Version-specific operations
- `DeliverablesRepository` - Database access

#### 3.3 ConversationsService (mode: 'converse')

```
Agent2AgentConversationsService
├── executeAction(action, params)
│   ├── read_conversation → getMessages()
│   ├── delete_conversation → deleteWithArtifacts()
│   └── export_conversation → exportToFormat()
```

**Responsibilities:**
- Conversation message management
- Cascade deletion (conversation + plans + deliverables)
- Export functionality
- Message history retrieval

#### 3.4 ToolAgentsService (mode: 'tool') - Phase 4

```
ToolAgentsService
├── executeAction(action, params)
│   ├── execute → executeTool()
│   ├── read → getToolResult()
│   └── list → getExecutionHistory()
```

**Responsibilities:**
- MCP tool integration
- Tool execution (Supabase queries, Obsidian operations, etc.)
- Result formatting
- Error handling for tool failures
- Delegates to MCPAdapter for protocol translation

**Sub-Services:**
- `MCPAdapter` - MCP protocol translation
- `SupabaseMCPAdapter` - Supabase-specific MCP
- `ObsidianMCPAdapter` - Obsidian-specific MCP

#### 3.5 OrchestrationsService (mode: 'orchestrate') - Phase 6

```
OrchestrationsService
├── executeAction(action, params)
│   ├── create → createOrchestration()
│   ├── read → getOrchestrationState()
│   ├── list → getRunHistory()
│   ├── pause → pauseExecution()
│   ├── resume → resumeExecution()
│   ├── cancel → cancelExecution()
│   ├── retry_step → retryStep()
│   └── delete → deleteOrchestration()
```

**Responsibilities:**
- Multi-agent workflow execution
- Step-by-step orchestration
- State management (running, paused, failed, complete)
- Inter-agent communication via Tasks API
- Progress tracking and reporting

**Sub-Services:**
- `OrchestrationExecutor` - Step execution engine
- `OrchestrationStateManager` - State persistence
- `OrchestrationsRepository` - Database access

### Level 4: Adapter Layer (Agent Runtime Integration)

Adapters bridge between TasksService and AgentRuntime, handling artifact creation from agent execution results.

#### 4.1 AgentRuntimePlansAdapter

```
AgentRuntimePlansAdapter
├── maybeCreateFromPlanTask(ctx, agentResult)
├── createVersionFromManualEdit(ctx, editedContent)
├── mergeVersions(ctx, versionIds, mergePrompt)
└── copyVersion(ctx, versionId)
```

**Responsibilities:**
- Translate agent execution results → plan artifacts
- Determine if plan should be created (mode === 'plan')
- Create new versions vs update existing plans
- Metadata enrichment (LLM model, task reference)

#### 4.2 AgentRuntimeDeliverablesAdapter

```
AgentRuntimeDeliverablesAdapter
├── maybeCreateFromBuild(ctx, agentResult)
├── createVersionFromManualEdit(ctx, editedContent)
├── rerunWithLLM(ctx, rerunConfig)
├── mergeVersions(ctx, versionIds, mergePrompt)
└── copyVersion(ctx, versionId)
```

**Responsibilities:**
- Translate agent execution results → deliverable artifacts
- Determine if deliverable should be created (mode === 'build')
- Format detection and validation
- LLM rerun with different configs
- Metadata enrichment

#### 4.3 AgentRuntimeToolAdapter - Phase 4

```
AgentRuntimeToolAdapter
├── executeTool(ctx, toolName, toolParams)
├── formatToolResult(rawResult)
└── handleToolError(error)
```

**Responsibilities:**
- Translate tool execution → standardized results
- MCP protocol handling
- Tool-specific result formatting
- Error translation for LLM consumption

### Level 5: Repository Layer (Data Access)

Repositories handle all database operations using Supabase client.

```
PlansRepository
├── create(data)
├── findByConversationId(conversationId, userId)
├── findById(id, userId)
├── update(id, data)
├── delete(id, userId)
└── setCurrentVersion(id, versionId)

PlanVersionsRepository
├── create(planId, versionData)
├── findById(versionId)
├── findByPlanId(planId)
├── getCurrentVersion(planId)
├── deleteVersion(versionId)
└── markAsCurrent(versionId)

DeliverablesRepository (identical structure)
DeliverableVersionsRepository (identical structure)
ConversationsRepository
MessagesRepository
OrchestrationRunsRepository (Phase 6)
ToolExecutionsRepository (Phase 4)
```

**Responsibilities:**
- SQL query execution
- Row mapping to TypeScript entities
- Transaction management
- Foreign key enforcement
- Optimistic locking for version conflicts

## Complete Service Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│ Agent2AgentTasksController                              │
│ (HTTP layer)                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Agent2AgentTasksService                                 │
│ (Orchestration layer - mode × action routing)          │
│                                                         │
│ Dependencies:                                           │
│ - PlansService                                          │
│ - Agent2AgentDeliverablesService                        │
│ - Agent2AgentConversationsService                       │
│ - ToolAgentsService (Phase 4)                           │
│ - OrchestrationsService (Phase 6)                       │
│ - AgentRuntimeService (for LLM execution)               │
│ - WebSocketGateway (for notifications)                  │
│ - AgentRuntimePlansAdapter                              │
│ - AgentRuntimeDeliverablesAdapter                       │
└──┬──────────────┬──────────────┬──────────────┬─────────┘
   │              │              │              │
   │              │              │              │
   ▼              ▼              ▼              ▼
┌──────────┐  ┌────────────┐  ┌─────────┐  ┌──────────────┐
│Plans     │  │Deliverables│  │Converse │  │Tool (Phase 4)│
│Service   │  │Service     │  │Service  │  │Service       │
└──┬───────┘  └──┬─────────┘  └──┬──────┘  └──┬───────────┘
   │             │               │             │
   │             │               │             │
   ▼             ▼               ▼             ▼
┌──────────┐  ┌────────────┐  ┌─────────┐  ┌──────────┐
│Plan      │  │Deliverable │  │Messages │  │MCP       │
│Versions  │  │Versions    │  │Repo     │  │Adapter   │
│Service   │  │Service     │  └─────────┘  └──────────┘
└──┬───────┘  └──┬─────────┘
   │             │
   │             │
   ▼             ▼
┌──────────┐  ┌────────────┐
│Plans     │  │Deliverables│
│Repo      │  │Repo        │
└──────────┘  └────────────┘
```

## Action Matrix - All Combinations

### Plans (mode: 'plan')

| Action | Service Method | LLM Required | Sub-Services Used | Returns |
|--------|---------------|--------------|-------------------|---------|
| create | PlansService.createOrRefine() | ✅ | AgentRuntime, PlanVersionsService | Plan + Version |
| read | PlansService.getCurrentPlan() | ❌ | PlanVersionsService | Plan + Current Version |
| list | PlansService.getVersionHistory() | ❌ | PlanVersionsService | Version[] |
| edit | PlansService.saveManualEdit() | ❌ | PlanVersionsService | New Version |
| set_current | PlansService.setCurrentVersion() | ❌ | PlanVersionsService | Updated Plan |
| delete_version | PlansService.deleteVersion() | ❌ | PlanVersionsService | Success |
| merge_versions | PlansService.mergeVersions() | ✅ | AgentRuntime, PlanVersionsService | Merged Version |
| copy_version | PlansService.copyVersion() | ❌ | PlanVersionsService | Copied Version |
| delete | PlansService.deletePlan() | ❌ | PlansRepository | Success |

### Deliverables (mode: 'build')

| Action | Service Method | LLM Required | Sub-Services Used | Returns |
|--------|---------------|--------------|-------------------|---------|
| create | DeliverablesService.createOrRefine() | ✅ | AgentRuntime, DeliverableVersionsService | Deliverable + Version |
| read | DeliverablesService.getCurrentDeliverable() | ❌ | DeliverableVersionsService | Deliverable + Current Version |
| list | DeliverablesService.getVersionHistory() | ❌ | DeliverableVersionsService | Version[] |
| edit | DeliverablesService.saveManualEdit() | ❌ | DeliverableVersionsService | New Version |
| rerun | DeliverablesService.rerunWithLLM() | ✅ | AgentRuntime, DeliverableVersionsService | New Version |
| set_current | DeliverablesService.setCurrentVersion() | ❌ | DeliverableVersionsService | Updated Deliverable |
| delete_version | DeliverablesService.deleteVersion() | ❌ | DeliverableVersionsService | Success |
| merge_versions | DeliverablesService.mergeVersions() | ✅ | AgentRuntime, DeliverableVersionsService | Merged Version |
| copy_version | DeliverablesService.copyVersion() | ❌ | DeliverableVersionsService | Copied Version |
| delete | DeliverablesService.deleteDeliverable() | ❌ | DeliverablesRepository | Success |

### Conversations (mode: 'converse')

| Action | Service Method | LLM Required | Sub-Services Used | Returns |
|--------|---------------|--------------|-------------------|---------|
| read_conversation | ConversationsService.getMessages() | ❌ | MessagesRepository | Message[] |
| delete_conversation | ConversationsService.deleteWithArtifacts() | ❌ | PlansService, DeliverablesService | Success |
| export_conversation | ConversationsService.exportToFormat() | ❌ | MessagesRepository | Exported String |

### Tool Agents (mode: 'tool') - Phase 4

| Action | Service Method | LLM Required | Sub-Services Used | Returns |
|--------|---------------|--------------|-------------------|---------|
| execute | ToolAgentsService.executeTool() | ❌ | MCPAdapter, ToolExecutionsRepository | Tool Result |
| read | ToolAgentsService.getToolResult() | ❌ | ToolExecutionsRepository | Cached Result |
| list | ToolAgentsService.getExecutionHistory() | ❌ | ToolExecutionsRepository | Execution[] |

### Orchestrations (mode: 'orchestrate') - Phase 6

| Action | Service Method | LLM Required | Sub-Services Used | Returns |
|--------|---------------|--------------|-------------------|---------|
| create | OrchestrationsService.createOrchestration() | ✅ | AgentRuntime, OrchestrationExecutor | Orchestration Run |
| read | OrchestrationsService.getOrchestrationState() | ❌ | OrchestrationRunsRepository | Run State |
| list | OrchestrationsService.getRunHistory() | ❌ | OrchestrationRunsRepository | Run[] |
| pause | OrchestrationsService.pauseExecution() | ❌ | OrchestrationStateManager | Updated State |
| resume | OrchestrationsService.resumeExecution() | ❌ | OrchestrationExecutor | Updated State |
| cancel | OrchestrationsService.cancelExecution() | ❌ | OrchestrationStateManager | Updated State |
| retry_step | OrchestrationsService.retryStep() | ❌ | OrchestrationExecutor | Step Result |
| delete | OrchestrationsService.deleteOrchestration() | ❌ | OrchestrationRunsRepository | Success |

## Benefits of This Architecture

### ✅ Single Entry Point
- All operations go through one controller: `Agent2AgentTasksController`
- Consistent API surface
- Easy to add global middleware (auth, logging, rate limiting)

### ✅ Mode × Action Extensibility
- Add new mode → create new domain service
- Add new action → add method to domain service
- No controller changes needed
- Clean separation of concerns

### ✅ Code Simplification
As the user said: **"the really good part about doing this is that it will simplify our code so much!"**

- Plans and Deliverables share identical patterns
- No duplicate controller code
- Consistent service structure across all modes
- Easy to understand and maintain

### ✅ A2A Protocol Compliance
- All operations (read, write, delete) go through Tasks API
- Capability checks enforce authorization
- All operations audited as tasks
- Agents can discover available operations via YAML

### ✅ Testability
- Each service layer can be tested independently
- Mock dependencies at each level
- Clear interfaces between layers
- Action-specific test coverage

### ✅ Future-Proof
- Phase 4: Add `ToolAgentsService` for MCP tools
- Phase 6: Add `OrchestrationsService` for multi-agent workflows
- Phase 7+: Add new modes/actions without refactoring

## Implementation Priority

### Phase 1 (Current)
1. ✅ Agent2AgentTasksService (orchestration layer)
2. ✅ PlansService + PlanVersionsService
3. ✅ Agent2AgentDeliverablesService + DeliverableVersionsService
4. ✅ AgentRuntimePlansAdapter + AgentRuntimeDeliverablesAdapter
5. ⏳ Add action-based routing to TasksService
6. ⏳ Implement all actions for plans and deliverables

### Phase 4 (Tool Agents)
1. Create ToolAgentsService
2. Create MCPAdapter base class
3. Implement SupabaseMCPAdapter
4. Implement ObsidianMCPAdapter
5. Add 'tool' mode to TasksService routing

### Phase 6 (Orchestrations)
1. Create OrchestrationsService
2. Create OrchestrationExecutor
3. Create OrchestrationStateManager
4. Add 'orchestrate' mode to TasksService routing
5. Implement all orchestration actions

## Example Implementation - TasksService

```typescript
@Injectable()
export class Agent2AgentTasksService {
  constructor(
    private readonly plansService: PlansService,
    private readonly deliverablesService: Agent2AgentDeliverablesService,
    private readonly conversationsService: Agent2AgentConversationsService,
    private readonly agentRuntime: AgentRuntimeService,
    private readonly websocket: WebSocketGateway,
  ) {}

  async executeTask(params: ExecuteTaskParams): Promise<TaskResult> {
    // 1. Validate A2A capability
    await this.checkA2ACapability(
      params.agentSlug,
      params.mode,
      params.action
    );

    // 2. Route by mode
    let service: any;
    switch (params.mode) {
      case 'plan':
        service = this.plansService;
        break;
      case 'build':
        service = this.deliverablesService;
        break;
      case 'converse':
        service = this.conversationsService;
        break;
      // Phase 4:
      // case 'tool':
      //   service = this.toolAgentsService;
      //   break;
      // Phase 6:
      // case 'orchestrate':
      //   service = this.orchestrationsService;
      //   break;
      default:
        throw new BadRequestException(`Unsupported mode: ${params.mode}`);
    }

    // 3. Route by action
    const result = await service.executeAction(params.action, params);

    // 4. Notify via WebSocket
    await this.websocket.broadcast('task:completed', {
      taskId: result.taskId,
      conversationId: params.conversationId,
      mode: params.mode,
      action: params.action,
      result,
    });

    return result;
  }

  private async checkA2ACapability(
    agentSlug: string,
    mode: string,
    action: string
  ): Promise<void> {
    const agent = await this.agentsService.findBySlug(agentSlug);
    const capability = `${action}_${mode}`;

    const hasCapability = agent.a2a_capabilities?.some(
      cap => cap.capability === capability
    );

    if (!hasCapability) {
      throw new ForbiddenException(
        `Agent ${agentSlug} does not have capability: ${capability}`
      );
    }
  }
}
```

## Next Steps

1. **Document current state**: Audit existing services to map to this hierarchy
2. **Identify gaps**: Find services that don't fit the pattern
3. **Refactor TasksService**: Add action-based routing
4. **Implement missing actions**: merge_versions, copy_version, set_current, etc.
5. **Add capability checking**: Enforce A2A protocol
6. **Update frontend**: Use action parameter in all API calls
7. **Write tests**: Cover all mode × action combinations
