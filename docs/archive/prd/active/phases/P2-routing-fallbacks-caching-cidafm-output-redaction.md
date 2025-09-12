### Phase 2: Routing, Fallbacks, Caching, CID AFM, Output Redaction (P2)

Scope: introduce routing layer (policy + cost/latency), retries/fallbacks, memoization/caching, CID AFM presets, and output redaction for CONFIDENTIAL.

---

#### Test harness
- Metrics/KPI agent serves as the canonical flow for routing/fallback/cache tests.
- Use repeated identical prompts to demonstrate cache hits; induce provider errors to trigger fallbacks.

#### Backend changes (API / LLM Service)
- Routing layer: select provider by policy profile, task type, cost cap, latency SLO, and safety score signals; configurable canaries.
- Fallback chains: per-task fallback order; circuit breakers for provider errors/rate limits.
- Caching: prompt/result memoization for idempotent requests with TTL; per-deployment namespace; hash includes policyProfileVersion.
- CID AFM integration: inject presets (Strict Privacy, Balanced Privacy, Standard) as system modifiers; surface in run ledger.
- Output redaction: for CONFIDENTIAL, redact identifiers in model output; detokenize per policy on return to server-side only.
- Ledger v2: add routing decision, fallback events, cacheHit, cidafmPreset, outputRedactionSummary.

#### Frontend demo changes (web)
- Add toggles to select demo routing policy (read-only; driven by backend profile) and display chosen provider, fallbacks, and cache hit indicator.
- Add CID AFM preset badge and an “output redaction” badge with summary counts.

#### Backend tests
- Unit: router chooses expected provider under cost/latency constraints; fallback order honored; cache key stability under policy changes.
- Integration: simulate provider failure → fallback activates; ledger records events; output redaction removes identifiers; detokenization only when allowed.
- Load: cache effectiveness improves p95 latency; circuit breaker opens under repeated failures.

#### Frontend tests
- Unit: badges render (provider, fallback used, cacheHit, cidafmPreset, outputRedaction).
- E2E: repeated same prompt → shows cacheHit on second run; induced provider failure → UI displays fallback event.

#### Acceptance criteria
- Router selects providers per policy and signals; fallbacks work and are logged.
- Cache reduces latency/cost on repeated calls; cache namespace is per-deployment and policy-versioned.
- CID AFM preset applied and recorded; output redaction enforced for CONFIDENTIAL.


