# Orchestration Architecture Overview

This guide explains how orchestration requests move through the platform, the services involved in each phase, and how the system delivers reliability, observability, and scale. File paths reference the NestJS workspace under `apps/api/src/agent-platform/**` unless noted otherwise.

---

## 1. End-to-End Execution Flow

```
Client / Orchestrator Agent
        │
        │  (A2A JSON-RPC via AgentExecutionGateway)
        ▼
OrchestrationRunFactoryService
        │  (creates run + steps, emits planning lifecycle)
        ▼
OrchestrationExecutionService
        │  (queues runnable steps respecting concurrency)
        ▼
OrchestrationStepExecutorService
        │  ├─ Agent task execution via AgentModeRouterService
        │  ├─ Sub-orchestration execution (child runs)
        │  ├─ Cache lookup / population
        │  └─ Metrics & event emission
        ▼
OrchestrationEventsService + ProgressEventsService
        │  (SSE/WebSocket/Webhook updates, TaskStatus sync)
        ▼
Consumers (Dashboards, Webhooks, Metrics, Logs)
```

Key insights:
- **AgentExecutionGateway** (`apps/api/src/agent2agent/services/agent-execution-gateway.service.ts`) is the single entry point for orchestrator agents. It validates capability, enforces routing policies, and delegates orchestration modes (create, execute, continue, resume) to internal services.
- **OrchestrationRunFactoryService** (`services/orchestration-run-factory.service.ts`) materializes runs from saved definitions or inline plans. It seeds metadata, computes concurrency defaults, persists the run + step rows, and triggers execution immediately.
- **OrchestrationExecutionService** (`services/orchestration-execution.service.ts`) maintains the active queue. It computes available slots, marks steps as `queued`/`running`/`completed`, and drives lifecycle events.
- **OrchestrationStepExecutorService** (`apps/api/src/agent2agent/services/orchestration-step-executor.service.ts`) performs the heavy lifting: conversation provisioning, agent invocation via `AgentModeRouterService`, retry bookkeeping, cache hydration, and sub-orchestration fan-out.

---

## 2. Core Services & Responsibilities

| Service | Responsibility | Notes |
| --- | --- | --- |
| `OrchestrationDefinitionService` | CRUD for saved definitions, schema validation, caching | Uses `OrchestrationCacheService` to memoize definitions by `(owner, name, version)`. |
| `OrchestrationRunFactoryService` | Builds new runs from definitions or ad-hoc plans, sets metadata | Extracts execution + error handling metadata, initializes steps via `OrchestrationStateService`. |
| `OrchestrationExecutionService` | Queue management, concurrency enforcement, run lifecycle | Emits events through `OrchestrationEventsService` and records Prometheus metrics. |
| `OrchestrationStateService` | Step persistence helpers (initialization, dependency resolution) | Works with `OrchestrationRunsRepository` and `OrchestrationStepsRepository`. |
| `OrchestrationStepExecutorService` | Executes queued steps, handles retries, caching, sub-runs | Integrates with `AgentRegistryService`, `AgentModeRouterService`, `RoutingPolicyAdapterService`. |
| `OrchestrationCacheService` | In-memory caches for definitions + step outputs | Step cache keys use stable SHA-256 fingerprinting of step inputs. |
| `OrchestrationMetricsService` | Prometheus registry + counters/histograms | Exposed via `/metrics` controller; records run/step lifecycle stats. |
| `OrchestrationProgressEventsService` | Bridges run events to SSE/WebSocket/webhook targets | Emits `agent.stream.*` events, updates `TaskStatusService`, optionally POSTs to configured webhook. |

Supporting modules:
- `OrchestrationEventsService`: wraps `EventEmitter2` to publish rich lifecycle payloads.
- `OrchestratorAgentRunnerService`: extends base agent runner to enable agent-triggered orchestration runs.
- `OrchestrationCheckpointService`: handles human-in-the-loop decisions by linking `human_approvals` to step snapshots.

---

## 3. Persistence Layer

All orchestration entities live in Supabase (Postgres). Repositories encapsulate SQL access:

| Table | Repository | Purpose |
| --- | --- | --- |
| `orchestration_definitions` | `orchestration-definitions.repository.ts` | Stores versioned definitions + metadata. |
| `orchestration_runs` | `orchestration-runs.repository.ts` | Canonical run records, lifecycle timestamps, metadata blobs. |
| `orchestration_steps` | `orchestration-steps.repository.ts` | Step state (`queued`, `running`, `failed`, etc.), payloads, runtime metadata. |
| `human_approvals` | `human-approvals.repository.ts` | Checkpoint gating decisions, linked to step + conversation. |
| `conversation_plans` / `tasks` / `deliverables` | Existing agent platform tables reused for orchestration steps and outputs. |

Repositories are injected into services via Nest modules (`agent-platform.module.ts`) and leverage Supabase client helpers for consistent logging/error handling.

