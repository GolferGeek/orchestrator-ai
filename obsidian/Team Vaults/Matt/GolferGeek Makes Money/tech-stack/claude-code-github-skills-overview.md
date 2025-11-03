# Claude Code GitHub Skills - Complete Overview

**Date:** 2025-01-12  
**Status:** All Questions Answered - Ready for Implementation

---

## 📋 Commands (9 Total)

**Location:** `.claude/commands/git/`

### Core Git Commands
1. **`commit.md`** - Commit with quality gates
   - Runs lint/build/test
   - Uses `lint-build-fix-agent` and `test-fix-agent`
   - Creates commit with proper message format
   - Aborts if fixes fail

2. **`pr.md`** ✅ - Create PR (already exists)
   - Pre-flight checks (lint/build/test)
   - Commit changes
   - Push to remote
   - Create PR via GitHub CLI

### PR Commands (`.claude/commands/git/pr/`)
3. **`list.md`** - List all open PRs
   - Shows PR number, title, author, status, CI status
   - Uses `gh pr list`

4. **`review.md`** - Review PR
   - Reads PR diff and files
   - Checks CI status
   - Runs quality checks (lint/build/test)
   - Analyzes code quality, architecture, tests
   - Generates review comments
   - Approves or requests changes
   - Uses `pr-review-agent`

5. **`merge.md`** - Merge PR
   - Verifies CI passed
   - Verifies approvals
   - Re-runs quality checks
   - Merges with squash strategy
   - Deletes branch

### Worktree Commands (`.claude/commands/git/worktree/`)
6. **`create.md`** - Create worktree
   - Creates worktree branch
   - Creates effort folder: `efforts/current/{developer}-{feature-name}/`
   - Creates PRD and plan templates
   - Sets up context for agents

7. **`list.md`** - List worktrees
   - Shows all worktrees with status
   - Shows associated effort folders

8. **`remove.md`** - Remove worktree
   - Removes worktree
   - Optionally archives effort folder to `efforts/archive/`

9. **`process.md`** - Process worktree (implementation)
   - Reads PRD/plan/architecture from effort folder
   - Implements according to plan
   - Runs lint/build/test as it goes
   - Uses `worktree-processor-agent`
   - Notifies when complete

---

## 🎯 Skills (5 Total)

**Location:** `.claude/skills/`  
**How they work:** Auto-load based on description matching user requests

### 1. `github-workflow-skill/`
- **Description**: "GitHub and Git workflow management. Use when working with Git operations, pull requests, branches, commits, or GitHub repositories."
- **Auto-loads when**: User mentions Git, GitHub, PR, commit, branch, merge
- **Contains**: 
  - Git standards and best practices
  - PR workflow and branch strategy
  - GitHub CLI usage and commands
  - Code review standards

### 2. `worktree-lifecycle-skill/`
- **Description**: "Git worktree management for parallel development. Use when creating, managing, or processing worktrees."
- **Auto-loads when**: User mentions worktree, parallel development, effort folder
- **Contains**:
  - Worktree operations and setup
  - Effort folder structure (`efforts/current/{developer}-{feature-name}/`)
  - PRD/plan discovery and context loading
  - Worktree processing workflows

### 3. `quality-gates-skill/`
- **Description**: "Code quality gates and standards enforcement. Use before commits, PR creation, or when quality checks are needed."
- **Auto-loads when**: User mentions commit, PR, quality checks, lint, build, test
- **Contains**:
  - Quality standards and requirements
  - Lint rules and configuration
  - Test requirements and coverage
  - Build process and type checking

### 4. `orchestrator-git-standards-skill/`
- **Description**: "Orchestrator AI Git conventions and standards. Use when working with Orchestrator AI repository."
- **Auto-loads when**: Working in Orchestrator AI repo, mentions Orchestrator conventions
- **Contains**:
  - Orchestrator-specific Git standards
  - Branch naming: `integration/orchestration-phaseN`
  - Commit message formats for phases
  - Team standards and conventions

### 5. `conventional-commits-skill/`
- **Description**: "Conventional Commits specification and format. Use when creating commit messages."
- **Auto-loads when**: User mentions commit, commit message, or creating commits
- **Contains**:
  - Conventional commit format (type(scope): description)
  - Commit types (feat, fix, docs, etc.)
  - Examples and best practices
  - Scope definitions

