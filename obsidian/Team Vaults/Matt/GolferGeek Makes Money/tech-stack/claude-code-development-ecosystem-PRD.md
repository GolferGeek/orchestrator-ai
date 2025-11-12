---
slug: claude-code-development-ecosystem
title: Claude Code Development Ecosystem - Complete Commands, Skills, and Agents
owner: Matt
reviewers: []
created: 2025-01-12
target-window: 2025-01-12 .. 2025-03-31
success-metrics:
  - All HIGH PRIORITY commands, skills, and agents implemented and functional
  - Supabase operations enforce storage-based sync (zero direct operations)
  - Quality gates prevent commits/PRs with lint/build/test failures
  - Workflow development (N8N/LangGraph/CrewAI) follows Orchestrator AI patterns
  - API agent wrapping works correctly for all workflow types
  - Front-end/back-end coding agents follow architecture standards
risk-level: medium
deps: []
non-goals:
  - Cursor-specific integrations (Phase 2+)
  - Production deployment automation
  - Performance optimization (focus on correctness first)
---

## 1. Summary

Build a comprehensive Claude Code development ecosystem with commands, skills, and agents that enforce Orchestrator AI development standards and workflows. This system will be the primary way Matt and interns work on the codebase, preventing common mistakes (especially Supabase database sync issues) and ensuring consistent patterns across N8N, LangGraph, CrewAI, API agents, front-end, and back-end development. The system will be used religiously and iterated upon immediately when gaps or failures are discovered.

## 2. Problem & Goals

### Problem
- **Claude/Cursor keeps resetting Supabase** - Direct Supabase operations bypass the storage-based sync system (`storage/snapshots/`, `storage/migrations/`, `storage/scripts/`), breaking database synchronization across users and production
- **No standardized workflow development** - N8N, LangGraph, and CrewAI workflows are created inconsistently without following Orchestrator AI patterns (Helper LLM, webhook status systems, API agent wrapping)
- **Quality gates are manual** - Commits and PRs can bypass lint/build/test checks, leading to broken code
- **Architecture violations** - Front-end and back-end code doesn't consistently follow Vue 3/NestJS patterns, transport types, and A2A protocol standards
- **Intern workflow gaps** - Interns need complete solution for PRs, commits, and database management

### Goals
1. **Enforce Supabase storage system** - ALL Supabase operations MUST go through commands/agent using `storage/scripts/*.sh` - prevent direct operations
2. **Standardize workflow development** - N8N, LangGraph, CrewAI workflows follow Orchestrator AI patterns automatically via skills and agents
3. **Automate quality gates** - Commits and PRs automatically run lint/build/test with auto-fix agents before allowing proceed
4. **Ensure architecture compliance** - Front-end/back-end coding agents enforce Vue 3/NestJS patterns, transport types, A2A protocol
5. **Complete intern solution** - Git/PR workflow commands enable interns to work properly with quality gates

## 3. Scope

### In Scope
- **42 Commands** across 9 categories:
  - Supabase management (10 commands) ⚠️ CRITICAL
  - API agent development (5 commands)
  - N8N development (4 commands)
  - LangGraph development (4 commands)
  - CrewAI development (4 commands - FUTURE)
  - Quality gates (4 commands)
  - Front-end development (3 commands)
  - Back-end development (3 commands)
  - Git/PR/worktree (9 commands)

- **12 Skills** that auto-load based on description matching:
  - Supabase management ⚠️ CRITICAL
  - API agent development
  - N8N development
  - LangGraph development
  - CrewAI development (FUTURE)
  - Quality gates
  - Front-end structure
  - Back-end structure
  - GitHub workflow
  - Worktree lifecycle
  - Orchestrator Git standards
  - Conventional commits

- **12 Agents** that execute specialized tasks:
  - Supabase management ⚠️ CRITICAL
  - API agent development
  - N8N development
  - LangGraph development
  - CrewAI development (FUTURE)
  - Lint-build-fix
  - Test-fix
  - Front-end coding
  - Back-end coding
  - Git commit
  - PR review
  - Worktree processor

