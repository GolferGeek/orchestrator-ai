# Claude Code Development Ecosystem - Complete `.claude/` Checklist

**Purpose:** Complete list of ALL commands, skills, and agents that will exist under `.claude/`  
**Date:** 2025-01-12  
**Status:** Comprehensive Plan - Ready for Implementation

---

## 📋 Complete `.claude/` Directory Structure

### Commands (`.claude/commands/`)

#### HIGH PRIORITY 🚀

**Supabase Commands (`.claude/commands/supabase/`):** ⚠️ CRITICAL
- [ ] `snapshot/export.md` - Export database snapshot
- [ ] `snapshot/apply.md` - Apply snapshot
- [ ] `migration/propose.md` - Create migration proposal
- [ ] `migration/apply.md` - Apply approved migration
- [ ] `agent/export.md` - Export agent(s)
- [ ] `agent/import.md` - Import agent(s)
- [ ] `n8n/export.md` - Export N8N workflow(s)
- [ ] `n8n/import.md` - Import N8N workflow(s)
- [ ] `backup.md` - Create daily backup
- [ ] `restore.md` - Restore from backup

**API Agent Commands (`.claude/commands/api-agent/`):**
- [ ] `create.md` - Create new API agent with YAML, request/response transforms, A2A compliance
- [ ] `test.md` - Test API agent endpoint, validate transforms, check webhook streaming
- [ ] `wrap-n8n.md` - Wrap n8n workflow as API agent (auto-configures transforms)
- [ ] `wrap-langgraph.md` - Wrap LangGraph workflow as API agent (auto-configures transforms)
- [ ] `wrap-crewai.md` - Wrap CrewAI workflow as API agent (FUTURE)

**N8N Commands (`.claude/commands/n8n/`):**
- [ ] `create.md` - Create new n8n workflow using n8n MCP, sets up Helper LLM pattern, webhook status
- [ ] `update.md` - Update existing n8n workflow via n8n MCP, validates patterns
- [ ] `test.md` - Test n8n workflow execution, validate output format, check status webhooks
- [ ] `wrap.md` - Wrap n8n workflow as API agent (calls `/api-agent:wrap-n8n`)

**LangGraph Commands (`.claude/commands/langgraph/`):**
- [ ] `create.md` - Create new LangGraph workflow in `apps/langgraph/workflows/`, sets up webhook streaming
- [ ] `update.md` - Update existing LangGraph workflow, validates patterns
- [ ] `test.md` - Test LangGraph workflow, validate step-by-step webhook calls
- [ ] `wrap.md` - Wrap LangGraph workflow as API agent (calls `/api-agent:wrap-langgraph`)

**CrewAI Commands (`.claude/commands/crewai/`):**
- [ ] `create.md` - Create new CrewAI workflow (FUTURE)
- [ ] `update.md` - Update existing CrewAI workflow (FUTURE)
- [ ] `test.md` - Test CrewAI workflow (FUTURE)
- [ ] `wrap.md` - Wrap CrewAI workflow as API agent (FUTURE)

**Quality Gate Commands (`.claude/commands/quality/`):**
- [ ] `lint.md` - Run linting checks, uses `lint-build-fix-agent` if issues found
- [ ] `build.md` - Run build/type checks, uses `lint-build-fix-agent` if issues found
- [ ] `test.md` - Run tests, uses `test-fix-agent` if failures found
- [ ] `all.md` - Run all quality gates (lint → build → test), uses fix agents as needed

#### MEDIUM PRIORITY

**Front-End Commands (`.claude/commands/frontend/`):**
- [ ] `component.md` - Create Vue component, uses `front-end-coding-agent`
- [ ] `store.md` - Create Pinia store, uses `front-end-coding-agent`
- [ ] `service.md` - Create service, uses `front-end-coding-agent`

**Back-End Commands (`.claude/commands/backend/`):**
- [ ] `module.md` - Create NestJS module, uses `back-end-coding-agent`
- [ ] `service.md` - Create NestJS service, uses `back-end-coding-agent`
- [ ] `controller.md` - Create NestJS controller, uses `back-end-coding-agent`

#### LOW PRIORITY (For Interns)

**Git Commands (`.claude/commands/git/`):**
- [ ] `commit.md` - Commit with quality gates (uses lint-build-fix-agent, test-fix-agent)
- [x] `pr.md` ✅ - Create PR (already exists)
- [ ] `pr/list.md` - List all open PRs with status
- [ ] `pr/review.md` - Review PR (uses `pr-review-agent`)
- [ ] `pr/merge.md` - Merge PR (checks CI, approvals, quality gates)

