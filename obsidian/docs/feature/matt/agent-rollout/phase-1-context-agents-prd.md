# Phase 1: Context Agents (Deliverable Workflow)

## Overview
Establish the complete end-to-end workflow for context agents (like blog_post_writer) with full deliverable lifecycle including conversation, planning, building, editing, versioning, and LLM reruns.

## Goals
- Get blog_post_writer fully working as the reference implementation
- Implement complete converse → plan → build → edit workflow
- Enable deliverables panel with text deliverables
- Support deliverable versions and LLM reruns
- Validate the agent2agent architecture with a production-ready agent

## Scope

### In Scope
1. **Context Agent Execution**
   - Converse mode: Chat with agent about requirements
   - Plan mode: Generate outline/structure for deliverable
   - Build mode: Create the actual deliverable content

2. **Deliverables Panel (Frontend)**
   - Display deliverables for current conversation
   - Show deliverable versions with timestamps
   - View/edit deliverable content
   - Switch between versions
   - Delete deliverables

3. **Plan Editing Workflow** (Conversation-Driven)
   - **Initial Plan Generation:**
     - User switches to PLAN mode (or agent suggests planning)
     - Agent receives: full conversation history + mode='plan'
     - Agent generates initial plan outline
     - Plan stored as deliverable (type='plan', format='markdown' or 'json')

   - **Plan Refinement via Conversation:**
     - User can refine plan through natural conversation
     - Each refinement message includes:
       - Full conversation history
       - **Current version of the plan** (most important context)
       - User's latest message (refinement request)
       - Mode still set to 'plan'
     - Agent generates updated plan based on conversation + current plan
     - New plan version created automatically

   - **Plan Context for Building:**
     - When switching to BUILD mode, agent receives:
       - Full conversation history
       - **Approved plan** (current version of plan deliverable)
       - Mode='build'
     - Agent uses plan as blueprint for deliverable

   - **NOT just button clicks:**
     - Switching modes without a message → agent uses conversation history only
     - Switching modes WITH a message → that message is the primary instruction
     - Example: User types "make it more technical" then clicks BUILD
       - Agent sees: conversation + plan + "make it more technical" + mode='build'

4. **Deliverable Versioning**
   - Create initial version on build
   - Track version history
   - Set current version
   - Copy version to create new iteration

5. **LLM Rerun Functionality**
   - "Rerun with different LLM" on any deliverable version
   - Preserve original task context
   - Create new version with rerun result
   - Track which LLM created which version

6. **Backend Services (Already Exists)**
   - Agent2AgentConversationsService
   - Agent2AgentTasksService
   - Agent2AgentDeliverablesService
   - DeliverablesController (universal API)
   - DeliverableVersionsController

7. **Frontend Services (Need Updates)**
   - agent2AgentConversationsService ✅ (exists)
   - agent2AgentTasksService ❌ (needs creation)
   - agent2AgentDeliverablesService ❌ (needs creation)
   - agent2AgentChatStore ❌ (needs creation - duplicate of agentChatStore)

### Out of Scope
- Image deliverables (Phase 1 focuses on text only)
- API agents
- Orchestration
- File-based agents (those continue to work separately)
- Conversation-only agents (next phase)

## Success Criteria

### User Can:
1. ✅ Start conversation with blog_post_writer
2. ✅ Discuss blog post requirements in converse mode
3. ✅ Switch to plan mode → agent generates outline
4. ✅ View plan in deliverables panel
5. ✅ Edit plan directly or via conversation
6. ✅ Switch to build mode → agent creates blog post
7. ✅ View deliverable in deliverables panel
8. ✅ See version history
9. ✅ Click "Rerun with different LLM" → creates new version
10. ✅ Edit deliverable content manually
11. ✅ Save edits as new version
12. ✅ Switch between versions seamlessly

### Technical Requirements:
1. ✅ All database agents route through agent2agent services (not legacy services)
2. ✅ Frontend has separate store for database agents (agent2AgentChatStore)
3. ✅ Deliverables API works identically for file-based and database agents
4. ✅ Conversation titles show friendly time format ("2h ago", "Yesterday")
5. ✅ No mixing of file-based and database agent code paths

## Implementation Tasks

### Key Architectural Decisions

#### 1. Plans = Deliverables Pattern

**Plans and Deliverables follow IDENTICAL patterns:**
- Both have their own table (`plans`, `deliverables`)
- Both have versions table (`plan_versions`, `deliverable_versions`)
- Both support: versioning, LLM rerun, manual edit, copy, current version tracking
- Both are one-per-conversation
- Both use the same review → refine → approve workflow

**Migration Required:**
- ❌ **DROP** `conversation_plan` table (old single-field approach)
- ✅ **CREATE** `plans` and `plan_versions` tables (new versioned approach)

This creates a consistent mental model:
- **Planning phase:** Create plan → review plan → refine plan → approve plan (all versioned)
- **Building phase:** Create deliverable → review deliverable → refine deliverable → approve deliverable (all versioned)

#### 2. Mode-Based Routing (No Separate Controllers)

**Tasks API handles everything - mode determines routing:**
- ❌ **OLD:** Separate PlansController, DeliverablesController with their own endpoints
- ✅ **NEW:** Single Tasks API with mode-based internal routing

**Benefits:**
- Frontend has ONE entry point: `POST /api/agent2agent/conversations/:id/tasks`
- Mode parameter determines what gets created (`plan` | `build` | `converse`)
- Plans and Deliverables become internal implementation details
- Cleaner A2A protocol compliance
- Easier to extend with new modes/artifact types

**Implementation:**
```typescript
// Frontend calls:
POST /api/agent2agent/conversations/:id/tasks
{ mode: 'plan', message: 'focus on healthcare' }

// Backend Agent2AgentTasksService:
switch (mode) {
  case 'plan':   → PlansAdapter → PlansService
  case 'build':  → DeliverablesAdapter → DeliverablesService
  case 'converse': → No artifacts
}
```

**Result:** No need for separate Plans/Deliverables controllers. Tasks service orchestrates everything.

### Backend - Database Schema
1. **Create plans tables migration (mirrors deliverables structure exactly)**
   ```sql
   -- Drop old conversation_plan table (no longer needed - plans work like deliverables now)
   DROP TABLE IF EXISTS conversation_plan CASCADE;

   -- plans table (IDENTICAL structure to deliverables table)
   CREATE TABLE plans (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     conversation_id UUID NOT NULL UNIQUE,  -- One plan per conversation
     user_id UUID NOT NULL,
     agent_name VARCHAR(255) NOT NULL,
     namespace VARCHAR(255),
     title TEXT NOT NULL,
     type VARCHAR(50) DEFAULT 'plan',
     current_version_id UUID,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
   );

   CREATE INDEX idx_plans_conversation_id ON plans(conversation_id);
   CREATE INDEX idx_plans_user_id ON plans(user_id);

   -- plan_versions table (IDENTICAL structure to deliverable_versions table)
   CREATE TABLE plan_versions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     plan_id UUID NOT NULL,
     version_number INTEGER NOT NULL,
     content TEXT NOT NULL,
     format VARCHAR(50) DEFAULT 'markdown',
     is_current_version BOOLEAN DEFAULT false,
     created_by_type VARCHAR(50),  -- 'conversation_task', 'manual_edit', 'llm_rerun'
     task_id UUID,
     metadata JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
     UNIQUE (plan_id, version_number)
   );

   CREATE INDEX idx_plan_versions_plan_id ON plan_versions(plan_id);
   CREATE INDEX idx_plan_versions_is_current ON plan_versions(is_current_version);
   ```

