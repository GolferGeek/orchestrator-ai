### Phase 1: Privacy Relay MVP (P1)

Scope: classify → redact/pseudonymize → source-blind route → minimal run ledger. Per-deployment/workflow policies as versioned YAML/JSON. Demonstrate before/after diffs and scrubbed headers.

---

#### Test harness
- Single agent path: Metrics/KPI agent `apps/api/src/agents/actual/finance/metrics/agent-function.ts`.
- Fixtures include emails, account IDs, and names (synthetic) to validate classifier/redaction/pseudonymization.

#### Backend changes (API / LLM Service)
- Policy engine v1: load `policyProfiles/*.yaml` with fields (redactionLevel, pseudonymization, providerAllowlist, outputRedaction=false default).
- Classifier: rules + lightweight NER for CONFIDENTIAL/INTERNAL/PUBLIC tagging.
- Redaction: mask configured PII spans; deterministic pseudonymization with BYOK/KMS tokenization (store reversible map under deployment control).
- Source blinding: single egress http client; strip org/user IDs, referers, custom headers; stable NAT/IP.
- Run ledger (minimal): runId, agentId, policyProfileVersion, dataClass, provider, latency, costApprox, redactionSummary (counts), headerScrubbed=true.

#### Frontend demo changes (web)
- Add Before/After panel: show redaction diff for submitted prompt (dev/demo only; never persist raw).
- Add “provider + header scrub proof” section: display chosen provider and a sanitized header list proof (names only, no values).

#### Backend tests
- Unit: tokenizer determinism across runs; redaction rules cover configured patterns; classifier assigns correct dataClass on fixtures.
- Integration: request with CONFIDENTIAL triggers redaction+pseudonymization; provider adapter receives masked payload; headers scrubbed.
- E2E (API): simulate agent flow → verify ledger entry with redaction counts and headerScrubbed flag; provider allowlist enforced.

#### Frontend tests
- Unit: diff panel renders token placeholders; hides raw content when flag off.
- E2E: submit prompt with sample PII → UI shows before/after diff and provider/header proof; no raw identifiers in network payloads.

#### Acceptance criteria
- All CONFIDENTIAL inputs are redacted/pseudonymized per policy before provider call.
- Outbound requests contain scrubbed headers; allowlist enforced; ledger captures proof.
- Demo shows before/after diff and provider proof without storing raw data.


