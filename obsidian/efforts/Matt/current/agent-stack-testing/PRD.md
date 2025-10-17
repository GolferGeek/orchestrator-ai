# PRD: Front-End Architecture Consolidation & Agent Stack Validation

**Effort Type**: architecture-improvement  
**Branch**: architecture-consolidation  
**Start Date**: 2025-10-14  
**Owner**: Matt (GolferGeek)

---

## Problem Statement

The current Vue front-end and supporting services evolved organically and now duplicate state across multiple Pinia stores, mix UI state with domain entities, and call legacy service layers that bypass the newer action abstractions. This fragmentation creates inconsistent reactivity, higher maintenance costs, and makes it hard to validate the agent stack end to end. We need a consolidated architecture that keeps stores focused on synchronous state management, moves side effects into dedicated actions/services, and ensures the testing workflow can exercise the full stack without fighting the client architecture.

---

## Goals

1. **Consolidate domain stores** so that conversations, plans, deliverables, and agents each have a single, well-typed Pinia store with synchronous mutations only.
2. **Separate UI state** (view preferences, ephemeral flags) from domain data via lightweight UI stores.
3. **Adopt action-based services** (e.g., `agent2agent/actions/*`) as the single entry point for async operations, removing legacy `agent-tasks` services.
4. **Migrate “Projects” concepts to “Orchestrations”** across API, database, and front-end layers to match current terminology.
5. **Provide progressive testing coverage** that validates the refactored front-end, action layer, and backend orchestration flows from unit to E2E.
6. **Complete store type-safety overhaul (incremental improvement)** so every store, getter, and mutation exposes precise TypeScript definitions without regressions.

---

## Non-Goals

- Introducing new user-facing features beyond the renamed orchestration terminology.
- Expanding real-time infrastructure beyond existing SSE/webhook mechanisms.
- Performing performance benchmarking beyond the agreed verification checks.

---

## Users & Impact

- **Front-end engineers** gain a clearer mental model and faster iteration cycle.
- **QA & Release** teams inherit deterministic testing flows aligned with the architecture.
- **Operators** see fewer regression risks due to reduced duplication and improved typing.

---

## Solution Overview (Phased)

1. **Store Consolidation**  
   - Create unified conversations, plans, deliverables, and agents stores.  
   - Extract UI-only state into dedicated UI stores.  
   - Remove the legacy `agentChatStore` and redundant project stores.

2. **Service Migration to Actions**  
   - Implement deliverable and conversation actions following the existing `plan.actions.ts` pattern.  
   - Update Vue components to call actions instead of legacy services.  
   - Delete the `agent-tasks` directory once no call sites remain.

3. **Projects → Orchestrations Migration**  
   - Update database schema, backend entities, DTOs, and APIs.  
   - Reflect the new naming in front-end services, components, and routing.  
   - Remove obsolete project UI/pages.

4. **Store Method Migration**  
   - Ensure all Pinia stores expose synchronous mutations only.  
   - Move async logic to services/actions and adjust components accordingly.  
   - Apply incremental type-safety improvements to stores, strengthening types without breaking existing behavior.

5. **Validation, Documentation & Release Readiness**  
   - Raise automated and manual test coverage across the agent stack.  
   - Execute integration and E2E runs aligned with the progressive testing plan.  
   - Update architecture docs, ADRs, and contribution guidelines before sign-off.

---

## Functional Requirements

- **R1. Unified Stores**: Conversations, plans, deliverables, and agents each live in a single Pinia store backed by typed interfaces and Maps where appropriate for O(1) lookups.
- **R2. UI Store Isolation**: UI state (active conversation, pending actions, display modes) resides in dedicated UI stores with no domain data bleed.
- **R3. Action Layer**: All async CRUD and orchestration logic routes through `agent2agent/actions/*` modules that dispatch synchronous store mutations.
- **R4. Terminology Migration**: Database, API, and front-end code refer to “orchestrations” instead of “projects,” with migrations deployed safely across environments.
- **R5. Testing Workflow**: Progressive testing artifacts (phase plans, tracking docs) reflect the new architecture and confirm cross-phase dependencies.
- **R6. Documentation**: `DOMAIN_ARCHITECTURE_ANALYSIS.md`, ADRs, and READMEs detail the finalized store/service architecture and workflows.
- **R7. Type Safety**: Store modules, selectors, and actions expose strict TypeScript types (no `any` or implicit casts) backed by shared domain models.

---

## Success Metrics

- Store count reduced from >10 to ≤7 consolidated stores.  
- Zero async methods remain within Pinia stores.  
- Zero imports from deprecated `agent-tasks` services.  
- ≥1,454 lines of legacy project-related code removed.  
- ≥80% test coverage for newly introduced or modified stores, actions, and services.  
- 100% of Pinia store APIs rely on explicit, strongly typed interfaces with no unchecked casts.
- Front-end bundle size and key load times are equal to or better than pre-refactor baselines.  
- End-to-end test suite validates the agent stack (plan → deliverable → orchestration) without regressions.

---

## Testing Strategy

1. **Unit Tests**: Pinia stores, action modules, and backend services gain thorough coverage with Jest/Vitest.  
2. **Integration Tests**: Vue component flows for conversations, plans, deliverables, and orchestrations are exercised via Vitest/JSDOM.  
3. **Progressive Agent Stack Runs**: Phased manual/automated checks ensure each layer (plans, deliverables, actions, orchestration) behaves correctly after refactors.  
4. **End-to-End Verification**: Cypress or Playwright runs cover critical conversations → plan → deliverable flows, including real-time updates.  
5. **Regression & Performance Sanity**: Smoke tests for major features plus baseline comparisons for load time and bundle size.

Testing artifacts live in `obsidian/efforts/Matt/current/agent-stack-testing/` and must be updated as phases complete.

---

## Dependencies & Risks

- Coordinating API/database migrations requires tight sequencing across environments.  
- Refactoring large Vue components may surface hidden coupling; incremental commits and feature flags mitigate rollout risk.  
- Test automation updates must keep pace with store/action changes to avoid false regressions.

---

## Assumptions & Decisions

1. **Database Management**: Reset between major phases only; reuse seeded data within a phase to observe state transitions.  
2. **Test Evidence**: Execution logs and written results in the tracking document suffice; video capture is optional.  
3. **Deliverable Lifecycle**: When a plan is deleted, related deliverables persist but become orphaned artefacts accessible via orchestration history.  
4. **Failure Handling**: Any failed test blocks phase completion until resolved; defects are logged and fixed before progressing.

---

## Exit Criteria

- All functional requirements met and verified.  
- Success metrics satisfied with documented evidence.  
- Testing strategy executed with results in the tracking repository.  
- Documentation updated and reviewed.  
- Stakeholders (Matt, front-end, QA) approve release readiness.
