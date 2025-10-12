# Orchestration UI API Reference

Updated for **Phase 7 – UI enablement**. These endpoints expose orchestration run data, approval queues, and replay metadata so the frontend can render dashboards and checkpoint workflows. All responses follow the `{ success: boolean, data: any }` envelope pattern used across the platform.

> **Authorization:** Every route requires a valid `Authorization: Bearer <token>` header (Swagger tag: `orchestrations`).

---

## Dashboard Endpoints

### `GET /api/orchestrations`
Lists orchestration runs with pagination and lifecycle filtering.

| Query | Type | Description |
| --- | --- | --- |
| `lifecycle` | `active` \| `completed` \| `all` (default `active`) | Filters status buckets. Active includes `pending`, `planning`, `running`, `checkpoint`. |
| `definitionId` | `string` | Restrict to a specific orchestration definition. |
| `parentRunId` | `string` | Show child runs for the supplied parent id. |
| `organizationSlug` | `string` | Filter by owning organization. |
| `search` | `string` | Case-insensitive match against `id`, `name`, or `slug`. |
| `limit` | `1-100` (default `25`) | Page size. |
| `offset` | `>=0` (default `0`) | Items to skip. |
| `startedAfter` / `startedBefore` | ISO-8601 string | Timebox results by `started_at`. |

**Response:** `data.items` is an array of run summaries:

```jsonc
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "run_01HF...",
        "status": "running",
        "name": "kpi-tracking",
        "definitionId": "def_842",
        "orchestrationSlug": "kpi-tracking",
        "originType": "plan",
        "agent": { "slug": "finance-manager", "displayName": "Finance Manager" },
        "stats": { "totalSteps": 4, "completedSteps": 1, "progressPercentage": 25 },
        "timings": { "createdAt": "...", "startedAt": "...", "completedAt": null },
        "pendingApprovals": 1,
        "latestCheckpoint": {
          "approvalId": "app_01HF...",
          "checkpointId": "review-query-results",
          "requestedAt": "...",
          "stepLabel": "Review KPI query"
        }
      }
    ],
    "total": 38,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  }
}
```

### `GET /api/orchestrations/:runId`
Returns full run detail, including step snapshots, pending approvals, and parent/child run summaries. Response structure matches `OrchestrationDashboardService.getRunDetail`.

### `GET /api/orchestrations/:runId/status`
Existing endpoint now reused by the UI for lightweight polling. Returns the status payload emitted by `OrchestrationStatusService.getRunStatus`, including `run`, `steps`, `currentStep`, `pendingApprovals`, and a `summary` block.

### `GET /api/orchestrations/:runId/replay`
Provides replay metadata so the UI can pre-fill restart flows.

```jsonc
{
  "success": true,
  "data": {
    "runId": "run_01HF...",
    "organizationSlug": "global",
    "conversationId": "conv_913",
    "definition": {
      "id": "def_842",
      "name": "kpi-tracking",
      "displayName": "KPI Tracking",
      "version": "1.0.0",
      "ownerAgentSlug": "finance-manager"
    },
    "agent": { "id": "agt_501", "slug": "finance-manager" },
    "parameters": { "kpi_names": ["revenue", "expenses"] },
    "plan": { "...": "..." },
    "results": { "...": "..." },
    "origin": { "type": "plan", "id": "plan_901", "slug": "kpi-tracking" },
    "timestamps": { "createdAt": "...", "startedAt": "...", "completedAt": "..." }
  }
}
```

---

## Approval Management

### `GET /api/orchestrations/approvals`
Returns paginated checkpoint approvals with run context.

| Query | Type | Description |
| --- | --- | --- |
| `status` | `pending` \| `approved` \| `rejected` | Filter by disposition (default: all). |
| `organizationSlug` | `string` | Restrict to a specific organization. |
| `sortDirection` | `asc` \| `desc` (default `desc`) | Order by `created_at`. |
| `limit` | `1-200` (default `50`) | Page size. |
| `offset` | `>=0` (default `0`) | Pagination offset. |

Each item in `data.items` bundles the approval view plus a run summary so the UI can render context without additional round-trips.

### `POST /api/orchestrations/approvals/:approvalId/decision`
Resolves an orchestration checkpoint via `OrchestrationCheckpointService`.

**Body:**

```jsonc
{
  "decision": "continue",      // or "retry" / "abort"
  "notes": "Looks good, proceed.",
  "modifications": {
    "parameters": { "grouping": "week" }
  }
}
```

The actor is resolved from the authenticated user (`req.user.sub` fallback chain). Response contains the updated approval plus the latest run summary so the UI can refresh state immediately.

---

## Implementation References

- Service orchestration: `apps/api/src/agent-platform/services/orchestration-dashboard.service.ts`
- Repository extensions: `orchestration-runs.repository.ts`, `human-approvals.repository.ts`
- Controller & DTOs: `orchestrations.controller.ts`, `dto/orchestrations.dto.ts`
- Swagger tag: `orchestrations` (see `apps/api/src/main.ts`)

The SSE bridge added in Phase 3 (`OrchestrationProgressEventsService`) continues to stream real-time updates on the existing `agent.stream.*` channel; pair the new REST APIs with that stream for live dashboards.