- **Integration points:**
  - Claude Code CLI hooks (already configured)
  - Cursor hooks (already configured)
  - n8n MCP integration
  - Storage scripts (`storage/scripts/*.sh`)
  - GitHub CLI (`gh`)
  - Quality gate scripts (`npm run lint/build/test`)

### Out of Scope
- Cursor-specific integration layer (Phase 2+)
- Production deployment automation
- Performance optimization
- Multi-repository support
- Legacy system migration
- Documentation generation automation
- CI/CD pipeline integration

## 4. Deliverables (Definition of Done)

### User-Visible Deliverables
- **Supabase Commands** - `/supabase:*` commands for all database operations
  - Snapshot export/apply
  - Migration propose/apply
  - Agent/N8N export/import
  - Backup/restore
- **Workflow Commands** - `/n8n:*`, `/langgraph:*`, `/crewai:*` commands for workflow development
- **API Agent Commands** - `/api-agent:*` commands for creating and wrapping workflows as API agents
- **Quality Gate Commands** - `/quality:*` commands for lint/build/test
- **Coding Commands** - `/frontend:*`, `/backend:*` commands for component/module creation
- **Git Commands** - `/git:*` commands for commits, PRs, worktrees

### Internal Deliverables
- **All command files** in `.claude/commands/` directories
- **All skill directories** with `SKILL.md` files in `.claude/skills/`
- **All agent files** with frontmatter in `.claude/agents/`
- **Supabase enforcement** - Skill and agent prevent direct Supabase operations
- **Auto-loading skills** - Skills trigger based on description matching
- **Agent orchestration** - Agents can invoke other agents (hierarchy)
- **Quality gate integration** - All coding agents use lint-build-fix-agent and test-fix-agent

### Acceptance Criteria
- ✅ **Supabase enforcement**: Attempting direct Supabase operations redirects to `/supabase:*` commands or `supabase-management-agent` with clear error message
- ✅ **Command execution**: All 42 commands execute without errors and produce expected results
- ✅ **Skill auto-loading**: Skills load automatically when relevant keywords are mentioned (verified via hook logs)
- ✅ **Agent invocation**: Agents can be invoked by commands and other agents, execute correctly
- ✅ **Quality gates**: `/git:commit` and `/git:pr` commands prevent commits/PRs if lint/build/test fail after max fix attempts
- ✅ **Workflow patterns**: N8N workflows created via `/n8n:create` automatically use Helper LLM pattern (ID: `9jxl03jCcqg17oOy`)
- ✅ **API agent wrapping**: `/api-agent:wrap-n8n` and `/api-agent:wrap-langgraph` create correct YAML with proper request/response transforms
- ✅ **Architecture compliance**: Front-end/back-end coding agents use transport types correctly and follow Vue 3/NestJS patterns
- ✅ **Storage system**: All Supabase operations use `storage/scripts/*.sh` scripts (never direct Supabase CLI/API)
- ✅ **Hooks fire**: All operations trigger hooks automatically (verified via observability server)

## 5. Constraints & Assumptions

### Constraints
- **Must work with existing Claude Code CLI** - Commands must follow Claude Code command format
- **Must work with existing hooks** - Hooks already configured in `.claude/settings.json` and `.cursor/hooks.json`
- **Storage scripts must be used** - Cannot bypass `storage/scripts/*.sh` for Supabase operations
- **No breaking changes** - Existing `.claude/commands/git/pr.md` must continue working
- **Must support iteration** - System will be retooled, extended, fixed as we use it

### Assumptions
- **Claude Code CLI available** - Users have Claude Code CLI installed and configured
- **Storage scripts exist** - All `storage/scripts/*.sh` scripts are functional and tested
- **GitHub CLI available** - `gh` CLI is installed and authenticated
- **n8n MCP accessible** - n8n MCP server is configured and accessible
- **Supabase accessible** - Supabase database is accessible via Docker/local connection
- **Node.js/npm available** - `npm run lint/build/test` commands work
- **Immediate iteration expected** - System will be improved as we use it, not expected to be perfect initially

## 6. Technical Plan

### Architecture