### 6. `front-end-structure-skill/` ⭐ NEW
- **Description**: "Vue 3 front-end architecture, patterns, and standards for Orchestrator AI. Use when working with front-end code, Vue components, Pinia stores, services, or UI implementation."
- **Auto-loads when**: User mentions front-end, Vue, components, stores, services, UI, or works in `apps/web/`
- **Contains**:
  - Vue 3 + TypeScript + Ionic architecture
  - Pinia store patterns (state only, no business logic)
  - Service-oriented architecture (services handle business logic)
  - A2A protocol and transport types usage
  - Component structure and organization
  - Front-end coding standards and conventions
  - File structure: `components/`, `stores/`, `services/`, `views/`

### 7. `back-end-structure-skill/` ⭐ NEW
- **Description**: "NestJS back-end architecture, patterns, and standards for Orchestrator AI. Use when working with back-end code, NestJS modules, services, controllers, or API implementation."
- **Auto-loads when**: User mentions back-end, NestJS, API, services, controllers, or works in `apps/api/`
- **Contains**:
  - NestJS module/controller/service architecture
  - A2A protocol and transport types usage
  - Dependency injection patterns
  - File structure: `dto/`, `interfaces/`, `services/`, `controllers/`, `repositories/`
  - Transport types as sacred contract
  - Back-end coding standards and conventions
  - Module organization and SOLID principles

### 8. `n8n-development-skill/` ⭐ NEW
- **Description**: "N8N workflow development for Orchestrator AI. Use when creating, modifying, or debugging n8n workflows. Understands Helper LLM pattern, parameter passing, response structure, webhook status system, and API agent wrapping."
- **Auto-loads when**: User mentions n8n, workflow, Helper LLM, webhook status, or works in `apps/n8n/`
- **Contains**:
  - Helper LLM workflow pattern (ID: `9jxl03jCcqg17oOy`)
  - Parameter structure (prompt, provider, model, temperature, maxTokens, status tracking)
  - Normalized response format (text, provider, model, usage)
  - Webhook status system for streaming progress
  - API agent wrapping (request_transform, response_transform)
  - n8n MCP integration and workflow management
  - Organization standards (webhook defaults, error handling, naming conventions)

### 9. `langgraph-development-skill/` ⭐ NEW
- **Description**: "LangGraph workflow development for Orchestrator AI. Use when creating, modifying, or debugging LangGraph workflows. Understands API agent wrapping, parameter passing, response structure, webhook streaming for every step, and integration with Orchestrator AI API agents."
- **Auto-loads when**: User mentions LangGraph, workflow, graph, state machine, or works in `apps/langgraph/`
- **Contains**:
  - LangGraph architecture and state machine patterns
  - API agent wrapping (how API agents consume LangGraph workflows)
  - Parameter structure (userMessage, conversationId, taskId, metadata)
  - Response structure (TaskResponse format, A2A protocol compliance)
  - Webhook streaming for every step (like n8n status system)
  - Directory structure: `apps/langgraph/` (similar to `apps/n8n/`)
  - Step-by-step progress updates via webhooks
  - Integration with Orchestrator AI API agent system

### 10. `crewai-development-skill/` ⭐ FUTURE
- **Description**: "CrewAI multi-agent system development for Orchestrator AI. Use when creating CrewAI workflows, agents, tasks, or tools. For customer development and teaching curriculum."
- **Auto-loads when**: User mentions CrewAI, multi-agent, crew, or works in `apps/crewai/`
- **Contains**: (To be defined - future implementation)

---

## 🤖 Sub-Agents (5 Total)

**Location:** `.claude/agents/`  
**How they work:** Invoked by commands or other agents

### 1. `lint-build-fix-agent.md`
- **Purpose**: Fixes linting and building issues automatically
- **Invoked by**: `git-commit-agent`, `/git:commit`, `/git:pr` commands
- **Does**:
  - Runs lint checks
  - Runs build/type checks
  - Identifies issues
  - Fixes automatically
  - Retries up to 3 times
  - Reports unfixable issues

### 2. `test-fix-agent.md`
- **Purpose**: Runs tests and fixes test failures automatically
- **Invoked by**: `git-commit-agent`, `/git:commit`, `/git:pr` commands
- **Does**:
  - Runs test suite
  - Identifies failures
  - Fixes test issues
  - Retries up to 3 times
  - Reports unfixable failures

