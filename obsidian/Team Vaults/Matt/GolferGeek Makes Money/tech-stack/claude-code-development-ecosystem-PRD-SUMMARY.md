# Claude Code Development Ecosystem - PRD Summary

**Full PRD:** `obsidian/Team Vaults/Matt/GolferGeek Makes Money/tech-stack/claude-code-development-ecosystem-PRD.md`

## Quick Overview

Build a complete Claude Code development ecosystem with **42 commands, 12 skills, and 12 agents** that enforce Orchestrator AI standards and prevent common mistakes (especially Supabase database sync issues).

## Priority Order

1. **CRITICAL FIRST**: Supabase management (10 commands + skill + agent) - Prevents database sync issues
2. **HIGH**: Quality gates (4 commands + skill + 2 agents) - Prevents broken code
3. **HIGH**: API agent development (5 commands + skill + agent) - Wraps workflows
4. **HIGH**: N8N development (4 commands + skill + agent) - Workflow creation
5. **HIGH**: LangGraph development (4 commands + skill + agent) - Workflow creation
6. **MEDIUM**: Front-end/back-end coding agents (6 commands + 2 skills + 2 agents)
7. **LOW**: Git/PR/worktree (9 commands + 4 skills + 3 agents) - For interns

## What We're Building

### Commands (`.claude/commands/`)
**42 total commands** organized by category:
- `/supabase:*` - 10 commands (snapshot, migration, agent/N8N export/import, backup/restore)
- `/api-agent:*` - 5 commands (create, test, wrap-n8n, wrap-langgraph, wrap-crewai)
- `/n8n:*` - 4 commands (create, update, test, wrap)
- `/langgraph:*` - 4 commands (create, update, test, wrap)
- `/crewai:*` - 4 commands (FUTURE)
- `/quality:*` - 4 commands (lint, build, test, all)
- `/frontend:*` - 3 commands (component, store, service)
- `/backend:*` - 3 commands (module, service, controller)
- `/git:*` - 9 commands (commit, pr:list, pr:review, pr:merge, worktree:*)

### Skills (`.claude/skills/`)
**12 total skills** that auto-load based on description matching:
- `supabase-management-skill` ⚠️ CRITICAL
- `api-agent-development-skill`
- `n8n-development-skill`
- `langgraph-development-skill`
- `crewai-development-skill` (FUTURE)
- `quality-gates-skill`
- `front-end-structure-skill`
- `back-end-structure-skill`
- `github-workflow-skill`
- `worktree-lifecycle-skill`
- `orchestrator-git-standards-skill`
- `conventional-commits-skill`

### Agents (`.claude/agents/`)
**12 total agents** that execute specialized tasks:
- `supabase-management-agent.md` ⚠️ CRITICAL
- `api-agent-development-agent.md`
- `n8n-development-agent.md`
- `langgraph-development-agent.md`
- `crewai-development-agent.md` (FUTURE)
- `lint-build-fix-agent.md`
- `test-fix-agent.md`
- `front-end-coding-agent.md`
- `back-end-coding-agent.md`
- `git-commit-agent.md`
- `pr-review-agent.md`
- `worktree-processor-agent.md`

## Critical Requirements

### ⚠️ Supabase Enforcement
- **ALL Supabase operations** MUST go through `/supabase:*` commands or `supabase-management-agent`
- **NEVER** allow direct Supabase operations (bypasses storage system)
- Skill description warns against direct operations
- Agent intercepts any direct Supabase requests
- Uses `storage/scripts/*.sh` scripts (never direct Supabase CLI/API)

### Quality Gates
- Commits and PRs automatically run lint/build/test
- Auto-fix agents (`lint-build-fix-agent`, `test-fix-agent`) fix issues automatically
- Max 3 retry attempts
- Prevent commit/PR if fixes fail after max attempts

### Workflow Patterns
- N8N workflows automatically use Helper LLM pattern (ID: `9jxl03jCcqg17oOy`)
- Webhook status system configured automatically
- API agent wrapping creates correct YAML with proper transforms
- LangGraph workflows implement webhook streaming for every step

## Implementation Phases

### Phase 1: CRITICAL (Start Here) 🚀
1. Supabase management skill + agent + 10 commands
2. Quality gates skill + 2 agents + 4 commands

### Phase 2: HIGH PRIORITY
3. API agent development skill + agent + 5 commands
4. N8N development skill + agent + 4 commands
5. LangGraph development skill + agent + 4 commands

### Phase 3: MEDIUM PRIORITY
6. Front-end structure skill + agent + 3 commands
7. Back-end structure skill + agent + 3 commands

### Phase 4: LOW PRIORITY (For Interns)
8. Git/PR/worktree commands + skills + agents

## Key Acceptance Criteria

- ✅ Supabase enforcement: Direct operations redirect to commands/agent
- ✅ Quality gates: Commits/PRs prevent if lint/build/test fail after max fixes
- ✅ N8N workflows: Helper LLM pattern used automatically
- ✅ API agent wrapping: Correct YAML with proper transforms
- ✅ Architecture compliance: Front-end/back-end follow patterns

## Success Metrics

- All HIGH PRIORITY commands, skills, and agents implemented and functional
- Zero direct Supabase operations bypassing storage system
- Quality gates prevent commits/PRs with failures
- Workflow development follows Orchestrator AI patterns
- API agent wrapping works correctly for all workflow types

## Next Steps

1. Review full PRD: `obsidian/Team Vaults/Matt/GolferGeek Makes Money/tech-stack/claude-code-development-ecosystem-PRD.md`
2. Parse PRD into Taskmaster tasks
3. Start with Phase 1 (Supabase + Quality gates)
4. Iterate immediately as we use it

---

**See full PRD for:** Complete technical plan, directory structure, APIs/contracts, test plans, risks & mitigations, and 42 task seeds organized by phase.

