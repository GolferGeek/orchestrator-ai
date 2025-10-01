# M3.3 — PII/Pseudonymization Integration

Objective
- Apply organization redaction patterns and secret masking to inputs, outputs, logs, and error messages. Preserve policy metadata in responses.

Where Applied
- Dispatch boundary (pre‑LLM/API/External): redact `userMessage` per org policies unless local bypass is set.
- Error/logging: redact secrets (API keys, tokens, Authorization headers) from structured logs and failure envelopes.
- Responses: attach policy metadata (e.g., detection flags, action taken) to `tasks.response_metadata` when available.

Implementation
- Service: `apps/api/src/agent-platform/services/agent-runtime-redaction.service.ts`.
  - Loads org regex patterns via `RedactionPatternsRepository`.
  - Applies patterns to `userMessage` unless local route bypass.
  - Always applies denylist secret masking (e.g., `Bearer ...`, `sk-...`) to errors/logs.
- Allowlist headers for external requests remain controlled via env.

Behavior
- If redaction modifies `userMessage`, the runtime dispatches redacted content; original is not logged.
- Errors returned to clients carry redacted messages; internal logs also mask secrets.
- If policy blocks execution, return a `blocked: true` structure with a human‑safe reason.

Environment
- Header allowlist: `AGENT_EXTERNAL_HEADER_ALLOWLIST` (extend with additional header names).
- Default timeouts: `AGENT_API_DEFAULT_TIMEOUT_MS`, `AGENT_EXTERNAL_DEFAULT_TIMEOUT_MS` (unrelated to redaction but impacts transport behavior).

Acceptance Tests
- PII detection: sample inputs trigger org patterns and produce redacted `userMessage` downstream.
- Secret masking: error messages redact bearer tokens and API keys; logs do not contain secrets.
- Policy metadata: responses include redaction indicators in `response_metadata` when patterns are applied.
- Bypass: when local route bypass is set, org pattern redaction is skipped (denylist masking still applies to logs/errors).

Notes
- Redaction is defense‑in‑depth alongside privacy relay and provider no‑retain/no‑train options; do not rely on a single control.

