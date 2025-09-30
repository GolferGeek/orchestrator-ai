# Agent-to-Agent Modernization Implementation Plan

**Owner:** Codex (with Matt)  
**Last Updated:** 2025-01-20  
**Status:** In progress (Phase 2)  

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

## Phase 1 Recap (Transport & Auth)

### Summary
- Google-spec controller, DTOs, and task routing live alongside structured auth + telemetry.
- Routing adapter + mode router collaborate with the new registry for metadata-rich LLM dispatch.
- Legacy AgentCreator/agent-builder module removed to avoid conflicting Supabase dependencies.

Phase 1 exit criteria are met; work now shifts to the database-backed runtime.

---

## Current Focus (Phase 2)

### Objectives
- Stand up database-driven agent runtime primitives (definitions, capability profiles, execution context builders).
- Replace `A2AAgentBaseService` dependencies with the new runtime inside the agent2agent gateway.
- Seed exemplar agents in Supabase for demo/my-org namespaces and wire registry hydration tests.
- Ensure plan/orchestration services operate on the new agent artifacts end-to-end.

### Active Tasks
1. ✅ **Runtime Blueprint** – Database agent capability model, runtime definitions, and metadata envelopes established (AgentRegistry + RuntimeDefinition/Execution services).
2. 🚧 **Execution Primitives** – Implement base classes/services that drive converse/plan/build using the new capability model. *Status:* Prompt + Dispatch + Stream services centralize LLM invocation, emit stream IDs/events, and TaskProgressGateway/websocket consumers can now subscribe via `subscribe_stream` for live tokens.
3. ✅ **Reference Agent Seed** – Author seed scripts + fixtures for `demo/orchestrator` and one specialist agent in Supabase (seeded via `apps/api/supabase/seed.sql`).
4. 🚧 **Integration Coverage** – Gateway runtime/stream specs now cover plan-based start, saved orchestration launch, and run-continue flows; next: mode router + runner edge cases.

### Exit Criteria
- Database runtime service produces consistent agent execution payloads consumed by the mode router.
- Supabase seeds provide at least two working agents for Phase 2 testing.
- End-to-end task execution (converse/plan/build) functions without touching legacy base services.
- Documentation reflects the database runtime architecture (`agent-platform-unified-prd.md`, seeds README).

### Orchestration Task Modes (draft)
- **Planning**: `orchestrator_plan_create`, `orchestrator_plan_update`, `orchestrator_plan_review`, `orchestrator_plan_approve`, `orchestrator_plan_reject`, `orchestrator_plan_archive`.
- **Runs**: `orchestrator_run_start`, `orchestrator_run_continue`, `orchestrator_run_pause`, `orchestrator_run_resume`, `orchestrator_run_human_response`, `orchestrator_run_rollback_step`, `orchestrator_run_cancel`, `orchestrator_run_evaluate`.
- **Saved Orchestrations**: `orchestrator_recipe_save`, `orchestrator_recipe_update`, `orchestrator_recipe_validate`, `orchestrator_recipe_delete`, `orchestrator_recipe_load`, `orchestrator_recipe_list`.

---

## Backlog (Phase 3+) Snapshot

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
- **Local DB:** Run `supabase db reset --config apps/api/supabase/config.dev.toml` to load the reference agents into your development stack after pulling seeds.

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
- **2025-01-19:** Retired the legacy AgentCreator “agent builder” module to avoid conflicting database dependencies ahead of the new runtime. (Codex)
- **2025-01-19:** Added `AgentRuntimeDefinitionService` and wired mode router hydration through the database-defined capability profile with new unit coverage. (Codex)
- **2025-01-19:** AgentExecutionGateway now hydrates runtime definitions once per request, propagating agent metadata to plan/orchestration responses and mode routing. (Codex)
- **2025-01-19:** OrchestrationRunnerService persists agent/org metadata on run start, giving us immutable provenance for auditing. (Codex)
- **2025-01-19:** AgentModeRouter consumes the new AgentRuntimePromptService for prompt + metadata assembly, completing the first execution primitive refactor. (Codex)
- **2025-01-19:** Introduced AgentRuntimeDispatchService to wrap LLMServiceFactory calls (future streaming hook) and refactored mode router/specs to route through it. (Codex)
- **2025-01-19:** Dispatcher streaming API added; callers can await the final response or iterate chunks via async iterator ahead of websocket integration. (Codex)
- **2025-01-19:** TaskProgressGateway now relays `agent.stream.*` events (`subscribe_stream`, conversation/run rooms) so live LLM tokens reach clients without one-off per-agent plumbing. (Codex)
- **2025-01-19:** Orchestration execute paths now start streaming sessions, emit run-start chunks, and include `streamId` in responses so front-end orchestration tooling can subscribe immediately. (Codex)
- **2025-01-19:** Orchestration continue updates also stream `run_updated` chunks and return the same `streamId`, keeping long-running runs in sync across websocket subscribers. (Codex)
- **2025-01-20:** Seeded database-backed demo orchestrator + my-org requirements agents (SQL + fixtures) to exercise the new runtime services. (Codex)
- **2025-01-20:** Added AgentExecutionGateway integration spec covering plan-based run start streaming flow using seeded agents. (Codex)
- **2025-01-20:** Extended integration coverage to orchestration run continuation streaming updates. (Codex)
- **2025-01-20:** Added integration coverage for saved orchestration execution, validating prompt parameter resolution and streaming. (Codex)
- **2025-01-20:** Saved orchestration integration spec now asserts missing parameter validation and stream error emission. (Codex)
- **2025-01-20:** AgentModeRouter tests now cover streaming error propagation (session.error) for dispatcher failures. (Codex)
- **2025-01-20:** Gateway integration suite exercises routing showstopper path (human response) to guard against unintended dispatch calls. (Codex)
- **2025-01-20:** Plan mode integration confirms PlanEngine receives enriched agent metadata for draft creation. (Codex)
- **2025-01-18:** Initial plan draft, orchestration work marked as deferred (Codex).