```
User Request (Claude Code CLI or Cursor)
    ↓
Command (/supabase:*, /n8n:*, /api-agent:*, etc.)
    ↓
Skills Auto-Load (based on description matching)
    ↓
Command Orchestrates Workflow
    ↓
Sub-Agents Invoked (as needed)
    ↓
    ├─→ supabase-management-agent (uses storage/scripts/*.sh)
    ├─→ lint-build-fix-agent (fixes lint/build issues)
    ├─→ test-fix-agent (fixes test failures)
    ├─→ n8n-development-agent (uses n8n MCP)
    ├─→ langgraph-development-agent (creates workflows)
    ├─→ api-agent-development-agent (creates YAML)
    └─→ coding agents (front-end/back-end)
    ↓
Hooks Fire Automatically (PreToolUse, PostToolUse, Stop)
    ↓
Results Returned to User
```

### Directory Structure

```
.claude/
├── commands/
│   ├── supabase/
│   │   ├── snapshot/
│   │   │   ├── export.md
│   │   │   └── apply.md
│   │   ├── migration/
│   │   │   ├── propose.md
│   │   │   └── apply.md
│   │   ├── agent/
│   │   │   ├── export.md
│   │   │   └── import.md
│   │   ├── n8n/
│   │   │   ├── export.md
│   │   │   └── import.md
│   │   ├── backup.md
│   │   └── restore.md
│   ├── api-agent/
│   │   ├── create.md
│   │   ├── test.md
│   │   ├── wrap-n8n.md
│   │   ├── wrap-langgraph.md
│   │   └── wrap-crewai.md
│   ├── n8n/
│   │   ├── create.md
│   │   ├── update.md
│   │   ├── test.md
│   │   └── wrap.md
│   ├── langgraph/
│   │   ├── create.md
│   │   ├── update.md
│   │   ├── test.md
│   │   └── wrap.md
│   ├── crewai/
│   │   ├── create.md (FUTURE)
│   │   ├── update.md (FUTURE)
│   │   ├── test.md (FUTURE)
│   │   └── wrap.md (FUTURE)
│   ├── quality/
│   │   ├── lint.md
│   │   ├── build.md
│   │   ├── test.md
│   │   └── all.md
│   ├── frontend/
│   │   ├── component.md
│   │   ├── store.md
│   │   └── service.md
│   ├── backend/
│   │   ├── module.md
│   │   ├── service.md
│   │   └── controller.md
│   └── git/
│       ├── commit.md
│       ├── pr.md ✅ (exists)
│       ├── pr/
│       │   ├── list.md
│       │   ├── review.md
│       │   └── merge.md
│       └── worktree/
│           ├── create.md
│           ├── list.md
│           ├── remove.md
│           └── process.md
├── skills/
│   ├── supabase-management-skill/
│   │   └── SKILL.md
│   ├── api-agent-development-skill/
│   │   └── SKILL.md
│   ├── n8n-development-skill/
│   │   └── SKILL.md
│   ├── langgraph-development-skill/
│   │   └── SKILL.md
│   ├── crewai-development-skill/
│   │   └── SKILL.md
│   ├── quality-gates-skill/
│   │   └── SKILL.md
│   ├── front-end-structure-skill/
│   │   └── SKILL.md
│   ├── back-end-structure-skill/
│   │   └── SKILL.md
│   ├── github-workflow-skill/
│   │   └── SKILL.md
│   ├── worktree-lifecycle-skill/
│   │   └── SKILL.md
│   ├── orchestrator-git-standards-skill/
│   │   └── SKILL.md
│   └── conventional-commits-skill/
│       └── SKILL.md
├── agents/
│   ├── supabase-management-agent.md
│   ├── api-agent-development-agent.md
│   ├── n8n-development-agent.md
│   ├── langgraph-development-agent.md
│   ├── crewai-development-agent.md (FUTURE)
│   ├── lint-build-fix-agent.md
│   ├── test-fix-agent.md
│   ├── front-end-coding-agent.md
│   ├── back-end-coding-agent.md
│   ├── git-commit-agent.md
│   ├── pr-review-agent.md
│   └── worktree-processor-agent.md
├── settings.json ✅ (exists)
└── hooks-templates/
    └── observability.json ✅ (exists)
```