### Backend - Services (Plans - Identical to Deliverables)
2. **Create PlansService** (apps/api/src/agent2agent/plans/plans.service.ts)
   - EXACT MIRROR of Agent2AgentDeliverablesService
   - Methods:
     - `create(conversationId, userId, agentName, namespace, title, content, format)` - Create plan
     - `findByConversationId(conversationId, userId)` - Get plan for conversation
     - `findOne(planId, userId)` - Get specific plan
     - `update(planId, userId, updates)` - Update plan metadata
     - `delete(planId, userId)` - Delete plan and all versions
     - `listPlans(userId, filters?)` - List all plans for user

3. **Create PlanVersionsService** (apps/api/src/agent2agent/plans/plan-versions.service.ts)
   - EXACT MIRROR of DeliverableVersionsService
   - Methods:
     - `createVersion(planId, content, format, createdByType, taskId?, metadata?)` - Create new plan version
     - `getCurrentVersion(planId)` - Get current plan version
     - `getVersionHistory(planId)` - Get all versions with metadata
     - `setCurrentVersion(planId, versionId)` - Switch current version
     - `findOne(versionId)` - Get specific version
     - `update(versionId, content, metadata?)` - Update version content (for manual edits)
     - `copyVersion(versionId)` - Duplicate version as new version

4. **NO separate PlansController - Tasks API handles everything**
   - **ALTERNATIVE ARCHITECTURE:** Tasks API interprets mode and routes internally
   - Plans and Deliverables are **implementation details**, not separate APIs
   - Frontend only interacts with Tasks API + websocket

   **Tasks API becomes mode-aware:**
   ```typescript
   // All requests go through Tasks API
   POST   /api/agent2agent/conversations/:id/tasks
   {
     mode: 'plan' | 'build' | 'converse',
     message?: string,
     action?: 'create' | 'refine' | 'rerun' | 'edit'
   }

   // Tasks controller/service routes based on mode:
   // - mode='plan' → creates/updates plan versions
   // - mode='build' → creates/updates deliverable versions
   // - mode='converse' → conversation only

   // Read endpoints for UI display (can be separate or in Tasks)
   GET    /api/agent2agent/conversations/:id/plan              // Get current plan
   GET    /api/agent2agent/conversations/:id/plan/versions     // Get plan history
   GET    /api/agent2agent/conversations/:id/deliverable       // Get current deliverable
   GET    /api/agent2agent/conversations/:id/deliverable/versions  // Get deliverable history
   ```

   **Key Benefits:**
   - Single entry point (Tasks API)
   - Mode determines what gets created (plan vs deliverable)
   - No need to expose separate Plans/Deliverables controllers
   - Cleaner A2A protocol compliance
   - Frontend doesn't need to know about internal storage structure

5. **Create PlansModule** (apps/api/src/agent2agent/plans/plans.module.ts)
   ```typescript
   @Module({
     imports: [
       SupabaseModule,
       LLMModule,  // For rerun functionality
       forwardRef(() => Agent2AgentModule)
     ],
     controllers: [PlansController, PlanVersionsController],
     providers: [PlansService, PlanVersionsService, PlansRepository, PlanVersionsRepository],
     exports: [PlansService, PlanVersionsService]
   })
   export class PlansModule {}
   ```

6. **Create Plans Repositories** (mirrors deliverables repositories)
   - `PlansRepository` - Database access for plans table
   - `PlanVersionsRepository` - Database access for plan_versions table

7. **Create AgentRuntimePlansAdapter** (mirrors AgentRuntimeDeliverablesAdapter)
   - This adapter sits between Agent2AgentTasksService and PlansService
   - Follows same pattern as deliverables adapter
   ```typescript
   // apps/api/src/agent-platform/services/agent-runtime-plans.adapter.ts
   @Injectable()
   export class AgentRuntimePlansAdapter {
     constructor(
       private readonly plansService: PlansService,
       private readonly planVersionsService: PlanVersionsService,
     ) {}

     /**
      * Called by Agent2AgentTasksService after plan mode execution
      * Creates or updates plan based on agent result
      */
     async maybeCreateFromPlanTask(
       ctx: AgentExecutionContext,
       result: AgentResult,
     ): Promise<{ planId: string; version: PlanVersion } | null> {
       if (result.mode !== 'plan') return null;

       // Check if plan exists for conversation
       const existingPlan = await this.plansService.findByConversationId(
         ctx.conversationId,
         ctx.userId,
       );

       if (existingPlan) {
         // Create new version
         const version = await this.planVersionsService.createVersion(
           existingPlan.id,
           result.content,
           result.format || 'markdown',
           'conversation_task',
           ctx.taskId,
           { llm_model: ctx.llmModel, agentName: ctx.agentName },
         );
         return { planId: existingPlan.id, version };
       } else {
         // Create new plan with first version
         const plan = await this.plansService.create(
           ctx.conversationId,
           ctx.userId,
           ctx.agentName,
           ctx.namespace,
           result.title || 'Plan',
           result.content,
           result.format || 'markdown',
         );
         return { planId: plan.id, version: plan.currentVersion };
       }
     }
   }
   ```

   **Usage in Agent2AgentTasksService:**
   ```typescript
   async executeTask(params) {
     // ... execute agent ...
     const result = await agent.execute(context);

     // Adapter handles plan creation logic
     if (params.mode === 'plan') {
       await this.plansAdapter.maybeCreateFromPlanTask(ctx, result);
     }

     // Adapter handles deliverable creation logic
     if (params.mode === 'build') {
       await this.deliverablesAdapter.maybeCreateFromBuild(ctx, result);
     }

     return result;
   }
   ```

### Backend - Plans vs Deliverables (Parallel Structure)

**The Plan → Build workflow mirrors the Deliverable versioning workflow:**

| Feature | Plans | Deliverables |
|---------|-------|--------------|
| **Table** | `plans` | `deliverables` |
| **Versions Table** | `plan_versions` | `deliverable_versions` |
| **Service** | `PlansService` | `Agent2AgentDeliverablesService` |
| **Versions Service** | `PlanVersionsService` | `DeliverableVersionsService` |
| **Controller** | `PlansController` | `DeliverablesController` |
| **Repository** | `PlansRepository` | `DeliverablesRepository` |
| **One per conversation** | ✅ Yes | ✅ Yes |
| **Version history** | ✅ Yes | ✅ Yes |
| **LLM rerun** | ✅ Yes | ✅ Yes |
| **Manual edit** | ✅ Yes | ✅ Yes |
| **Copy version** | ✅ Yes | ✅ Yes |
| **Current version tracking** | ✅ Yes | ✅ Yes |
| **Metadata** | ✅ Yes | ✅ Yes |

**Workflow:**
1. **Converse** → Build conversation context
2. **Plan Mode** → Create/refine plan (stored in `plans` table with versions)
   - Plan v1, Plan v2, Plan v3... (iterative refinement via conversation)