### 3. `git-commit-agent.md`
- **Purpose**: Orchestrates complete commit workflow
- **Invoked by**: `/git:commit` command
- **Does**:
  - Runs quality gates (lint/build/test)
  - Invokes `lint-build-fix-agent` if needed
  - Invokes `test-fix-agent` if needed
  - Creates commit with proper message format
  - Aborts if fixes fail after max attempts

### 4. `pr-review-agent.md`
- **Purpose**: Systematically reviews PRs
- **Invoked by**: `/git:pr:review` command
- **Does**:
  - Reads PR diff and files via `gh pr diff`
  - Checks CI status via `gh pr checks`
  - Runs quality checks (lint/build/test)
  - Analyzes code quality, architecture, tests
  - Generates review comments
  - Approves or requests changes via `gh pr review`

### 5. `worktree-processor-agent.md`
- **Purpose**: Processes worktree implementation (runs the plan)
- **Invoked by**: `/git:worktree:process` command
- **Does**:
  - Reads PRD, plan, architecture from `efforts/current/{worktree-name}/`
  - Implements according to plan
  - Runs lint/build/test as it goes
  - Uses `lint-build-fix-agent` and `test-fix-agent` as needed
  - Notifies when complete

### 6. `front-end-coding-agent.md` ⭐ NEW
- **Purpose**: Implements front-end features following Vue 3/NestJS standards
- **Invoked by**: Commands, worktree-processor-agent, or explicitly by user
- **Does**:
  - Uses `front-end-structure-skill` for context (auto-loads)
  - Understands Vue 3 + Pinia + A2A protocol architecture
  - Creates components, stores, services following patterns
  - Ensures transport types are used correctly
  - Follows front-end coding standards
  - Works with `lint-build-fix-agent` and `test-fix-agent` as needed

### 7. `back-end-coding-agent.md` ⭐ NEW
- **Purpose**: Implements back-end features following NestJS standards
- **Invoked by**: Commands, worktree-processor-agent, or explicitly by user
- **Does**:
  - Uses `back-end-structure-skill` for context (auto-loads)
  - Understands NestJS module/controller/service architecture
  - Creates modules, services, controllers following patterns
  - Ensures transport types are used correctly
  - Follows back-end coding standards
  - Works with `lint-build-fix-agent` and `test-fix-agent` as needed

### 8. `n8n-development-agent.md` ⭐ NEW
- **Purpose**: Creates and manages n8n workflows following Orchestrator AI patterns
- **Invoked by**: Commands, worktree-processor-agent, or explicitly by user
- **Does**:
  - Uses `n8n-development-skill` for context (auto-loads)
  - Uses n8n MCP to create/manage workflows
  - Implements Helper LLM pattern correctly
  - Sets up webhook status system for streaming
  - Creates API agent wrappers with proper request/response transforms
  - Follows organization standards (webhook defaults, error handling, naming)
  - Ensures parameter passing and response structure match requirements

### 9. `langgraph-development-agent.md` ⭐ NEW
- **Purpose**: Creates and manages LangGraph workflows following Orchestrator AI patterns
- **Invoked by**: Commands, worktree-processor-agent, or explicitly by user
- **Does**:
  - Uses `langgraph-development-skill` for context (auto-loads)
  - Creates LangGraph state machines/workflows
  - Implements webhook streaming for every step (like n8n status system)
  - Ensures API agent wrapping compatibility (parameters, responses)
  - Follows A2A protocol and transport types
  - Creates workflows in `apps/langgraph/` directory structure
  - Ensures proper step-by-step progress updates

### 10. `crewai-development-agent.md` ⭐ FUTURE
- **Purpose**: Creates CrewAI multi-agent systems for customer development and teaching
- **Invoked by**: Commands, worktree-processor-agent, or explicitly by user
- **Does**: (To be defined - future implementation)

**Agent Hierarchy:**
```
Command → Orchestrator Agent → Specialist Agents
/git:commit → git-commit-agent → lint-build-fix-agent, test-fix-agent
/git:pr:review → pr-review-agent → (standalone review)
/git:worktree:process → worktree-processor-agent → lint-build-fix-agent, test-fix-agent
```

---

## 🔌 MCP Servers

### Do We Need MCP for Git/GitHub Operations?

**Short Answer: No, not required.**

