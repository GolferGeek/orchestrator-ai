# Phase 3: API Agents (n8n Integration)

## Overview
Implement API agent type that delegates execution to external services via n8n workflows. Convert complex file-based agents (metrics, marketing swarm, requirements writer) into API agents backed by n8n.

## Goals
- Implement API agent execution flow (webhook-based)
- Build 3 reference n8n workflows
- Handle async execution and callbacks
- Validate API agent architecture
- Offload complex logic from monolith to n8n

## Prerequisites
- ✅ Phase 1 complete (context agents)
- ✅ Phase 2 complete (conversation-only agents)
- ✅ n8n instance running and accessible
- ✅ n8n workflow sync system (from previous PRD)

## Scope

### In Scope
1. **API Agent Type**
   - `agent_type: 'api'`
   - Configuration includes webhook URL
   - Async execution via n8n
   - Callback handling for results

2. **Three API Agents**
   - **Metrics Agent:** Fetch and analyze system metrics
   - **Marketing Swarm Agent:** Multi-agent marketing analysis (complex)
   - **Requirements Writer Agent:** Technical requirements generation

3. **n8n Workflows**
   - One workflow per agent
   - Webhook trigger
   - Business logic execution
   - Callback to orchestrator-ai API

4. **Backend Implementation**
   - API agent runner service
   - Webhook call to n8n
   - Callback endpoint for results
   - Task status tracking (pending → running → completed)

5. **Frontend Support**
   - API agents appear in agent list
   - Execute like other agents
   - Show "processing" state during async execution
   - Handle longer execution times gracefully

### Out of Scope
- File-based agent removal (Phase 5)
- Image deliverables (Phase 4)
- Orchestration (Phase 6)
- Function agents (already implemented)

## Success Criteria

### User Can:
1. ✅ Select metrics agent from agent list
2. ✅ Request: "Show me last 24h metrics"
3. ✅ See "processing" indicator
4. ✅ Receive metrics data when n8n completes
5. ✅ Same flow works for marketing swarm and requirements writer
6. ✅ Error handling if n8n workflow fails

### Technical Requirements:
1. ✅ API agents execute via webhook to n8n
2. ✅ Task status updates from pending → running → completed
3. ✅ Callback endpoint receives results
4. ✅ Results stored in task record
5. ✅ Deliverables created if applicable
6. ✅ Timeout handling (max 5 minutes)
7. ✅ n8n workflows versioned in git

## Implementation Tasks

### Backend - API Agent Execution
1. **Create ApiAgentRunnerService**
   - `execute(agent, request)` → calls webhook
   - Build webhook payload with task context
   - Return immediately with task ID (async)
   - Handle webhook authentication

2. **Create API callback endpoint**
   - `POST /agent-to-agent/api-callback/:taskId`
   - Validate callback signature
   - Update task status to completed
   - Store result in task record
   - Create deliverable if needed
   - Notify via WebSocket

3. **Update AgentModeRouterService**
   - Check if agent_type === 'api'
   - Route to ApiAgentRunnerService
   - Handle async execution flow

4. **Task status tracking**
   - Create task with status: pending
   - Update to running when webhook called
   - Update to completed/failed on callback
   - Support timeout after 5 minutes

### n8n Workflows
5. **Metrics Agent Workflow**
   - Webhook trigger: `/webhook/metrics-agent`
   - Extract task ID and user message
   - Query metrics from database/APIs
   - Format response
   - Callback to: `POST /agent-to-agent/api-callback/{taskId}`

6. **Marketing Swarm Agent Workflow**
   - Webhook trigger: `/webhook/marketing-swarm`
   - Complex multi-step analysis
   - Call multiple LLMs (or sub-workflows)
   - Aggregate results
   - Callback with final output

7. **Requirements Writer Workflow**
   - Webhook trigger: `/webhook/requirements-writer`
   - Parse user input
   - Generate technical requirements
   - Format as structured document
   - Callback with requirements

8. **Workflow sync to git**
   - Export workflows as JSON
   - Store in `apps/api/n8n/workflows/`
   - Use migration scripts from n8n PRD
   - Version control all workflows

### Agent Configuration
9. **Create Metrics Agent**
```typescript
{
  slug: 'metrics_agent',
  name: 'Metrics Agent',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: 'https://n8n.example.com/webhook/metrics-agent',
      auth_type: 'bearer',
      auth_token: '${N8N_WEBHOOK_TOKEN}',
      timeout_ms: 300000 // 5 minutes
    },
    systemPrompt: 'You analyze system metrics...'
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: { can_build: true }
}
```

10. **Create Marketing Swarm Agent**
11. **Create Requirements Writer Agent**

### Frontend
12. **Update agent2AgentChatStore**
   - Handle async task execution
   - Poll task status if needed
   - Show "processing" state
   - Handle timeout errors

13. **Update ConversationView.vue**
   - Show loading indicator during API execution
   - Display "Agent is processing..." message
   - Timeout warning after 3 minutes

## Data Model

### API Agent Configuration
```typescript
{
  id: 'uuid',
  slug: 'metrics_agent',
  name: 'Metrics Agent',
  agent_type: 'api',
  config: {
    api: {
      webhook_url: string,
      auth_type: 'bearer' | 'none',
      auth_token?: string,
      timeout_ms: number,
      method: 'POST',
      headers?: Record<string, string>
    },
    systemPrompt?: string,
    // ... other config
  },
  execution_profile: 'autonomous_build',
  execution_capabilities: {
    can_plan: false,
    can_build: true
  },
  source: 'database',
  status: 'active'
}
```

