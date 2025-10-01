# Agent Migration Plan (Filesystem → Database)

Status: Draft for review
Owner: Codex with Matt

## Goal
Move from filesystem-based agents to database-backed agents in a deliberate, low-risk sequence. Keep only what provides value, modernize what needs parity, and deprecate what’s obsolete.

## Decision Criteria
- Usage: recent invocations, owner demand, demo value
- Type: orchestrator, context, API/external, function
- Complexity to port: YAML-only vs code/function
- Dependencies: n8n/webhooks, external APIs, local files
- Parity Requirements: deliverables, PII, auth, streaming

## Buckets
- Keep & Migrate: high usage/value, low/medium effort
- Migrate Later: value but medium/high effort or dependencies
- Drop: obsolete, redundant, or superseded

## Migration Steps
1) Inventory filesystem agents (auto-generated report)
2) Classify into keep/migrate/drop buckets (this doc)
3) Recreate selected agents as DB agents (YAML + context + transport)
4) Validate on new A2A runtime (converse/plan/build)
5) Dual-run comparison where applicable
6) Cutover per agent (update registry, hide legacy path)
7) Remove legacy code after sign-off

## Coexistence Strategy
- Legacy route: `DynamicAgentsController` + filesystem
- New route: `Agent2AgentController` + DB runtime
- Both available until Phase 4 cutover

## Deliverables
- Migration inventory (report)
- Agent-by-agent migration checklists
- Final deprecation PR removing legacy code (scoped by directories)

## Notes
- API/External agents keep minimal prompt-only bodies; response extraction via YAML transform is supported
- Credential injection is optional and deferred