**Current Approach:**
- Using GitHub CLI (`gh`) directly for all Git/GitHub operations
- `gh` CLI provides full GitHub API access
- Simpler, no MCP server needed
- Works reliably from Claude Code commands

**Existing MCP Servers (Already Configured):**
1. **n8n MCP** ✅ - Workflow automation
   - Used for: Creating/managing n8n workflows
   - Tools: `create_workflow`, `list_workflows`, `execute_workflow`
   - **Not needed for Git/GitHub** - We use `gh` CLI instead

2. **Taskmaster MCP** ✅ - Project task management
   - Used for: Managing tasks, tracking progress
   - Tools: `get_tasks`, `add_task`, `set_status`
   - **Not needed for Git/GitHub** - Separate concern

3. **Firecrawl MCP** ✅ - Web scraping
   - Used for: Research, documentation fetching
   - Tools: `firecrawl_scrape`, `firecrawl_search`
   - **Not needed for Git/GitHub** - Separate concern

4. **Obsidian MCP** ✅ - Obsidian vault access
   - Used for: Reading/writing Obsidian notes
   - Tools: `read_note`, `write_note`, `search_vault`
   - **Not needed for Git/GitHub** - Separate concern

5. **Supabase MCP** ✅ - Database operations
   - Used for: Database queries and operations
   - **Not needed for Git/GitHub** - Separate concern

### When Would We Need GitHub MCP?

**Optional Enhancement (Future):**
- If we wanted more advanced GitHub API features
- If we needed webhook management
- If we wanted GitHub Actions workflow management
- **Current `gh` CLI covers all our needs** ✅

**Recommendation:**
- ✅ **Stick with `gh` CLI** - It's simpler and works perfectly
- ✅ **No GitHub MCP needed** - Current approach is sufficient
- ✅ **Use existing MCPs** - For their specific purposes (n8n, tasks, etc.)

---

## 🏗️ Architecture Summary

```
User Request
    ↓
Command (/git:commit, /git:pr:review, etc.)
    ↓
Skills Auto-Load (based on description matching)
    ↓
Command Orchestrates Workflow
    ↓
Sub-Agents Invoked (as needed)
    ↓
    ├─→ lint-build-fix-agent (fixes issues)
    ├─→ test-fix-agent (fixes tests)
    └─→ Orchestrator agents (git-commit-agent, pr-review-agent, etc.)
    ↓
Hooks Fire Automatically (PreToolUse, PostToolUse, Stop)
    ↓
Results Returned to User
```

---

## 📊 Implementation Checklist

### Commands: 8 new + 1 existing = 9 total
- [ ] `git/commit.md`
- [x] `git/pr.md` ✅
- [ ] `git/pr/list.md`
- [ ] `git/pr/review.md`
- [ ] `git/pr/merge.md`
- [ ] `git/worktree/create.md`
- [ ] `git/worktree/list.md`
- [ ] `git/worktree/remove.md`
- [ ] `git/worktree/process.md`

### Skills: 10 total (5 Git + 2 Structure + 2 Workflow + 1 Future)
- [ ] `github-workflow-skill/SKILL.md`
- [ ] `worktree-lifecycle-skill/SKILL.md`
- [ ] `quality-gates-skill/SKILL.md`
- [ ] `orchestrator-git-standards-skill/SKILL.md`
- [ ] `conventional-commits-skill/SKILL.md`
- [ ] `front-end-structure-skill/SKILL.md` ⭐ NEW
- [ ] `back-end-structure-skill/SKILL.md` ⭐ NEW
- [ ] `n8n-development-skill/SKILL.md` ⭐ NEW
- [ ] `langgraph-development-skill/SKILL.md` ⭐ NEW
- [ ] `crewai-development-skill/SKILL.md` ⭐ FUTURE

### Sub-Agents: 10 total (5 Git + 2 Coding + 2 Workflow + 1 Future)
- [ ] `lint-build-fix-agent.md`
- [ ] `test-fix-agent.md`
- [ ] `git-commit-agent.md`
- [ ] `pr-review-agent.md`
- [ ] `worktree-processor-agent.md`
- [ ] `front-end-coding-agent.md` ⭐ NEW
- [ ] `back-end-coding-agent.md` ⭐ NEW
- [ ] `n8n-development-agent.md` ⭐ NEW
- [ ] `langgraph-development-agent.md` ⭐ NEW
- [ ] `crewai-development-agent.md` ⭐ FUTURE