### Webhook Payload (to n8n)
```typescript
{
  task_id: 'task-123',
  agent_slug: 'metrics_agent',
  conversation_id: 'conv-456',
  user_id: 'user-789',
  mode: 'build',
  user_message: 'Show me last 24h metrics',
  context?: {
    // Optional conversation context
  },
  callback_url: 'https://api.orchestrator.ai/agent-to-agent/api-callback/task-123'
}
```

### Callback Payload (from n8n)
```typescript
{
  task_id: 'task-123',
  status: 'completed' | 'failed',
  result?: {
    content: string,
    metadata?: Record<string, any>
  },
  error?: string
}
```

### Task Lifecycle
```
Create task (status: pending)
  ↓
Call webhook (status: running)
  ↓
Wait for callback...
  ↓
Receive callback (status: completed)
  ↓
Store result + create deliverable
  ↓
Notify user via WebSocket
```

## n8n Workflow Structure

### Example: Metrics Agent Workflow
```
[Webhook Trigger]
  ↓
[Extract Payload]
  ↓
[Query Metrics Database]
  ↓
[Format Response]
  ↓
[HTTP Request to Callback URL]
```

### Example: Marketing Swarm Workflow (Complex)
```
[Webhook Trigger]
  ↓
[Parse User Request]
  ↓
[Branch: Run Multiple Analyses]
  ├─ [Competitor Analysis] → [LLM Call]
  ├─ [Market Trends] → [LLM Call]
  └─ [Content Strategy] → [LLM Call]
  ↓
[Merge Results]
  ↓
[Aggregate Analysis] → [LLM Call]
  ↓
[Format Final Report]
  ↓
[HTTP Request to Callback URL]
```

## Testing Plan

### Manual Testing Checklist

**Metrics Agent:**
- [ ] Start conversation with metrics_agent
- [ ] Request: "Show me metrics from last 24 hours"
- [ ] Verify task created with status: pending
- [ ] Verify webhook called to n8n
- [ ] Verify task status updates to running
- [ ] Wait for n8n to complete
- [ ] Verify callback received
- [ ] Verify task status updates to completed
- [ ] Verify result displayed in conversation
- [ ] Verify deliverable created (if applicable)

**Marketing Swarm Agent:**
- [ ] Request: "Analyze our competitor landscape"
- [ ] Verify complex workflow executes
- [ ] Verify multiple sub-steps complete
- [ ] Verify aggregated result returned

**Requirements Writer Agent:**
- [ ] Request: "Write requirements for user authentication"
- [ ] Verify structured requirements generated
- [ ] Verify deliverable created

**Error Handling:**
- [ ] Test timeout (webhook doesn't respond)
- [ ] Test n8n workflow error
- [ ] Test invalid callback payload
- [ ] Test network failure

### Automated Testing
- Unit tests for ApiAgentRunnerService
- Unit tests for callback endpoint
- Integration test: full webhook → callback flow (mock n8n)
- E2E test: real n8n workflow execution (dev environment)

## Security Considerations

1. **Webhook Authentication**
   - Use bearer token for n8n webhooks
   - Validate token in n8n workflow
   - Rotate tokens periodically

2. **Callback Validation**
   - Verify callback signature/token
   - Validate task ID exists
   - Rate limiting on callback endpoint

3. **Data Privacy**
   - Don't send PII to n8n (or pseudonymize)
   - Respect user data sovereignty
   - Audit logging for API calls

## Risks & Mitigations

### Risk: n8n downtime breaks agents
**Mitigation:** Health checks, timeout handling, graceful error messages

### Risk: Webhook callbacks lost
**Mitigation:** Retry logic, task expiration cleanup

### Risk: Complex workflows hard to debug
**Mitigation:** Extensive logging, n8n execution history, structured error responses

### Risk: Long execution times frustrate users
**Mitigation:** Progress updates, realistic timeouts, "this may take a minute" messaging

## Timeline Estimate
- ApiAgentRunnerService implementation: 2 days
- Callback endpoint: 1 day
- n8n workflows (3 agents): 3 days
- Agent configuration: 1 day
- Frontend async handling: 1 day
- Testing & bug fixes: 2 days
- **Total: 10 days**

## Dependencies
- Phase 1 & 2 complete ✅
- n8n instance running ✅
- n8n workflow sync system ✅
- Database agent architecture ✅

## Definition of Done
- [ ] ApiAgentRunnerService implemented
- [ ] Callback endpoint working
- [ ] 3 n8n workflows created and synced to git
- [ ] All 3 API agents working end-to-end
- [ ] Async execution with status updates
- [ ] Timeout handling
- [ ] Error handling for workflow failures
- [ ] Manual testing checklist complete
- [ ] Documentation for creating new API agents
- [ ] Code reviewed and merged

## Documentation Deliverables
- API agent creation guide
- n8n workflow template
- Webhook payload specification
- Callback endpoint specification
- Troubleshooting guide

## Notes
API agents allow us to offload complex logic to n8n without bloating the monolith. This architecture supports future expansion - any complex workflow can become an API agent.

Future enhancements:
- Progress callbacks (multi-step workflows)
- Streaming responses
- Workflow versioning and rollback
- A/B testing different workflow versions
