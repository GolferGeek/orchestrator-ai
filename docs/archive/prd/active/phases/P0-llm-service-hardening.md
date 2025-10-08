### Phase 0: Central LLM Service Hardening (P0)

Scope: enforce centralized LLM path, consolidate provider configs, set no-train/no-retain where available, and wire SDK headers. No frontend provider calls. Minimal demo UI changes to surface run metadata.

---

#### Test harness
- Use the Metrics/KPI agent as the single end-to-end test path: `apps/api/src/agents/actual/finance/metrics/agent-function.ts`.
- Standard KPI prompt fixture with synthetic identifiers for safe redaction/pseudonymization tests.

#### Backend changes (API / A2A service)
- Enforce LLM-service-only usage for all agents via shared SDK; remove direct provider clients from agents.
- Centralize provider configuration in one module; set notrain/no-retain flags and timeouts per provider.
- Add request metadata headers (SDK-set): `X-Policy-Profile`, `X-Data-Class`, `X-Sovereign-Mode` (no-op for now).
- Add basic run metadata in responses: provider, latency, cost (approx), runId.
- Logging: redact secrets; include runId correlation; disable provider-request body logging in prod.

#### Frontend demo changes (web)
- Add a developer-only panel to display returned run metadata (provider, latency, cost, runId).
- Ensure all UI calls go to the LLM service endpoints only; remove any legacy direct provider toggles.

#### Backend tests
- Unit: shared SDK enforces service URL; rejects direct provider client instantiation.
- Integration: calling chat/complete returns run metadata; notrain flag present in provider adapters.
- E2E (API): simulate agent call → verify only LLM service outbound occurs; ensure redaction of logs.

#### Frontend tests
- Unit: metadata panel renders fields when present, hides when absent.
- E2E: run a demo prompt and assert provider/latency/cost badges appear with a valid runId.

#### Acceptance criteria
- 100% of agent LLM calls traverse the centralized service.
- Responses include non-PII run metadata; provider adapters set no-train/no-retain where supported.
- No frontend or agent code makes direct provider API calls.