### Infrastructure: Already Configured ✅
- [x] `.claude/settings.json` with hooks ✅
- [x] `.claude/hooks-templates/observability.json` ✅
- [x] MCP servers configured (n8n, Taskmaster, Firecrawl, Obsidian, Supabase) ✅

---

## 🎯 Key Workflows

### 1. Commit Workflow
```
/git:commit
  → Quality gates (lint/build/test)
  → lint-build-fix-agent (if needed)
  → test-fix-agent (if needed)
  → Create commit
  → Hooks fire automatically
```

### 2. PR Review Workflow
```
/git:pr:list → See all PRs
/git:pr:review 123
  → pr-review-agent reads PR
  → Quality checks
  → Code analysis
  → Approve or request changes
```

### 3. Worktree Workflow
```
/git:worktree:create golfergeek-feature-auth
  → Creates worktree
  → Creates efforts/current/golfergeek-feature-auth/
  → Creates PRD/plan templates
  → Architect → Validate → Build Plan
/git:worktree:process golfergeek-feature-auth
  → worktree-processor-agent implements plan
  → Quality gates as it goes
  → Notifies when done
```

---

## ✅ Summary

**Commands:** 9 total (Git operations, PR management, worktree management)  
**Skills:** 10 total (5 Git + 2 Structure + 2 Workflow + 1 Future - Auto-load based on context)  
**Sub-Agents:** 10 total (5 Git + 2 Coding + 2 Workflow + 1 Future - Specialized tasks)  
**MCP:** Not needed for Git/GitHub (using `gh` CLI instead). n8n MCP used for workflow management.

**New Additions:**
- **Skills**: 
  - `front-end-structure-skill`, `back-end-structure-skill` (knowledge/context)
  - `n8n-development-skill`, `langgraph-development-skill` (workflow development knowledge)
  - `crewai-development-skill` (future - teaching curriculum)
- **Sub-Agents**: 
  - `front-end-coding-agent`, `back-end-coding-agent` (executors)
  - `n8n-development-agent`, `langgraph-development-agent` (workflow executors)
  - `crewai-development-agent` (future - teaching curriculum)  

**All questions answered. Ready to implement!** 🚀

---

## 📚 Teaching Curriculum Integration

**Purpose:** Build comprehensive skills and agents for teaching in schools, bootcamps, or individual learning.

### **Front-End Development**
- `front-end-structure-skill` + `front-end-coding-agent`
- Teaches Vue 3, Pinia, A2A protocol, transport types
- Hands-on component, store, service creation

### **Back-End Development**
- `back-end-structure-skill` + `back-end-coding-agent`
- Teaches NestJS, modules, services, A2A protocol
- Hands-on API endpoint, service, controller creation

### **Workflow Development**
- **N8N**: `n8n-development-skill` + `n8n-development-agent`
  - Visual workflow builder
  - Helper LLM pattern
  - Webhook status system
  - API agent wrapping
  
- **LangGraph**: `langgraph-development-skill` + `langgraph-development-agent`
  - State machine workflows
  - Step-by-step webhook streaming
  - API agent integration
  - Code-based workflow development

- **CrewAI**: `crewai-development-skill` + `crewai-development-agent` (Future)
  - Multi-agent systems
  - Agent collaboration patterns
  - Task orchestration

### **Directory Structure (Like N8N)**

**N8N Structure:**
```
apps/n8n/
├── workflows/        # Workflow exports
├── docs/            # Documentation
├── scripts/         # Management scripts
└── docker-compose.yml
```

**LangGraph Structure (To Be Created):**
```
apps/langgraph/
├── workflows/       # LangGraph workflow definitions
├── docs/           # Documentation
├── scripts/        # Management scripts
└── README.md
```

**Pattern:** Both follow the same organizational structure for consistency and teaching clarity.

---

## 🎓 Curriculum Use Cases

1. **School/Bootcamp Teaching:**
   - Skills provide foundational knowledge
   - Agents demonstrate implementation
   - Students learn by doing with guided agents

2. **Individual Learning:**
   - Self-paced learning with skills as reference
   - Agents help implement examples
   - Gradual complexity building

3. **Customer Development:**
   - Customers can use agents to build workflows
   - Skills ensure correct patterns
   - Self-service development capabilities

