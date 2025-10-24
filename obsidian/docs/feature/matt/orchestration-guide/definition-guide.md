# Orchestration Definition Guide

Authoring orchestration definitions is the fastest way to ship reusable workflows. This guide documents the schema consumed by `OrchestrationDefinitionService`, how metadata influences execution, and best practices for versioning.

Definitions are stored as JSON/YAML blobs in Supabase (`orchestration_definitions` table) and can also be committed to the repo under `docs/feature/matt/payloads/orchestrations/` for reference.

---

## 1. Top-Level Structure

```yaml
orchestration:
  name: marketing-campaign-launch
  display_name: "Marketing Campaign Launch"
  description: "Plan + execute a multi-channel campaign"
  version: "1.1.0"
  parameters:
    - key: campaign_name
      type: string
      required: true
      description: Friendly label used in dashboards.
    - key: launch_date
      type: string
      format: date
  steps:
    - id: research-brief
      type: agent
      agent: marketing-researcher
      mode: BUILD
      input:
        payload:
          instructions: "Compile audience insights"
      checkpoint_after:
        reason: "Review insights before creative brief"
    - id: creative-brief
      depends_on: [research-brief]
      type: agent
      agent: marketing-strategist
      mode: BUILD
    - id: launch-orchestration
      depends_on: [creative-brief]
      type: orchestration
      orchestration:
        name: content-pipeline
        owner: marketing-manager
  execution:
    concurrency:
      maxParallel: 2
      queueStrategy: fifo
    caching:
      enabled: true
      ttlSeconds: 1800
      steps:
        - id: research-brief
          ttlSeconds: 86400
  error_handling:
    on_step_failure:
      maxAttempts: 3
      initialDelayMs: 2000
      backoffMultiplier: 2
      allowSkip: true
      notifyHuman: true
    rollback:
      reversible: true
      description: "Ensure CRM state is restored if campaign launch fails."
```

The orchestration engine normalizes the document before storing it, ensuring IDs exist and modes are uppercase.

---

## 2. Parameters

- `parameters` is an array describing user-supplied values passed to the orchestration at runtime.
- Each item supports the fields:
  - `key` (string, required)
  - `type` (string, optional hint; not enforced yet)
  - `required` (boolean, default `false`)
  - `description` (string, optional)
  - `default` (any)
- The run factory persists `parameters` in run metadata, and the step executor passes the resolved values through to agent payload templates.
- Document parameter expectations in the example library so operators know how to invoke orchestrations safely.

---

## 3. Step Configuration

### Common Fields
| Field | Description |
| --- | --- |
| `id` | Unique identifier per step. Auto-generated as `step_{index}` if omitted. |
| `type` | `agent` (default) or `orchestration` (for nested runs). |
| `mode` | Agent task mode: `BUILD`, `CONVERSE`, `PLAN`, `ORCHESTRATION`. Defaults to `BUILD`. |
| `depends_on` | Array of `id`s this step waits for; used to construct DAG dependencies. |
| `input.payload` | Arbitrary JSON merged into the agent payload before execution. |
| `input.user_message` | Optional string used when generating conversation tasks. |
| `checkpoint_after` | Declares a human checkpoint after the step completes (`reason`, `severity`, `autoTimeout` fields supported). |

### Agent Steps
- Provide `agent` with the agent slug to invoke.
- Optional `organization` overrides allow cross-org execution (rare; prefer orchestrator ownership).
- The executor provisions a conversation per step to reuse existing deliverable infrastructure.

### Sub-Orchestration Steps
- Set `type: orchestration`.
- Provide `orchestration.name` and optionally `orchestration.version`. If omitted, the latest active version is loaded.
- `orchestration.owner` may override the agent slug that owns the target orchestration; defaults to the parent orchestration owner.
- `agent` is still allowed and wins over `orchestration.owner` (handy when delegating to a manager agent that already owns the orchestration).

---

## 4. Execution Policies

### Concurrency
- `execution.concurrency.maxParallel` defines the maximum number of steps that may run simultaneously.
- `queueStrategy` currently supports `fifo` (default). Future strategies (priority, LIFO) can be introduced without breaking the schema.
- If omitted, the platform falls back to environment defaults (see architecture guide).

### Caching
- `execution.caching.enabled` toggles the step output cache. When true the executor will:
  1. Compute a deterministic hash of the step input payload.
  2. Return a cached output (including deliverable references) if available.
  3. Store new outputs with TTL controls.
- `ttlSeconds` applies globally; `steps[]` can override per step or toggle caching for only a subset of steps.

### Error Handling
- `error_handling.on_step_failure` mirrors the retry/backoff metadata captured in `OrchestrationRunFactoryService`.
- Supported fields: `maxAttempts`, `retryCount` (alias), `initialDelayMs|Seconds`, `backoffMultiplier`, `maxDelayMs|Seconds`, `strategy` (`exponential`, `linear`), `notifyHuman`, `allowSkip`.
- The executor uses this metadata to schedule automatic retries. When max attempts are exhausted the run transitions to `failed`, and manual recovery APIs become available.
- `error_handling.rollback` documents whether the orchestration supports operator-driven rollback. Metadata is surfaced in run summaries for human guidance.

---

## 5. Metadata & Runtime Enrichment

- **Plan Snapshot**: Run metadata captures a normalized `plan` (id + agent + type for each step) for dashboards.
- **Execution Metadata**: The run factory stores concurrency/caching info so operators understand the active policies.
- **Task Linkage**: When orchestrations are spawned from a task, `metadata.task` holds `id`/`userId` for TaskStatus synchronization.
- **Request Metadata**: Caller-provided `requestMetadata` is merged into run metadata (audit purposes).

---

## 6. Versioning & Lifecycle

1. **Draft Locally**: Create/update YAML under `docs/feature/matt/payloads/orchestrations/`. Include a changelog at the top of the file.
2. **Validate**: Use `OrchestrationDefinitionService.validateDefinition` by invoking the Nest provider (Claude will supply automated tests).
3. **Publish**: Upsert via Admin tooling or Supabase migration. Record `version`, `display_name`, and `description`.
4. **Activate**: Mark the definition status as `active` through the repository/service.
5. **Deprecate**: Update `status` to `archived` or remove references; existing runs retain their definition snapshot.

> **Tip:** Keep versions semantic (`major.minor.patch`). Breaking changes (step IDs, parameter shape) warrant a new major version. Non-breaking tweaks (copy, TTL adjustments) can use minor/patch bumps.

---

## 7. Testing Hooks (Builder Guidance Only)

- Claude owns automated validation, but builders should structure definitions so they are deterministic:
  - Parameter defaults must be immutable.
  - Avoid referencing dynamic secrets directly; rely on agent/service configurations.
  - Always define stable step IDs so retries, checkpoints, and caching remain predictable.

---

## 8. Reference Implementations

The Phase 10 example library (see `examples.md`) contains ready-to-run definitions for finance, marketing, and content workflows. Use them as templates when crafting new orchestrations:

- Finance KPI tracking & quarterly review (multi-step, sequential)
- Marketing campaign launch (parallel creative lanes)
- Content pipeline (sub-orchestration + caching)

When adding new definitions, update both the Supabase seed/migration (if required) and the documentation catalog so operators know what is available.