3. **Build Mode** → Create deliverable (stored in `deliverables` table with versions)
   - Deliverable v1, Deliverable v2... (build/rerun/edit iterations)

**Key Insight:** Plans ARE deliverables of type 'plan'. They follow the exact same lifecycle:
- Review, review, review → approve
- Each review creates a new version
- Can rerun with different LLM
- Can manually edit
- Version history preserved

### Backend (Already Complete - Deliverables Side)
- ✅ Agent2AgentConversationsService
- ✅ Agent2AgentTasksService
- ✅ Agent2AgentDeliverablesService
- ✅ DeliverablesController
- ✅ DeliverableVersionsController with rerun endpoint

**TODO: Create identical Plans side (mirror of Deliverables)**

### Frontend - Services Layer
1. **Create agent2AgentTasksService.ts**
   - `createTask(agentSlug, conversationId, mode, userMessage, planId?)`
   - `getTaskStatus(taskId)`
   - `listTasks(conversationId)`

2. **Create agent2AgentPlansService.ts** (NEW)
   - `getPlanByConversation(conversationId)` - Get plan for conversation
   - `createPlan(conversationId, title, content)` - Create initial plan
   - `updatePlan(planId, updates)` - Update plan
   - `getPlanVersions(planId)` - Get version history
   - `createPlanVersion(planId, content)` - Create new version
   - `setCurrentVersion(versionId)` - Switch current version

3. **Create agent2AgentDeliverablesService.ts**
   - `getDeliverableByConversation(conversationId)` - Get deliverable for conversation
   - `getDeliverable(deliverableId)`
   - `getDeliverableVersions(deliverableId)`
   - `rerunWithLLM(versionId, llmConfig)`
   - `updateDeliverable(deliverableId, updates)`

