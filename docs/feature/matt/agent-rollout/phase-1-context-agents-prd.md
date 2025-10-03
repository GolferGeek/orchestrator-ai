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

3. **Plan Editing Workflow**
   - Generate plan from conversation
   - Display plan in deliverables panel (as special deliverable type)
   - Allow user to edit plan before building
   - Conversation-based plan refinement ("change step 2 to focus on X")

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

### Backend (Already Complete)
- ✅ Agent2AgentConversationsService
- ✅ Agent2AgentTasksService
- ✅ Agent2AgentDeliverablesService
- ✅ DeliverablesController
- ✅ DeliverableVersionsController with rerun endpoint

### Frontend - Services Layer
1. **Create agent2AgentTasksService.ts**
   - `createTask(agentSlug, conversationId, mode, userMessage)`
   - `getTaskStatus(taskId)`
   - `listTasks(conversationId)`

2. **Create agent2AgentDeliverablesService.ts**
   - `listDeliverables(conversationId)`
   - `getDeliverable(deliverableId)`
   - `getDeliverableVersions(deliverableId)`
   - `rerunWithLLM(versionId, llmConfig)`
   - `updateDeliverable(deliverableId, updates)`

### Frontend - Store Layer
3. **Create stores/agent2AgentChatStore/**
   - Duplicate agentChatStore structure
   - Update to use agent2agent services (not legacy)
   - Remove file-based agent logic
   - Clean implementation for database agents only

4. **Update agentConversationsStore.ts**
   - Already routes to agent2AgentConversationsService ✅
   - Verify conversation title formatting works

### Frontend - UI Components
5. **Update DeliverablesPanel.vue**
   - Detect agent source (database vs file)
   - Route to appropriate deliverables service
   - Support plan deliverables (editable outline)
   - Version selector UI
   - LLM rerun button

6. **Create/Update PlanEditor.vue**
   - Display plan in editable format
   - Save plan changes
   - Conversation-based plan refinement
   - "Approve & Build" button

7. **Update ConversationView.vue**
   - Route to agent2AgentChatStore for database agents
   - Route to agentChatStore for file-based agents
   - Check `agent.source` field to determine routing

### Agent Configuration
8. **Verify blog_post_writer configuration**
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
