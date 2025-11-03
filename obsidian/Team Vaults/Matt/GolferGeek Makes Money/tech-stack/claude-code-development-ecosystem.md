# Claude Code Development Ecosystem - Complete Plan

**Purpose:** Comprehensive Claude Code commands, skills, and agents for ALL Orchestrator AI development workflows  
**Status:** Planning - Comprehensive Scope Defined  
**Date:** 2025-01-12  
**Philosophy:** Large, well-thought-out plan → Immediate iteration → Continuous improvement

---

## 🎯 Scope & Philosophy

**This is NOT just about GitHub/Git.** This is a **complete development ecosystem** for:
- **You (Matt)** - Primary workflows
- **Your interns** - Complete solution including PRs
- **Orchestrator AI** - All development patterns and standards

**Core Philosophy:**
- ✅ **Large, comprehensive plan FIRST** - Define everything before starting
- ✅ **Immediate iteration expected** - Skills/agents will be retooled, added, removed, fixed as we use them
- ✅ **Use religiously** - These become the primary way we work
- ✅ **Improve when they fail** - When something doesn't work, we fix it immediately

**Priority Order:**
1. **HIGH**: Supabase database management (CRITICAL - prevents Claude/Cursor from breaking database sync)
2. **HIGH**: N8N, LangGraph, CrewAI development workflows
3. **HIGH**: API agent development (wrapping n8n/LangGraph/CrewAI)
4. **HIGH**: Quality gates (lint/build/test agents)
5. **MEDIUM**: Front-end/back-end coding agents
6. **LOW**: Git/worktrees (supporting infrastructure for interns)

---

## 📋 Complete Command Structure

**Location:** `.claude/commands/`

### Supabase Commands (`.claude/commands/supabase/`)
**HIGH PRIORITY** ⚠️ CRITICAL - All Supabase operations MUST go through these commands

1. **`snapshot:export.md`** - Export database snapshot to `storage/snapshots/<timestamp>/`
   - Uses `storage/scripts/export-snapshot.sh`
   - Creates timestamped snapshot with schema.sql, seed.sql, metadata.json
   - Updates `storage/snapshots/latest/` symlink

2. **`snapshot:apply.md`** - Apply snapshot from `storage/snapshots/latest/` or specific timestamp
   - Uses `storage/scripts/apply-snapshot.sh`
   - Applies full database snapshot
   - Validates snapshot before applying

3. **`migration:propose.md`** - Create migration proposal in `storage/migrations/proposed/`
   - Creates migration file following template format
   - Validates SQL syntax
   - Ensures proper naming convention (YYYYMMDD-HHMM-description.sql)

4. **`migration:apply.md`** - Apply approved migration from `storage/migrations/applied/`
   - Moves migration from `proposed/` to `applied/`
   - Applies migration to database
   - Exports new snapshot after successful application

5. **`agent:export.md`** - Export agent(s) to `storage/snapshots/agents/`
   - Uses `storage/scripts/export-agent.sh` or `export-all-agents.sh`
   - Exports as JSON files (source of truth)

6. **`agent:import.md`** - Import agent(s) from `storage/snapshots/agents/`
   - Uses `storage/scripts/import-agent.sh` or `import-all-agents.sh`
   - Upserts agents to database

7. **`n8n:export.md`** - Export N8N workflow(s) to `storage/snapshots/n8n/`
   - Uses `storage/scripts/export-n8n-workflow.sh` or `export-all-n8n-workflows.sh`
   - Exports as JSON files (source of truth)

8. **`n8n:import.md`** - Import N8N workflow(s) from `storage/snapshots/n8n/`
   - Uses `storage/scripts/import-n8n-workflow.sh` or `import-all-n8n-workflows.sh`
   - Upserts workflows to database

9. **`backup.md`** - Create daily backup to `storage/backups/`
   - Uses `storage/scripts/backup-all-daily.sh` or individual backup scripts
   - Creates compressed SQL backups

