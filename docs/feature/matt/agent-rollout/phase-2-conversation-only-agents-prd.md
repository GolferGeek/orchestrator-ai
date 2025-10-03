# Phase 2: Conversation-Only Profile

## Overview
Enable conversation-only execution profile for agents. This is a **capability flag**, not an agent type. Any agent type (context, API, function) can be set to conversation-only by configuring `execution_profile: 'conversation_only'` in their YAML/database configuration.

## Key Concept
**Conversation-only is a profile, not a type:**
- Context agent + conversation_only = chat-only context agent (HR agent)
- API agent + conversation_only = chat-only API agent
- Function agent + conversation_only = chat-only function agent (rare but possible)

## Goals
- Support `execution_profile: 'conversation_only'` on any agent type
- Simplify UI for conversation-only agents (no deliverables panel)
- Validate execution capabilities filtering
- Get HR agent (context + conversation_only) working as reference

## Prerequisites
- ✅ Phase 1 complete (context agents working)
- ✅ agent2AgentChatStore exists
- ✅ Agent routing logic in place

## Scope

### In Scope
1. **Conversation-Only Execution Profile**
   - Works with ANY agent type (context, API, function)
   - Set via `execution_profile: 'conversation_only'` in config
   - Only converse mode supported
   - No plan or build modes
   - Execution capabilities: `{ can_plan: false, can_build: false }`

2. **UI Adaptations**
   - Hide mode selector (converse only)
   - Hide deliverables panel (no deliverables created)
   - Show only conversation history
   - Optional: Show context/files panel on right

3. **Agent Configuration**
   - HR agent properly configured
   - execution_profile validation
   - Capabilities enforcement in backend

4. **Frontend Store Updates**
   - agent2AgentChatStore respects execution capabilities
   - Don't show plan/build options for conversation-only agents
   - Handle execution mode restrictions

### Out of Scope
- Context agents (Phase 1)
- API agents (Phase 3)
- Orchestrators (Phase 6)
- Multi-modal conversation (images, files, etc.)

## Success Criteria

### User Can:
1. ✅ Start conversation with HR agent
2. ✅ Ask questions and get responses
3. ✅ Have ongoing multi-turn conversation
4. ✅ See conversation history
5. ✅ No deliverables panel shown
6. ✅ No mode selector shown (locked to converse)
7. ✅ Create multiple conversations with same agent
8. ✅ Switch between conversations

### Technical Requirements:
1. ✅ Agent execution capabilities prevent plan/build modes
2. ✅ UI dynamically adapts based on agent capabilities
3. ✅ Backend rejects plan/build requests for conversation-only agents
4. ✅ No deliverable creation for conversation-only agents
5. ✅ Conversation history persisted correctly

## Implementation Tasks

### Backend
1. **Validate HR agent configuration**
   - `agent_type: 'context'` (or new 'conversational' type?)
   - `execution_profile: 'conversation_only'`
   - `execution_capabilities: { can_plan: false, can_build: false }`
   - Proper system prompt for HR domain
   - Status: active

2. **Add execution capability validation**
   - Agent2AgentController validates mode against capabilities
   - Return error if plan/build requested for conversation-only agent
   - Log warning if mode mismatch detected

### Frontend - Store Updates
3. **Update agent2AgentChatStore**
   - Read agent.execution_capabilities
   - Filter allowed modes based on capabilities
   - Set default mode to 'converse' for conversation-only
   - Disable mode switching UI

4. **Update conversation service**
   - Ensure no deliverable creation for conversation-only agents
   - Don't call deliverables API unnecessarily

### Frontend - UI Components
5. **Update ConversationView.vue**
   - Check agent.execution_profile
   - Hide deliverables panel if conversation_only
   - Hide mode selector if only converse available
   - Show full-width conversation for conversation-only agents

6. **Update ChatModeSelector.vue**
   - Filter modes based on execution_capabilities
   - Hide completely if only one mode available
   - Show tooltip explaining why modes disabled

7. **Create ConversationOnlyLayout.vue (Optional)**
   - Specialized layout for conversation-only agents
   - Full-width conversation
   - Optional context panel on right
   - Clean, simple interface

### Agent Configuration
8. **Create/Update HR agent**
   - Write HR agent YAML or database record
   - Domain: HR policies, employee questions, benefits
   - System prompt for helpful HR assistant
   - Execution profile: conversation_only
   - Test configuration

## Data Model