---

## 4. Concurrency, Retry, and Caching

### Concurrency
- Definitions can specify `orchestration.execution.concurrency.maxParallel` (or legacy aliases). The run factory normalizes this and stores it in run metadata.
- `OrchestrationExecutionService.getConcurrencyLimit()` reads metadata first, falling back to environment variables `ORCHESTRATION_DEFAULT_MAX_PARALLEL` or `ORCHESTRATION_MAX_CONCURRENCY`, and finally to sequential execution.
- Step scheduling pulls as many runnable steps as permitted by available slots and updates run state atomically.

### Retry & Rollback Metadata
- Definitions may include `orchestration.error_handling.on_step_failure` parameters (max attempts, exponential backoff, notify human, allow skip). The run factory captures this into metadata so the step executor can calculate retry schedules.
- Manual rollback hints (`error_handling.rollback`) are preserved for UI display and operator tooling.

### Step Output Cache
- Enabled per definition via `orchestration.execution.caching`. Policies can toggle per-step caching and TTLs (`ttlSeconds`).
- `OrchestrationStepExecutorService` builds cache keys from `(definition, organization, stepId, input fingerprint)` and restores cached outputs before invoking agents.
- Cached hits update runtime metadata (hit counters, stored timestamps) for observability.

---

## 5. Agent-to-Agent (A2A) Integration

- Orchestrators interact through the existing JSON-RPC transport. Request payloads use `TaskRequestDto` with modes like `ORCHESTRATE_EXECUTE` or `ORCHESTRATOR_RUN_CONTINUE`.
- For each agent step, the executor:
  1. Ensures a conversation exists (mirrors “steps have conversations” architecture).
  2. Builds an agent runtime definition via `AgentRuntimeDefinitionService`.
  3. Routes execution with `AgentModeRouterService`, respecting policy gates (`RoutingPolicyAdapterService`).
  4. Translates agent responses back into `TaskResponseDto`, updating step records and emitting events.
- Sub-orchestrations spawn new runs via `OrchestrationRunFactoryService`, link parent/child IDs, and wait for terminal status before completing the parent step.

---

## 6. Observability & Telemetry

| Channel | Description |
| --- | --- |
| **Event Bus** (`EventEmitter2`) | `OrchestrationEventsService` emits domain events (`orchestration.run.created`, `orchestration.step.completed`, etc.). |
| **SSE / WebSocket Bridge** | `OrchestrationProgressEventsService` converts events into `agent.stream.*` chunks consumed by the frontend. |
| **Task Status Sync** | The same service updates `TaskStatusService` so human-facing dashboards stay in sync with orchestration progress. |
| **Webhooks** | If `ORCHESTRATION_PROGRESS_WEBHOOK_URL` is set, lifecycle events POST structured payloads for external subscribers. |
| **Prometheus Metrics** | `OrchestrationMetricsService` exports counters + histograms (`orchestration_runs_total`, `orchestration_run_duration_seconds`, etc.) at `GET /metrics`. |
| **Structured Metadata** | Runs and steps store runtime metadata (cache info, retries, concurrency source) to power dashboards and audits. |

---

## 7. Configuration Surface

| Variable | Purpose | Default |
| --- | --- | --- |
| `ORCHESTRATION_DEFAULT_MAX_PARALLEL` | Fallback per-run concurrency when definition omits it. | `null` → sequential (`1`). |
| `ORCHESTRATION_MAX_CONCURRENCY` | Global concurrency cap (overrides default when set). | unset. |
| `ORCHESTRATION_PROGRESS_WEBHOOK_URL` | Optional webhook target for lifecycle notifications. | unset. |
| `ORCHESTRATION_CACHE_MAX_DEFINITIONS` | (Coming soon) override for definition cache size; default 200 inside `OrchestrationCacheService`. | internal constant. |
| `ORCHESTRATION_CACHE_MAX_STEP_OUTPUTS` | Override for step output cache size; default 2,000 entries. | internal constant. |

Operational notes:
- All caches live in-memory inside API instances; horizontal scaling requires external cache if cross-node reuse is required.
- Metrics controller is registered in `agent-platform.module.ts` and should be guarded at ingress (no auth by design).
- Long-running steps rely on external agents respecting timeouts; orchestrator records the duration regardless of agent runtime.

---

## 8. Extensibility Checklist

When extending the orchestration engine:
- Update `OrchestrationDefinitionService` validation to cover new schema fields.
- Surface new metadata in `OrchestrationRunFactoryService` so dashboards + operators can observe it.
- Emit events through `OrchestrationEventsService` for any new lifecycle transitions.
- Document new APIs or payloads in this guide so downstream teams can adopt changes confidently.

This architecture delivers deterministic orchestration runs, transparent state management, and the hooks required for production-grade monitoring and control. The accompanying guides drill into API contracts, definition authoring, and operational best practices.