**Worktree Commands (`.claude/commands/git/worktree/`):**
- [ ] `create.md` - Create worktree + effort folder + PRD/plan templates
- [ ] `list.md` - List all worktrees with status
- [ ] `remove.md` - Remove worktree (optionally archive effort folder)
- [ ] `process.md` - Process worktree (uses `worktree-processor-agent`)

---

### Skills (`.claude/skills/`)

**Each skill contains `SKILL.md` with description that triggers auto-loading**

#### HIGH PRIORITY 🚀

1. **`supabase-management-skill/`** ⚠️ CRITICAL
   - `SKILL.md` - Description: "Supabase database management for Orchestrator AI. Use when performing ANY Supabase operations including snapshots, migrations, agent imports/exports, N8N workflow imports/exports, or backups. CRITICAL: This skill enforces the storage-based sync system. Never perform Supabase operations directly - always use the supabase-management-agent."
   - Contains: Storage directory structure, snapshot system, migration workflow, agent/N8N management, script usage, why direct operations break sync

2. **`api-agent-development-skill/`**
   - `SKILL.md` - Description: "API agent development for Orchestrator AI. Use when creating, modifying, or debugging API agents. Understands request/response transforms, A2A protocol, webhook streaming, and wrapping n8n/LangGraph/CrewAI workflows."
   - Contains: API agent YAML structure, request/response transforms, template variables (`{{userMessage}}`, `{{sessionId}}`, etc.), A2A protocol compliance, webhook streaming patterns, API agent wrapping patterns

3. **`n8n-development-skill/`**
   - `SKILL.md` - Description: "N8N workflow development for Orchestrator AI. Use when creating, modifying, or debugging n8n workflows. Understands Helper LLM pattern, parameter passing, response structure, webhook status system, and API agent wrapping."
   - Contains: Helper LLM workflow (ID: `9jxl03jCcqg17oOy`), parameter structure (prompt, provider, model, temperature, maxTokens, status tracking), normalized response format, webhook status system, API agent wrapping, n8n MCP integration, organization standards

4. **`langgraph-development-skill/`**
   - `SKILL.md` - Description: "LangGraph workflow development for Orchestrator AI. Use when creating, modifying, or debugging LangGraph workflows. Understands API agent wrapping, parameter passing, response structure, webhook streaming for every step, and integration with Orchestrator AI API agents."
   - Contains: LangGraph architecture, state machine patterns, API agent wrapping, parameter/response structure, webhook streaming (every step), `apps/langgraph/` directory structure, A2A protocol compliance, step-by-step progress updates

5. **`crewai-development-skill/`** (FUTURE)
   - `SKILL.md` - Description: "CrewAI multi-agent system development for Orchestrator AI. Use when creating CrewAI workflows, agents, tasks, or tools. For customer development and teaching curriculum."
   - Contains: (To be defined - future implementation)

6. **`quality-gates-skill/`**
   - `SKILL.md` - Description: "Code quality gates and standards enforcement. Use before commits, PR creation, or when quality checks are needed. Handles linting, building, testing, and quality standards."
   - Contains: Quality standards, lint rules, test requirements, build process, Orchestrator AI quality standards

#### MEDIUM PRIORITY

6. **`front-end-structure-skill/`**
   - `SKILL.md` - Description: "Vue 3 front-end architecture, patterns, and standards for Orchestrator AI. Use when working with front-end code, Vue components, Pinia stores, services, or UI implementation."
   - Contains: Vue 3 + TypeScript + Ionic architecture, Pinia patterns (state only, no business logic), service-oriented architecture, A2A protocol, transport types usage, component structure, front-end coding standards, file structure (`components/`, `stores/`, `services/`, `views/`)

7. **`back-end-structure-skill/`**
   - `SKILL.md` - Description: "NestJS back-end architecture, patterns, and standards for Orchestrator AI. Use when working with back-end code, NestJS modules, services, controllers, or API implementation."
   - Contains: NestJS module/controller/service architecture, A2A protocol, transport types usage, dependency injection patterns, file structure (`dto/`, `interfaces/`, `services/`, `controllers/`, `repositories/`), transport types as sacred contract, back-end coding standards, module organization, SOLID principles

#### LOW PRIORITY

8. **`github-workflow-skill/`**
   - `SKILL.md` - Description: "GitHub and Git workflow management. Use when working with Git operations, pull requests, branches, commits, or GitHub repositories."
   - Contains: Git standards, PR workflow, branch strategy, GitHub CLI usage, code review standards

9. **`worktree-lifecycle-skill/`**
   - `SKILL.md` - Description: "Git worktree management for parallel development. Use when creating, managing, or processing worktrees."
   - Contains: Worktree operations, effort folder structure (`efforts/current/{developer}-{feature-name}/`), PRD/plan discovery, worktree processing workflows

