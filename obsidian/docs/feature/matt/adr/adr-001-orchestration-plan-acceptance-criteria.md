# ADR-001: Orchestration Plan Acceptance Criteria

## Status

**Accepted** (2025-10-12)
- ✅ Acknowledged by Claude (Tester) - 2025-10-12T14:15:00Z
- ✅ Acknowledged by Human Owner (GolferGeek) - 2025-10-12T15:00:00Z

## Context

The orchestration system delivery plan (`docs/feature/matt/orchestration-system-plan.md`) defines a ten-phase roadmap, separating builder (Codex) and tester (Claude) responsibilities with explicit exit criteria, quality gates, and documentation deliverables. Phase 0 requires foundational environment work (Supabase reset, tooling baseline, ADR scaffolding, plan alignment) before implementation begins. To ensure all stakeholders work from the same expectations, we need a formal agreement on what it means for the plan to be "accepted" and used as the source of truth throughout delivery.

## Decision

Adopt the orchestration system plan as the authoritative guide for execution, with the following acceptance criteria:

1. **Branch Workflow** – Each phase begins on a dedicated branch named `integration/orchestration-phase-{n}` created from `integration/agent-platform-sync-main`; merges follow the plan's checklist.
2. **Role Separation** – Codex does not author or run tests; Claude enforces standards, writes tests, and controls commits. Any deviation requires a documented exception in the plan.
3. **Phase Exit Gates** – A phase is complete only when every checkbox in the plan (builder and tester) is marked done, exit criteria are met, and required artifacts (reports, backups, coverage summaries) exist in `docs/feature/matt/`.
4. **Documentation Loop** – Newly created artifacts (task logs, standards reports, retrospectives, ADRs) are kept current as work progresses; updates happen within the active phase branch.
5. **Human Validation Points** – Human review occurs only at the designated gates (Phase 5 and Phase 10) unless an ADR records a change to that cadence.

By meeting these criteria we can treat the plan as the binding contract for orchestration delivery.

## Consequences

Positive:
- Establishes a shared definition of done for every phase and reduces ambiguity when transitioning work between Codex and Claude.
- Simplifies audits and retrospectives because artifacts and decisions live beside the plan in version control.
- Supports predictable scheduling by tying branch workflow and documentation to phase exit gates.

Negative / Risks:
- Adds upfront coordination overhead; progress may pause if documentation or plan updates lag.
- Requires discipline to keep checkbox status and artifacts synchronized; missed updates could block phase completion.

Follow-up:
- Claude and the human owner should review and mark this ADR as "Accepted" once they acknowledge the criteria.
- Future deviations (additional human validation gates, altered branching strategy) must be recorded in a subsequent ADR.