### Frontend - Store Layer
4. **Create stores/agent2AgentChatStore/**
   - Duplicate agentChatStore structure
   - Update to use agent2agent services (not legacy)
   - Remove file-based agent logic
   - Clean implementation for database agents only

5. **Update agentConversationsStore.ts**
   - Already routes to agent2AgentConversationsService ✅
   - Verify conversation title formatting works

### Backend - Agent2Agent Protocol Flow (Mode-Based Routing)

**CRITICAL: Single Tasks API - Mode determines what gets created**

```
┌─────────────┐
│  Frontend   │  Everything goes through Tasks API
└──────┬──────┘
       │
       │ POST /api/agent2agent/conversations/:id/tasks
       │ { mode: 'plan', message: 'focus on healthcare' }
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Agent2AgentTasksController                               │
│                                                          │
│ createTask(conversationId, { mode, message, action })   │
│                                                          │
│ Routes to: Agent2AgentTasksService.executeTask()        │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Agent2AgentTasksService.executeTask()                   │
│                                                          │
│ 1. Load conversation history                            │
│ 2. Load context based on mode:                          │
│    - mode='plan' → load current plan (if exists)        │
│    - mode='build' → load current plan + deliverable     │
│ 3. Assemble full context (history + plan + message)     │
│ 4. Execute agent with mode                              │
│ 5. Receive agent result                                 │
│ 6. **Route based on mode** ← KEY DECISION POINT         │
└──────┬───────────────────────────────────────────────────┘
       │
       │ Agent returns: { content: '...', format: 'markdown' }
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Mode-Based Internal Routing (in executeTask)            │
│                                                          │
│ switch (mode) {                                          │
│   case 'plan':                                           │
│     → AgentRuntimePlansAdapter                           │
│        .maybeCreateFromPlanTask()                        │
│        → PlansService / PlanVersionsService              │
│                                                          │
│   case 'build':                                          │
│     → AgentRuntimeDeliverablesAdapter                    │
│        .maybeCreateFromBuild()                           │
│        → DeliverablesService / DeliverableVersionsService│
│                                                          │
│   case 'converse':                                       │
│     → No artifact creation, just conversation            │
│ }                                                        │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ Response & Notifications                                 │
│                                                          │
│ - WebSocket notification: task complete                  │
│ - Frontend GETs:                                         │
│   GET /api/agent2agent/conversations/:id/plan           │
│   GET /api/agent2agent/conversations/:id/deliverable    │
│                                                          │
│ NO separate controllers needed for Plans/Deliverables!  │
│ Tasks API handles everything via mode routing           │
└──────────────────────────────────────────────────────────┘
```

**Frontend & Agent-to-Agent Calls:**
1. `POST /api/agent2agent/conversations/:id/tasks` - ALL operations (create, read, update)
2. WebSocket for real-time updates

**ALL operations go through Tasks API with action parameter:**
- Create: `{ mode: 'plan', action: 'create', message: '...' }`
- Read: `{ mode: 'plan', action: 'read' }` → Returns current plan
- Update: `{ mode: 'plan', action: 'edit', editedContent: '...' }`
- List: `{ mode: 'plan', action: 'list' }` → Returns version history

**Backend Tasks Service Handles:**
- Mode interpretation (plan vs build vs converse)
- Internal routing to Plans or Deliverables services
- Version management
- Adapter orchestration
- All creation/update logic

**No Separate APIs Needed:**
- ❌ No PlansController
- ❌ No DeliverablesController
- ✅ Single Tasks API with mode-based routing + action-based operations
- ✅ Plans/Deliverables are internal implementation details
- ✅ All agent capabilities defined in YAML

### Agent Capabilities (YAML Configuration)

**CRITICAL for A2A:** Agents must declare their capabilities in YAML to enable agent-to-agent interactions.

#### Context Agent with Plans & Deliverables Capabilities

```yaml
# agents/blog_post_writer.yaml
slug: blog_post_writer
name: Blog Post Writer
agent_type: context
execution_profile: autonomous_build

# Execution capabilities define what this agent can do
execution_capabilities:
  can_plan: true        # Can create and refine plans
  can_build: true       # Can create deliverables
  can_converse: true    # Can chat

# A2A capabilities define what OTHER agents can request from this agent
a2a_capabilities:
  # Plan operations
  - capability: read_plan
    action: read
    mode: plan
    description: "Retrieve the current plan for this conversation"
    returns: { type: 'plan', format: 'markdown' }

  - capability: list_plan_versions
    action: list
    mode: plan
    description: "Get version history of plans"
    returns: { type: 'array', items: 'plan_version' }

  - capability: create_plan
    action: create
    mode: plan
    description: "Generate a new plan or refine existing plan"
    requires: { message: 'string' }
    returns: { type: 'plan', format: 'markdown' }

  # Deliverable operations
  - capability: read_deliverable
    action: read
    mode: build
    description: "Retrieve the current deliverable"
    returns: { type: 'deliverable', format: 'markdown' }

  - capability: list_deliverable_versions
    action: list
    mode: build
    description: "Get version history of deliverables"
    returns: { type: 'array', items: 'deliverable_version' }

  - capability: create_deliverable
    action: create
    mode: build
    description: "Generate deliverable from plan"
    requires: { message?: 'string' }
    returns: { type: 'deliverable', format: 'markdown' }

# LLM configuration
llm_config:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  temperature: 0.7
```

#### Agent-to-Agent Read Example

**Scenario:** Orchestrator agent needs to read a plan created by Blog Writer agent

```typescript
// Orchestrator agent code (or another agent)
const planResult = await tasksService.executeTask({
  conversationId: 'conv-123',
  agentSlug: 'blog_post_writer',
  mode: 'plan',
  action: 'read',  // Read operation
});

// Returns:
{
  status: 'completed',
  result: {
    plan: {
      id: 'plan-456',
      conversationId: 'conv-123',
      currentVersionId: 'ver-789',
      currentVersion: {
        id: 'ver-789',
        versionNumber: 3,
        content: '# Blog Post Plan\n\n## 1. Introduction...',
        format: 'markdown',
        createdAt: '2025-10-04T...',
        metadata: { created_by_type: 'conversation_task' }
      }
    }
  }
}
```

**Why This Matters for A2A:**
1. **Authorization**: Capability check ensures agent is allowed to read
2. **Type Safety**: YAML defines expected inputs/outputs
3. **Discovery**: Agents can query what operations are available
4. **Consistency**: Same API for humans and agents
5. **Auditing**: All reads are logged as tasks

### Backend - Tasks Service with Mode-Based Routing
6. **Agent2AgentTasksService becomes the central orchestrator**
   ```typescript
   @Injectable()
   export class Agent2AgentTasksService {
     constructor(
       private readonly conversationsService: Agent2AgentConversationsService,
       private readonly plansService: PlansService,
       private readonly planVersionsService: PlanVersionsService,
       private readonly deliverablesService: Agent2AgentDeliverablesService,
       private readonly deliverableVersionsService: DeliverableVersionsService,
       private readonly plansAdapter: AgentRuntimePlansAdapter,
       private readonly deliverablesAdapter: AgentRuntimeDeliverablesAdapter,
       private readonly agentRuntime: AgentRuntimeService,
     ) {}

   async executeTask(params: {
     agentSlug: string;
     conversationId: string;
     mode: 'converse' | 'plan' | 'build';
     userMessage?: string;
     userId: string;
     action?: 'create' | 'refine' | 'rerun' | 'edit';
   }) {
     // 1. Load conversation history
     const conversationHistory = await this.conversationsService.getHistory(params.conversationId);

     // 2. Load context based on mode
     let currentPlan = null;
     let currentDeliverable = null;

     if (params.mode === 'plan' || params.mode === 'build') {
       // Load plan (needed for refinement and as blueprint for build)
       const plan = await this.plansService.findByConversationId(
         params.conversationId,
         params.userId
       );
       if (plan) {
         currentPlan = await this.planVersionsService.getCurrentVersion(plan.id);
       }
     }

     if (params.mode === 'build') {
       // Also load deliverable to check for existing versions
       const deliverable = await this.deliverablesService.findByConversationId(
         params.conversationId,
         params.userId
       );
       if (deliverable) {
         currentDeliverable = await this.deliverableVersionsService.getCurrentVersion(
           deliverable.id
         );
       }
     }

     // 3. Assemble context for agent execution
     const context = {
       conversation: conversationHistory,
       currentPlan: currentPlan?.content || null,
       currentDeliverable: currentDeliverable?.content || null,
       mode: params.mode,
       userMessage: params.userMessage || null,
     };

     // 4. Execute agent
     const agentResult = await this.agentRuntime.execute(
       params.agentSlug,
       context
     );

     // 5. MODE-BASED ROUTING - Process result based on mode
     switch (params.mode) {
       case 'plan':
         // Create or update plan version
         await this.plansAdapter.maybeCreateFromPlanTask(
           {
             conversationId: params.conversationId,
             userId: params.userId,
             agentName: params.agentSlug,
             taskId: agentResult.taskId
           },
           agentResult
         );
         break;

       case 'build':
         // Create or update deliverable version
         await this.deliverablesAdapter.maybeCreateFromBuild(
           {
             conversationId: params.conversationId,
             userId: params.userId,
             agentName: params.agentSlug,
             taskId: agentResult.taskId
           },
           agentResult
         );
         break;

       case 'converse':
         // No artifact creation, just conversation
         break;
     }

     return agentResult;
   }
   ```

   **Key Points:**
   - ✅ Single service handles all modes
   - ✅ Mode determines what gets created (plan vs deliverable)
   - ✅ Adapters handle the specific creation logic
   - ✅ No separate controllers needed
   - ✅ Clean separation of concerns

### Backend - Plan Editing (Manual vs LLM)

**CRITICAL: All plan edits go through Tasks API with full text content**

7. **Plan Mode with Actions**
   ```typescript
   // Tasks API request structure
   POST /api/agent2agent/conversations/:id/tasks
   {
     mode: 'plan',
     message?: string,           // For conversational refinement
     action?: 'create' | 'edit', // Determines how to process
     editedContent?: string,     // For manual edits - FULL plan text
     metadata?: {
       editType?: 'manual' | 'llm'
     }
   }
   ```

8. **Two Ways to Update Plans**

   **Option 1: Conversational Refinement (LLM)**
   ```typescript
   // User types in chat: "add section about healthcare"
   POST /api/agent2agent/conversations/:id/tasks
   {
     mode: 'plan',
     action: 'create',  // or omit - default behavior
     message: 'add section about healthcare'
   }

   // Backend flow:
   // 1. Load conversation history
   // 2. Load current plan version
   // 3. Send to LLM: { conversation, currentPlan, message }
   // 4. LLM generates refined plan
   // 5. PlansAdapter.maybeCreateFromPlanTask()
   // 6. New version created with metadata: { created_by_type: 'conversation_task' }
   ```

   **Option 2: Manual Text Editing (Direct Save)**
   ```typescript
   // User clicks "Edit" in UI, modifies text directly, clicks "Save"
   POST /api/agent2agent/conversations/:id/tasks
   {
     mode: 'plan',
     action: 'edit',
     editedContent: `# Updated Plan

   ## 1. Introduction
   - Overview of AI trends

   ## 2. Healthcare Focus (NEW)
   - AI in diagnostics
   - AI in treatment planning

   ## 3. Conclusion
   - Summary and future outlook`
   }

   // Backend flow:
   // 1. NO LLM call
   // 2. Directly create new plan version with editedContent
   // 3. PlansAdapter receives editedContent as-is
   // 4. New version created with metadata: { created_by_type: 'manual_edit' }
   ```

9. **Agent2AgentTasksService Enhanced**
   ```typescript
   async executeTask(params) {
     if (params.mode === 'plan') {

       if (params.action === 'edit' && params.editedContent) {
         // MANUAL EDIT - No LLM, direct save
         await this.plansAdapter.createVersionFromManualEdit(
           {
             conversationId: params.conversationId,
             userId: params.userId,
             agentName: params.agentSlug,
             taskId: generatedTaskId
           },
           params.editedContent
         );
         return { success: true, source: 'manual_edit' };
       }

       // CONVERSATIONAL REFINEMENT - Use LLM
       const context = {
         conversation: await this.loadHistory(params.conversationId),
         currentPlan: await this.loadCurrentPlan(params.conversationId),
         message: params.userMessage
       };

       const agentResult = await this.agentRuntime.execute(
         params.agentSlug,
         context
       );

       await this.plansAdapter.maybeCreateFromPlanTask(ctx, agentResult);
       return agentResult;
     }
   }
   ```

10. **AgentRuntimePlansAdapter Enhanced**
    ```typescript
    // NEW method for manual edits
    async createVersionFromManualEdit(
      ctx: { conversationId, userId, agentName, taskId },
      editedContent: string
    ): Promise<PlanVersion> {
      const plan = await this.plansService.findByConversationId(
        ctx.conversationId,
        ctx.userId
      );

      if (!plan) {
        throw new Error('No plan exists to edit');
      }

      // Create new version with edited content
      const version = await this.planVersionsService.createVersion(
        plan.id,
        editedContent,              // Full edited text from user
        'markdown',                  // Format
        'manual_edit',              // Created by type
        ctx.taskId,                 // Task reference
        {
          agentName: ctx.agentName,
          editedBy: ctx.userId,
          editSource: 'ui_text_editor'
        }
      );

      return version;
    }
    ```

**Key Requirements:**
- ✅ Manual edits send **ENTIRE plan text** as `editedContent`
- ✅ All edits create **new versions** (never update in-place)
- ✅ Tasks API is **only entry point** (no direct version creation endpoints)
- ✅ `action: 'edit'` bypasses LLM, saves directly
- ✅ Metadata tracks edit source (`manual_edit` vs `conversation_task`)
- ✅ Version history shows both LLM refinements and manual edits

### Backend - Deliverable Editing (Same Pattern)

**Deliverables follow identical pattern to Plans**

11. **Build Mode with Actions**
    ```typescript
    POST /api/agent2agent/conversations/:id/tasks
    {
      mode: 'build',
      message?: string,           // For LLM refinement
      action?: 'create' | 'edit' | 'rerun',
      editedContent?: string,     // For manual edits - FULL deliverable text
      rerunConfig?: {             // For LLM rerun
        llm_model: 'gpt-4',
        temperature: 0.7
      }
    }
    ```

12. **Three Ways to Update Deliverables**

    **Option 1: Conversational Refinement**
    ```typescript
    POST /api/agent2agent/conversations/:id/tasks
    {
      mode: 'build',
      action: 'create',
      message: 'make it more technical'
    }
    // → LLM generates refined deliverable → new version
    ```

    **Option 2: Manual Text Editing**
    ```typescript
    POST /api/agent2agent/conversations/:id/tasks
    {
      mode: 'build',
      action: 'edit',
      editedContent: '# AI Trends 2025\n\nFull blog post content here...'
    }
    // → Direct save, no LLM → new version with created_by_type: 'manual_edit'
    ```

    **Option 3: LLM Rerun**
    ```typescript
    POST /api/agent2agent/conversations/:id/tasks
    {
      mode: 'build',
      action: 'rerun',
      rerunConfig: { llm_model: 'gpt-4', temperature: 0.7 }
    }
    // → Rerun with different LLM using same plan → new version with created_by_type: 'llm_rerun'
    ```

**Consistency Across Plans and Deliverables:**
| Action | Plans | Deliverables |
|--------|-------|--------------|
| **Conversational Refinement** | `mode: 'plan'` + `message` | `mode: 'build'` + `message` |
| **Manual Edit** | `mode: 'plan'` + `action: 'edit'` + `editedContent` | `mode: 'build'` + `action: 'edit'` + `editedContent` |
| **LLM Rerun** | `mode: 'plan'` + `action: 'rerun'` | `mode: 'build'` + `action: 'rerun'` + `rerunConfig` |

**All operations:**
- ✅ Go through Tasks API
- ✅ Create new versions (immutable history)
- ✅ Track metadata (who/what/how created)
- ✅ Support version comparison

### Frontend - UI Components
7. **Create PlansPanel.vue** (NEW - similar to DeliverablesPanel)
   - Display current plan for conversation
   - Show plan version history
   - Refinement UI (converse to update plan)
   - Version comparison
   - "Approve & Build" button

8. **Update DeliverablesPanel.vue**
   - Display deliverable for conversation (ONE per conversation)
   - Show deliverable version history
   - Version selector UI
   - LLM rerun button
   - Manual edit capability

9. **Update ConversationView.vue - Mode Switching Logic**
   ```typescript
   // When user switches mode or sends message with mode change
   async function handleModeSwitchOrMessage(
     mode: 'converse' | 'plan' | 'build',
     userMessage?: string,
     planId?: string  // Optional: use specific plan version
   ) {
     // CRITICAL: userMessage (if present) is the PRIMARY context
     // The mode switch is SECONDARY

     const taskParams = {
       agentSlug: currentAgent.slug,
       conversationId: currentConversation.id,
       mode: mode,
       userMessage: userMessage || null,  // Can be null if just mode switch
       planId: planId || null,  // Can be null (auto-load by conversation)
       userId: currentUser.id
     };

     // Backend will:
     // 1. Load conversation history
     // 2. Load plan by planId OR auto-load by conversation (if mode=plan/build)
     // 3. Assemble context with priority: userMessage > plan > conversation
     // 4. Execute in specified mode
     await agent2AgentTasksService.createTask(taskParams);
   }

   // Examples:
   // 1. User clicks "Plan" button (no message) → mode='plan', userMessage=null, planId=null
   // 2. User types "focus on healthcare" then clicks "Plan" → mode='plan', userMessage='focus on healthcare'
   // 3. User types "make it longer" then clicks "Build" → mode='build', userMessage='make it longer'
   // 4. User selects plan v2, clicks "Build" → mode='build', planId='plan-ver-2'
   ```

10. **Update ConversationView.vue**
    - Route to agent2AgentChatStore for database agents
    - Route to agentChatStore for file-based agents
    - Check `agent.source` field to determine routing

11. **Add Mode Action Buttons to Message Bubbles**
    ```typescript
    // Show under each assistant message (after first converse)
    // Only for agents with execution_profile !== 'conversation_only'

    <MessageBubble>
      <MessageContent />

      <MessageActions v-if="canShowModeButtons">
        <Button @click="handleMode('plan', message.content)">
          📋 Plan
        </Button>
        <Button @click="handleMode('build', message.content)">
          🔨 Build
        </Button>
        <Button @click="handleMode('converse')">
          💬 Continue Conversation
        </Button>
      </MessageActions>
    </MessageBubble>

    // canShowModeButtons = true when:
    // - Agent is NOT conversation_only
    // - Message is from assistant
    // - At least one user message has been sent

    // Clicking button:
    // - "Plan" → executeTask(mode='plan', userMessage=null)
    // - "Build" → executeTask(mode='build', userMessage=null)
    // - If user types message THEN clicks → userMessage included
    ```

### Agent Configuration & Response Format
12. **Update blog_post_writer system prompt to specify format**
   ```yaml
   config:
     context:
       system_prompt: |
         You are a blog post writing assistant.

         IMPORTANT CONTEXT HIERARCHY (when processing requests):
         1. **User's last message** (highest priority - the specific instruction)
         2. **Current plan** (if exists - the agreed blueprint)
         3. **Conversation history** (background context)
         4. **Current mode** (plan/build/converse - execution style)

         When in PLAN mode, generate an outline/structure.
         When in BUILD mode, create the full deliverable using the plan.

         When generating deliverables in BUILD mode, always structure your response as:
         {
           "format": "markdown",  // REQUIRED: markdown, json, yaml, html, plaintext
           "title": "Descriptive Title",
           "output": "<your content here>"
         }

         This ensures proper rendering and syntax highlighting in the UI.
   ```

13. **Add format specification to Agent2AgentDeliverablesService**
   ```typescript
   // createFromTaskResult should use format from agent response
   const format = result.payload.format || this.inferFormat(content);
   // ↑ Agent explicitly provides format, no guessing needed

   // Route to correct deliverable type
   const isCode = ['typescript', 'javascript', 'python', 'css', 'sql'].includes(format);
   const method = isCode ? 'generateCodeDeliverable' : 'generateDocumentDeliverable';
   ```

14. **Verify blog_post_writer configuration**
   - `agent_type: 'context'`
   - `execution_profile: 'autonomous_build'` or similar
   - `execution_capabilities: { can_plan: true, can_build: true }`
   - Has proper system prompt and configuration
   - `function_code` is null (not a function agent)

### Action-Based Operations (Read/List for A2A)

**CRITICAL:** Read and list operations must also go through Tasks API for proper A2A protocol compliance.

#### Read Operation Example

```typescript
// Agent-to-Agent: Orchestrator reading Blog Writer's plan
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan',
  action: 'read',  // No LLM execution, just retrieve
  agentSlug: 'blog_post_writer'
}

// Backend: Agent2AgentTasksService
async executeTask(params) {
  if (params.action === 'read') {
    // 1. Check A2A capability
    await this.checkA2ACapability(params.agentSlug, 'read_plan');

    // 2. Retrieve plan (no LLM call)
    const plan = await this.plansService.findByConversationId(params.conversationId);
    const currentVersion = await this.planVersionsService.getCurrentVersion(plan.id);

    // 3. Return immediately
    return {
      status: 'completed',
      result: { plan: { id: plan.id, currentVersion } }
    };
  }
  // ... rest of create/edit logic
}

// Response
{
  status: 'completed',
  result: {
    plan: {
      id: 'plan-456',
      currentVersion: {
        id: 'ver-789',
        versionNumber: 3,
        content: '# Blog Post Plan\n\n## 1. Introduction...',
        format: 'markdown',
        createdAt: '2025-10-04T...'
      }
    }
  }
}
```

#### List Operation Example

```typescript
// Agent-to-Agent: Get all plan versions
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan',
  action: 'list',
  agentSlug: 'blog_post_writer'
}

// Response
{
  status: 'completed',
  result: {
    planId: 'plan-456',
    versions: [
      { id: 'ver-789', versionNumber: 3, createdAt: '2025-10-04T14:00', isCurrent: true },
      { id: 'ver-788', versionNumber: 2, createdAt: '2025-10-04T13:30', isCurrent: false },
      { id: 'ver-787', versionNumber: 1, createdAt: '2025-10-04T13:00', isCurrent: false }
    ]
  }
}
```

#### Complete Action Support - All Artifact Types

**CRITICAL:** Every operation must be defined as an A2A capability for agent-to-agent interactions.

### Plans Operations

| Action | Mode | Description | Requires LLM | Input | A2A Capability |
|--------|------|-------------|--------------|-------|----------------|
| `create` | plan | Generate new plan or refine existing | ✅ Yes | `message: string` | `create_plan` |
| `read` | plan | Retrieve current plan version | ❌ No | none | `read_plan` |
| `list` | plan | Get all plan version history | ❌ No | none | `list_plan_versions` |
| `edit` | plan | Manual text edit (save as new version) | ❌ No | `editedContent: string` | `edit_plan` |
| `set_current` | plan | Change current version to different version | ❌ No | `versionId: string` | `set_current_plan_version` |
| `delete_version` | plan | Delete a specific version | ❌ No | `versionId: string` | `delete_plan_version` |
| `merge_versions` | plan | Merge multiple versions with LLM | ✅ Yes | `versionIds: string[], mergePrompt: string` | `merge_plan_versions` |
| `copy_version` | plan | Duplicate a version as new version | ❌ No | `versionId: string` | `copy_plan_version` |
| `delete` | plan | Delete entire plan (all versions) | ❌ No | `confirm: boolean` | `delete_plan` |

### Deliverables Operations

| Action | Mode | Description | Requires LLM | Input | A2A Capability |
|--------|------|-------------|--------------|-------|----------------|
| `create` | build | Generate new deliverable or refine | ✅ Yes | `message?: string` | `create_deliverable` |
| `read` | build | Retrieve current deliverable version | ❌ No | none | `read_deliverable` |
| `list` | build | Get all deliverable version history | ❌ No | none | `list_deliverable_versions` |
| `edit` | build | Manual text edit (save as new version) | ❌ No | `editedContent: string` | `edit_deliverable` |
| `rerun` | build | Re-generate with different LLM/config | ✅ Yes | `rerunConfig: { model?, temperature? }` | `rerun_deliverable` |
| `set_current` | build | Change current version | ❌ No | `versionId: string` | `set_current_deliverable_version` |
| `delete_version` | build | Delete a specific version | ❌ No | `versionId: string` | `delete_deliverable_version` |
| `merge_versions` | build | Merge multiple versions with LLM | ✅ Yes | `versionIds: string[], mergePrompt: string` | `merge_deliverable_versions` |
| `copy_version` | build | Duplicate a version as new version | ❌ No | `versionId: string` | `copy_deliverable_version` |
| `delete` | build | Delete entire deliverable (all versions) | ❌ No | `confirm: boolean` | `delete_deliverable` |

### Orchestrations Operations (Phase 6+)

| Action | Mode | Description | Requires LLM | Input | A2A Capability |
|--------|------|-------------|--------------|-------|----------------|
| `create` | orchestrate | Create orchestration plan/execution | ✅ Yes | `message: string` | `create_orchestration` |
| `read` | orchestrate | Retrieve current orchestration state | ❌ No | none | `read_orchestration` |
| `list` | orchestrate | Get orchestration execution history | ❌ No | none | `list_orchestration_runs` |
| `pause` | orchestrate | Pause running orchestration | ❌ No | none | `pause_orchestration` |
| `resume` | orchestrate | Resume paused orchestration | ❌ No | none | `resume_orchestration` |
| `cancel` | orchestrate | Cancel orchestration | ❌ No | none | `cancel_orchestration` |
| `retry_step` | orchestrate | Retry failed step | ❌ No | `stepId: string` | `retry_orchestration_step` |
| `delete` | orchestrate | Delete orchestration | ❌ No | `confirm: boolean` | `delete_orchestration` |

### Conversation-Level Operations

| Action | Mode | Description | Requires LLM | Input | A2A Capability |
|--------|------|-------------|--------------|-------|----------------|
| `read_conversation` | converse | Get conversation messages | ❌ No | none | `read_conversation` |
| `delete_conversation` | converse | Delete conversation + all artifacts | ❌ No | `confirm: boolean, deleteArtifacts: boolean` | `delete_conversation` |
| `export_conversation` | converse | Export conversation history | ❌ No | `format: 'json' \| 'markdown'` | `export_conversation` |

### Complete Agent YAML with All Capabilities

```yaml
# agents/blog_post_writer.yaml
slug: blog_post_writer
name: Blog Post Writer
agent_type: context
execution_profile: autonomous_build

execution_capabilities:
  can_plan: true
  can_build: true
  can_converse: true

# Complete A2A capability definitions
a2a_capabilities:
  # ===== PLAN OPERATIONS =====
  - capability: create_plan
    action: create
    mode: plan
    description: "Generate new plan or refine existing plan"
    requires: { message: string }
    returns: { type: plan, format: markdown }

  - capability: read_plan
    action: read
    mode: plan
    description: "Retrieve current plan version"
    returns: { type: plan, format: markdown }

  - capability: list_plan_versions
    action: list
    mode: plan
    description: "Get all plan version history"
    returns: { type: array, items: plan_version }

  - capability: edit_plan
    action: edit
    mode: plan
    description: "Manual text edit - save as new version"
    requires: { editedContent: string }
    returns: { type: plan_version }

  - capability: set_current_plan_version
    action: set_current
    mode: plan
    description: "Change current version to different version"
    requires: { versionId: string }
    returns: { type: plan }

  - capability: delete_plan_version
    action: delete_version
    mode: plan
    description: "Delete a specific plan version"
    requires: { versionId: string }
    returns: { success: boolean }

  - capability: merge_plan_versions
    action: merge_versions
    mode: plan
    description: "Merge multiple plan versions using LLM"
    requires: { versionIds: array<string>, mergePrompt: string }
    returns: { type: plan_version }

  - capability: copy_plan_version
    action: copy_version
    mode: plan
    description: "Duplicate a plan version as new version"
    requires: { versionId: string }
    returns: { type: plan_version }

  - capability: delete_plan
    action: delete
    mode: plan
    description: "Delete entire plan and all versions"
    requires: { confirm: boolean }
    returns: { success: boolean }

  # ===== DELIVERABLE OPERATIONS =====
  - capability: create_deliverable
    action: create
    mode: build
    description: "Generate deliverable from plan"
    requires: { message?: string }
    returns: { type: deliverable, format: markdown }

  - capability: read_deliverable
    action: read
    mode: build
    description: "Retrieve current deliverable version"
    returns: { type: deliverable, format: markdown }

  - capability: list_deliverable_versions
    action: list
    mode: build
    description: "Get all deliverable version history"
    returns: { type: array, items: deliverable_version }

  - capability: edit_deliverable
    action: edit
    mode: build
    description: "Manual text edit - save as new version"
    requires: { editedContent: string }
    returns: { type: deliverable_version }

  - capability: rerun_deliverable
    action: rerun
    mode: build
    description: "Re-generate deliverable with different LLM config"
    requires: { rerunConfig: { model?: string, temperature?: number } }
    returns: { type: deliverable_version }

  - capability: set_current_deliverable_version
    action: set_current
    mode: build
    description: "Change current version"
    requires: { versionId: string }
    returns: { type: deliverable }

  - capability: delete_deliverable_version
    action: delete_version
    mode: build
    description: "Delete a specific deliverable version"
    requires: { versionId: string }
    returns: { success: boolean }

  - capability: merge_deliverable_versions
    action: merge_versions
    mode: build
    description: "Merge multiple deliverable versions using LLM"
    requires: { versionIds: array<string>, mergePrompt: string }
    returns: { type: deliverable_version }

  - capability: copy_deliverable_version
    action: copy_version
    mode: build
    description: "Duplicate a deliverable version"
    requires: { versionId: string }
    returns: { type: deliverable_version }

  - capability: delete_deliverable
    action: delete
    mode: build
    description: "Delete entire deliverable and all versions"
    requires: { confirm: boolean }
    returns: { success: boolean }

  # ===== CONVERSATION OPERATIONS =====
  - capability: read_conversation
    action: read_conversation
    mode: converse
    description: "Get conversation message history"
    returns: { type: array, items: message }

  - capability: delete_conversation
    action: delete_conversation
    mode: converse
    description: "Delete conversation and optionally all artifacts"
    requires: { confirm: boolean, deleteArtifacts: boolean }
    returns: { success: boolean }

  - capability: export_conversation
    action: export_conversation
    mode: converse
    description: "Export conversation history"
    requires: { format: 'json' | 'markdown' }
    returns: { type: string }
```

### Example API Calls for All Operations

#### Merge Versions Example

```typescript
// User wants to merge plan versions 2, 3, 5 into a unified version
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan',
  action: 'merge_versions',
  agentSlug: 'blog_post_writer',
  versionIds: ['ver-788', 'ver-789', 'ver-791'],
  mergePrompt: 'Combine the best ideas from these versions, keeping the structure from version 3 but incorporating the healthcare examples from version 2'
}

// Backend: Agent2AgentTasksService
async executeTask(params) {
  if (params.action === 'merge_versions') {
    // 1. Check A2A capability
    await this.checkA2ACapability(params.agentSlug, 'merge_plan_versions');

    // 2. Load specified versions
    const versions = await this.planVersionsService.findByIds(params.versionIds);

    // 3. Build LLM context with all versions
    const context = {
      versions: versions.map(v => ({
        versionNumber: v.versionNumber,
        content: v.content,
        createdAt: v.createdAt
      })),
      mergePrompt: params.mergePrompt
    };

    // 4. Execute LLM to merge
    const mergedContent = await this.agentRuntime.execute(
      params.agentSlug,
      {
        mode: 'plan',
        action: 'merge',
        context,
        systemPrompt: 'You are merging multiple plan versions. Follow the user instructions.'
      }
    );

    // 5. Create new version with merged content
    const newVersion = await this.planVersionsService.createVersion(
      plan.id,
      mergedContent,
      'markdown',
      'merge_operation',
      null,
      {
        mergedFrom: params.versionIds,
        mergePrompt: params.mergePrompt
      }
    );

    return { status: 'completed', result: { version: newVersion } };
  }
}
```

#### Delete Conversation Example

```typescript
// Delete conversation and all artifacts (plans, deliverables)
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'converse',
  action: 'delete_conversation',
  agentSlug: 'blog_post_writer',
  confirm: true,
  deleteArtifacts: true  // If true, also delete plans and deliverables
}

// Backend: CASCADE delete
async executeTask(params) {
  if (params.action === 'delete_conversation') {
    // 1. Check A2A capability
    await this.checkA2ACapability(params.agentSlug, 'delete_conversation');

    // 2. Require confirmation
    if (!params.confirm) {
      throw new BadRequestException('Confirmation required to delete conversation');
    }

    // 3. Delete artifacts if requested
    if (params.deleteArtifacts) {
      await this.plansService.deleteByConversationId(params.conversationId);
      await this.deliverablesService.deleteByConversationId(params.conversationId);
    }

    // 4. Delete conversation (cascades to messages)
    await this.conversationsService.delete(params.conversationId);

    return { status: 'completed', result: { success: true } };
  }
}
```

#### Set Current Version Example

```typescript
// Switch current plan version back to version 2
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan',
  action: 'set_current',
  agentSlug: 'blog_post_writer',
  versionId: 'ver-788'
}

// Backend
async executeTask(params) {
  if (params.action === 'set_current') {
    await this.checkA2ACapability(params.agentSlug, 'set_current_plan_version');

    const plan = await this.plansService.findByConversationId(params.conversationId);
    await this.plansService.setCurrentVersion(plan.id, params.versionId);

    return {
      status: 'completed',
      result: { planId: plan.id, currentVersionId: params.versionId }
    };
  }
}
```

#### Copy Version Example

```typescript
// Duplicate version 3 to create a new version to experiment with
POST /api/agent2agent/conversations/:id/tasks
{
  mode: 'plan',
  action: 'copy_version',
  agentSlug: 'blog_post_writer',
  versionId: 'ver-789'
}

// Backend
async executeTask(params) {
  if (params.action === 'copy_version') {
    await this.checkA2ACapability(params.agentSlug, 'copy_plan_version');

    const sourceVersion = await this.planVersionsService.findById(params.versionId);
    const newVersion = await this.planVersionsService.createVersion(
      sourceVersion.planId,
      sourceVersion.content,
      sourceVersion.format,
      'copy_operation',
      null,
      {
        copiedFrom: params.versionId,
        originalVersionNumber: sourceVersion.versionNumber
      }
    );

    return { status: 'completed', result: { version: newVersion } };
  }
}
```

### Benefits of Complete A2A Capability Matrix

✅ **Comprehensive Protocol**: Every operation agents might need
✅ **Authorization**: Capability checks prevent unauthorized access
✅ **Discoverable**: Agents can query available operations
✅ **Type Safe**: YAML defines inputs/outputs for validation
✅ **Auditable**: All operations logged as tasks
✅ **Orchestration-Ready**: Orchestrators can manipulate artifacts created by other agents
✅ **Flexible**: Supports complex workflows (merge, copy, version control)
✅ **Consistent**: Same pattern for plans, deliverables, orchestrations

## Data Model

### Agent Record (Database)
```typescript
{
  id: 'uuid',
  slug: 'blog_post_writer',
  name: 'Blog Post Writer',
  agent_type: 'context',
  execution_profile: 'autonomous_build',
  execution_capabilities: {
    can_plan: true,
    can_build: true
  },
  source: 'database', // Routing flag
  status: 'active',
  // ... other fields
}
```

### Conversation
```typescript
{
  id: 'conv-123',
  user_id: 'user-456',
  agent_name: 'blog_post_writer',
  namespace: 'my-org',
  started_at: '2025-10-03T10:00:00Z',
  title: '2h ago' // Formatted by frontend
}
```

### Plan (NEW - mirrors Deliverable)
```typescript
{
  id: 'plan-456',
  conversation_id: 'conv-123',
  user_id: 'user-456',
  agent_name: 'blog_post_writer',
  namespace: 'my-org',
  title: 'Blog Post Plan: AI Trends 2025',
  type: 'plan',
  current_version_id: 'plan-ver-103'
}
```

### Plan Version (NEW - mirrors Deliverable Version)
```typescript
{
  id: 'plan-ver-103',
  plan_id: 'plan-456',
  version_number: 3,
  content: '# Outline\n1. Introduction...',
  format: 'markdown',
  created_by_type: 'conversation_task' | 'manual_edit' | 'llm_rerun',
  task_id: 'task-333',
  is_current_version: true,
  metadata: {
    llm_model: 'claude-sonnet-4',
    agentName: 'blog_post_writer',
    refinement_notes: 'Added healthcare focus to section 2'
  }
}
```

### Deliverable
```typescript
{
  id: 'deliv-789',
  conversation_id: 'conv-123',
  user_id: 'user-456',
  agent_name: 'blog_post_writer',
  namespace: 'my-org',
  title: 'Blog Post: AI Trends 2025',
  type: 'document',
  current_version_id: 'ver-101'
}
```

### Deliverable Version
```typescript
{
  id: 'ver-101',
  deliverable_id: 'deliv-789',
  version_number: 2,
  content: 'Blog post text...',
  format: 'markdown',
  created_by_type: 'conversation_task' | 'manual_edit' | 'llm_rerun',
  task_id: 'task-555', // For reruns
  is_current_version: true,
  metadata: {
    llm_model: 'claude-sonnet-4',
    agentName: 'blog_post_writer'
  }
}
```

## Frontend Architecture

### Routing Decision
```typescript
// In ConversationView.vue or chat component
function getStoreForAgent(agent: Agent) {
  return agent.source === 'database'
    ? useAgent2AgentChatStore()
    : useAgentChatStore();
}

const chatStore = getStoreForAgent(selectedAgent);
```

### Service Routing
```typescript
// In DeliverablesPanel.vue
function getDeliverablesService(agent: Agent) {
  return agent.source === 'database'
    ? agent2AgentDeliverablesService
    : deliverablesService;
}

const deliverables = await getDeliverablesService(agent).listDeliverables(conversationId);
```

## Testing Plan

### Manual Testing Checklist
- [ ] Create new conversation with blog_post_writer
- [ ] Converse: "I want to write a blog post about AI trends"
- [ ] Switch to plan mode → verify plan appears in deliverables panel
- [ ] Edit plan directly in UI
- [ ] Have conversation to refine plan: "Change step 2 to focus on healthcare"
- [ ] Switch to build mode → verify blog post created
- [ ] Verify deliverable appears with version 1
- [ ] Click "Rerun with GPT-4" → verify version 2 created
- [ ] Switch between versions → verify content changes
- [ ] Edit deliverable manually → save as version 3
- [ ] Verify conversation title shows "Just now" / "15m ago" format
- [ ] Create second conversation → verify both show in list

### Automated Testing
- Unit tests for agent2AgentTasksService
- Unit tests for agent2AgentDeliverablesService
- Integration tests for full conversation → plan → build flow
- E2E test for deliverable version lifecycle

## Risks & Mitigations

### Risk: Frontend store complexity
**Mitigation:** Keep agent2AgentChatStore completely separate from agentChatStore, route once at component level

### Risk: Deliverables API differences between file/database agents
**Mitigation:** Deliverables API is universal, both agent types use same endpoints

### Risk: Breaking file-based agents
**Mitigation:** No changes to file-based agent code, only additions for database agents

### Risk: Conversation title formatting not working
**Mitigation:** Already implemented in agent2AgentConversationsService, verify agentConversationsStore routing

## Timeline Estimate
- Frontend services creation: 1 day
- Frontend store creation: 2 days
- UI component updates: 2 days
- Testing & bug fixes: 2 days
- **Total: 7 days**

## Dependencies
- Backend agent2agent services ✅ (complete)
- blog_post_writer agent in database ✅ (exists)
- Deliverables API ✅ (complete)
- Database tables ✅ (exist)

## Definition of Done
- [ ] blog_post_writer works end-to-end: converse → plan → build
- [ ] Deliverables panel shows plans and deliverables
- [ ] Can edit plans before building
- [ ] Can rerun deliverables with different LLM
- [ ] Version history works correctly
- [ ] Conversation titles show friendly time format
- [ ] No console errors or warnings
- [ ] Manual testing checklist complete
- [ ] Code reviewed and merged to main branch

## Notes
This phase establishes the foundation for all future agent types. Getting this right means phases 2-6 will be much smoother.