10. **`orchestrator-git-standards-skill/`**
    - `SKILL.md` - Description: "Orchestrator AI Git conventions and standards. Use when working with Orchestrator AI repository."
    - Contains: Orchestrator-specific Git standards, branch naming (`integration/orchestration-phaseN`), commit message formats, team standards

11. **`conventional-commits-skill/`**
    - `SKILL.md` - Description: "Conventional Commits specification and format. Use when creating commit messages."
    - Contains: Conventional commit format (`type(scope): description`), commit types (feat, fix, docs, etc.), examples, scope definitions

---

### Agents (`.claude/agents/`)

**Each agent is a markdown file with frontmatter**

#### HIGH PRIORITY 🚀

1. **`supabase-management-agent.md`** ⚠️ CRITICAL
   - Purpose: Handles ALL Supabase operations through storage-based sync system
   - Invoked by: `/supabase:*` commands, or explicitly when Supabase operations are requested
   - Uses: `supabase-management-skill` (auto-loads)
   - Does: Exports/imports snapshots, manages migrations, exports/imports agents/N8N workflows, creates backups, restores from backups, NEVER performs direct Supabase operations

2. **`api-agent-development-agent.md`**
   - Purpose: Creates and manages API agents following Orchestrator AI patterns
   - Invoked by: `/api-agent:*` commands
   - Uses: `api-agent-development-skill` (auto-loads)
   - Does: Creates API agent YAML, configures request/response transforms, ensures A2A protocol compliance, sets up webhook streaming, validates transforms

3. **`n8n-development-agent.md`**
   - Purpose: Creates and manages n8n workflows following Orchestrator AI patterns
   - Invoked by: `/n8n:*` commands
   - Uses: `n8n-development-skill` (auto-loads)
   - Does: Uses n8n MCP to create/manage workflows, implements Helper LLM pattern correctly, sets up webhook status system, creates API agent wrappers, follows organization standards

4. **`langgraph-development-agent.md`**
   - Purpose: Creates and manages LangGraph workflows following Orchestrator AI patterns
   - Invoked by: `/langgraph:*` commands
   - Uses: `langgraph-development-skill` (auto-loads)
   - Does: Creates LangGraph state machines/workflows, implements webhook streaming for every step, ensures API agent wrapping compatibility, follows A2A protocol, creates workflows in `apps/langgraph/` directory

5. **`crewai-development-agent.md`** (FUTURE)
   - Purpose: Creates CrewAI multi-agent systems for customer development and teaching
   - Invoked by: `/crewai:*` commands
   - Uses: `crewai-development-skill` (auto-loads)
   - Does: (To be defined - future implementation)

6. **`lint-build-fix-agent.md`**
   - Purpose: Fixes linting and building issues automatically
   - Invoked by: Quality gate commands, commit commands, other agents
   - Does: Runs lint checks, runs build/type checks, identifies issues, fixes automatically, retries up to 3 times, reports unfixable issues

7. **`test-fix-agent.md`**
   - Purpose: Runs tests and fixes test failures automatically
   - Invoked by: Quality gate commands, commit commands, other agents
   - Does: Runs test suite, identifies failures, fixes test issues, retries up to 3 times, reports unfixable failures

#### MEDIUM PRIORITY

7. **`front-end-coding-agent.md`**
   - Purpose: Implements front-end features following Vue 3 standards
   - Invoked by: `/frontend:*` commands, `worktree-processor-agent`
   - Uses: `front-end-structure-skill` (auto-loads)
   - Does: Creates components, stores, services following patterns, ensures transport types are used correctly, follows front-end coding standards, works with `lint-build-fix-agent` and `test-fix-agent` as needed

8. **`back-end-coding-agent.md`**
   - Purpose: Implements back-end features following NestJS standards
   - Invoked by: `/backend:*` commands, `worktree-processor-agent`
   - Uses: `back-end-structure-skill` (auto-loads)
   - Does: Creates modules, services, controllers following patterns, ensures transport types are used correctly, follows back-end coding standards, works with `lint-build-fix-agent` and `test-fix-agent` as needed

#### LOW PRIORITY

9. **`git-commit-agent.md`**
   - Purpose: Orchestrates complete commit workflow
   - Invoked by: `/git:commit` command
   - Does: Runs quality gates (lint/build/test), invokes `lint-build-fix-agent` if needed, invokes `test-fix-agent` if needed, creates commit with proper message format, aborts if fixes fail after max attempts

10. **`pr-review-agent.md`**
    - Purpose: Systematically reviews PRs
    - Invoked by: `/git:pr:review` command
    - Does: Reads PR diff and files via `gh pr diff`, checks CI status via `gh pr checks`, runs quality checks (lint/build/test), analyzes code quality, architecture, tests, generates review comments, approves or requests changes via `gh pr review`

