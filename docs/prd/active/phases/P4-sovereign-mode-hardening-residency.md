### Phase 4: Sovereign Mode Hardening & Residency (P4)

Scope: hard “no external egress,” local/private inference adapters, regional residency, proofs of non‑egress, and documentation.

---

#### Test harness
- Metrics/KPI agent as the sovereign-mode demo path: prove no external egress while generating KPI insights.
- Region pinning exercises performed via this agent to demonstrate residency.

#### Backend changes (API / LLM Service)
- Sovereign enforcement: global toggle and per‑policy flag that blocks external provider calls; route to local/vended private endpoints only.
- Local adapters: Ollama/vLLM/Bedrock PrivateLink/Azure Private; ensure parity with tool/function‑calling where possible.
- Residency controls: region pinning; prevent cross‑region egress; log residency decisions.
- Audit proofs: per‑run non‑egress proof (no external domains/IPs); exportable audit pack (hashes, configs, logs subset).

#### Frontend demo changes (web)
- Sovereign toggle for demo profile (clearly labeled test); show routing path diagram and “no‑egress” proof badge.
- Region selector (demo) to show residency pinning effects on routing.

#### Backend tests
- Unit: sovereign flag blocks external adapters; residency rules applied; adapters return structured errors on unsupported features.
- Integration: run with sovereign on → only local/private adapters called; audit pack contains expected artifacts.
- E2E (API): toggle sovereign → verify no external traffic; region pinning respected; logs show residency decisions.

#### Frontend tests
- Unit: sovereign and region UI reflects backend state; proof badge rendered.
- E2E: toggle sovereign on → demo shows local route and non‑egress proof; change region → updated routing indication.

#### Acceptance criteria
- No external egress under sovereign mode; audit pack shows cryptographic/hash‑based linkage to run ledger.
- Residency constraints enforced; UI demonstrates non‑egress and residency clearly without exposing sensitive data.


