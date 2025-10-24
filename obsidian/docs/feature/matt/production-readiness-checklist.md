# Orchestration Production Readiness Checklist

Use this checklist before promoting the orchestration platform to production. Each item identifies the owner responsible for validation (`B`uilder, `T`ester, `H`uman operator) and links to supporting documentation when available.

---

## 1. Platform & Infrastructure

| Item | Owner | Status / Notes |
| --- | --- | --- |
| Supabase migrations applied in production (`202510140100_gold_standard_baseline.sql` + orchestration deltas). | B | |
| Supabase backup automation configured (`apps/api/supabase/backup-*.sh`). | B | |
| Environment variables set: `ORCHESTRATION_DEFAULT_MAX_PARALLEL`, optional `ORCHESTRATION_MAX_CONCURRENCY`. | B | |
| API deployment uses Node 22.x, npm 10.x as validated in `tooling-baseline.md`. | B | |
| Horizontal scaling plan for API workers (HPA or PM2 cluster) documented. | B | |

---

## 2. Security & Compliance

| Item | Owner | Status / Notes |
| --- | --- | --- |
| All orchestration REST endpoints protected by JWT + organization scoping. | T | |
| Rate limiting enabled on `/api/orchestrations/**` (30 req/s baseline). | B | |
| Webhook receivers validate signatures or network ACLs (`ORCHESTRATION_PROGRESS_WEBHOOK_URL`). | B | |
| Supabase queries use parameterised SQL; no string concatenation in orchestration services. | T | |
| Sensitive data redacted from logs (PII, API keys). Verify logger statements in `OrchestrationStepExecutorService`. | T | |
| A2A transport sandbox enforced (agents run with restricted `ctx`). | T | |
| Secrets stored in environment manager (no `.env` commits). | B | |

---

## 3. Observability & Monitoring

| Item | Owner | Status / Notes |
| --- | --- | --- |
| Prometheus scraping `/metrics`; dashboards cover run duration, queue latency, failure rate. | B | |
| Alerting configured: failed runs (`orchestration_runs_total{status="failed"}`), queue latency (`>5s`), webhook errors. | B | |
| Logs ship to centralized aggregator with correlation IDs (run ID, step ID). | B | |
| SSE/WebSocket channels monitored for disconnect rates. | T | |
| Load test executed (`scripts/perf/orchestration-load-test.yaml`) ≥10 concurrent runs, results documented in `observability.md`. | T | |

---

## 4. Operations & Runbooks

| Item | Owner | Status / Notes |
| --- | --- | --- |
| Troubleshooting guide (`orchestration-guide/troubleshooting.md`) reviewed by on-call rotation. | H | |
| Manual recovery procedures (retry/skip/abort) validated in staging with real data. | T | |
| Incident response contacts documented (builder, tester, product owner). | H | |
| Backup & restore drill executed (Supabase snapshot restore test). | T | |
| Change management workflow documented (definition versioning + rollout plan). | B | |

---

## 5. Documentation & Training

| Item | Owner | Status / Notes |
| --- | --- | --- |
| Architecture + API guides shared with engineering teams. | B | |
| Example library reviewed with orchestrator owners (marketing, content, finance). | H | |
| Production onboarding session scheduled (covers metrics, manual recovery, alerts). | H | |
| Release notes drafted (overview, migrations, rollback steps). | T | |

---

## 6. Final Gate

| Item | Owner | Status / Notes |
| --- | --- | --- |
| Full regression suite executed (Claude) and results archived. | T | |
| Human happy-path validation (launch marketing + finance orchestrations end-to-end). | H | |
| Sign-off recorded in `docs/feature/matt/IMPLEMENTATION_COMPLETE.md`. | H | |
| Merge `integration/agent-platform-sync-main` → `main` following release checklist. | T | |

---

### Rollback Plan
1. Revert to previous container/image version.
2. Restore latest Supabase snapshot.
3. Disable orchestrator agents via feature flag or config toggle.
4. Communicate outage + mitigation steps to stakeholders.

Keep this checklist updated as platform requirements evolve. Any unchecked item blocks the Phase 10 release.
