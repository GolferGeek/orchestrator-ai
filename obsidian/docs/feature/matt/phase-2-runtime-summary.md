# Phase 2 — Runtime Summary

Status: Completed (ready to transition to Phase 3)

## Scope
- Database-backed agent runtime (A2A) for converse/plan/build
- API/External transports with minimal prompt body, transforms, retries
- Strict A2A surface (card, tasks, health)
- Registry cache invalidation + basic observability
- Secret-safe logging and standardized failure payloads

## Flow (A2A)
1. Client → `POST /agent-to-agent/:org/:agent/tasks`
2. AgentExecutionGateway
   - Capability/human-gate enforcement
   - Plan mode handled centrally (no placeholder in mode router)
3. AgentModeRouter
   - Builds prompt payload
   - Dispatches LLM/API/External via runtime services
4. Transports
   - API: prompt-only body (or request_transform template), response_transform extraction
   - External (A2A): JSON-RPC with result unwrap
   - Retries + timeouts (env + YAML), header allowlist, secret redaction
5. Observability
   - Safe logs (host, path, status, duration)
   - In-memory metrics (totals/failures/latencies) — card metadata private-only (feature-flagged)

## Environment Controls
- Header allowlist: `AGENT_EXTERNAL_HEADER_ALLOWLIST`
- Default timeouts: `AGENT_API_DEFAULT_TIMEOUT_MS`, `AGENT_EXTERNAL_DEFAULT_TIMEOUT_MS`
- Registry poll: `AGENT_REGISTRY_POLL_INTERVAL_MS`
- Card private metrics feature flag: `AGENT_CARD_INCLUDE_PRIVATE_METRICS`
- Legacy timeout fallback: `AGENT_TASK_TIMEOUT_SECONDS`

## Backward Compatibility
- Legacy `DynamicAgentsController` remains:
  - Secret-safe logs
  - Standardized failure payloads (HTTP 200 per legacy contract)
  - Timeout fallback using `AGENT_TASK_TIMEOUT_SECONDS` if card omits it

## What’s Ready for Phase 3
- Clean runtime seams for task lifecycle expansion (deliverables, logging)
- Pseudonymization/PII hooks in place (policy checks preserved)
- Ops signals (metrics, logs) for regression tracking

---

See also: `apps/api/docs/external-api-agents-usage.md` for transport usage, transforms, health, and legacy error payloads.
