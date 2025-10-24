# Orchestration Best Practices

Design orchestrations so they are reliable, observable, and easy for operators to control. The principles below distill lessons from earlier phases and should guide new workflow authoring.

---

## 1. Model the Conversation Flow

- **One step → one conversation.** Ensure each step produces a conversation/task/deliverable trail so operators can inspect agent output history.
- **Name steps intentionally.** Use human-friendly IDs (`review-sql-results`) because they surface in dashboards, metrics labels, and cache diagnostics.
- **Checkpoint early, not late.** Place `checkpoint_after` blocks immediately after high-risk steps (data fetches, external actions) so humans can intervene before cascading failures.

---

## 2. Guard Against Failure

- **Enable retries thoughtfully.** Set `maxAttempts` ≥ 2 for steps that depend on flaky APIs. Combine with `notifyHuman=true` so operators are alerted after auto retries exhaust.
- **Whitelist skip scenarios.** If skipping a step is ever acceptable, set `allowSkip=true` and document the downstream impact in runbooks.
- **Capture failure context.** Populate `input.payload` with enough detail for diagnostics (entity IDs, date ranges). Sanitise sensitive data via agent prompts rather than logging raw secrets.

---

## 3. Balance Parallelism & Ordering

- **Group truly independent steps.** Only raise `execution.concurrency.maxParallel` when steps share no dependencies and external systems can handle the load.
- **Monitor queue depth.** Watch `orchestration_step_queue_seconds` histogram; if P95 ≥ 5s regularly, either increase concurrency or scale worker instances.
- **Avoid fan-out storms.** For loops or large collections use sub-orchestrations that implement batching instead of spawning hundreds of sibling steps.

---

## 4. Use Caching Strategically

- **Cache deterministic outputs.** Enable caching for expensive read-only steps (analytics queries, data normalization) where identical inputs produce identical outputs.
- **Set realistic TTLs.** Short TTL (<10 minutes) for rapidly changing data; longer TTL (hours) for static reports. Remember TTL `null` disables expiration.
- **Expose cache metadata.** Downstream agents can look at `step.metadata.runtime.cache` to understand whether they're using cached inputs—surface this in prompts to avoid stale assumptions.

---

## 5. Operational Excellence

- **Instrument every change.** Update `docs/feature/matt/observability.md` or your team dashboard when adding new metrics so on-call has visibility.
- **Automate runbooks.** Extend `orchestration-guide/troubleshooting.md` with playbooks whenever incidents occur. Keep response steps short and actionable.
- **Protect APIs.** Apply WAF or API gateway rate limiting on `/api/orchestrations/**` endpoints. Manual recovery routes mutate state and must be guarded.
- **Document owners.** Always fill `ownerAgentSlug` and include contact info in the example library entry. Operators need to know who maintains each orchestration.

---

## 6. Change Management

- **Version definitions.** Breaking schema updates require new `version` strings. Communicate deprecations to orchestrator owners.
- **Dry run before merging.** Execute orchestrations in staging using the Artillery scenario (`scripts/perf/orchestration-load-test.yaml`) to detect regressions.
- **Sync with Claude.** Builder delivers implementation; Claude adds tests + verification. Provide doc updates so testers know the intended behaviour.

---

## 7. Security & Compliance Touchpoints

- **Enforce auth scopes.** Orchestrator agents should validate the caller’s organization and role before launching sensitive workflows.
- **Mask sensitive data.** Use redaction utilities when logging prompts/results. Never store API keys inside definitions.
- **Webhook hygiene.** When enabling `ORCHESTRATION_PROGRESS_WEBHOOK_URL`, ensure the receiver validates source IPs or HMAC signatures.

Following these practices keeps orchestrations maintainable and production-ready as the library of workflows grows.