10. **`restore.md`** - Restore from backup
    - Uses `storage/scripts/restore-from-backup.sh`
    - Restores from `storage/backups/*.sql.gz`

**CRITICAL RULE:** Claude/Cursor MUST NOT perform Supabase operations directly. ALL Supabase work MUST use these commands or the `supabase-management-agent`.

### API Agent Commands (`.claude/commands/api-agent/`)
**HIGH PRIORITY** - Creating API agents that wrap workflows

1. **`create.md`** - Create new API agent
   - Prompts for: name, description, endpoint (n8n/LangGraph/CrewAI webhook)
   - Creates YAML with proper `request_transform` and `response_transform`
   - Ensures A2A protocol compliance
   - Creates agent in database via API

2. **`test.md`** - Test API agent
   - Sends test request to agent endpoint
   - Validates request/response transforms
   - Checks webhook streaming (if applicable)
   - Reports any issues

3. **`wrap-n8n.md`** - Wrap n8n workflow as API agent
   - Given n8n workflow ID, creates API agent wrapper
   - Configures proper request/response transforms
   - Sets up webhook status system
   - Validates Helper LLM pattern usage

4. **`wrap-langgraph.md`** - Wrap LangGraph workflow as API agent
   - Given LangGraph workflow path, creates API agent wrapper
   - Configures proper request/response transforms
   - Sets up webhook streaming for every step
   - Validates A2A protocol compliance

5. **`wrap-crewai.md`** - Wrap CrewAI workflow as API agent (FUTURE)
   - Given CrewAI workflow, creates API agent wrapper
   - Configures proper request/response transforms
   - Validates multi-agent coordination patterns

### N8N Development Commands (`.claude/commands/n8n/`)
**HIGH PRIORITY** - Creating and managing n8n workflows

1. **`create.md`** - Create new n8n workflow
   - Uses n8n MCP to create workflow
   - Prompts for workflow purpose and structure
   - Sets up Helper LLM pattern automatically
   - Configures webhook status system
   - Saves to `apps/n8n/workflows/`

2. **`update.md`** - Update existing n8n workflow
   - Loads workflow via n8n MCP
   - Applies changes following patterns
   - Validates Helper LLM usage
   - Validates status webhook configuration

3. **`test.md`** - Test n8n workflow
   - Executes workflow via n8n MCP
   - Validates output format
   - Checks status webhook calls
   - Reports any issues

4. **`wrap.md`** - Wrap n8n workflow as API agent
   - Creates API agent that calls this workflow
   - Uses `/api-agent:wrap-n8n` command
   - Links workflow and agent together

### LangGraph Development Commands (`.claude/commands/langgraph/`)
**HIGH PRIORITY** - Creating and managing LangGraph workflows

1. **`create.md`** - Create new LangGraph workflow
   - Prompts for workflow purpose and state machine structure
   - Creates workflow in `apps/langgraph/workflows/`
   - Sets up webhook streaming for every step
   - Configures API agent wrapping compatibility
   - Validates A2A protocol compliance

2. **`update.md`** - Update existing LangGraph workflow
   - Loads workflow file
   - Applies changes following patterns
   - Validates webhook streaming setup
   - Validates API agent compatibility

3. **`test.md`** - Test LangGraph workflow
   - Executes workflow with test inputs
   - Validates step-by-step webhook calls
   - Checks output format
   - Reports any issues

4. **`wrap.md`** - Wrap LangGraph workflow as API agent
   - Creates API agent that calls this workflow
   - Uses `/api-agent:wrap-langgraph` command
   - Links workflow and agent together

### CrewAI Development Commands (`.claude/commands/crewai/`)
**HIGH PRIORITY** - Creating and managing CrewAI workflows (FUTURE)

