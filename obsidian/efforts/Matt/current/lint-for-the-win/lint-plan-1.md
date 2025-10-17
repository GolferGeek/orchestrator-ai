# Lint Plan 1 — Tooling & LLM Foundations

## 🤝 Multi-Agent Coordination Rules

**THREE AGENTS RUNNING IN PARALLEL** — Follow these rules to avoid conflicts:

### Commit Strategy
- **Commit frequency**: Every 2-4 hours or after completing a phase
- **Commit prefix**: Use `lint(tooling):` or `lint(llm):` for all commits
- **Pre-commit validation**: MUST run `npm run build && npm test` — both must pass
- **Pull before push**: ALWAYS run `git pull --rebase origin main && git push`
- **Rebase conflicts**: Accept incoming changes, re-apply your fixes, re-run build+test

### Your Scope (Plan 1)
- **Primary files**: `apps/api/eslint.config.*`, `apps/web/eslint.config.*`, `apps/api/src/llms/**/*`
- **Shared files**: Watch for conflicts in package.json, tsconfig.json
- **Coordination**: If Agent 2 or 3 breaks your build, pull and adapt (don't revert their work)

### Build Gate (Required for Every Commit)
```bash
npm run build && npm test
# Both must succeed before pushing
```

---

## Phase 1 — Tooling & Governance
- [x] Convert `apps/api` ESLint to per-target flat config with modern `ecmaVersion`.
- [x] Update parser options (`projectService`, `tsconfigRootDir`) and confirm TypeScript project references.
- [x] Introduce rule allowlists/overrides for temporary hotspots (document each case).
- [x] Migrate `apps/web/.eslintrc.json` to `eslint.config.js` with matching parser versions.
- [x] Ensure `npm run lint` exits on warnings; add `--max-warnings=0` guard.
- [x] Produce baseline lint metrics script (`lint:report`) storing counts for tracked rules.
- [ ] Update CI definitions to surface lint artifacts/dashboards without failing builds yet.

## Phase 2 — LLM & Evaluation Layer Hardening
- [ ] Inventory every `any`/unsafe usage inside `apps/api/src/llms/**/*` and evaluation modules.
- [ ] Design DTO interfaces for provider requests/responses (OpenAI, Anthropic, Google, Ollama).
- [ ] Add schema validation (e.g., Zod/TypeBox/Nest pipes) to enforce incoming payloads.
- [ ] Refactor centralized routing + evaluation services to use new types (no `any` casts).
- [ ] Type error-handling utilities and logging metadata; eliminate unsafe member accesses.
- [ ] Update or add unit tests covering newly typed branches or guards.
- [ ] Regenerate lint metrics; verify ≥50% reduction of `any`/unsafe hits in LLM modules.