### Data Model Changes
- **No database changes required** - All commands, skills, and agents are file-based in `.claude/` directory
- **Storage system unchanged** - Uses existing `storage/` directory structure
- **No API changes** - Commands use existing scripts, MCP servers, GitHub CLI

### APIs/Contracts

**Command Format:**
- Commands are markdown files with instructions
- Format: `/category:subcategory:action` or `/category:action`
- Arguments: Positional (e.g., `/git:pr:review 123`) or optional with auto-detection

**Skill Format:**
- Skills are directories with `SKILL.md` file
- YAML frontmatter with `description` field (used for auto-loading)
- Body contains detailed knowledge/patterns

**Agent Format:**
- Agents are markdown files with YAML frontmatter
- Frontmatter includes: `name`, `description`, `tools`, `model`, `color`
- Body contains execution instructions

**Invocation Patterns:**
- Commands invoke agents via `@agent-name` syntax
- Agents can invoke other agents
- Skills auto-load based on description matching user requests

### Services/Modules to Touch
- `.claude/` directory structure (create new files)
- `storage/scripts/*.sh` (no changes, use as-is)
- Existing hooks (already configured, no changes)
- n8n MCP (use existing MCP server)
- GitHub CLI (use existing `gh` CLI)

### Rollout/Feature Flags
- **No feature flags needed** - Commands are additive, don't break existing functionality
- **Phased rollout by priority**:
  - Phase 1: Supabase + Quality gates (CRITICAL)
  - Phase 2: API agents + N8N + LangGraph
  - Phase 3: Front-end/back-end coding agents
  - Phase 4: Git/PR/worktree commands

## 7. Risks & Mitigations

### Risk: Supabase Enforcement May Not Work
**Mitigation:** 
- Skill description explicitly warns against direct operations
- Agent intercepts any direct Supabase requests
- Clear error messages redirect to proper commands
- Test enforcement by attempting direct operations and verifying redirect

### Risk: Skills May Not Auto-Load Correctly
**Mitigation:**
- Test skill descriptions with various keyword combinations
- Monitor hook logs to verify skill loading
- Iterate on descriptions based on actual usage
- Document successful trigger patterns

### Risk: Agent Invocation May Fail
**Mitigation:**
- Test agent invocation patterns thoroughly
- Verify agents can invoke other agents
- Test error handling when agents fail
- Document invocation patterns clearly

### Risk: Quality Gates May Be Too Strict/Lenient
**Mitigation:**
- Start with current quality standards
- Iterate based on actual usage
- Allow configuration of max retry attempts
- Provide clear error messages explaining failures

### Risk: Workflow Patterns May Change
**Mitigation:**
- Skills contain patterns, easily updatable
- Agents follow skill guidance, can be updated
- Document pattern changes clearly
- Version control all pattern files

### Risk: Cursor Integration May Not Work
**Mitigation:**
- Build for Claude Code CLI first (works immediately)
- Cursor integration is Phase 2+ (low priority)
- Document Cursor integration approach for future
- Test Cursor rules bridge separately

### Risk: Too Much Scope, May Never Finish
**Mitigation:**
- Focus on Phase 1 (HIGH PRIORITY) first
- Iterate based on actual usage
- Remove unused commands/skills/agents
- Document what's actually used vs. planned

## 8. Test & Verification

### Unit Testing
- **Command files**: Test each command executes without syntax errors
- **Skill files**: Test skill descriptions trigger auto-loading
- **Agent files**: Test agent frontmatter is valid, agents can be invoked

### Integration Testing
- **Supabase commands**: Test `/supabase:snapshot:export` → `/supabase:snapshot:apply` workflow
- **Quality gates**: Test `/quality:all` → `/git:commit` workflow (should prevent commit if failures)
- **Workflow creation**: Test `/n8n:create` → creates workflow → `/n8n:wrap` → creates API agent
- **Agent invocation**: Test command → agent → sub-agent chain