1. **`create.md`** - Create new CrewAI workflow
   - Prompts for multi-agent system structure
   - Creates workflow in `apps/crewai/workflows/`
   - Configures agent coordination patterns
   - Sets up API agent wrapping compatibility

2. **`update.md`** - Update existing CrewAI workflow
   - Loads workflow file
   - Applies changes following patterns
   - Validates agent coordination
   - Validates API agent compatibility

3. **`test.md`** - Test CrewAI workflow
   - Executes workflow with test inputs
   - Validates agent coordination
   - Checks output format
   - Reports any issues

4. **`wrap.md`** - Wrap CrewAI workflow as API agent
   - Creates API agent that calls this workflow
   - Uses `/api-agent:wrap-crewai` command
   - Links workflow and agent together

### Quality Gate Commands (`.claude/commands/quality/`)
**HIGH PRIORITY** - Linting, building, testing

1. **`lint.md`** - Run linting checks
   - Runs `npm run lint`
   - Uses `lint-build-fix-agent` if issues found
   - Reports results

2. **`build.md`** - Run build/type checks
   - Runs `npm run build`
   - Uses `lint-build-fix-agent` if issues found
   - Reports results

3. **`test.md`** - Run tests
   - Runs `npm run test`
   - Uses `test-fix-agent` if failures found
   - Reports results

4. **`all.md`** - Run all quality gates
   - Runs lint → build → test
   - Uses fix agents as needed
   - Reports comprehensive results

### Front-End Development Commands (`.claude/commands/frontend/`)
**MEDIUM PRIORITY** - Vue 3 front-end development

1. **`component.md`** - Create Vue component
   - Prompts for component name and purpose
   - Uses `front-end-coding-agent`
   - Follows Vue 3 + Pinia + A2A patterns
   - Creates component, store, service as needed

2. **`store.md`** - Create Pinia store
   - Prompts for store name and state structure
   - Uses `front-end-coding-agent`
   - Follows Pinia patterns (state only, no business logic)

3. **`service.md`** - Create service
   - Prompts for service name and purpose
   - Uses `front-end-coding-agent`
   - Follows service-oriented architecture
   - Uses transport types correctly

### Back-End Development Commands (`.claude/commands/backend/`)
**MEDIUM PRIORITY** - NestJS back-end development

1. **`module.md`** - Create NestJS module
   - Prompts for module name and purpose
   - Uses `back-end-coding-agent`
   - Follows NestJS patterns (module/controller/service)
   - Uses transport types correctly

2. **`service.md`** - Create NestJS service
   - Prompts for service name and purpose
   - Uses `back-end-coding-agent`
   - Follows dependency injection patterns
   - Uses transport types correctly

3. **`controller.md`** - Create NestJS controller
   - Prompts for controller name and endpoints
   - Uses `back-end-coding-agent`
   - Follows controller patterns
   - Uses transport types correctly

### Git/PR Commands (`.claude/commands/git/`)
**LOW PRIORITY** - Supporting infrastructure for interns

1. **`commit.md`** - Commit with quality gates
   - Runs quality gates (lint/build/test)
   - Uses `lint-build-fix-agent` and `test-fix-agent`
   - Creates commit with proper message format
   - Aborts if fixes fail

2. **`pr.md`** ✅ - Create PR (already exists)

3. **`pr:list.md`** - List all open PRs

4. **`pr:review.md`** - Review PR
   - Uses `pr-review-agent`
   - Runs quality checks
   - Approves or requests changes

5. **`pr:merge.md`** - Merge PR
   - Verifies CI and approvals
   - Merges with squash strategy
   - Cleans up branch

### Worktree Commands (`.claude/commands/git/worktree/`)
**LOW PRIORITY** - Parallel development support

1. **`create.md`** - Create worktree + effort folder
2. **`list.md`** - List worktrees
3. **`remove.md`** - Remove worktree
4. **`process.md`** - Process worktree (implementation)

---

## 🎯 Complete Skills Structure