12. **`worktree-processor-agent.md`**
    - Purpose: Processes worktree implementation (runs the plan)
    - Invoked by: `/git:worktree:process` command
    - Does: Reads PRD, plan, architecture from `efforts/current/{worktree-name}/`, implements according to plan, runs lint/build/test as it goes, uses `lint-build-fix-agent` and `test-fix-agent` as needed, notifies when complete

---

### Settings & Infrastructure

**Already Configured ✅**

- [x] `.claude/settings.json` - Hooks configured, fires automatically
- [x] `.claude/hooks-templates/observability.json` - Hook template
- [x] `.claude/output-styles/` - Custom output formatting

**Additional Directories (if needed)**

- [ ] `.claude/scripts/` - Utility scripts for commands/agents

---

## 📊 Summary Statistics

### Commands: **42 Total**
- **HIGH PRIORITY**: 30 commands (Supabase: 10 ⚠️ CRITICAL, API agent: 5, N8N: 4, LangGraph: 4, CrewAI: 4 future, Quality: 4)
- **MEDIUM PRIORITY**: 6 commands (Front-end: 3, Back-end: 3)
- **LOW PRIORITY**: 9 commands (Git: 5, Worktree: 4)
- **Already Exists**: 1 command (`git/pr.md`)

### Skills: **12 Total**
- **HIGH PRIORITY**: 6 skills (Supabase management ⚠️ CRITICAL, API agent, N8N, LangGraph, CrewAI future, Quality gates)
- **MEDIUM PRIORITY**: 2 skills (Front-end, Back-end)
- **LOW PRIORITY**: 4 skills (GitHub workflow, Worktree lifecycle, Orchestrator Git standards, Conventional commits)

### Agents: **12 Total**
- **HIGH PRIORITY**: 7 agents (Supabase management ⚠️ CRITICAL, API agent dev, N8N dev, LangGraph dev, CrewAI dev future, Lint-build-fix, Test-fix)
- **MEDIUM PRIORITY**: 2 agents (Front-end coding, Back-end coding)
- **LOW PRIORITY**: 3 agents (Git commit, PR review, Worktree processor)

---

## 🎯 Implementation Priority

### Phase 1: HIGH PRIORITY (Start Here) 🚀
1. ✅ **Supabase management skill + agent + commands** ⚠️ CRITICAL FIRST - Prevents database sync issues
2. ✅ Quality gates skill + lint-build-fix-agent + test-fix-agent + quality commands
3. ✅ API agent development skill + agent + commands
4. ✅ N8N development skill + agent + commands
5. ✅ LangGraph development skill + agent + commands (plan for it even though not built yet)

### Phase 2: MEDIUM PRIORITY
5. ✅ Front-end structure skill + coding agent + commands
6. ✅ Back-end structure skill + coding agent + commands

### Phase 3: LOW PRIORITY (For Interns)
7. ✅ Git/PR commands + agents
8. ✅ Worktree commands + agents

---

## 🔄 Iteration Philosophy

**Expected Workflow:**
1. ✅ **Build comprehensive plan** (this document)
2. **Implement Phase 1** (HIGH priority)
3. **Use religiously** - Daily operations
4. **When something fails** → Fix immediately
5. **When something is missing** → Add immediately
6. **When something is wrong** → Update immediately
7. **Continuous improvement** - Never stop refining

**Key Principle:** This is a **living system** that evolves as we use it. The plan is comprehensive, but execution will reveal gaps that we'll fill immediately.

---

## ⚠️ CRITICAL: Supabase Management Enforcement

**Problem:** Claude/Cursor keeps resetting Supabase and doesn't understand the storage-based sync system.

**Solution:**
- **ALL Supabase operations** MUST go through `/supabase:*` commands or `supabase-management-agent`
- **Skill description** explicitly warns against direct operations
- **Agent intercepts** any direct Supabase requests and redirects to proper workflow
- **Storage system** (`storage/`) is the source of truth - never bypass it

**Storage System Understanding:**
- `storage/snapshots/` - Timestamped snapshots + `latest/` with schema.sql, seed.sql, metadata.json
- `storage/migrations/` - Proposed migrations → Applied migrations workflow
- `storage/snapshots/agents/` - Source of truth for agent JSON files
- `storage/snapshots/n8n/` - Source of truth for N8N workflow JSON files
- `storage/scripts/` - All operations go through these scripts
- `storage/backups/` - Daily compressed backups

**Enforcement:**
- Skill auto-loads when Supabase operations are mentioned
- Agent invoked automatically when Supabase operations are attempted
- Clear error messages if direct operations attempted
- Commands use `storage/scripts/*.sh` - never direct Supabase CLI or API calls

---

## ✅ Ready to Build!

**All planned commands, skills, and agents documented above.**  
**Start with Phase 1 (HIGH PRIORITY) - Supabase management FIRST to prevent database sync issues.** 🚀