### Manual Test Plan
1. **Supabase enforcement test**:
   - Attempt direct Supabase operation
   - Verify redirect to `/supabase:*` command or agent
   - Verify error message explains why

2. **Workflow creation test**:
   - Run `/n8n:create` with workflow description
   - Verify Helper LLM pattern is used
   - Verify webhook status system configured
   - Verify workflow saved to `apps/n8n/workflows/`

3. **Quality gate test**:
   - Create code with lint errors
   - Run `/git:commit`
   - Verify `lint-build-fix-agent` fixes issues
   - Verify commit succeeds after fixes

4. **API agent wrapping test**:
   - Run `/api-agent:wrap-n8n` with workflow ID
   - Verify YAML created with correct request/response transforms
   - Verify API agent created in database

5. **Architecture compliance test**:
   - Run `/frontend:component` to create component
   - Verify component uses transport types correctly
   - Verify Pinia store follows patterns (state only, no business logic)

### Success Metrics Measurement
- **Command execution rate**: Track how many commands are used daily (via hooks)
- **Supabase enforcement**: Zero direct Supabase operations bypassing storage system
- **Quality gate success**: Percentage of commits/PRs that pass quality gates on first try
- **Workflow pattern compliance**: Percentage of N8N workflows using Helper LLM pattern
- **Architecture violations**: Track violations caught by coding agents

## 9. Work Plan Hints (for Taskmaster)

### Milestones/Epics

**M1: Supabase Management (CRITICAL FIRST)** ⚠️
- Build `supabase-management-skill` with storage system understanding
- Build `supabase-management-agent` that uses `storage/scripts/*.sh`
- Build all 10 Supabase commands (`/supabase:*`)
- Test enforcement - verify direct operations are prevented
- **Why first**: Prevents database sync issues that break everything else

**M2: Quality Gates Foundation**
- Build `quality-gates-skill` with lint/build/test standards
- Build `lint-build-fix-agent` (runs lint/build, fixes issues, retries up to 3 times)
- Build `test-fix-agent` (runs tests, fixes failures, retries up to 3 times)
- Build `/quality:*` commands (lint, build, test, all)
- **Why second**: Foundation for all other coding workflows

**M3: API Agent Development**
- Build `api-agent-development-skill` with YAML structure, transforms, A2A protocol
- Build `api-agent-development-agent` that creates API agent YAML
- Build `/api-agent:*` commands (create, test, wrap-n8n, wrap-langgraph, wrap-crewai)
- **Why third**: Core integration pattern for all workflows

**M4: N8N Workflow Development**
- Build `n8n-development-skill` with Helper LLM pattern, webhook status, MCP integration
- Build `n8n-development-agent` that uses n8n MCP
- Build `/n8n:*` commands (create, update, test, wrap)
- Verify Helper LLM pattern (ID: `9jxl03jCcqg17oOy`) is used automatically
- **Why fourth**: High priority workflow type

**M5: LangGraph Workflow Development**
- Build `langgraph-development-skill` with state machine patterns, webhook streaming
- Build `langgraph-development-agent` that creates LangGraph workflows
- Build `/langgraph:*` commands (create, update, test, wrap)
- Create `apps/langgraph/` directory structure (like `apps/n8n/`)
- **Why fifth**: High priority workflow type (plan for it even though not built yet)

**M6: Front-End/Back-End Coding Agents**
- Build `front-end-structure-skill` and `back-end-structure-skill`
- Build `front-end-coding-agent` and `back-end-coding-agent`
- Build `/frontend:*` and `/backend:*` commands
- Verify transport types and architecture patterns are enforced
- **Why sixth**: Medium priority, supports main workflows

**M7: Git/PR/Worktree Commands**
- Build Git-related skills (github-workflow, worktree-lifecycle, orchestrator-git-standards, conventional-commits)
- Build Git agents (git-commit-agent, pr-review-agent, worktree-processor-agent)
- Build `/git:*` commands (commit, pr:list, pr:review, pr:merge, worktree:*)
- **Why seventh**: Low priority, supporting infrastructure for interns

