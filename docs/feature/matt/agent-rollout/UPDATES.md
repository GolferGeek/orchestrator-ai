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

### Phase 0: NUCLEAR CLEANUP - Delete EVERYTHING Except agent2agent + demo

**Keep ONLY These Two Directories:**
1. ✅ `apps/api/src/agents/demo/` - Reference agents (agents + their files, some code is fine)
2. ✅ `apps/api/src/agent2agent/` - The ONE TRUE agent execution system

**DELETE EVERYTHING ELSE Agent-Related:**
- ❌ `apps/api/src/agents/base/` - **DELETE ENTIRE DIRECTORY** (all base implementations)
- ❌ `apps/api/src/agents/dynamic-agents.controller.ts` - DELETE
- ❌ Any agent loaders, parsers, file readers - DELETE
- ❌ **Clean up `llms/` directory** - remove any agent-specific code
- ❌ **Clean up `mcp/` directory** - remove any agent-specific code
- ❌ **Any stray agent files ANYWHERE** - DELETE

**Handle Strays:**
- IF agent2agent NEEDS a file from deleted areas → **MOVE it INTO agent2agent/**
- NO stray files scattered around
- Everything agent-related lives in agent2agent/ (except demo reference)

**After Cleanup:**
```
apps/api/src/
├── agent2agent/           ✅ ONLY agent execution system
│   ├── controllers/
│   ├── services/
│   ├── dto/
│   └── [any needed utilities moved here]
│
├── agents/
│   └── demo/              ✅ Reference agents only (not executed)
│
├── llms/                  ✅ CLEAN - just LLM integrations
├── mcp/                   ✅ CLEAN - just MCP protocol
├── deliverables/          ✅ Universal deliverables API
├── supabase/              ✅ Database layer
└── [other modules]        ✅ Simple, focused
```

**Goal:**
- API directory becomes **VERY simple**
- ONE agent system (agent2agent)
- NO confusion
- NO scattered files
- Clean module boundaries

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

---

### 3. Image Generation & Deliverables Need Their Own Phase

**Phase Structure Update:**

**OLD Plan:**
- Phase 5: Orchestration (assumed deliverables/images working)

**NEW Plan:**
- Phase 5: Image Generation & Deliverables (7 days)
- Phase 6: Orchestration (22 days)

**Why Separate Phase:**
- Image generation has only initial code, needs full implementation
- Deliverables need complete workflow (plan → build → edit)
- Version management needs work
- Asset storage integration incomplete
- Should be working BEFORE orchestration (orchestrators will use these)

**What's in Phase 5:**
- OpenAI DALL-E integration (complete)
- Gemini Imagen integration (complete)
- Image storage via assets module
- Deliverable lifecycle (plan, build, edit modes)
- Deliverable versioning
- Deliverables UI panel
- Edit conversations

**Agent Types Added:**
```typescript
// Image generation agent
{
  agent_type: 'image_generation',
  config: {
    image_generation: {
      provider: 'openai' | 'gemini',
      model: 'dall-e-3' | 'imagen-3'
    }
  }
}
```

**Timeline Impact:**
- Total: ~55 days → ~62 days (~11 weeks → ~12.5 weeks)
- Phase 5 must complete before Phase 6 (Orchestration)

---

### 4. Consolidate Image Generation into Agent2AgentDeliverablesService

**Architecture Decision:**

**OLD Approach:**
- Separate `image-agents/` module
- Separate `ImageAgentsService`
- Separate controller/routes

**NEW Approach:**
- Single `Agent2AgentDeliverablesService` handles ALL deliverable types
- Image generation providers in `agent2agent/providers/`
- Unified deliverable creation pattern

**Why:**
- Single source of truth for deliverable creation
- Consistent API across text, image, video, audio deliverables
- Easier to maintain and extend
- Clean separation: providers generate, service stores/versions

**Implementation:**
```typescript
// Agent2AgentDeliverablesService methods:
- createFromTaskResult()        // Text (existing)
- generateImageDeliverable()    // Images (Phase 5)
- generateVideoDeliverable()    // Future
- generateAudioDeliverable()    // Future
```

**Providers:**
```
agent2agent/providers/
├── openai-image.provider.ts     // DALL-E 3
├── gemini-image.provider.ts     // Imagen
├── openai-video.provider.ts     // Future: Sora
└── elevenlabs-audio.provider.ts // Future: TTS
```

**Phase 0 Impact:**
- ❌ DELETE `image-agents/` module entirely
- Will be reimplemented in Phase 5 inside agent2agent

**Phase 5 Impact:**
- Simpler - just add methods to existing service
- No new module to maintain
- Consistent with existing deliverable patterns

---

---

### 5. Better Naming: "Document" over "Text"

**Terminology Update:**

**OLD:** `generateTextDeliverable()` - too narrow, implies plain text only

**NEW:** Two explicit methods:
- `generateDocumentDeliverable()` - formatted content (markdown, JSON, YAML, HTML)
- `generateCodeDeliverable()` - syntax-highlighted code (TypeScript, Python, SQL, etc.)

**Why:**
- "Document" is user-facing, broader scope
- Clear separation enables different UI rendering
- Code gets syntax highlighting, documents get formatted rendering
- Matches industry terms (Google Docs, not Google Texts)

**Method Signatures:**
```typescript
generateDocumentDeliverable() → type: 'document', formats: markdown, json, yaml, html
generateCodeDeliverable()      → type: 'code', formats: typescript, python, sql, css
generateImageDeliverable()     → type: 'image', formats: png, jpg, webp
```

---

## Action Items

- [x] Add Phase 5: Image Generation & Deliverables PRD
- [x] Rename old Phase 5 to Phase 6
- [x] Update README with new phase structure
- [x] Document image consolidation decision in Phase 5 PRD
- [x] Update Phase 0 to delete image-agents module
- [x] Rename generateTextDeliverable → generateDocumentDeliverable
- [x] Add generateCodeDeliverable for syntax-highlighted code
- [ ] Update Phase 2 PRD title: "Conversation-Only Profile" (not "Agents")
- [ ] Update Phase 2 to clarify it's a profile flag, not agent type
- [ ] Update Phase 3 PRD title: "API & External Agents"
- [ ] Add ExternalAgentRunnerService to Phase 3 tasks
- [ ] Update high-level vision PRD with external agents

---

**Bottom Line:**
- Conversation-only = execution profile (applies to any agent type)
- External agents = missing from plan, add to Phase 3 (very light effort)
- Image generation & deliverables = need dedicated phase before orchestration
- Image generation = consolidate into Agent2AgentDeliverablesService (cleaner architecture)
- Keep demo/ directory intact in Phase 0
- Delete image-agents/ in Phase 0, rebuild in Phase 5 inside agent2agent

Total timeline: ~62 days (12.5 weeks), all scope accounted for.
