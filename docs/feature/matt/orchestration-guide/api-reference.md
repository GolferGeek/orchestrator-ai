# Orchestration API Reference

The orchestration surface area combines REST endpoints, streaming channels, and Prometheus telemetry. All routes are served by the NestJS API (`apps/api`) and adopt the shared response envelope:

```jsonc
{ "success": true, "data": { /* payload */ } }
```

- **Authentication**: `Authorization: Bearer <token>` must be supplied for every `/api/orchestrations/**` route. Guards reuse the standard platform JWT pipeline.
- **Rate limiting**: Apply gateway-level throttles (recommended baseline: 30 requests/sec per organization) to protect orchestration control surfaces.
- **Versioning**: Routes sit under `/api` and are backward compatible with existing UI integrations. Breaking changes require a new version prefix.

---

## 1. Dashboard & Run Management

### `GET /api/orchestrations`
Lists orchestration runs with pagination and filters.

| Query | Type | Description |
| --- | --- | --- |
| `lifecycle` | `active` \| `completed` \| `all` (default `active`) | Groups statuses into “active” (planning, running, checkpoint) vs “completed” (completed, failed, aborted). |
| `definitionId` | `string` | Restrict to a specific saved orchestration definition. |
| `parentRunId` | `string` | Fetch child runs belonging to a parent. |
| `organizationSlug` | `string` | Scope to an organization. |
| `search` | `string` | Case-insensitive match against `id`, `name`, `slug`. |
| `limit` | `1-100` (default `25`) | Page size. |
| `offset` | `>=0` (default `0`) | Offset for pagination. |
| `startedAfter` / `startedBefore` | ISO-8601 datetime | Timebox results by `started_at`. |

Response payload `data.items[]` mirrors `OrchestrationDashboardService.getRuns` and includes summary stats, pending approvals, and latest checkpoint metadata.

### `GET /api/orchestrations/:runId`
Returns full run detail including:
- Run metadata & lifecycle timestamps
- Ordered step snapshots (status, attempts, cache metadata, deliverables)
- Pending approvals with payload diffs
- Parent/child orchestration context

### `GET /api/orchestrations/:runId/status`
Lightweight status view used by the UI polling loop. Delegates to `OrchestrationStatusService.getRunStatus` and contains `run`, `steps`, `currentStep`, `pendingApprovals`, and a summarized `summary` block.

### `GET /api/orchestrations/:runId/replay`
Prepares replay context for rerunning or cloning an orchestration. Includes definition metadata, parameter payload, originating conversation/task data, and delivered results.

---

## 2. Approval Workflow

### `GET /api/orchestrations/approvals`
Lists checkpoint approvals awaiting action.

| Query | Type | Description |
| --- | --- | --- |
| `status` | `pending` \| `approved` \| `rejected` (default `all`) | Filter by decision state. |
| `organizationSlug` | `string` | Scope to org. |
| `sortDirection` | `asc` \| `desc` (default `desc`) | Sort by creation time. |
| `limit` / `offset` | Pagination controls | Same semantics as run listing. |

Each item includes run summary fields so the dashboard can render approval cards without additional fetches.

### `POST /api/orchestrations/approvals/:approvalId/decision`
Resolves a checkpoint via `OrchestrationCheckpointService`.

Body:
```jsonc
{
  "decision": "continue",      // also "retry" or "abort"
  "notes": "Looks good, proceed.",
  "modifications": {
    "parameters": { "grouping": "week" }
  }
}
```

Response returns the updated approval object and latest run snapshot.

---

## 3. Manual Recovery & Operator Controls

Operators may retry, skip, or abort failed runs through the dashboard. These actions share audit trails and rely on `OrchestrationExecutionService` to mutate state safely.

### `POST /api/orchestrations/:runId/actions/retry`
Queues a retry for the last failed step (or supplied `stepRecordId`).

Body fields (all optional):
```jsonc
{
  "stepRecordId": "step_rec_123",
  "delaySeconds": 30,                     // 0-600
  "modifications": { "payload": { /* deep merge */ } },
  "note": "Retry with more conservative query"
}
```

### `POST /api/orchestrations/:runId/actions/skip`
Marks the current failed step as completed and optionally supplies replacement output.

```jsonc
{
  "stepRecordId": "step_rec_123",
  "note": "Accept prior deliverable",
  "replacementOutput": {
    "content": "Manual summary inserted by reviewer"
  }
}
```

### `POST /api/orchestrations/:runId/actions/abort`
Terminates the run and emits a terminal failure event.

```jsonc
{ "note": "Escalated to human finance review" }
```

All responses return refreshed run summaries so UIs can update immediately.

---

## 4. Streaming Interfaces

### SSE / WebSocket Stream
- The existing agent event channel (`agent.stream.*`) is reused for orchestration progress.
- `OrchestrationProgressEventsService` emits partial chunks with a JSON payload:

```jsonc
{
  "type": "orchestration.step.completed",
  "timestamp": "2025-10-12T22:05:00Z",
  "run": { "id": "run_01HF...", "stats": { "progressPercentage": 50 }, ... },
  "data": {
    "step": { "id": "review-query-results", "status": "completed" }
  }
}
```

- Terminal events translate into either `agent.stream.complete` or `agent.stream.error`, allowing the UI to close out runs gracefully.

### Task Status Synchronization
- When runs originate from a task (`TaskStatusService`), progress updates automatically propagate to the human task dashboard with consistent statuses (`running`, `failed`, `completed`).

### Webhook Notifications
- If `ORCHESTRATION_PROGRESS_WEBHOOK_URL` is configured, every lifecycle event issues an HTTP `POST` with `{ event, runId, data }`. Use this for Slack/Teams alerts or downstream automation.

---

## 5. Metrics Endpoint

### `GET /metrics`
- Controller: `apps/api/src/agent-platform/controllers/metrics.controller.ts`
- Content-Type: `text/plain; version=0.0.4`
- No authentication (protect at ingress or service mesh).

Exported metrics (see `OrchestrationMetricsService`):

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `orchestration_runs_total` | `counter` | `definition`, `status` (`started`, `completed`, `failed`, `aborted`) | Lifecycle counts per definition. |
| `orchestration_run_duration_seconds` | `histogram` | `definition`, `status` | Run duration from `started_at` to terminal timestamp. |
| `orchestration_step_duration_seconds` | `histogram` | `definition`, `step`, `status` | Execution runtime per step. |
| `orchestration_step_queue_seconds` | `histogram` | `definition`, `step` | Time spent queued before execution starts. |

Dashboards: pair these metrics with PromQL queries in `docs/feature/matt/observability.md`. Load testing scenarios live in `scripts/perf/orchestration-load-test.yaml`.

---

## 6. Error Semantics

- All orchestration APIs emit HTTP problem details when errors occur. Common cases:
  - `400 Bad Request`: invalid step ID, incompatible action for run status, schema validation failure.
  - `404 Not Found`: run or approval does not exist within organization scope.
  - `409 Conflict`: concurrent mutation detected (retry the request).
  - `429 Too Many Requests`: upstream rate limiting triggered.
- Error bodies adopt `{ success: false, error: { code, message, details? } }`. Surface these messages to operators for quicker triage.

---

## 7. Deprecations & Change Control

- The previous standalone doc `docs/feature/matt/orchestration-ui-api-reference.md` now points to this consolidated guide.
- Breaking API changes require:
  1. ADR documenting the change.
  2. Update to this reference with migration guidance.
  3. Coordination with Claude for regression test updates.
  4. Communication blast to frontend + operator stakeholders.

Keep this document current whenever endpoints evolve so the orchestration platform remains discoverable and reliable for all consumers.