**M8: CrewAI (Future)**
- Build `crewai-development-skill` and `crewai-development-agent` (when CrewAI is ready)
- Build `/crewai:*` commands (when CrewAI is ready)
- **Why last**: Future feature, not built yet

### Suggested Task Seeds

**Phase 1 Tasks (Supabase + Quality Gates):**
1. Create `supabase-management-skill` directory and `SKILL.md` file with storage system documentation
2. Create `supabase-management-agent.md` with frontmatter and execution instructions
3. Create `/supabase:snapshot:export` command that uses `storage/scripts/export-snapshot.sh`
4. Create `/supabase:snapshot:apply` command that uses `storage/scripts/apply-snapshot.sh`
5. Create `/supabase:migration:propose` command for creating migration proposals
6. Create `/supabase:migration:apply` command for applying approved migrations
7. Create `/supabase:agent:export` and `/supabase:agent:import` commands
8. Create `/supabase:n8n:export` and `/supabase:n8n:import` commands
9. Create `/supabase:backup` and `/supabase:restore` commands
10. Test Supabase enforcement - attempt direct operation, verify redirect
11. Create `quality-gates-skill` directory and `SKILL.md` file
12. Create `lint-build-fix-agent.md` that runs lint/build and fixes issues
13. Create `test-fix-agent.md` that runs tests and fixes failures
14. Create `/quality:lint`, `/quality:build`, `/quality:test`, `/quality:all` commands
15. Test quality gates - verify they prevent commits/PRs when failures exist

**Phase 2 Tasks (API Agents + Workflows):**
16. Create `api-agent-development-skill` with YAML structure and patterns
17. Create `api-agent-development-agent.md` that creates API agent YAML
18. Create `/api-agent:create` command
19. Create `/api-agent:test` command
20. Create `/api-agent:wrap-n8n` command
21. Create `/api-agent:wrap-langgraph` command
22. Create `n8n-development-skill` with Helper LLM pattern documentation
23. Create `n8n-development-agent.md` that uses n8n MCP
24. Create `/n8n:create` command that sets up Helper LLM pattern automatically
25. Create `/n8n:update`, `/n8n:test`, `/n8n:wrap` commands
26. Create `langgraph-development-skill` with state machine patterns
27. Create `langgraph-development-agent.md` that creates LangGraph workflows
28. Create `/langgraph:create`, `/langgraph:update`, `/langgraph:test`, `/langgraph:wrap` commands
29. Create `apps/langgraph/` directory structure

**Phase 3 Tasks (Coding Agents):**
30. Create `front-end-structure-skill` with Vue 3/Pinia/A2A patterns
31. Create `back-end-structure-skill` with NestJS/A2A patterns
32. Create `front-end-coding-agent.md` that enforces front-end patterns
33. Create `back-end-coding-agent.md` that enforces back-end patterns
34. Create `/frontend:component`, `/frontend:store`, `/frontend:service` commands
35. Create `/backend:module`, `/backend:service`, `/backend:controller` commands

**Phase 4 Tasks (Git/PR/Worktree):**
36. Create Git-related skills (github-workflow, worktree-lifecycle, orchestrator-git-standards, conventional-commits)
37. Create `git-commit-agent.md` that orchestrates commit workflow
38. Create `pr-review-agent.md` that reviews PRs systematically
39. Create `worktree-processor-agent.md` that processes worktree implementation
40. Create `/git:commit` command
41. Create `/git:pr:list`, `/git:pr:review`, `/git:pr:merge` commands
42. Create `/git:worktree:create`, `/git:worktree:list`, `/git:worktree:remove`, `/git:worktree:process` commands

---

## Appendix: Complete Implementation Checklist

See `obsidian/Team Vaults/Matt/GolferGeek Makes Money/tech-stack/claude-code-complete-checklist.md` for complete checklist of all 42 commands, 12 skills, and 12 agents.

---

## Notes

- **This is a living system** - Will be iterated upon immediately as we use it
- **Focus on Phase 1 first** - Supabase + Quality gates are CRITICAL
- **Use religiously** - These become the primary way we work
- **Improve when they fail** - Fix immediately when something doesn't work
- **Documentation is critical** - Skills and agents must contain complete patterns and examples







