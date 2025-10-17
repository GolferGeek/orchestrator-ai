# Lint for the Win — Product Requirements Document

## Background
- The monorepo relies on lenient ESLint configurations that suppress critical TypeScript safety rules (e.g., `no-explicit-any`, `no-unsafe-*`, `require-await`).  
- Current telemetry (Jan 2025 baseline):
  - API (`apps/api`): 1 867 `any`s, 2 246 unsafe assignments, 2 787 unsafe member accesses, 646 unsafe arguments, 188 unsafe returns, 80 missing `await`s, 156 unbound methods.
  - Web (`apps/web`): 952 `any`s, 360 unused symbols, concentrated in shared type files and complex Ionic/Vue components.
- These suppressions hide real integration bugs, block accurate typings for external providers, and reduce developer confidence in analytics, agent orchestration, and LLM safety surfaces.

## Problem Statement
We must re-enable lint rules that enforce type safety across API and Web codebases while keeping runtime behavior stable. The effort should deliver actionable typed contracts, ensure lint passes in CI, and prevent regression by institutionalizing stricter lint gates.

## Objectives
- Restore strict TypeScript linting while avoiding breaking changes to public contracts or runtime workflows.
- Deliver typed abstractions for LLM, Agent2Agent, Supabase tooling, and front-end stores that eliminate reliance on `any` and unsafe operations.
- Integrate the hardened lint rules into CI/CD so new code cannot reintroduce suppressed categories.

## Success Metrics
- ESLint runs succeed with `@typescript-eslint/no-explicit-any`, `no-unsafe-*`, and related rules set to `error`.
- Reduction of `any` usage by ≥90% in both API and Web targets (tracked via weekly rule counts).
- No new lint suppressions added without documented justification; existing suppressions reduced to <10 project-wide.
- CI gate (`npm run lint`) fails on regressions and is adopted before project completion.

## In Scope
- Updating ESLint configuration for API and Web workspaces (flat config migration, modern parser options).
- Refactoring TypeScript modules to replace `any` and unsafe operations with explicit interfaces, discriminated unions, schema guards, or typed helpers.
- Documentation updates covering new lint expectations and exception processes.
- Incremental PR workflow for large subsystems (LLM services, Agent2Agent runtime, Vue stores/components).

## Out of Scope / Non-Goals
- Overhauling runtime APIs or introducing new product features.
- Large-scale dependency upgrades beyond what lint/type fixes require.
- Enforcing 100% elimination of `any` where third-party interfaces remain untyped (acceptable with documented, localized exceptions).

## Stakeholders
- Product & Architecture: Matt (initiative sponsor), platform leads for LLM/agents.
- Engineering: API team, Web team, QA for regression coverage, DevOps for CI updates.
- Developer Experience: lint/tooling maintainers responsible for ongoing rule enforcement.

## Requirements & Phased Approach

### Phase 1 — Tooling & Governance (1 engineer-day)
- Convert API lint config to flat config per target, increase `ecmaVersion`, and add rule allowlists where staging overrides are required.
- Convert Web `.eslintrc.json` to `eslint.config.js`, align TypeScript parser versions, and ensure `npm run lint` exits on warnings.
- Establish lint dashboards/reports (e.g., `npm run lint:report`) and update CI to surface counts.

### Phase 2 — LLM & Evaluation Layer Hardening (5 engineer-days)
- Introduce DTOs and strict interfaces for LLM provider payloads, centralized routing decisions, and evaluation outputs.
- Replace `any` usage with typed wrappers and schema validation (Zod/TypeBox or Nest pipes) across `apps/api/src/llms/**/*`.
- Refactor error-handling utilities to return typed structures; add unit tests where typing alters branches.

### Phase 3 — Agent2Agent & Agent Platform Typing (7 engineer-days)
- Define contract interfaces for orchestration payloads, runtime artifacts, and Supabase responses.
- Refactor services/controllers (`agent-runtime-*`, `agents-admin`, `orchestrations`) to use typed repositories and builder factories instead of `as any`.
- Update test helpers to use typed factories (`Partial<T>`, builders) replacing blanket casts.

### Phase 4 — Integration Utilities & Tooling (3 engineer-days)
- Harden MCP tools, Supabase utilities, and external SDK adapters with typed request/response layers and guard helpers.
- Centralize adapter patterns so future providers integrate without relaxing lint rules.

### Phase 5 — Front-End Typing Sweep (3 engineer-days)
- Start only after the dedicated front-end testing workstream signs off and Phases 1–4 are complete.
- Refine shared Vue types (`src/types/*.ts`), align store typing, and generate API contracts where possible.
- Update components/composables to use typed props/emits and remove unused symbols.
- Add targeted unit tests to cover any newly constrained props or services.

### Phase 6 — Residual Cleanup & Enforcement (2 engineer-days)
- Address remaining `require-await`, `unbound-method`, and template restriction hits.
- Document and justify any unavoidable suppressions; ensure they are localized with TODO follow-up.
- Expand regression tests where lint-driven refactors touched business-critical flows.

### Phase 7 — Finalization & Rollout (1 engineer-day)
- Flip lint rules to `error`, verify `npm run lint && npm test && npm run build` succeed.
- Update developer docs (README, contribution guide) outlining lint expectations and exception process.
- Present wrap-up report with before/after metrics and backlog of remaining annotated follow-ups.

## Dependencies
- Access to Supabase schemas and existing TypeScript types to align DTOs.
- Coordination with owners of LLM provider integrations to validate typed contracts.
- CI pipeline updates (DevOps) to enforce new lint gates.

## Risks & Mitigations
- **Hidden behavior changes**: Tightened types may expose implicit assumptions. Mitigate via incremental PRs, additional unit tests, and stakeholder review on any behavior-affecting fixes.
- **Timeline creep**: Large refactors might unearth broader debt. Mitigate with strict scoping, breaking efforts into module-sized PRs, and tracking outstanding items in a follow-up backlog.
- **Developer friction**: Stricter lint rules can slow short-term productivity. Mitigate by documenting patterns, providing helper utilities, and hosting onboarding sessions.

## Rollout & Communication Plan
- Weekly status updates in the architecture consolidation initiative channel with metrics snapshots.
- Publish lint dashboard link and tracking spreadsheet; highlight delta since last update.
- Conduct end-of-phase reviews with stakeholders to confirm readiness before enabling strict CI gates.

## Decisions & Follow-Ups
- ✅ Adopt code generation/typed contract tooling ahead of the deeper LLM typing effort (mirrors recent front-end approach).
- ✅ Skip temporary branch protections; rely on final CI lint gate once rollout completes.
- ✅ Confirmed no external integrations (n8n, MCP) need changes—the stricter types stay internal.
