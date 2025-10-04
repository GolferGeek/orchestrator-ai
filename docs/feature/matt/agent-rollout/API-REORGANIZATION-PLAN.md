# API Source Directory Reorganization Plan

**Date:** 2025-10-04
**Objective:** Organize `/apps/api/src` into clear, logical groupings

---

## Current State Analysis

### Current Top-Level Directories (32 total):
```
__tests__
agent-conversations
agent-platform
agent-pool
agent2agent
agents
analytics
assets
auth
cidafm
common
config
context-optimization
dto
evaluation
health
hierarchy
langchain
llms
mcp
models
orchestration
projects
providers
services
speech
supabase
system
types
usage
utils
websocket
```

---

## Proposed Organization

### 1. **LLM Module** (`llms/`)
**Purpose:** All LLM-related functionality - providers, models, evaluation, etc.

**Should contain:**
- ✅ Current: `llms/` (core LLM service)
- 🔄 **MOVE:** `providers/` → `llms/providers/` (LLM provider implementations)
- 🔄 **MOVE:** `models/` → `llms/models/` (LLM model definitions)
- 🔄 **MOVE:** `evaluation/` → `llms/evaluation/` (LLM evaluation and feedback)
- 🔄 **MOVE:** `cidafm/` → `llms/cidafm/` (AI Function Module - LLM behavior modification)
- 🔄 **MOVE:** `usage/` → `llms/usage/` (LLM usage analytics and cost tracking)
- 🔄 **MOVE:** `langchain/` → `llms/langchain/` (LangChain integration for LLMs)

**Reasoning:** All these modules are directly related to LLM operations, evaluation, and management.

---

### 2. **Agent2Agent Module** (`agent2agent/`)
**Purpose:** All agent-to-agent communication, conversations, tasks, deliverables

**Currently contains:**
- ✅ `agent2agent/deliverables/` (already moved)
- ✅ `agent2agent/tasks/` (already moved)
- ✅ `agent2agent/services/`
- ✅ `agent2agent/controllers/`
- ✅ `agent2agent/dto/`
- ✅ `agent2agent/guards/`

**Should also contain:**
- 🔄 **MOVE:** `agent-conversations/` → `agent2agent/conversations/`
- 🔄 **MOVE:** `projects/` → `agent2agent/projects/` (Project lifecycle for agent work)
- 🔄 **MOVE:** `context-optimization/` → `agent2agent/context-optimization/` (Optimizing agent conversation context)
- 🔄 **MOVE:** `orchestration/` → `agent2agent/orchestration/` (Agent orchestration)

**Reasoning:** These are all core to agent-to-agent interactions and collaboration.

---

### 3. **Agent Platform** (`agent-platform/`)
**Purpose:** Database agent management, registry, execution runtime

**Keep as-is:**
- ✅ `agent-platform/` (already well-organized)
- Contains: repositories, services, controllers for database agents

**Reasoning:** This is the new agent execution platform - keep it separate and clean.

---

### 4. **Infrastructure/Core** (Stay in `src/`)
**Purpose:** Core application infrastructure that everything depends on

**Keep at root level:**
- ✅ `auth/` - Authentication & authorization (used by everything)
- ✅ `supabase/` - Database connection (infrastructure)
- ✅ `config/` - Configuration management
- ✅ `health/` - Health checks
- ✅ `websocket/` - WebSocket infrastructure
- ✅ `common/` - Shared types, interfaces, constants
- ✅ `dto/` - Shared DTOs
- ✅ `types/` - Shared TypeScript types
- ✅ `utils/` - Shared utility functions
- ✅ `__tests__/` - Test utilities

**Reasoning:** These are foundational and used across all modules.

---

### 5. **Feature Modules** (Stay in `src/`)
**Purpose:** Standalone features with their own routes/controllers

**Keep at root level:**
- ✅ `assets/` - Asset storage and streaming (images, files)
- ✅ `speech/` - Speech-to-text and text-to-speech
- ✅ `analytics/` - Analytics tracking
- ✅ `system/` - System monitoring
- ✅ `hierarchy/` - Agent hierarchy endpoints (may need review)

**Reasoning:** These are independent features that aren't specifically agent or LLM focused.

---

### 6. **Legacy/Archived** (Already handled)
**Moved to `_archive-phase-0/`:**
- ✅ `agents/` (file-based agents)
- ✅ `agent-factory.*` files

---

### 7. **To Review/Clarify:**

**`agent-pool/`** - What is this?
- Need to check if this is legacy or still used
- If used: probably belongs in `agent-platform/`

**`services/`** - Generic name, what's in it?
- Need to audit contents
- Likely needs to be distributed to appropriate modules

