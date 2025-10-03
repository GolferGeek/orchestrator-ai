# PRD Updates and Clarifications

## Key Clarifications from Discussion

### 1. Conversation-Only is a Profile, NOT a Type

**Phase 2 Update:**

**OLD Understanding:** "Conversation-only agents" are a separate agent type
**CORRECT Understanding:** `conversation_only` is an **execution profile** that can be applied to ANY agent type

**Examples:**
```typescript
// Context agent + conversation_only = HR Agent
{
  agent_type: 'context',
  execution_profile: 'conversation_only', // ← The key flag
  execution_capabilities: { can_plan: false, can_build: false }
}

// API agent + conversation_only = Chat-only API agent
{
  agent_type: 'api',
  execution_profile: 'conversation_only',
  config: { api: { webhook_url: '...' } }
}

// Function agent + conversation_only = Chat-only function (rare but possible)
{
  agent_type: 'function',
  execution_profile: 'conversation_only',
  function_code: '...'
}
```

**Implementation:**
- NOT creating a new agent type
- Just respecting `execution_profile: 'conversation_only'` flag
- UI hides deliverables panel when this flag is set
- Backend rejects plan/build modes when this flag is set

---

### 2. External Agents Missing from Plan

**Phase 3 Update:**

**Need to add:** External agent type to Phase 3

**What are External Agents:**
- Call arbitrary HTTP endpoints (not just n8n)
- Already have file-based implementation we can copy
- Very light coding effort (stub based on existing code)
- Same webhook/callback pattern as API agents

**Phase 3 becomes:** "API & External Agents"

**Agent Types in Phase 3:**
```typescript
// API Agent (n8n workflow)
{
  agent_type: 'api',
  config: {
    api: {
      webhook_url: 'https://n8n.example.com/webhook/agent'
    }
  }
}

// External Agent (arbitrary HTTP endpoint)
{
  agent_type: 'external',
  config: {
    external: {
      endpoint_url: 'https://example.com/api/execute',
      method: 'POST',
      auth_type: 'bearer'
    }
  }
}
```

**Implementation:**
1. Create `ApiAgentRunnerService` for n8n webhooks
2. Create `ExternalAgentRunnerService` for arbitrary endpoints (copy from file-based external)
3. Both use same callback pattern
4. Very light effort - mostly reusing existing code

**Timeline:** Add 0.5 days to Phase 3 for external agent stub

---

## Updated Agent Type Summary

### All Agent Types (Post Phase 0-5)

1. **Context Agents** (Phase 1)
   - LLM-based
   - Create deliverables
   - Examples: blog_post_writer, social_media_manager

2. **Function Agents** (Already implemented)
   - Execute JavaScript/TypeScript code
   - Deterministic
   - Examples: image_generator, data_processor

3. **API Agents** (Phase 3)
   - Delegate to n8n workflows
   - Async webhook/callback
   - Examples: metrics_agent, marketing_swarm

4. **External Agents** (Phase 3)
   - Delegate to arbitrary HTTP endpoints
   - Same async pattern as API
   - Examples: third-party service integrations

5. **Orchestrator Agents** (Phase 5)
   - Coordinate multiple specialists
   - Multi-step workflows
   - Examples: hiverarchy_orchestrator, ceo_orchestrator

### All Execution Profiles

- `autonomous_build` - Can plan and build deliverables
- `conversation_only` - Chat only, no deliverables (can be ANY agent type)
- `orchestrator` - Multi-agent coordination

---

## Implementation Notes

### Phase 0: Keep Demo Directory
- Keep **entire** `apps/api/src/agents/demo/` directory
- Not just YAML files - has important utilities, types, etc.
- Only delete **execution code** (DynamicAgentsController, loaders, etc.)
- Demo directory becomes reference/documentation

### Phase 2: Minimal Effort
- Just respect `execution_profile` flag
- Hide UI elements based on capabilities
- Backend validation
- **NOT** a new agent type

### Phase 3: Two Runner Services
- `ApiAgentRunnerService` - n8n webhooks (new)
- `ExternalAgentRunnerService` - HTTP endpoints (stub from file-based)
- Both minimal effort, reuse patterns

---

## Action Items

- [ ] Update Phase 2 PRD title: "Conversation-Only Profile" (not "Agents")
- [ ] Update Phase 2 to clarify it's a profile flag, not agent type
- [ ] Update Phase 3 PRD title: "API & External Agents"
- [ ] Add ExternalAgentRunnerService to Phase 3 tasks
- [ ] Update Phase 0 to explicitly keep entire demo/ directory
- [ ] Update high-level vision PRD with external agents

---

**Bottom Line:**
- Conversation-only = execution profile (applies to any agent type)
- External agents = missing from plan, add to Phase 3 (very light effort)
- Keep demo/ directory intact in Phase 0

These are clarifications, not major scope changes. All timelines still valid.