**Location:** `.claude/skills/`  
**How they work:** Auto-load based on description matching user requests

### HIGH PRIORITY Skills

1. **`supabase-management-skill/`** ⚠️ CRITICAL
   - **Description**: "Supabase database management for Orchestrator AI. Use when performing ANY Supabase operations including snapshots, migrations, agent imports/exports, N8N workflow imports/exports, or backups. CRITICAL: This skill enforces the storage-based sync system. Never perform Supabase operations directly - always use the supabase-management-agent."
   - **Contains**: 
     - Storage directory structure (`storage/snapshots/`, `storage/migrations/`, `storage/backups/`)
     - Snapshot system (timestamped + `latest/`, schema.sql, seed.sql, metadata.json)
     - Migration workflow (proposed → applied)
     - Agent management (source of truth: `storage/snapshots/agents/*.json`)
     - N8N workflow management (source of truth: `storage/snapshots/n8n/*.json`)
     - Script usage (`storage/scripts/*.sh`)
     - Why direct Supabase operations break database sync
     - Commands to use instead of direct operations

2. **`api-agent-development-skill/`**
   - **Description**: "API agent development for Orchestrator AI. Use when creating, modifying, or debugging API agents. Understands request/response transforms, A2A protocol, webhook streaming, and wrapping n8n/LangGraph/CrewAI workflows."
   - **Contains**: API agent YAML structure, request/response transforms, template variables, A2A protocol, webhook streaming patterns

3. **`n8n-development-skill/`**
   - **Description**: "N8N workflow development for Orchestrator AI. Use when creating, modifying, or debugging n8n workflows. Understands Helper LLM pattern, parameter passing, response structure, webhook status system, and API agent wrapping."
   - **Contains**: Helper LLM workflow (ID: `9jxl03jCcqg17oOy`), parameter structure, normalized response format, webhook status system, API agent wrapping, n8n MCP integration

4. **`langgraph-development-skill/`**
   - **Description**: "LangGraph workflow development for Orchestrator AI. Use when creating, modifying, or debugging LangGraph workflows. Understands API agent wrapping, parameter passing, response structure, webhook streaming for every step, and integration with Orchestrator AI API agents."
   - **Contains**: LangGraph architecture, API agent wrapping, parameter/response structure, webhook streaming (every step), `apps/langgraph/` directory structure, A2A protocol compliance

5. **`crewai-development-skill/`** (FUTURE)
   - **Description**: "CrewAI multi-agent system development for Orchestrator AI. Use when creating CrewAI workflows, agents, tasks, or tools. For customer development and teaching curriculum."
   - **Contains**: (To be defined - future implementation)

6. **`quality-gates-skill/`**
   - **Description**: "Code quality gates and standards enforcement. Use before commits, PR creation, or when quality checks are needed. Handles linting, building, testing, and quality standards."
   - **Contains**: Quality standards, lint rules, test requirements, build process

### MEDIUM PRIORITY Skills

7. **`front-end-structure-skill/`**
   - **Description**: "Vue 3 front-end architecture, patterns, and standards for Orchestrator AI. Use when working with front-end code, Vue components, Pinia stores, services, or UI implementation."
   - **Contains**: Vue 3 + TypeScript + Ionic architecture, Pinia patterns, A2A protocol, transport types, front-end coding standards

8. **`back-end-structure-skill/`**
   - **Description**: "NestJS back-end architecture, patterns, and standards for Orchestrator AI. Use when working with back-end code, NestJS modules, services, controllers, or API implementation."
   - **Contains**: NestJS architecture, A2A protocol, transport types, dependency injection, back-end coding standards

### LOW PRIORITY Skills

9. **`github-workflow-skill/`**
   - **Description**: "GitHub and Git workflow management. Use when working with Git operations, pull requests, branches, commits, or GitHub repositories."
   - **Contains**: Git standards, PR workflow, branch strategy, GitHub CLI usage