**`mcp/`** - Model Context Protocol
- **RECOMMENDATION:** Move to `llms/mcp/` (it's LLM-related protocol)

---

## Migration Steps

### Step 1: Create new directory structure in LLMs
```bash
mkdir -p apps/api/src/llms/providers
mkdir -p apps/api/src/llms/models
mkdir -p apps/api/src/llms/evaluation
mkdir -p apps/api/src/llms/cidafm
mkdir -p apps/api/src/llms/usage
mkdir -p apps/api/src/llms/langchain
mkdir -p apps/api/src/llms/mcp
```

### Step 2: Move LLM-related modules
```bash
mv apps/api/src/providers apps/api/src/llms/
mv apps/api/src/models apps/api/src/llms/
mv apps/api/src/evaluation apps/api/src/llms/
mv apps/api/src/cidafm apps/api/src/llms/
mv apps/api/src/usage apps/api/src/llms/
mv apps/api/src/langchain apps/api/src/llms/
mv apps/api/src/mcp apps/api/src/llms/
```

### Step 3: Create new directory structure in agent2agent
```bash
mkdir -p apps/api/src/agent2agent/conversations
mkdir -p apps/api/src/agent2agent/projects
mkdir -p apps/api/src/agent2agent/context-optimization
mkdir -p apps/api/src/agent2agent/orchestration
```

### Step 4: Move agent2agent-related modules
```bash
mv apps/api/src/agent-conversations apps/api/src/agent2agent/conversations
mv apps/api/src/projects apps/api/src/agent2agent/
mv apps/api/src/context-optimization apps/api/src/agent2agent/
mv apps/api/src/orchestration apps/api/src/agent2agent/
```

### Step 5: Update all imports
- Use find/replace to update import paths
- Update absolute path aliases in tsconfig.json if needed
- Update module imports in app.module.ts

### Step 6: Audit remaining directories
- Check `agent-pool/` - keep or move to agent-platform?
- Check `services/` - distribute contents to appropriate modules
- Check `hierarchy/` - agent-platform or agent2agent?

### Step 7: Update LLM module exports
- Create `llms/llm.module.ts` that imports all sub-modules
- Export unified LLMModule

### Step 8: Update agent2agent module exports
- Update `agent2agent/agent2agent.module.ts` to import all sub-modules
- Export unified Agent2AgentModule

### Step 9: Build and test
- Run build to catch import errors
- Run smoke tests
- Fix any remaining issues

---

## Final Structure (Target State)

```
apps/api/src/
├── llms/                          # LLM Module
│   ├── llm.service.ts
│   ├── llm.module.ts
│   ├── providers/                 # LLM providers (OpenAI, Anthropic, etc.)
│   ├── models/                    # Model definitions
│   ├── evaluation/                # LLM evaluation & feedback
│   ├── cidafm/                    # AI Function Module
│   ├── usage/                     # Usage analytics & cost tracking
│   ├── langchain/                 # LangChain integration
│   └── mcp/                       # Model Context Protocol
│
├── agent2agent/                   # Agent-to-Agent Module
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
├── agent-platform/                # Agent Platform (Database Agents)
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   └── interfaces/
│
├── auth/                          # Authentication
├── supabase/                      # Database
├── config/                        # Configuration
├── health/                        # Health checks
├── websocket/                     # WebSocket infrastructure
│
├── assets/                        # Asset management
├── speech/                        # Speech services
├── analytics/                     # Analytics
├── system/                        # System monitoring
├── hierarchy/                     # Hierarchy (TBD: move to agent-platform?)
│
├── common/                        # Shared code
├── dto/                           # Shared DTOs
├── types/                         # Shared types
├── utils/                         # Utilities
└── __tests__/                     # Test utilities
```

---

## Benefits of This Organization

1. **Clear Module Boundaries**
   - LLM concerns in one place
   - Agent concerns in one place
   - Infrastructure separate

2. **Easier Navigation**
   - Developers know exactly where to look
   - New team members can understand structure quickly

3. **Better Dependency Management**
   - Clear module dependencies
   - Easier to maintain and refactor

4. **Scalability**
   - Each module can grow independently
   - Easy to extract into separate packages later if needed

5. **Alignment with Architecture**
   - Matches the agent-platform vision
   - Separates LLM concerns from agent orchestration

---

## Questions to Answer

1. **`agent-pool/`** - Is this still used? Legacy or current?
2. **`services/`** - What's in here? Should it be distributed?
3. **`hierarchy/`** - Agent hierarchy - part of agent-platform or agent2agent?
4. **`speech/`** - Should this stay standalone or move to a "features" directory?

---

## Execution Priority

**HIGH PRIORITY (Do Now):**
1. Move LLM-related modules → `llms/`
2. Move agent conversation/project modules → `agent2agent/`

**MEDIUM PRIORITY (Do Soon):**
3. Audit `agent-pool/`, `services/`, `hierarchy/`
4. Clean up remaining structure

**LOW PRIORITY (Nice to Have):**
5. Consider grouping standalone features under `features/` directory
6. Further optimize module boundaries
