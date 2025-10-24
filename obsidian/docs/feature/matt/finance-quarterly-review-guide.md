# Finance Quarterly Review Orchestration

## Overview
`finance-quarterly-review` is a Phase 6 orchestration owned by the `finance-manager` agent. It executes the `kpi-tracking` orchestration as a child run, then composes an executive summary using the aggregated KPI results.

- **Orchestration definition:** `finance-quarterly-review`
- **Owning agent:** `finance-manager`
- **Supabase seed migration:** `202510140020_seed_phase6_finance_quarterly_review_orchestration.sql`
- **Definition payload:** `docs/feature/matt/payloads/orchestrations/finance-quarterly-review.yaml`

## Parameters
| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `kpi_names` | `string[]` | Yes | — | KPI identifiers to route into the child orchestration. |
| `start_date` | `date` | Yes | — | Start of the KPI window (`YYYY-MM-DD`). |
| `end_date` | `date` | Yes | — | End of the KPI window (`YYYY-MM-DD`). |
| `grouping` | `string` | No | `month` | Aggregation interval passed to the child run (`day`, `week`, `month`). |

## Steps
1. **Execute KPI Tracking (`type: orchestration`)**
   - Launches `kpi-tracking` via the same `finance-manager` orchestrator.
   - Passes the parent parameters through to the child run.
   - Inherits the parent conversation so checkpoint prompts surface in the same channel.
   - The step output exposes:
     - `steps.run-kpi-tracking.status`
     - `steps.run-kpi-tracking.results` (full child step map)
     - `steps.run-kpi-tracking.results.summarize-results.summary` (executive text)
2. **Prepare Executive Brief (`summarizer`, BUILD)**
   - Consumes the child run `results` map and crafts an executive-ready summary.
   - Output mapping exposes `steps.prepare-executive-brief.executive_summary` and `summary_deliverable_id`.

## Child Run Aggregation
When the child orchestration completes, the step executor stores a structured payload on the parent step:

```json
{
  "orchestrationRunId": "child-run-id",
  "status": "completed",
  "results": {
    "fetch-kpi-data": { "...": "..." },
    "summarize-results": { "summary": "..." }
  },
  "parameters": { "...": "..." },
  "completedSteps": ["fetch-kpi-data", "summarize-results"],
  "timings": {
    "startedAt": "2025-10-13T07:40:00Z",
    "completedAt": "2025-10-13T07:45:00Z"
  }
}
```

Downstream steps can interpolate the aggregated structure via `{{ steps.run-kpi-tracking.results }}` and related helpers.
