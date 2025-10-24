# ADR-005: Deliverable Mapping Strategy for Orchestration Steps

## Status
Proposed – Phase 5 implementation guidance (2025-10-12)

## Context
- Orchestration steps run arbitrary agents (tool, context, function, etc.) and obtain heterogeneous `TaskResponsePayload` structures.
- Downstream steps reference upstream data via templates like `{{ steps.fetch-kpi-data.query_results }}`. We need a deterministic way to translate agent payloads into named fields stored in `orchestration_steps.output` and `orchestration_runs.results`.
- Checkpoints and observability require us to preserve the raw agent payload (for debugging) while exposing a normalized projection to the orchestration engine.
- Phase 5 introduces the `kpi-tracking` orchestration where step 1 (Supabase agent) must hand structured query results to step 2 (Summarizer). The PRD and YAML definition rely on `output_mapping` entries to express these projections.

## Decision
1. **Introduce an explicit mapping layer**
   - Add an `OrchestrationOutputMapper` service that accepts the raw `TaskResponsePayload` plus the step’s `output_mapping` configuration.
   - Mapping entries are simple JSONPath-like expressions evaluated against the payload root (`$` points to the payload object). We support dot notation and array indices: `$.content.deliverable.content`, `$.metadata.results[0].value`.
   - Non-string mapping values are treated as literals (copied verbatim).
   - Missing or invalid paths resolve to `null` (never throw).

2. **Default behaviour**
   - If a step omits `output_mapping`, the mapper stores `{ content: payload.content, metadata: payload.metadata }`.
   - If a mapping produces an object or array, the value is injected without stringification so downstream steps can consume structured data.

3. **Persisted data contract**
   - `orchestration_steps.output` = mapped object (keys defined by mapping or defaults).
   - `orchestration_runs.results[stepId]` mirrors the same mapped object to power `{{ steps.* }}` substitutions.
   - `orchestration_steps.metadata.runtime` keeps diagnostic context:
     - `rawResponse` – trimmed raw payload (content + metadata + top-level deliverable IDs if present).
     - `resolvedInput` – final arguments sent to the agent after placeholder substitution.
     - `mappingRules` – the evaluated `output_mapping`.

4. **Deliverable linkage**
   - Mapper inspects the payload for deliverable identifiers:
     - Primary source: `payload.deliverables[0]`.
     - Fallback: `payload.content.deliverable`.
   - The executor updates `orchestration_steps.deliverable_id` (and exposes `deliverableId` inside the mapped output) when present so TaskStatus/SSE streams can reference saved assets.

5. **Downstream template resolution**
   - We resolve `{{ steps.step-id.field.subfield }}` placeholders via the merged results map (post-mapping).
   - Placeholders that appear alone in a string become the raw value (object/array allowed). Interpolated strings fall back to textual substitution.
   - Missing values resolve to an empty string for interpolated text or `null` for standalone placeholders to keep templating predictable.

6. **Failure handling**
   - Mapping errors never abort the step. We log a warning, persist `null`, and continue.
   - The executor still records the raw payload for debugging.

## Consequences
- Downstream steps get stable, typed data sourced from upstream agents.
- Checkpoint reviewers can inspect both the raw agent payload and the mapped fields.
- Definition authors only need to supply JSONPath-style expressions—no custom code.
- We centralize mapping logic, making it testable and extensible (e.g., future functions like `coalesce()` can live here).

## Implementation Notes
- Add `OrchestrationOutputMapper` under `apps/api/src/agent-platform/services`.
- Step executor will:
  1. Resolve step input placeholders using `orchestration_runs.results`.
  2. Invoke the agent through the existing `AgentExecutionGateway`.
  3. Use the mapper to project the payload.
  4. Update step + run records with mapped output, raw payload, deliverable reference, and run metadata.
  5. Trigger checkpoints (when configured) before queueing subsequent steps.
- JSONPath evaluation is intentionally small-scope: dot + array index support implemented in-house to avoid new dependencies during Phase 5.