10. **`worktree-lifecycle-skill/`**
   - **Description**: "Git worktree management for parallel development. Use when creating, managing, or processing worktrees."
   - **Contains**: Worktree operations, effort folder structure, PRD/plan discovery

11. **`orchestrator-git-standards-skill/`**
   - **Description**: "Orchestrator AI Git conventions and standards. Use when working with Orchestrator AI repository."
   - **Contains**: Orchestrator-specific Git standards, branch strategy, commit formats

12. **`conventional-commits-skill/`**
    - **Description**: "Conventional Commits specification and format. Use when creating commit messages."
    - **Contains**: Conventional commit format, examples, type definitions

---

## 🤖 Complete Agent Structure

**Location:** `.claude/agents/`  
**How they work:** Invoked by commands or other agents

### HIGH PRIORITY Agents

1. **`supabase-management-agent.md`** ⚠️ CRITICAL
   - **Purpose**: Handles ALL Supabase operations through the storage-based sync system
   - **Invoked by**: `/supabase:*` commands, or explicitly when user requests Supabase operations
   - **Uses**: `supabase-management-skill` (auto-loads)
   - **Does**: 
     - Exports/imports snapshots using `storage/scripts/export-snapshot.sh` and `apply-snapshot.sh`
     - Manages migrations (creates proposals, applies approved migrations)
     - Exports/imports agents using `storage/scripts/export-agent.sh` and `import-agent.sh`
     - Exports/imports N8N workflows using `storage/scripts/export-n8n-workflow.sh` and `import-n8n-workflow.sh`
     - Creates backups using `storage/scripts/backup-*-daily.sh`
     - Restores from backups using `storage/scripts/restore-from-backup.sh`
     - NEVER performs direct Supabase operations that bypass the storage system
   - **CRITICAL RULE**: If Claude/Cursor attempts direct Supabase operations, redirect to this agent immediately

2. **`api-agent-development-agent.md`**
   - **Purpose**: Creates and manages API agents following Orchestrator AI patterns
   - **Invoked by**: `/api-agent:*` commands
   - **Does**: Creates API agent YAML, configures request/response transforms, ensures A2A protocol compliance, sets up webhook streaming

3. **`n8n-development-agent.md`**
   - **Purpose**: Creates and manages n8n workflows following Orchestrator AI patterns
   - **Invoked by**: `/n8n:*` commands
   - **Does**: Uses n8n MCP, implements Helper LLM pattern, sets up webhook status system, creates API agent wrappers

4. **`langgraph-development-agent.md`**
   - **Purpose**: Creates and manages LangGraph workflows following Orchestrator AI patterns
   - **Invoked by**: `/langgraph:*` commands
   - **Does**: Creates LangGraph state machines, implements webhook streaming for every step, ensures API agent wrapping compatibility

5. **`crewai-development-agent.md`** (FUTURE)
   - **Purpose**: Creates CrewAI multi-agent systems for customer development and teaching
   - **Invoked by**: `/crewai:*` commands
   - **Does**: (To be defined - future implementation)

6. **`lint-build-fix-agent.md`**
   - **Purpose**: Fixes linting and building issues automatically
   - **Invoked by**: Quality gate commands, commit commands, other agents
   - **Does**: Runs lint/build, identifies issues, fixes automatically, retries up to 3 times

7. **`test-fix-agent.md`**
   - **Purpose**: Runs tests and fixes test failures automatically
   - **Invoked by**: Quality gate commands, commit commands, other agents
   - **Does**: Runs tests, identifies failures, fixes automatically, retries up to 3 times

### MEDIUM PRIORITY Agents

7. **`front-end-coding-agent.md`**
   - **Purpose**: Implements front-end features following Vue 3 standards
   - **Invoked by**: `/frontend:*` commands, worktree-processor-agent
   - **Does**: Uses `front-end-structure-skill`, creates components/stores/services, ensures transport types and A2A protocol compliance

