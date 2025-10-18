# Lint Plan 3 — Front-End Sweep & Finalization

## 🤝 Multi-Agent Coordination Rules

**THREE AGENTS RUNNING IN PARALLEL** — Follow these rules to avoid conflicts:

### Task Management
- **REQUIRED**: Update checkboxes in real-time as you work
- Mark tasks `[x]` immediately after completing them (not in batches)
- Add subtasks with checkboxes for large tasks to show incremental progress
- Update progress notes in parentheses when partially complete
- Keep the plan file current at all times - it's how progress is tracked

### Commit Strategy
- **Commit frequency**: Every 2-4 hours or after completing a phase
- **Commit prefix**: Use `lint(web):` or `lint(finalization):` for all commits
- **Pre-commit validation**: MUST run `npm run build && npm test` — both must pass
- **Pull before push**: ALWAYS run `git pull --rebase origin main && git push`
- **Rebase conflicts**: Accept incoming changes, re-apply your fixes, re-run build+test

### Your Scope (Plan 3)
- **Primary files**: `apps/web/src/**/*` (types, stores, components)
- **Shared files**: Watch for conflicts in ESLint configs (Agent 1 creates these in Phase 1)
- **Coordination**: Wait for Agent 1 to complete Phase 1 ESLint config before starting Phase 5
  - Check for `apps/web/eslint.config.js` existence
  - If not present, start with Phases 6-7 (API cleanup) and circle back to Phase 5

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

## Phase 5 — Front-End Typing Sweep
- [ ] Confirm front-end testing stream sign-off and Phases 1–4 completion.
- [ ] Generate/ingest typed API contracts for Web services (reuse backend codegen where possible).
- [ ] Tighten shared `apps/web/src/types/*.ts` definitions; remove blanket `any`.
- [ ] Refactor high-usage components (TwoPaneConversationView, AgentTaskItem, DeliverableDisplay) to typed props/emits.
- [ ] Align Pinia stores/composables with typed state/actions and eliminate unused symbols.
  - [x] privacyService.ts type improvements
  - [x] llmAnalyticsService responses typed
  - [x] agentExecutionService payload typing tightened
  - [x] sanitizationAnalyticsService typed activity/system health
  - [x] sovereignPolicyService model return types clarified
- [ ] Update targeted unit tests or add new ones covering typed data flows.
- [ ] Record lint metrics; verify ≥80% reduction of `any`/unused-var hits in Web app.

## Phase 6 — Residual Cleanup & Enforcement
- [ ] Resolve outstanding `require-await`, `unbound-method`, template restriction issues.
- [ ] Localize any unavoidable suppressions with TODO justification and owners.
- [ ] Add regression tests for flows touched during cleanup (e.g., async handlers, sanitizer utilities).
- [ ] Perform repository-wide search to confirm no lingering broad `eslint-disable` comments.

## Phase 7 — Finalization & Rollout
- [ ] Enable strict lint rules (`error`) and ensure `npm run lint && npm test && npm run build` succeed.
- [ ] Update developer docs (README, contribution guide) with new lint expectations and exception process.
- [ ] Communicate completion via architecture initiative channel with before/after metrics.
- [ ] Add lint status badge/report link and archive final metrics snapshot.
