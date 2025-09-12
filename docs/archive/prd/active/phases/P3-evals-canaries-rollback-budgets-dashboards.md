### Phase 3: Evaluations, Canaries, Rollback, Budgets, Dashboards (P3)

Scope: instrument eval harness, shadow runs/canaries, automatic rollback on regression, per-deployment budgets/alerts, and basic admin dashboards.

---

#### Test harness
- Use Metrics/KPI agent golden datasets for offline evals; seed canary traffic from this flow only.
- Define regression thresholds based on KPI summarization accuracy/consistency metrics.

#### Backend changes (API / LLM Service)
- Eval harness: golden datasets per workflow; offline eval runner; metrics (accuracy/consistency style per task), redaction impact scoring.
- Shadow/canarying: % of traffic runs against candidate config/provider; compare outputs with tolerances; record deltas.
- Auto-rollback: on metric regression beyond threshold, revert provider/policy version; log event in ledger.
- Budgets/alerts: per-deployment cost caps, daily/monthly; soft/hard caps with routing to cheaper models when safe; webhook/email alerts.
- Dashboards API: endpoints to surface spend, latency, error budgets, policy events, eval scores, routing mix.

#### Frontend demo changes (web)
- Simple admin view to display: spend by provider, latency/error budgets, recent policy events, eval scores, and canary status.
- Toggle to start/stop a demo canary (backed by safe test profile only).

#### Backend tests
- Unit: eval scorer computes expected metrics; rollback triggers on threshold breach; budget enforcement routes to cheaper model.
- Integration: canary run compares outputs and writes deltas; dashboard API aggregates ledger data correctly.
- E2E (API): exceed budget in test → routing adjusts or requests blocked per policy; rollback event recorded on induced regression.

#### Frontend tests
- Unit: admin charts render and update from API; canary toggle disabled/enabled based on backend state.
- E2E: start canary in demo; show canary status and resulting metrics; show budget alert banner when threshold crossed.

#### Acceptance criteria
- Canarying and offline evals operational; rollback works with audit trail.
- Budgets enforce caps with alerts and safe routing; dashboards show real data.


