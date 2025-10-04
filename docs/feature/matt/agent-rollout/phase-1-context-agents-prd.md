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

### Backend - Database Schema
1. **Create plans tables migration**
   ```sql
   -- plans table (mirrors deliverables structure)
   CREATE TABLE plans (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     conversation_id UUID NOT NULL UNIQUE,  -- One plan per conversation
     user_id UUID NOT NULL,
     title TEXT NOT NULL,
     current_version_id UUID,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
   );

   -- plan_versions table (mirrors deliverable_versions structure)
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
   ```

### Backend - Services
2. **Create PlansService** (mirror of DeliverablesService)
   - `create(conversationId, userId, title, content, format)` - Create plan
   - `findByConversationId(conversationId, userId)` - Get plan for conversation
   - `update(planId, updates)` - Update plan
   - `delete(planId)` - Delete plan

3. **Create PlanVersionsService** (mirror of DeliverableVersionsService)
   - `createVersion(planId, content, format, metadata)` - Create new plan version
   - `getCurrentVersion(planId)` - Get current plan version
   - `getVersionHistory(planId)` - Get all versions
   - `setCurrentVersion(versionId)` - Switch current version

4. **Create PlansController**
   ```typescript
   GET    /api/plans/conversation/:conversationId  // Get plan for conversation
   POST   /api/plans                               // Create plan
   PATCH  /api/plans/:id                           // Update plan
   DELETE /api/plans/:id                           // Delete plan

   GET    /api/plans/:id/versions                  // Get version history
   POST   /api/plans/:id/versions                  // Create new version
   PATCH  /api/plans/:id/versions/:versionId       // Set as current
   ```

### Backend (Already Complete)
- ✅ Agent2AgentConversationsService
- ✅ Agent2AgentTasksService
- ✅ Agent2AgentDeliverablesService
- ✅ DeliverablesController
- ✅ DeliverableVersionsController with rerun endpoint

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

### Backend - Plan Context Assembly
6. **Enhance Agent2AgentTasksService to include plan context**
   ```typescript
   async executeTask(params: {
     agentSlug: string;
     conversationId: string;
     mode: 'converse' | 'plan' | 'build';
     userMessage?: string;
     userId: string;
     planId?: string;  // Optional: explicit plan ID to use
   }) {
     // 1. Load conversation history
     const conversationHistory = await this.loadConversationHistory(params.conversationId);

     // 2. Load plan context (CRITICAL for plan refinement and building)
     let currentPlan = null;

     if (params.planId) {
       // Explicit plan ID provided (user selected specific plan version)
       currentPlan = await this.planVersions.getCurrentVersion(params.planId);
     } else if (params.mode === 'plan' || params.mode === 'build') {
       // Auto-load plan by conversation (if exists)
       const plan = await this.plans.findByConversationId(params.conversationId, params.userId);
       if (plan) {
         currentPlan = await this.planVersions.getCurrentVersion(plan.id);
       }
     }

     // 3. Assemble context for agent
     const context = {
       conversation: conversationHistory,
       currentPlan: currentPlan?.content || null,  // The plan content
       planVersion: currentPlan?.version_number || null,
       mode: params.mode,
       userMessage: params.userMessage || null,  // LAST MESSAGE - highest priority
     };

     // Context priority for BUILD mode:
     // 1. userMessage (most important - "make it more technical")
     // 2. currentPlan (the blueprint)
     // 3. conversation history (background)

     // 4. Execute task with full context
     return await this.agent.execute(context);
   }
   ```

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

### Deliverable
```typescript
{
  id: 'deliv-789',
  conversation_id: 'conv-123',
  agent_name: 'blog_post_writer',
  title: 'Blog Post: AI Trends 2025',
  type: 'document' | 'plan',
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
