### PRD (High-Level): Privacy Relay in Centralized LLM Service

Context: Single-deployment per company. Frontend never calls providers. All agents use the centralized LLM service and CID AFM is available.

---

#### Problem
Controls for privacy/safety are fragmented and not uniformly enforced at the LLM boundary with strong auditability.

#### Vision
Make the LLM service the privacy relay and routing control point: classify → redact/pseudonymize → source‑blind route → CID AFM modifiers → (optional) detokenize → log/audit → return.

#### Goals
- Centralize privacy enforcement and provider routing.
- Per‑deployment workflow policies (YAML/JSON) with BYOK pseudonymization and output redaction.
- Source blinding (single egress + scrubbed headers), provider allowlist, no‑train/no‑retain.
- Sovereign mode (no external egress) with local/private models.
- Run ledger with proofs (costs, latency, policy hits, provider, CID AFM state, versions).

#### Non‑Goals
- Per‑agent privacy logic; frontend/provider calls.

#### Success Metrics
- 0 critical leaks; ≤200 ms median overhead; <5% eval delta; provider swap without agent code changes.

#### Phases
- P0: LLM service hardening, headers, notrain/no‑retain.
- P1: Privacy relay MVP (classification, redaction/pseudonymization, source‑blinding, ledger v1).
- P2: Routing, fallbacks, caching, CID AFM presets, output redaction.
- P3: Evals/canaries, rollback, budgets/alerts, dashboards.
- P4: Sovereign mode hardening and residency.