### HR Agent Configuration (Context + Conversation-Only)
```typescript
{
  id: 'uuid',
  slug: 'hr_agent',
  name: 'HR Assistant',
  description: 'Helpful HR assistant for employee questions',
  agent_type: 'context', // ← Still a context agent!
  execution_profile: 'conversation_only', // ← But conversation-only profile
  execution_capabilities: {
    can_plan: false,
    can_build: false
  },
  config: {
    systemPrompt: 'You are a helpful HR assistant...',
    temperature: 0.7,
    // ... other config
  },
  source: 'database',
  status: 'active'
}
```

### Example: API Agent + Conversation-Only
```typescript
{
  slug: 'metrics_chat_agent',
  agent_type: 'api', // ← API agent
  execution_profile: 'conversation_only', // ← Conversation-only profile
  config: {
    api: {
      webhook_url: 'https://n8n.example.com/webhook/metrics-chat'
    }
  }
  // This agent would call n8n but never create deliverables
}
```

### Conversation
```typescript
{
  id: 'conv-123',
  user_id: 'user-456',
  agent_name: 'hr_agent',
  namespace: 'my-org',
  started_at: '2025-10-03T10:00:00Z',
  // No deliverables associated
}
```

### Task (Converse only)
```typescript
{
  id: 'task-789',
  conversation_id: 'conv-123',
  agent_slug: 'hr_agent',
  mode: 'converse',
  prompt: 'What is the PTO policy?',
  response: 'Our PTO policy is...',
  status: 'completed'
}
```

## Frontend Architecture

### UI Adaptation Logic
```typescript
// In ConversationView.vue
const showDeliverablesPanel = computed(() => {
  if (!agent.value) return false;

  // Hide deliverables for conversation-only agents
  if (agent.value.execution_profile === 'conversation_only') {
    return false;
  }

  // Show deliverables for agents that can build
  return agent.value.execution_capabilities?.can_build ?? false;
});

const availableModes = computed(() => {
  if (!agent.value) return ['converse'];

  const modes = ['converse'];
  if (agent.value.execution_capabilities?.can_plan) modes.push('plan');
  if (agent.value.execution_capabilities?.can_build) modes.push('build');

  return modes;
});
```

### Backend Validation
```typescript
// In Agent2AgentController or AgentModeRouterService
async execute(request: TaskRequestDto) {
  const agent = await this.agentRegistry.getAgent(request.agentSlug);

  // Validate mode against capabilities
  if (request.mode === 'plan' && !agent.execution_capabilities?.can_plan) {
    throw new BadRequestException('Agent does not support plan mode');
  }

  if (request.mode === 'build' && !agent.execution_capabilities?.can_build) {
    throw new BadRequestException('Agent does not support build mode');
  }

  // Continue execution...
}
```

## Testing Plan

### Manual Testing Checklist
- [ ] Create conversation with HR agent
- [ ] Ask: "What is the PTO policy?"
- [ ] Verify response appears
- [ ] Ask follow-up: "How do I request time off?"
- [ ] Verify no deliverables panel shown
- [ ] Verify no mode selector shown
- [ ] Try to switch modes (should be disabled/hidden)
- [ ] Create second conversation with HR agent
- [ ] Switch between conversations
- [ ] Verify conversation history preserved
- [ ] Try blog_post_writer → verify deliverables panel still shows

### Automated Testing
- Unit tests for execution capability validation
- Unit tests for mode filtering
- Integration test: conversation-only agent rejects plan/build
- E2E test: full conversation flow with HR agent

## Risks & Mitigations

### Risk: UI doesn't adapt correctly
**Mitigation:** Use computed properties based on agent capabilities, test with both agent types

### Risk: User confusion about missing deliverables
**Mitigation:** Clear agent descriptions, maybe show info tooltip explaining conversation-only mode

### Risk: Backend allows invalid modes
**Mitigation:** Validation in controller before execution

## Timeline Estimate
- Backend validation: 0.5 days
- HR agent configuration: 0.5 days
- Frontend UI adaptations: 1 day
- Testing & bug fixes: 1 day
- **Total: 3 days**

## Dependencies
- Phase 1 complete ✅
- agent2AgentChatStore exists ✅
- Agent routing working ✅

## Definition of Done
- [ ] HR agent configured as conversation-only
- [ ] Can have multi-turn conversation with HR agent
- [ ] No deliverables panel shown for HR agent
- [ ] No mode selector shown for HR agent
- [ ] Backend rejects plan/build requests for conversation-only agents
- [ ] blog_post_writer still works with deliverables (regression test)
- [ ] Manual testing checklist complete
- [ ] Code reviewed and merged

## Notes
This phase validates that our agent architecture supports different execution profiles. The same infrastructure (agent2agent services, stores) works for both conversation-only and deliverable-producing agents.
