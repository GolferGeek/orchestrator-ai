# Lint Plan 2 — Agent Platform & Integrations

## 🤝 Multi-Agent Coordination Rules

**THREE AGENTS RUNNING IN PARALLEL** — Follow these rules to avoid conflicts:

### Commit Strategy
- **Commit frequency**: Every 2-4 hours or after completing a phase
- **Commit prefix**: Use `lint(agents):` or `lint(integrations):` for all commits
- **Pre-commit validation**: MUST run `npm run build && npm test` — both must pass
- **Pull before push**: ALWAYS run `git pull --rebase origin main && git push`
- **Rebase conflicts**: Accept incoming changes, re-apply your fixes, re-run build+test

### Your Scope (Plan 2)
- **Primary files**: `apps/api/src/agent-platform/**/*`, `apps/api/src/agent2agent/**/*`
- **Shared files**: Watch for conflicts in Supabase types, shared DTOs
- **Coordination**: If Agent 1 or 3 breaks your build, pull and adapt (don't revert their work)

### Build Gate (Required for Every Commit)
```bash
npm run build && npm test
# Both must succeed before pushing
```

### Type Safety Rules
- **NEVER replace `any` with `unknown`** - This just defers the problem and creates cascading errors
- **ALWAYS replace `any` with proper types** - Create interfaces, DTOs, or use Zod schemas
- **IF using `JSON` type** - MUST add runtime validation (type guards or Zod schemas)

---

## Phase 3 — Agent2Agent & Agent Platform Typing
- [x] Audit `apps/api/src/agent-platform/**/*` and `agent2agent/**/*` for `any`/unsafe lint hits. _(Primary hotspots: orchestration records/metadata, checkpoint services, action handler contracts, task DTOs, Supabase repositories.)_
- [ ] Define TypeScript interfaces for orchestration payloads, run artifacts, and Supabase records. _(Run/step records + plan version records now typed; continuing with remaining agent platform records.)_
- [ ] Replace controller/service signatures that return `any` with typed DTOs/results. _(Agent2Agent plan services + orchestration output/progress handlers now typed; remaining dashboard/state services in progress.)_
- [ ] Introduce typed repository helpers (factories/builders) instead of `as any` in tests/specs. _(Supabase repositories for runs and plan versions now emit typed records; TaskStatus cache migrating to JSON-safe helpers.)_
- [ ] Update Supabase client usage to rely on typed query builders or wrappers.
- [ ] Refresh Jest specs to align with new types; add coverage for critical flows (approvals, runtime execution).
- [ ] Re-run lint metrics ensuring ≥50% reduction of rule hits across agent modules.

## Phase 4 — Integration Utilities & Tooling
- [ ] Map external integration points (MCP tools, Slack/Notion, Supabase utilities).
- [ ] Implement typed adapters/guards for each integration response/request.
- [ ] Centralize shared helper functions for provider-safe casts; document usage.
- [ ] Remove legacy `eslint-disable` comments in integration directories.
- [ ] Conduct smoke tests against key integrations (where feasible) post-typing.
- [ ] Capture updated lint metrics; confirm remaining unsafe hits are documented exceptions.
