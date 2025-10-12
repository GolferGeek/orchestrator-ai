# Orchestration Observability

Phase 9 adds first-class instrumentation for the orchestration engine so operators can monitor throughput, latency, and queue health in real time.

## Prometheus Endpoint

- **Route:** `GET /metrics`
- **Content-Type:** `text/plain; version=0.0.4`
- **Authentication:** none (lock down via network policy / ingress)

The endpoint surfaces the orchestrator-specific metrics below in addition to Node.js runtime metrics (via `prom-client`'s default collectors).

## Metric Suite

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `orchestration_runs_total` | `counter` | `definition`, `status` (`started`, `completed`, `failed`, `aborted`) | Total runs per terminal state. `definition` resolves to `<owner>/<name>@<version>` when available. |
| `orchestration_run_duration_seconds` | `histogram` | `definition`, `status` | Wall-clock runtime from `started_at` → `completed_at` (or failure/abort timestamp). |
| `orchestration_step_duration_seconds` | `histogram` | `definition`, `step`, `status` (`completed`, `failed`) | Active execution time for each step. |
| `orchestration_step_queue_seconds` | `histogram` | `definition`, `step` | Time between step being queued and entering the running state. Useful for spotting backlog pressure. |

> **Note:** Histograms are pre-bucketed (see `apps/api/src/agent-platform/services/orchestration-metrics.service.ts` for bucket definitions). Adjust buckets in a follow-up if we need finer granularity.

### Sample PromQL Queries

```promql
# P95 orchestration run duration (seconds) over 5m window
histogram_quantile(
  0.95,
  sum(rate(orchestration_run_duration_seconds_bucket[5m])) by (le, definition)
)

# Mean step execution time by step id
sum(rate(orchestration_step_duration_seconds_sum[5m])) by (definition, step)
/
sum(rate(orchestration_step_duration_seconds_count[5m])) by (definition, step)

# Queue latency alert: >5s queue time across any step
sum(rate(orchestration_step_queue_seconds_sum[5m])) by (definition, step)
/
sum(rate(orchestration_step_queue_seconds_count[5m])) by (definition, step)
> 5
```

## Configuration Summary

| Variable | Purpose | Default |
| --- | --- | --- |
| `ORCHESTRATION_DEFAULT_MAX_PARALLEL` | Fallback parallelism per run when definition omits `execution.concurrency.maxParallel`. | `1` (sequential) |
| `ORCHESTRATION_MAX_CONCURRENCY` | Optional global override (takes precedence over default) | unset |

Set one of the variables above in deployment environments to raise baseline concurrency without editing every definition.

## Next Steps

- Graph key dashboards in Grafana (run throughput, queue latency, failure rate).
- Wire alerting on `orchestration_runs_total{status="failed"}` and queue latency.
- Feed metrics into autoscaling decisions once worker pool can scale.

## Load Testing Support

- Artillery scenario: `scripts/perf/orchestration-load-test.yaml`
  - Configure `API_BASE`, `API_TOKEN`, and orchestration parameters via environment variables.
  - Executes multiple orchestration launches in parallel and polls status to surface queue pressure in metrics dashboards.