8. **`back-end-coding-agent.md`**
   - **Purpose**: Implements back-end features following NestJS standards
   - **Invoked by**: `/backend:*` commands, worktree-processor-agent
   - **Does**: Uses `back-end-structure-skill`, creates modules/services/controllers, ensures transport types and A2A protocol compliance

### LOW PRIORITY Agents

10. **`git-commit-agent.md`**
   - **Purpose**: Orchestrates complete commit workflow
   - **Invoked by**: `/git:commit` command
   - **Does**: Runs quality gates, invokes fix agents, creates commit with proper message

11. **`pr-review-agent.md`**
   - **Purpose**: Systematically reviews PRs
   - **Invoked by**: `/git:pr:review` command
   - **Does**: Reads PR diff, checks CI, runs quality checks, approves or requests changes

12. **`worktree-processor-agent.md`**
    - **Purpose**: Processes worktree implementation (runs the plan)
    - **Invoked by**: `/git:worktree:process` command
    - **Does**: Reads PRD/plan/architecture, implements according to plan, runs quality gates as it goes

---

## 📊 Implementation Priority

### Phase 1: HIGH PRIORITY (Start Here)
1. ✅ **Supabase management skill + agent + commands** ⚠️ CRITICAL FIRST - Prevents database sync issues
2. ✅ Quality gates skill + lint-build-fix-agent + test-fix-agent
3. ✅ API agent development skill + agent
4. ✅ N8N development skill + agent
5. ✅ LangGraph development skill + agent (even though not built yet - plan for it)

### Phase 2: MEDIUM PRIORITY
5. ✅ Front-end structure skill + coding agent
6. ✅ Back-end structure skill + coding agent

### Phase 3: LOW PRIORITY (For Interns)
7. ✅ Git/PR commands + agents
8. ✅ Worktree commands + agents

---

## 🔄 Iteration & Improvement Philosophy

**Expected Workflow:**
1. **Build comprehensive plan** (this document) ✅
2. **Implement Phase 1** (HIGH priority)
3. **Use religiously** - Daily operations
4. **When something fails** → Fix immediately
5. **When something is missing** → Add immediately
6. **When something is wrong** → Update immediately
7. **Continuous improvement** - Never stop refining

**Key Principle:** This is a **living system** that evolves as we use it. The plan is comprehensive, but execution will reveal gaps that we'll fill immediately.

---

## 📚 Teaching & Documentation

**Each skill and agent should include:**
- **Clear description** for auto-loading
- **Complete patterns** and examples
- **Common mistakes** to avoid
- **Integration points** with other skills/agents
- **Teaching examples** for interns/students

**Documentation Structure:**
- Skills contain **knowledge** (what to know)
- Agents contain **execution** (what to do)
- Commands contain **workflows** (how to use)

---

## ⚠️ CRITICAL: Supabase Management Enforcement

**Problem:** Claude/Cursor keeps resetting Supabase and doesn't understand the storage-based sync system.

**Solution:** 
- **ALL Supabase operations** MUST go through `/supabase:*` commands or `supabase-management-agent`
- **Skill description** explicitly warns against direct operations
- **Agent intercepts** any direct Supabase requests and redirects to proper workflow
- **Storage system** is the source of truth - never bypass it

**Enforcement:**
- Skill loaded automatically when Supabase operations are mentioned
- Agent invoked automatically when Supabase operations are attempted
- Clear error messages if direct operations are attempted

---

## ✅ Next Steps

1. **Review this comprehensive plan** - Does it cover everything?
2. **Prioritize Phase 1** - Start with **Supabase management FIRST** (prevents database sync issues)
3. **Build incrementally** - One skill/agent at a time
4. **Use immediately** - Don't wait for perfection
5. **Iterate continuously** - Fix and improve as we go

**Ready to build!** 🚀

