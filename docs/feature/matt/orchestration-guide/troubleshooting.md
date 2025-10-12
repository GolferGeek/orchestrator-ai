# Orchestration Troubleshooting Playbook

Use this runbook when orchestration runs misbehave in staging or production. Each section lists the symptoms, likely causes, and concrete steps to diagnose and restore service.

---

## 1. Run Stuck in `planning` or `running`

**Symptoms**
- `/api/orchestrations/:runId/status` shows `status: planning` or `running` with no progress updates for >5 minutes.
- SSE stream emits no new `orchestration.step.*` events.

**Checks**
1. Verify queued steps: `OrchestrationExecutionService.startExecution` logs (Nest logger) indicate whether runnable steps were found.
2. Inspect database: query `orchestration_steps` for the run – look for steps still marked `pending` with satisfied dependencies.
3. Review concurrency limits: run metadata `execution.concurrency.maxParallelSteps` might be `0` or `1` when multiple steps require concurrency.

**Resolution**
- If dependencies were misconfigured, update the definition and relaunch (existing run may require abort).
- If concurrency is too low, update definition or environment variables and retry stuck steps.
- For transient queue failures, invoke `POST /api/orchestrations/:runId/actions/retry` to nudge execution.

---

## 2. Checkpoint Approvals Missing From Dashboard

**Symptoms**
- Step metadata indicates `checkpoint_after`, but `/api/orchestrations/approvals` is empty.
- Operators cannot resume orchestration after a checkpoint.

**Checks**
1. Confirm run metadata: the step should have `status: checkpoint_pending` in `orchestration_steps`.
2. Verify `human_approvals` table contains a row for the step’s `conversation_id`.
3. Inspect logs from `OrchestrationCheckpointService` for errors when creating approvals.

**Resolution**
- If approval row exists but API omits it, ensure the viewing user shares the same `organizationSlug`.
- If the approval row is missing, manually create one (only in staging) or retry the step to trigger checkpoint creation.
- Double-check that the orchestrator agent’s continue payload includes `approvalId` when resuming.

---

## 3. Sub-Orchestration Failures

**Symptoms**
- Parent run shows step failure with `type: orchestration.child.failed`.
- Child run is `failed` or `aborted`, but parent run remains `running`.

**Checks**
1. Fetch child run detail to view underlying error (`GET /api/orchestrations/:childRunId`).
2. Confirm parent run metadata includes `runtime.subOrchestration.childRunId`.
3. Ensure the child orchestrator definition is `active` and owned by the expected agent.

**Resolution**
- Use manual recovery on the parent (`retry` or `skip`) after addressing the child failure.
- If the child definition was unpublished, re-activate it and invoke parent `retry`.
- For systemic issues, run the child orchestration independently to reproduce and debug.

---

## 4. Agent Invocation Errors (A2A Transport)

**Symptoms**
- Step fails instantly with `agent_execution_error`.
- Error message shows “Agent not found” or policy violations.

**Checks**
1. Confirm agent slug exists via `AgentRegistryService` (`GET /api/admin/agents/:slug` if available).
2. Validate routing policy: logs from `RoutingPolicyAdapterService` explain why requests were blocked.
3. Inspect `TaskResponseDto` returned to ensure error codes make sense (e.g., `routing_showstopper`).

**Resolution**
- Update orchestration step to reference the correct agent slug.
- Adjust routing policy configuration if the restriction is intentional but overly strict.
- For policy bypass while debugging, use manual recovery with `modifications.agentOverrides` (if available) to test alternative agents.

---

## 5. Performance Regressions & Cache Misses

**Symptoms**
- Metrics show rising `orchestration_step_queue_seconds` or long run durations.
- Operators report repeated recomputation of heavy steps.

**Checks**
1. Review Prometheus histograms (`/metrics`) and Grafana dashboards for trends.
2. Inspect run metadata `execution.caching` to ensure caching is enabled for heavy steps.
3. For specific steps, examine `metadata.runtime.cache` to see cache hit counts and TTLs.

**Resolution**
- Increase concurrency defaults if queue time is high and infrastructure can handle it.
- Enable caching for deterministic steps or extend TTLs.
- Refactor step inputs to reduce fingerprint churn (e.g., sort arrays, remove volatile timestamps).

---

## 6. Webhook or Streaming Gaps

**Symptoms**
- External systems (Slack, PagerDuty) do not receive orchestration notifications.
- SSE connection ends unexpectedly without `complete` or `error` events.

**Checks**
1. Validate `ORCHESTRATION_PROGRESS_WEBHOOK_URL` configuration and target service health.
2. Inspect logs from `OrchestrationProgressEventsService` for HTTP errors when POSTing.
3. Ensure API instance has network access to the webhook endpoint.
4. For SSE, check gateway/proxy idle timeout settings; long runs may exceed defaults.

**Resolution**
- Reconfigure webhook URL or rotate credentials as needed.
- Use exponential backoff or dead-letter queue (future enhancement) if webhook target is unstable.
- Increase proxy idle timeout or switch to WebSocket streaming for long-lived runs.

---

## 7. Manual Recovery Actions Failing

**Symptoms**
- `POST /api/orchestrations/:runId/actions/retry` returns `409 Conflict`.
- Manual skip leaves run in failed state.

**Checks**
1. Ensure the run is still in `failed` status; completed runs reject mutations.
2. Confirm the target step is the last failed step unless `stepRecordId` is supplied.
3. Look at the executor logs; conflicting retries may be in-flight.

**Resolution**
- Wait for existing retries to finish before issuing new ones.
- If the wrong step is being targeted, query `/api/orchestrations/:runId` for the exact `stepRecordId` and retry again.
- As a last resort, abort the run and restart from the start; capture diagnostics before doing so.

Keep this document updated when new failure modes surface. Pair each addition with automated checks (via Claude) wherever feasible.
