# Agent-to-Agent Modernization Implementation Plan

**Owner:** Codex (with Matt)  
**Last Updated:** 2025-01-18  
**Status:** In progress (Phase 1)  

> This plan tracks the greenfield Agent-to-Agent (A2A) controller/runtime and database-backed agent work. Orchestration enhancements are explicitly deferred until after Phase 3 (see `orchestrator-project-planning-prd.md`).

---

## Phase Overview

| Phase | Goal | Target Outcomes |
| --- | --- | --- |
| **Phase 0 – Planning & Scaffolding** | Establish baseline | ✅ Inventory legacy code, capture PRDs, land lightweight controller scaffolding (done) |
| **Phase 1 – Transport & Auth** | New REST surface | Build Nest `Agent2AgentModule` with Google A2A compliant routes, API key guard, agent card builder, and execution gateway backed by Supabase repositories. Ensure parity with legacy auth and card responses. |
| **Phase 2 – Database Agents Runtime** | Replace legacy base service | Implement database-backed agent registry, base execution services (converse/plan/build), mode routing, and LLM gateway that no longer depends on `A2AAgentBaseService`. Seed 1–2 reference agents stored in Supabase. |
| **Phase 3 – Agent Feature Parity** | Restore critical capabilities | Rebuild task lifecycle, deliverables, logging, and human-in-the-loop behavior on the new stack. Cover redaction/pseudonymization integration. |
| **Phase 4 – Migration & Cutover** | Decommission legacy path | Dual-run validation, telemetry, and final switch-off of `dynamic-agents.controller.ts` plus filesystem YAML ingestion. |
| **Phase 5 – Orchestration Enablement (Deferred)** | Reintroduce orchestration | Revisit orchestration modes, UI, analytics after Phase 3 milestones. |

---

## Current Focus (Phase 1)

### Objectives
- Finalize request/response DTOs and schema alignment with Google A2A spec.
- Harden `AgentExecutionGateway` to cover converse/plan/build without legacy fallbacks.
- Flesh out repository coverage for agents, plans, runs, orchestration recipes, org credentials (done).
- Integrate centralized routing policy adapter (stubbed today) with real enforcement.

### Active Tasks
1. ✅ **Route Contract Audit** – `/agents/:org/:slug/.well-known/agent.json` and `/tasks` now align with the spec; JSON-RPC request/response handling documented in the PRD. *(Owner: Codex – 2025-01-19)*
2. ✅ **API Key Guard Hardening** – Supabase-backed lookup, credential caching, per-key rate limiting, and structured telemetry logs. *(Owner: Codex – 2025-01-19)*
3. ✅ **Routing Adapter Integration** – Real prompt assembly, metadata merge, and centralized routing enforcement with unit coverage. *(Owner: Codex – 2025-01-19)*
4. ✅ **Task Mode Router Enhancements** – Registry-driven agent hydration and refined LLM request construction for converse/build flows. *(Owner: Codex – 2025-01-19)*
5. ✅ **Unit Test Expansion** – Controller, guard, routing adapter, and gateway negative-path scenarios covered. *(Owner: Codex – 2025-01-19)*

### Exit Criteria
- Endpoints deployed locally via new module only (legacy controller untouched).
- Unit tests green for controller, gateway, guard, routing adapter, repositories.
- API key guard validated against Supabase credentials table.
- Documentation updated (`agent-platform-unified-prd.md`, this plan).

---

## Backlog (Phase 2+) Snapshot

| ID | Task | Notes |
| --- | --- | --- |
| P2-01 | Implement `AgentRegistryService` (DB-first) | Provides caching, supports org namespaces, replaces filesystem discovery. |
| P2-02 | Build database agent base classes (`AgentModeHandler`, `LLMDispatchService`) | Should encapsulate prompt building, streaming, telemetry. |
| P2-03 | Seed reference agents (`demo/orchestrator`, one specialist) via Supabase seeding script | Enables end-to-end tests. |
| P2-04 | Implement conversation/task persistence adapters in new stack | Must produce identical task/deliverable records. |
| P2-05 | Map JSON-RPC error telemetry to observability dashboards | Needs structured log → metrics pipeline. |
| P3-01 | Reinstate HITL checkpoints on new orchestration runner | Blocks final parity. |
| P3-02 | Integrate pseudonymization/redaction checks | Coordinate with privacy services. |
| P4-01 | Dual-run instrumentation | Compare legacy vs new responses. |
| P4-02 | Migration playbook + cutover toggle | Feature flag + rollback plan. |
| P5-01 | Revisit orchestration plan/run modes | Only after Phase 3 complete. |

---

## Coordination & Notes
- **Lint/Test Debt:** Separate agent handles legacy lint cleanup; sync before Phase 2 to avoid churn.
- **Docs:** Update this plan whenever tasks move phases; mirror key decisions back into `agent-platform-unified-prd.md` for historical record.
- **Tooling:** Avoid `tasks.json`; use this markdown for cross-session continuity.

---

- **2025-01-19:** Controller now assigns request IDs to every call (stored in metadata/logs) for end-to-end correlation. (Codex)
- **2025-01-19:** `AgentExecutionGateway` now resolves agents via `AgentRegistryService` (cached Supabase lookup). (Codex)
- **2025-01-19:** Added structured logging for controller requests (org/agent/mode + JSON-RPC metadata). (Codex)
- **2025-01-19:** Controller now returns JSON-RPC error envelopes (code mapping for 4xx/5xx) to keep HTTP 200 responses spec-compliant. (Codex)
- **2025-01-19:** PRD updated with JSON-RPC request/response contract (method mapping, envelope semantics) and auth/logging details. (Codex)
- **2025-01-19:** `/agent-to-agent/:org/:agent/tasks` accepts JSON-RPC 2.0 envelopes, maps `method` to task modes, and preserves request metadata for downstream telemetry. (Codex)
- **2025-01-19:** API key guard now caches Supabase credentials and enforces configurable per-key rate limits (429). (Codex)
- **2025-01-19:** Agent card builder now generates spec-compliant descriptors (protocol/version/url/capabilities/security) with unit coverage; remaining route-contract work tracks JSON-RPC payload docs. (Codex)
- **2025-01-19:** Guard emits structured auth telemetry (including rate-limit events) and controller supports `includePrivate` card queries for downstream policy enforcement. (Codex)
- **2025-01-19:** Routing adapter wires in centralized policy decisions with request/agent metadata, feeding the enhanced mode router. (Codex)
- **2025-01-18:** Initial plan draft, orchestration work marked as deferred (Codex).
