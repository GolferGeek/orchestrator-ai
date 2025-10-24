# API Source Directory Reorganization Plan (REVISED)

**Date:** 2025-10-04
**Objective:** Organize `/apps/api/src` into clear, logical groupings

---

## Key Findings from Investigation

### 1. **agent-pool/**
- **Current Use:** In-memory registry for file-based agents (legacy)
- **Status:** Still imported in app.module but only used by legacy app.service
- **Decision:** ⚠️ **ARCHIVE** - This is legacy file-based agent infrastructure
- **Action:** Move to `_archive-phase-0/agent-pool/`

### 2. **services/** (PII Services)
- **Contents:** PII detection and pseudonymization services
  - `pii-simplified.service.ts`
  - `pii.service.ts`
  - `dictionary-pseudonymizer.service.ts`
  - `pii-simplified.module.ts`
- **Current Pattern:** PII service uses `llms/pii-pattern.service.ts` but operates independently
- **Decision:** ✅ **MOVE to llms/pii/** - PII is processed BEFORE LLM calls (redaction)
- **Reasoning:** PII redaction happens in the LLM request/response pipeline

### 3. **hierarchy/**
- **Contents:** Controller to get agent hierarchy (tree structure)
- **Current Use:** Returns hierarchical list of discovered agents by namespace
- **Decision:** ✅ **MOVE to agent-platform/** - This is about discovering/listing database agents
- **Reasoning:** Returns agent metadata and hierarchy - part of agent discovery/registry

### 4. **mcp/** (Model Context Protocol)
- **Your feedback:** Should be at source level, similar to agents
- **Decision:** ✅ **KEEP at src/mcp/** - Infrastructure level, not LLM-specific
- **Reasoning:** MCP is a protocol layer that can be used beyond just LLMs

---

## REVISED Organization Plan

### 1. **LLM Module** (`llms/`)
**Purpose:** All LLM-related functionality - providers, models, evaluation, PII redaction

**Should contain:**
- ✅ Current: `llms/` core service
- 🔄 **MOVE:** `providers/` → `llms/providers/`
- 🔄 **MOVE:** `models/` → `llms/models/`
- 🔄 **MOVE:** `evaluation/` → `llms/evaluation/`
- 🔄 **MOVE:** `cidafm/` → `llms/cidafm/`
- 🔄 **MOVE:** `usage/` → `llms/usage/`
- 🔄 **MOVE:** `langchain/` → `llms/langchain/`
- 🔄 **MOVE:** `services/` → `llms/pii/` (PII redaction in LLM pipeline)

**Reasoning:** PII redaction is part of the LLM request/response pipeline (happens before LLM sees data)

---

### 2. **Agent2Agent Module** (`agent2agent/`)
**Purpose:** All agent-to-agent communication, conversations, tasks, deliverables

**Should contain:**
- ✅ Current: `deliverables/`, `tasks/`, `services/`, `dto/`, `guards/`
- 🔄 **MOVE:** `agent-conversations/` → `agent2agent/conversations/`
- 🔄 **MOVE:** `projects/` → `agent2agent/projects/`
- 🔄 **MOVE:** `context-optimization/` → `agent2agent/context-optimization/`
- 🔄 **MOVE:** `orchestration/` → `agent2agent/orchestration/`

**Reasoning:** All core agent collaboration features

---

### 3. **Agent Platform** (`agent-platform/`)
**Purpose:** Database agent management, registry, execution runtime, discovery

**Should contain:**
- ✅ Current: repositories, services, controllers for database agents
- 🔄 **MOVE:** `hierarchy/` → `agent-platform/hierarchy/` (agent discovery/listing)

**Reasoning:** Hierarchy is about listing and discovering agents in the registry

---

### 4. **Infrastructure/Core** (Stay in `src/`)
**Purpose:** Core application infrastructure that everything depends on

**Keep at root level:**
- ✅ `auth/` - Authentication & authorization
- ✅ `supabase/` - Database connection
- ✅ `config/` - Configuration management
- ✅ `health/` - Health checks
- ✅ `websocket/` - WebSocket infrastructure
- ✅ `mcp/` - Model Context Protocol (infrastructure layer)
- ✅ `common/` - Shared types, interfaces, constants
- ✅ `dto/` - Shared DTOs
- ✅ `types/` - Shared TypeScript types
- ✅ `utils/` - Shared utility functions
- ✅ `__tests__/` - Test utilities

**Reasoning:** Foundational infrastructure used across all modules

---

### 5. **Feature Modules** (Stay in `src/`)
**Purpose:** Standalone features with their own routes/controllers

**Keep at root level:**
- ✅ `assets/` - Asset storage and streaming
- ✅ `speech/` - Speech-to-text and text-to-speech
- ✅ `analytics/` - Analytics tracking
- ✅ `system/` - System monitoring

**Reasoning:** Independent features not specifically agent or LLM focused

---

### 6. **Legacy/To Archive**

**Move to `_archive-phase-0/`:**
- ✅ Already archived: `agents/`, `agent-factory.*`, `image-agents/`, etc.
- 🔄 **ARCHIVE:** `agent-pool/` - Legacy file-based agent registry
- 🔄 **ARCHIVE:** `agent-discovery.service.ts` - Legacy file-based discovery
- 🔄 **ARCHIVE:** `hierarchy-simple.controller.ts` - Legacy hierarchy endpoint

**Reasoning:** These are file-based agent infrastructure, no longer needed

---

## Final Target Structure

```
apps/api/src/
│
├── llms/                          # ⭐ LLM Module
│   ├── llm.service.ts
│   ├── llm.module.ts
│   ├── providers/                 # LLM providers (OpenAI, Anthropic, etc.)
│   ├── models/                    # Model definitions
│   ├── evaluation/                # LLM evaluation & feedback
│   ├── cidafm/                    # AI Function Module (behavior mod)
│   ├── usage/                     # Usage analytics & cost tracking
│   ├── langchain/                 # LangChain integration
│   └── pii/                       # PII redaction (before LLM calls)
│       ├── pii-simplified.service.ts
│       ├── pii.service.ts
│       ├── dictionary-pseudonymizer.service.ts
│       └── pii-simplified.module.ts
│
├── agent2agent/                   # ⭐ Agent-to-Agent Module
│   ├── agent2agent.module.ts
│   ├── agent2agent.controller.ts
│   ├── conversations/             # Agent conversations
│   ├── tasks/                     # Agent tasks
│   ├── deliverables/              # Agent deliverables
│   ├── projects/                  # Project lifecycle
│   ├── context-optimization/      # Context optimization
│   ├── orchestration/             # Agent orchestration
│   ├── services/
│   ├── dto/
│   └── guards/
│
├── agent-platform/                # ⭐ Agent Platform (Database Agents)
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── interfaces/
│   └── hierarchy/                 # Agent discovery/listing endpoints
│       ├── hierarchy.controller.ts
│       └── hierarchy.module.ts
│
├── mcp/                           # ⭐ Model Context Protocol (Infrastructure)
│   └── ... MCP server/client
│
├── auth/                          # 🔧 Core Infrastructure
├── supabase/
├── config/
├── health/
├── websocket/
│
├── assets/                        # 🎯 Standalone Features
├── speech/
├── analytics/
├── system/
│
├── common/                        # 📦 Shared Code
├── dto/
├── types/
├── utils/
└── __tests__/
```

---

## Migration Steps (Detailed)

### Phase 1: Archive Legacy Code
```bash
# Archive agent-pool (legacy file-based registry)
mv apps/api/src/agent-pool _archive-phase-0/

# Archive legacy discovery service
mv apps/api/src/agent-discovery.service.ts _archive-phase-0/

# Archive legacy hierarchy controller
mv apps/api/src/hierarchy-simple.controller.ts _archive-phase-0/
```

### Phase 2: Reorganize LLMs
```bash
# Create LLM subdirectories
mkdir -p apps/api/src/llms/{providers,models,evaluation,cidafm,usage,langchain,pii}

# Move modules into LLMs
mv apps/api/src/providers apps/api/src/llms/
mv apps/api/src/models apps/api/src/llms/
mv apps/api/src/evaluation apps/api/src/llms/
mv apps/api/src/cidafm apps/api/src/llms/
mv apps/api/src/usage apps/api/src/llms/
mv apps/api/src/langchain apps/api/src/llms/

# Move PII services into LLMs
mv apps/api/src/services/* apps/api/src/llms/pii/
rmdir apps/api/src/services
```

### Phase 3: Reorganize Agent2Agent
```bash
# Create agent2agent subdirectories
mkdir -p apps/api/src/agent2agent/{conversations,projects,context-optimization,orchestration}

# Move modules into agent2agent
mv apps/api/src/agent-conversations apps/api/src/agent2agent/conversations
mv apps/api/src/projects apps/api/src/agent2agent/
mv apps/api/src/context-optimization apps/api/src/agent2agent/
mv apps/api/src/orchestration apps/api/src/agent2agent/
```

### Phase 4: Reorganize Agent Platform
```bash
# Move hierarchy into agent-platform
mkdir -p apps/api/src/agent-platform/hierarchy
mv apps/api/src/hierarchy/* apps/api/src/agent-platform/hierarchy/
rmdir apps/api/src/hierarchy
```

### Phase 5: Update All Imports
```bash
# Use find/replace to update import paths throughout codebase
# Examples:
# - from '@/providers/' → from '@/llms/providers/'
# - from '@/services/pii' → from '@/llms/pii/'
# - from '@/agent-conversations/' → from '@/agent2agent/conversations/'
# - from '@/hierarchy/' → from '@/agent-platform/hierarchy/'
```

### Phase 6: Update Module Exports

**Update `llms/llm.module.ts`:**
```typescript
@Module({
  imports: [
    ProvidersModule,
    ModelsModule,
    EvaluationModule,
    CIDAFMModule,
    UsageModule,
    LangChainModule,
    PIISimplifiedModule,
  ],
  // ... rest of module
})
export class LLMModule {}
```

**Update `agent2agent/agent2agent.module.ts`:**
```typescript
@Module({
  imports: [
    ConversationsModule,
    TasksModule,
    DeliverablesModule,
    ProjectsModule,
    ContextOptimizationModule,
    OrchestrationModule,
  ],
  // ... rest of module
})
export class Agent2AgentModule {}
```

**Update `agent-platform/agent-platform.module.ts`:**
```typescript
@Module({
  imports: [
    HierarchyModule,
    // ... existing imports
  ],
  // ... rest of module
})
export class AgentPlatformModule {}
```

### Phase 7: Update app.module.ts
```typescript
@Module({
  imports: [
    // Core Infrastructure
    ConfigModule,
    HttpModule,
    SupabaseModule,
    AuthModule,
    HealthModule,
    WebSocketModule,
    MCPModule,

    // Main Modules
    LLMModule,              // Consolidated LLM functionality
    Agent2AgentModule,      // Consolidated agent collaboration
    AgentPlatformModule,    // Database agents & registry

    // Standalone Features
    AssetsModule,
    SpeechModule,
    AnalyticsModule,
    SystemModule,

    // Shared
    EventEmitterModule.forRoot(),
  ],
  // Remove: AgentPoolModule, ProvidersModule, ModelsModule, etc. (now in LLMModule)
  // Remove: AgentConversationsModule, ProjectsModule, etc. (now in Agent2AgentModule)
})
export class AppModule {}
```

### Phase 8: Build, Test, Fix
```bash
# Run build
npm run build

# Fix import errors
# Run smoke tests
npm test -- src/__tests__/smoke/

# Fix any remaining issues
```

---

## Benefits

1. **✅ Clear module boundaries** - LLM vs Agent vs Infrastructure
2. **✅ PII properly placed** - In LLM pipeline where it belongs
3. **✅ Hierarchy in right place** - Agent discovery with agent-platform
4. **✅ MCP at infrastructure level** - Protocol layer, not LLM-specific
5. **✅ Legacy code archived** - agent-pool removed
6. **✅ Easier to navigate** - Logical groupings
7. **✅ Better scalability** - Each module can grow independently

---

## Summary of Changes from Original Plan

| Item | Original Plan | Revised Plan | Reason |
|------|--------------|--------------|--------|
| **MCP** | Move to `llms/mcp/` | ✅ Keep at `src/mcp/` | Infrastructure protocol, not LLM-specific |
| **PII Services** | Unclear | ✅ Move to `llms/pii/` | PII redaction in LLM pipeline |
| **agent-pool** | Review | ✅ Archive | Legacy file-based registry |
| **hierarchy** | Review | ✅ Move to `agent-platform/hierarchy/` | Agent discovery/listing |

---

## Ready to Execute?

This plan gives us:
- 3 main modules: `llms/`, `agent2agent/`, `agent-platform/`
- Clear infrastructure at root: `auth/`, `supabase/`, `mcp/`, etc.
- Standalone features: `assets/`, `speech/`, etc.
- Archive legacy: `agent-pool/`, `agent-discovery.service.ts`

**Shall we proceed with the migration?**
