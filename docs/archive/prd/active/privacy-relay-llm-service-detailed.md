### PRD (Detailed): Privacy Relay + Central LLM Service (Single-Deployment)

Context: One deployment per company. Frontend makes no provider calls. All agents use the centralized LLM service. CID AFM is available for in‑model guidance.

---

#### System Context
- Agents call LLM service only (SDK enforced). No direct provider SDKs in agents.
- Policy profiles defined as YAML/JSON per deployment; selected via `X-Policy-Profile`.
- Headers: `X-Policy-Profile`, `X-Data-Class`, `X-Sovereign-Mode`.

#### Functional Requirements
- FR1: Keep API surface (chat/complete/embed/tools/streaming) but enhance behavior centrally.
- FR2: Policy engine (profiles: redactionLevel, pseudonymization, providerAllowlist, outputRedaction, sovereignMode, budgets).
- FR3: Classification + redaction + deterministic pseudonymization (BYOK/KMS, reversible mapping under customer control).
- FR4: Source blinding (single egress, scrubbed headers, region pinning optional).
- FR5: Provider routing, allowlist, notrain/no‑retain, retries/fallbacks, circuit breakers, caching/memoization.
- FR6: Sovereign mode (no external egress) with local/private adapters.
- FR7: Output redaction + controlled detokenization (server‑side only) for CONFIDENTIAL.
- FR8: Run ledger (policy hits, provider, costs, latency, retries, cache, CID AFM preset, config versions) with hash chaining; exportable.
- FR9: Admin APIs/dashboards for policies, providers, budgets/alerts, canaries/evals.
- FR10: Secret hygiene: no secrets in prompts/logs; alias‑based tools; scrubbing.

#### Non‑Functional
- Performance: p50 ≤200ms overhead; streaming preserved.
- Reliability: 99.9% service; graceful degradation to local models.
- Security: TLS, least privilege, BYOK/KMS, deny secrets in payloads, no provider‑visible deployment identifiers.

#### API/SDK Conventions
- Request: `X-Policy-Profile`, `X-Data-Class` (defaulted from agent metadata), `X-Sovereign-Mode` (bool).
- Response metadata: `x-run-id`, `x-policy-events`, `x-provider`, `x-cost`, `x-latency`, `x-cache-hit`.

#### Data Model (simplified)
- PolicyProfile: id, redactionLevel, pseudonymization, outputRedaction, providerAllowlist, sovereignMode, budgets, residency.
- RunLedger: runId, agentId, policyProfileVersion, dataClass, provider, cost, latency, cacheHit, policyEvents, redactionSummary, cidafmPreset, artifactsHash.
- PseudonymMap: token → secret handle (vault ref), createdAt, lastUsed (scoped to deployment).

#### Rollout (P0–P4)
- P0: Hardening, headers, central provider configs, notrain/no‑retain.
- P1: Privacy relay MVP (classification, redaction/pseudonymization, source‑blinding, ledger v1).
- P2: Routing/fallbacks/caching, CID AFM presets, output redaction, ledger v2.
- P3: Evals/canaries/rollback, budgets/alerts, dashboards.
- P4: Sovereign mode hardening, residency controls, audit packs.

#### Acceptance
- Provider swap without agent code changes; redaction impact <5% on evals; sovereign no‑egress proven; logs show policy proofs.

---

#### Future enhancement (optional): Shared Relay Mode (Consortium)
- Operate a relay with one upstream provider account; partner companies authenticate to the relay with opaque org tokens.
- Ensure per‑org storage isolation (pseudonym maps, caches, logs) and budgets; scrub all org identifiers from outbound requests.
- Provider sees only the relay’s account; members remain pseudonymous externally. Verify provider ToS for multi‑org usage.


