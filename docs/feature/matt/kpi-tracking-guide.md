# KPI Tracking Orchestration Guide

## Overview
The KPI Tracking orchestration coordinates a two-step workflow owned by the `finance-manager` orchestrator agent. It fetches KPI data from Supabase via the `supabase-agent`, pauses for an optional human checkpoint, and then routes the results to the `summarizer` agent for executive-ready insights.

- **Orchestration definition:** `kpi-tracking`
- **Owning agent:** `finance-manager`
- **Supabase seed migration:** `202510140010_seed_phase5_kpi_tracking_orchestration.sql`
- **Definition payload:** `docs/feature/matt/payloads/orchestrations/kpi-tracking.yaml`

## Sub-Orchestration Usage

Phase 6 introduces the `finance-quarterly-review` orchestration, which invokes `kpi-tracking` as a child run. The parent step receives a structured output with the child `status`, full `results`, and timing metadata so downstream steps can summarize or audit the KPI workflow.

```yaml
- id: run-kpi-tracking
  type: orchestration
  agent: finance-manager
  orchestration:
    name: kpi-tracking
    version: 1.0.0
    parameters:
      kpi_names: "{{ parameters.kpi_names }}"
      start_date: "{{ parameters.start_date }}"
      end_date: "{{ parameters.end_date }}"
      grouping: "{{ parameters.grouping }}"

- id: prepare-executive-brief
  agent: summarizer
  depends_on:
    - run-kpi-tracking
  input:
    context:
      summary: "{{ steps.run-kpi-tracking.results.summarize-results.summary }}"
      childStatus: "{{ steps.run-kpi-tracking.status }}"
      rawResults: "{{ steps.run-kpi-tracking.results }}"
```

Child outputs follow this shape:

- `status` – final disposition (`completed`, `failed`, `checkpoint`, etc.)
- `results` – mapped outputs for each child step (e.g., `fetch-kpi-data`, `summarize-results`)
- `parameters` / `plan` / `completedSteps` – useful for audit trails and secondary summarization

## Parameters
| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `kpi_names` | `string[]` | Yes | — | List of KPI identifiers to query (e.g. `['revenue', 'expenses']`). |
| `start_date` | `date` | Yes | — | Beginning of the reporting window (`YYYY-MM-DD`). |
| `end_date` | `date` | Yes | — | End of the reporting window (`YYYY-MM-DD`). |
| `grouping` | `string` | No | `day` | Aggregation interval (`day`, `week`, or `month`). |

## Step-by-step Execution
1. **Fetch KPI Data (`supabase-agent`, BUILD)**
   - Builds dynamic SQL via MCP tools, executes the query, and stores results as a deliverable (`analysis` / JSON).
   - Output mapping exposes:
     - `steps.fetch-kpi-data.query_results` → deliverable content (JSON string)
     - `steps.fetch-kpi-data.sql` → generated SQL
     - `steps.fetch-kpi-data.row_count` → row count from deliverable metadata
   - **Checkpoint:** “Review KPI query results before summarizing?” (continue / retry with modifications / abort).
2. **Summarize Results (`summarizer`, BUILD)**
   - Receives the data, SQL, and KPI names in `context`.
  - Produces a summary deliverable and maps:
     - `steps.summarize-results.summary` → summary content (Markdown)
     - `steps.summarize-results.summary_deliverable_id` → deliverable id for downstream consumers

## Human Checkpoint
- When the checkpoint is triggered, the run enters `checkpoint` status and the step executor pauses.
- Decisions:
  - **Continue:** resumes with the existing data.
  - **Retry (optional modifications):** supply updates under `modifications` (same shape as the step input) to tweak query parameters before re-running step 1.
  - **Abort:** terminates the run.
- Decisions can be submitted via the `ORCHESTRATOR_RUN_HUMAN_RESPONSE` mode on the `finance-manager` agent or the generic orchestration approval endpoint.

## API Usage
### Launching from Agent-to-Agent REST
```http
POST /agent-to-agent/global/finance-manager/tasks
Content-Type: application/json
Authorization: Bearer <access-token>

{
  "mode": "build",
  "payload": {
    "orchestration": {
      "name": "kpi-tracking"
    },
    "promptParameters": {
      "kpi_names": ["revenue", "expenses", "profit_margin"],
      "start_date": "2024-07-01",
      "end_date": "2024-09-30",
      "grouping": "month"
    }
  }
}
```
The response includes `content.steps` and `content.readySteps`. The orchestrator step executor now proceeds automatically; monitor progress via SSE (`/status/stream`) or webhook callbacks.

### Responding to a Checkpoint
```http
POST /agent-to-agent/global/finance-manager/tasks
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "mode": "orchestrator_run_human_response",
  "payload": {
    "approvalId": "<approval-id>",
    "decision": "retry",
    "notes": "Filter to ARR only",
    "modifications": {
      "grouping": "week",
      "context": {
        "kpiNames": ["arr", "churn"]
      }
    }
  }
}
```
A `continue` decision omits `modifications`; an `abort` stops the run immediately.

## Outputs and Deliverables
- Step results are available under `orchestration_runs.results`:
  - `steps.fetch-kpi-data.query_results` (JSON string)
  - `steps.fetch-kpi-data.sql`
  - `steps.fetch-kpi-data.row_count`
  - `steps.summarize-results.summary`
  - `steps.summarize-results.summary_deliverable_id`
- Step metadata (`orchestration_steps.metadata.runtime`) stores the resolved input and a snapshot of the raw agent response for debugging.
- Deliverables are persisted via existing DeliverablesService:
  - Fetch step → analysis deliverable (JSON)
  - Summary step → Markdown summary deliverable (`summary_deliverable_id` maps to record id)

## Monitoring & Retry Behavior
- Automatic orchestration events (`orchestration.step.*`, `orchestration.run.*`) include run stats and current state.
- On failure, `orchestration.step_failed` is emitted and the run transitions to `failed`.
- Retry attempts increment `attempt_number` and reuse the stored input (plus any checkpoint modifications).

## Notes for Testers (Claude)
- Validate that `steps.fetch-kpi-data.query_results` deserializes into actionable JSON for the summarizer.
- Exercise the checkpoint retry path with modifications and confirm the executor replays step 1 with updated parameters.
- Ensure deliverable linkage (`summary_deliverable_id`) matches the saved record for post-run consumption.
