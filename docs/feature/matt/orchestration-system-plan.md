# Orchestration System Delivery Plan — Codex (Builder) & Claude (Tester)

## 0. Overview

This plan aligns all implementation and quality work required to deliver the orchestration system defined in the PRD. Every coding task has a paired testing checklist so we move through the phased roadmap together, stay accountable to standards, and end each phase in a shippable state.

- **Builder (Codex)** – Architecture, services, migrations, implementation, documentation scaffolding. Does not write tests, test helpers, test infrastructure, or run any tests. Does not update .env files unless implementation requires new environment variables (documents in task log).
- **Tester (Claude)** – Code review for standards, writes/runs ALL tests (unit, integration, contract, E2E, load), writes ALL test infrastructure (helpers, mocks, fixtures, harnesses), enforces gates, prepares commits, handles ALL git operations.
- **Human Owner** – Validates happy-path UX at designated gates, approves plan & releases.

> **Note:** We keep this plan as the single source of truth. Each phase expands into detailed subtasks only when both agents are ready to execute, so context stays manageable. (No further split into separate files unless the plan grows beyond ~15 pages.)

---

## 1. Roles & Responsibilities

| Responsibility                    | Codex (Builder) | Claude (Tester) | Human |
|-----------------------------------|-----------------|-----------------|-------|
| Feature implementation            | ✅              | ⚠️ (bug fixes)  | ❌    |
| Architectural decisions (ADR)     | ✅ (draft)       | ✅ (review)      | ⚠️    |
| Standards enforcement             | ⚠️ (self-check) | ✅ (final say)   | ❌    |
| Test authoring/execution          | ❌              | ✅              | ❌    |
| Test infrastructure & helpers     | ❌              | ✅              | ❌    |
| Test planning & design            | ❌              | ✅              | ❌    |
| .env file updates                 | ❌ (documents only) | ✅          | ⚠️    |
| Git commits / pushes              | ❌              | ✅              | ❌    |
| Quality gate approvals            | ⚠️ (builder sign-off) | ✅ (final gate) | ✅ (Phase 5 & 10) |
| Release readiness checklist       | ⚠️              | ✅              | ✅    |

Legend: ✅ = primary owner, ⚠️ = contributes, ❌ = no involvement.

---

## 2. Development Principles

1. **Feature + Tests handshake** – No coding task moves to “Done” until its paired testing checklist is complete and passing.
2. **Phased commits** – Only after all tasks in a phase pass tests & review does Claude create a commit.
3. **Transparent ADRs** – Architectural decisions or deviations from the PRD are captured via ADR notes before coding.
4. **Fast feedback** – Failures trigger the error protocol; issues are resolved before new work starts.
5. **Living plan** – As phases unlock, subtasks are refined collaboratively; changes require both agents’ sign-off.

---

## 3. Git & Branch Workflow

### Phase Branch Lifecycle

**Each phase follows this branch workflow**:

1. **Phase Start** (Codex creates branch):
   - Codex creates new branch from current integration branch
   - Branch name: `integration/orchestration-phase-{n}`
   - Example: `git checkout -b integration/orchestration-phase-1` from `integration/agent-platform-sync-main`
   - Codex begins implementation work on phase branch

2. **Phase Development** (Codex builds, Claude tests):
   - Codex commits feature work to phase branch as needed
   - Claude writes tests, runs them, fixes bugs
   - All work stays on phase branch until complete

3. **Phase End** (Claude closes phase):
   - Claude verifies all phase checkboxes complete ✅
   - Claude verifies all tests passing ✅
   - Claude runs Supabase backup: `./apps/api/supabase/backup-local-db.sh`
   - Claude stages all changes: `git add .`
   - Claude creates final phase commit with message template (see below)
   - Claude pushes phase branch: `git push origin integration/orchestration-phase-{n}`
   - Claude merges phase branch into current integration branch: `git checkout integration/agent-platform-sync-main && git merge integration/orchestration-phase-{n}`
   - Claude pushes merged changes: `git push origin integration/agent-platform-sync-main`
   - Claude deletes phase branch (local): `git branch -d integration/orchestration-phase-{n}`

### Commit Message Template

```
feat(orchestration): Phase {n} – {short descriptor}

- Bullet list of key changes
- Database migrations: list migration files
- New services/controllers: list key files
- Tests: Summary of test suites added

Test Coverage:
- Unit tests: {count} tests, {percent}% coverage
- Integration tests: {count} tests
- E2E tests: {count} tests
- Total: {total_count} tests, {overall_percent}% coverage

🤖 Built by Codex & Claude

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Current Integration Branch

- **Base branch**: `integration/agent-platform-sync-main`
- All phase branches created from this branch
- All phase merges go back to this branch
- Human reviews at major gates (Phase 5 & Phase 10) before merge to `main`

### Backups

- Supabase dumps taken at end of each phase, before final commit
- Script: `./apps/api/supabase/backup-local-db.sh`
- Backup files stored in: `storage/backups/`

---

## 4. Error Resolution Protocol

1. **Test Failure or Code Violation Detected**
   - Tester logs issue in `docs/feature/matt/orchestration-issues.md`.
   - Label with severity (blocker, major, minor), affected phase, and owner.
2. **Triage**
   - Blockers stop all new development until resolved.
   - Claude fixes testing issues or standards violations where efficient; escalates implementation bugs back to Codex via the issue log.
3. **Resolution & Retest**
   - After fix, rerun relevant suites plus regression tests for impacted areas.
4. **Postmortem (if needed)**
   - Record lessons in `docs/feature/matt/orchestration-retrospective.md`.

---

## 5. Rollback Strategy

- **Database**
  - All migrations are reversible; before applying, create DB snapshot (Supabase CLI backup).
  - If a phase fails irrecoverably, rollback migrations and restore snapshot.
- **Code**
  - Since commits are per-phase, use `git revert` on the phase commit.
  - Create hotfix branch for clean reimplementation.
- **Agents**
  - Agent config versions tracked via migrations; revert to previous version using archive table or snapshot.

---

## 6. Tracking Artifacts

- `docs/feature/matt/orchestration-task-log.md` – Checklist with timestamps for every task checkbox below.
- `docs/feature/matt/orchestration-issues.md` – Active bugs, ownership, status.
- `docs/feature/matt/orchestration-risks.md` – Risk register updated weekly.
- `docs/feature/matt/orchestration-retrospective.md` – Notes after each phase.
- `docs/feature/matt/phase{n}-standards-report.md` – Code standards review results per phase.

---

## 6.5 Test Environment Configuration

### Environment Variables (Already Provisioned)

**Root `.env` file** contains:
- `SUPABASE_TEST_USER` - Test account username
- `SUPABASE_TEST_PASSWORD` - Test account password
- `OPENAI_API_KEY` - OpenAI API key for image-generator-openai agent
- `GOOGLE_API_KEY` - Google API key for image-generator-google agent
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

**`apps/n8n/.env` file** contains:
- `N8N_API_KEY` - n8n API key for marketing-swarm agent
- `N8N_BASE_URL` - n8n instance URL

### Test Authentication Pattern (Standard)

**All integration/E2E tests MUST authenticate using this pattern**:

```typescript
// Test setup - authenticate as test user
beforeAll(async () => {
  const authResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      username: process.env.SUPABASE_TEST_USER,
      password: process.env.SUPABASE_TEST_PASSWORD
    });

  authToken = authResponse.body.access_token;
});

// Use authToken in subsequent requests
const response = await request(app.getHttpServer())
  .get('/orchestrations')
  .set('Authorization', `Bearer ${authToken}`);
```

### Agent Testing with Real Services

**Context Agents** (summarizer):
- Use OPENAI_API_KEY for LLM calls
- Mock LLM responses in contract tests
- Use real API in integration tests (with rate limiting)

**API Agents** (marketing-swarm):
- Load N8N_API_KEY from `apps/n8n/.env`
- Use N8N_BASE_URL for workflow execution
- Mock n8n responses in contract tests

**Tool Agents** (supabase-agent):
- Use SUPABASE_SERVICE_ROLE_KEY for database operations
- Test database operations use `public.test_*` tables
- Clean up test data in `afterEach` hooks

**Function Agents** (image-generator-openai, image-generator-google):
- Use OPENAI_API_KEY and GOOGLE_API_KEY respectively
- Mock image generation in contract tests (no API calls)
- Use real APIs in integration tests (budget: 10 images/day)

**Orchestrator Agents** (image-orchestrator, finance-manager):
- Compose other agents, use their respective keys
- E2E tests use real agent network
- Mock agent responses for unit tests

### Test Data Management

**Database Fixtures** (Phase 0):
- `global` organization created by seed script
- Test agents seeded in Phase 0 (line 115-119)
- Test orchestration definitions seeded in Phase 4-5

**Test Isolation**:
- Each test suite creates unique test data with UUID prefixes
- `afterEach` hooks clean up test data
- Integration tests use transactions (rollback after test)

### CI Environment Variables

All environment variables from root `.env` are available in CI (GitHub Actions secrets).
Tests run in CI will have identical configuration to local development.

---

## 7. Phased Execution Plan

Each phase shows builder tasks (`[ ] (B)`) and tester tasks (`[ ] (T)`), with expected duration and explicit deliverables. Estimated durations are in person-days (builder or tester). Adjacent testing includes file paths and coverage targets when applicable.

### Phase 0 – Environment & Baseline Readiness (Week 0)

**Goal:** Ensure local and CI environments are clean, repeatable, and ready for orchestration development.

- [ ] (B) Supabase baseline reset (1d)
  - Run `npm run dev:supabase:reset`, validate clean migrations
  - Seed fixtures:
    - Base agents (context, api, tool, function runners)
    - Single test organization (`global`)
    - Conversation template for orchestration steps
  - Document seeded data in `docs/feature/matt/phase0-seed-inventory.md`
  - Output: `docs/feature/matt/phase0-supabase-report.md`
- [ ] (T) Supabase verification (0.5d)
  - Re-run reset, confirm idempotency (migration state identical)
  - Snapshot schema diff: `supabase/migrations/schema-diff-phase0.sql`
  - Ensure `task_messages` TTL migration intact
- [ ] (B) Lint & tooling baseline (0.5d)
  - `npm run lint`, `npm run format` dry run, address outstanding issues
  - Document existing lint suppressions in `docs/feature/matt/known-lint-waivers.md`
- [ ] (T) Tooling verification (0.5d)
  - Confirm lint/format/test commands run clean on CI profile
  - Capture Node/Nest versions in `docs/feature/matt/tooling-baseline.md`
- [ ] (B) ADR kick-off (0.5d)
  - Create ADR directory (`docs/feature/matt/adr/`)
  - Add ADR template `docs/feature/matt/adr/template.md` (sections: Context, Decision, Consequences)
  - Draft ADR-001: “Orchestration Plan Acceptance Criteria” using template
- [ ] (T) Test scaffolding audit (1d)
  - Inventory existing test helpers; identify gaps for orchestration
  - Propose additions in `docs/feature/matt/testing-scaffolding-proposal.md`
- [ ] (T) TaskStatusService baseline verification (0.25d)
  - Document current TaskStatusService behavior and cache implementation
  - Identify integration points for orchestration lifecycle
  - Output: Add section to `docs/feature/matt/testing-scaffolding-proposal.md`
- [ ] (B) Plan alignment session (0.5d)
  - Merge final plan (this document) into repo as `docs/feature/matt/orchestration-system-plan.md`

**Exit Criteria**
1. Supabase reset script tested twice, schemas match.
2. Lint/test commands succeed with zero TODOs.
3. ADR-001 published & acknowledged.
4. Plan merged and acknowledged by both agents + human.

---

### Phase 1 – Core Orchestration Infrastructure (Weeks 1–2)

**Goal:** Implement foundational schema, repositories, orchestration state management, and runner skeleton.

#### 1.1 Database Schema & Entities
- [ ] (B) Migrations for `orchestration_definitions`, `orchestration_runs`, `orchestration_steps`, `human_approvals` extensions (1.5d)
- [ ] (T) Migration tests (1d)
  - File: `apps/api/src/database/__tests__/orchestration-migrations.spec.ts`
  - Verify constraints, indexes, cascade behavior, rollback.
- [ ] (B) TypeORM entities (0.5d)
- [ ] (T) Entity smoke tests (0.5d)

#### 1.2 Repositories
- [ ] (B) OrchestrationDefinitionsRepository (1d)
- [ ] (T) Repository integration tests (1d) – `apps/api/src/agent-platform/repositories/__tests__/orchestration-definitions.repository.spec.ts`
  - CRUD operations (create/read/update/delete)
  - Slug uniqueness enforcement
  - `findByOrganization` coverage
  - Version filtering and pagination behaviors
- [ ] (B) OrchestrationRunsRepository (1d)
- [ ] (T) Tests – `.../orchestration-runs.repository.spec.ts` (0.75d)
  - Run creation lifecycle (planning → running → completed)
  - Parent run linkage queries
  - Soft-delete and cascade expectations
- [ ] (B) OrchestrationStepsRepository (1d)
- [ ] (T) Tests – `.../orchestration-steps.repository.spec.ts` (0.75d)
  - Step ordering and dependency queries
  - Attempt increment + retry tracking
  - Deliverable/plan linkage lookups

#### 1.3 Services
- [ ] (B) OrchestrationDefinitionService (1.5d)
- [ ] (T) Unit + integration tests, coverage ≥ 90% – `.../orchestration-definition.service.spec.ts` (1.5d)
- [ ] (B) OrchestrationStateService (2d)
- [ ] (T) Comprehensive tests (dependency resolution, state transitions, template mapping) – `.../orchestration-state.service.spec.ts` (2d)
- [ ] (B) OrchestrationRunnerService skeleton extending BaseAgentRunner (2d)
- [ ] (T) Runner unit tests w/ mocks + integration tests for run lifecycle – `apps/api/src/agent2agent/services/__tests__/orchestration-runner.service.spec.ts` (2d)
- [ ] (B) Register orchestration runner in AgentRunnerRegistry (0.25d)
- [ ] (T) Registry tests – `.../agent-runner-registry.service.spec.ts` (0.25d)

#### 1.4 Test Helpers & Infrastructure
- [ ] (T) Implement helper modules per Phase 0 proposal (database setup/teardown, agent mocks, orchestration factories, SSE utilities) (1d)
- [ ] (T) Validation tests for helpers (0.5d)

#### 1.5 Reviews & Commit
- [ ] (T) Standards review checklist (0.5d)
  - Use PRD Section 8 standards:
    - Transport types usage (`@orchestrator-ai/transport-types`)
    - File structure (dto/, services/, repositories/, controllers/)
    - Naming conventions (kebab-case files, PascalCase classes)
    - Strong typing (no `any`)
    - NestJS patterns (DI, decorators, exceptions)
    - Import order (external → transport → internal → DTOs)
  - Output: `docs/feature/matt/phase1-standards-report.md`
- [ ] (T) CI test run verification (0.25d)
  - Execute full suite in CI environment, record duration & issues
  - Document baseline in standards report
- [ ] (T) Integration regression test: `apps/api/src/agent-platform/__tests__/orchestration-phase1.integration.spec.ts` (0.75d)
- [ ] (T) Supabase backup, commit, push (0.5d)

#### 1.6 Rollback Drill (Recommended)
- [ ] (T) Execute rollback drill (0.5d)
  - Complete Phase 1 commit in staging branch
  - Introduce intentional breaking migration, observe failure
  - Perform rollback (revert commit + restore DB snapshot)
  - Verify system returns to Phase 0 baseline
  - Summarize lessons in `docs/feature/matt/orchestration-retrospective.md`

**Phase 1 Exit Criteria**
1. All repositories/services >90% coverage (HTML report in `coverage/`, summary in `docs/feature/matt/coverage-phase1.md`).
2. Runner creates runs/steps with placeholder agent execution.
3. Commit: `feat(orchestration): Phase 1 – Core infrastructure`

---

### Phase 2 – Human-In-The-Loop Checkpoints (Week 3)

**Goal:** Complete checkpoint lifecycle (creation, decisions, API, SSE/webhooks).

#### 2.1 Checkpoint Service & Payloads
- [ ] (B) `OrchestrationCheckpointService` (create/resolve + events + run updates) (1.5d)
- [ ] (T) Unit/integration tests with SSE verification – `.../orchestration-checkpoint.service.spec.ts` (1.5d)
- [ ] (B) A2A payload DTOs (`awaiting_approval` response + resume action) (0.25d)
- [ ] (T) DTO validation tests (0.25d)

#### 2.2 Agent Execution Hooks (A2A-Aligned)
- [ ] (B) Update `OrchestratorAgentRunnerService` to pause via `TaskResponseDto` + resume on new `TaskRequestDto` (1.25d)
- [ ] (T) Runner unit tests covering checkpoint → resume logic – `.../orchestrator-agent-runner.checkpoint.spec.ts` (1.0d)
- [ ] (B) Ensure `AgentExecutionGateway` maps resume payloads into runner inputs (0.5d)
- [ ] (T) Regression tests for gateway payload handling (0.5d)

#### 2.3 Notification Integrations
- [ ] (B) Emit `orchestration.checkpoint.requested/resolved` + webhook bridge (0.75d)
- [ ] (T) Webhook tests – `.../checkpoint-webhooks.spec.ts` (0.75d)
- [ ] (B) SSE event wiring via existing stream service (0.5d)
- [ ] (T) SSE tests – `.../checkpoint-sse.spec.ts` (0.5d)

#### 2.4 Full Flow Testing & Commit
- [ ] (T) E2E checkpoint flow (continue/retry/abort, modifications) – `.../checkpoint-flow.integration.spec.ts` (1d)
- [ ] (T) Standards review + commit (0.5d)

**Exit Criteria**
1. Checkpoint decisions persisted and reflected in orchestration state.
2. SSE & webhook payloads validated.
3. Orchestrator pause/resume flows strictly through A2A task requests (no direct REST state mutations).
4. Commit: `feat(orchestration): Phase 2 – Human-in-the-loop checkpoints`

---

### Phase 3 – Progress Updates & Streaming (Week 4)

**Goal:** Real-time observability via SSE, webhooks, and status endpoints, including TaskStatusService integration.

#### 3.1 Event Definitions & Emission
- [ ] (B) Define event payload interfaces (0.5d)
- [ ] (B) Emit lifecycle events in runner (1d)
- [ ] (T) Runner event tests – `.../orchestration-runner-events.spec.ts` (1d)

#### 3.2 Webhooks & TaskStatus Cache
- [ ] (B) Webhook progress payloads (0.75d)
- [ ] (T) Webhook tests – `.../orchestration-webhooks.spec.ts` (0.75d)
- [ ] (B) TaskStatusService integration (ensure in-memory cache reflects orchestration state) (1d)
- [ ] (T) TaskStatusService tests – `apps/api/src/agent2agent/tasks/__tests__/task-status-orchestration.spec.ts` (1d)

#### 3.3 Status Service & API
- [ ] (B) OrchestrationStatusService (1d)
- [ ] (T) Unit tests – `.../orchestration-status.service.spec.ts` (1d)
- [ ] (B) Status endpoints (0.75d)
- [ ] (T) Controller tests (0.75d)

#### 3.4 Observability Integration Test & Commit
- [ ] (T) Full observability integration scenario – `.../orchestration-observability.integration.spec.ts` (1d)
- [ ] (T) Review & commit (0.5d)

**Exit Criteria**
1. SSE/webhook/status endpoint validated for running/completed/failed runs.
2. TaskStatus cache confirmed updates through orchestration lifecycle.
3. Commit: `feat(orchestration): Phase 3 – Streaming & observability`

---

### Phase 4 – Agent Implementations (Weeks 5–6)

**Goal:** Finalize all seven agents with configuration, migrations (if needed), seeds, and tests.

#### 4.1 Implementation Order (Simplest → Complex)
1. **summarizer (Context)** – 1.75d
2. **marketing-swarm (API)** – 1.75d
3. **supabase-agent (Tool)** – 1.75d
4. **image-generator-openai (Function)** – 1.75d
5. **image-generator-google (Function)** – 1.75d
6. **image-orchestrator (Orchestrator)** – 1.75d
7. **finance-manager (Orchestrator)** – 1.75d

#### 4.2 Per-agent Checklist (repeat for each agent above)
- [ ] (B) Agent configuration (YAML/JSON), security restrictions, seeding (0.75d each)
- [ ] (T) Contract tests (A2A compliance) – `apps/api/src/agent-platform/contracts/__tests__/{agent}.contract.spec.ts` (0.5d each)
- [ ] (T) Integration tests (mock external services where needed) – 0.5d each
- [ ] (T) Seed validation (ensure seeding scripts re-runnable) – 0.25d each

#### 4.3 Additional Tasks
- [ ] (B) Shared migrations for agent seeds (if central seeding required) (0.5d)
- [ ] (T) Smoke test covering all agents – `apps/api/test/agents-smoke.spec.ts` (0.5d)
- [ ] (T) Phase review & commit (0.5d)

**Exit Criteria**
1. All agents pass contract/integration tests.
2. Seed scripts idempotent; README updated with agent descriptions.
3. Commit: `feat(orchestration): Phase 4 – Agent suite`

---

### Phase 5 – KPI Tracking Orchestration (Week 7)

**Goal:** Implement flagship orchestration (finance-manager → supabase-agent → summarizer) with checkpoint flow.

- [ ] (B) `kpi-tracking` orchestration definition YAML + migration/seeding (1d)
- [ ] (T) Definition validation tests – `.../orchestration-definitions/kpi-tracking.spec.ts` (0.5d)
- [ ] (B) Runner integration for agent execution (hook up deliverable mapping) (1.5d)
  - Draft ADR-005 “Deliverable Mapping Strategy” prior to implementation
  - Document step output → input mapping rules and fallback behaviors
- [ ] (T) Runner E2E with mock agents – `apps/api/src/agent2agent/services/__tests__/kpi-orchestration.e2e-spec.ts` (1.5d)
- [ ] (T) Human approval flow test (checkpoint continue/retry/abort with modifications) (1d)
- [ ] (B) Documentation (user guide, API docs) (0.75d)
- [ ] (T) Doc validation (0.25d)
- [ ] (T) Phase review & commit (0.5d)

**Exit Criteria**
1. Full KPI flow runs end-to-end with real services.
2. Documentation updated in `docs/feature/matt/kpi-tracking-guide.md`.
3. Human happy-path demo scheduled after tester approval.
4. Commit: `feat(orchestration): Phase 5 – KPI tracking orchestration`

---

### Phase 6 – Sub-Orchestration Support (Week 8)

**Goal:** Enable parent orchestrators (finance-manager, image-orchestrator) to invoke saved orchestrations; manage nested runs and aggregation.

- [ ] (B) Parent-child run wiring in runner/state service (1d)
- [ ] (T) Tests verifying parent-child relationships, context propagation – `.../sub-orchestration.integration.spec.ts` (1d)
- [ ] (B) finance-manager invoking kpi-tracking (0.75d)
- [ ] (T) E2E tests ensuring aggregated results & error propagation (1d)
- [ ] (B) Parallel sub-orchestration support (0.75d)
- [ ] (T) Load test for concurrent children (0.75d)
- [ ] (T) Review & commit (0.5d)

**Exit Criteria**
1. Nested orchestrations track status accurately.
2. finance-manager dashboards show aggregated outputs.
3. Commit: `feat(orchestration): Phase 6 – Sub-orchestration support`

---

### Phase 7 – UI Enablement for Approvals & Status (Week 9)

**Goal:** Provide backend APIs & docs necessary for UI teams to build orchestration dashboards and approval tools.

- [ ] (B) Dashboard endpoints (list active/completed orchestrations, drill-down data) (1d)
- [ ] (T) API contract tests – `apps/api/test/orchestration-dashboard.e2e-spec.ts` (1d)
- [ ] (B) Approval management endpoints (pending approvals, decisions, history) (0.75d)
- [ ] (T) Tests ensuring authz & filtering – `.../approval-ui.e2e-spec.ts` (0.75d)
- [ ] (B) Replay/history retrieval APIs (0.5d)
- [ ] (T) Tests verifying historical data completeness (0.5d)
- [ ] (B) OpenAPI/Swagger updates + developer docs (0.5d)
- [ ] (T) Doc validation (0.25d)
- [ ] (T) Review & commit (0.5d)

**Exit Criteria**
1. UI consumers have documented REST/SSE contracts.
2. Commit: `feat(orchestration): Phase 7 – UI enablement`

---

### Phase 8 – Error Handling & Recovery Enhancements (Week 10)

**Goal:** Robust retry, backoff, manual overrides, and (optional) rollback metadata.

- [ ] (B) Implement retry/backoff logic in runner (1d)
- [ ] (T) Tests covering retry scenarios, exponential backoff – `.../orchestration-retry.spec.ts` (1d)
- [ ] (B) Manual intervention APIs (retry, skip, abort) (0.75d)
- [ ] (T) Tests verifying state transitions & audit logging (0.75d)
- [ ] (B) Rollback metadata (flag reversible steps; stub implementation) (0.5d)
- [ ] (T) Tests confirming metadata captured (0.5d)
- [ ] (T) Review & commit (0.5d)

**Exit Criteria**
1. Runner gracefully handles transient & manual recoveries.
2. Commit: `feat(orchestration): Phase 8 – Error handling`

---

### Phase 9 – Performance, Caching & Monitoring (Week 11)

**Goal:** Parallel execution, caching, metrics, and load testing.

- [ ] (B) Parallel execution engine (configurable concurrency) (1.5d)
- [ ] (T) Performance tests ensuring order correctness – `.../parallel-execution.performance.spec.ts` (1d)
- [ ] (B) Caching layer (definitions, step outputs) (1d)
- [ ] (T) Cache tests (hit/miss, invalidation) (0.75d)
- [ ] (B) Metrics instrumentation (Prometheus, logging) (0.75d)
- [ ] (T) Metrics validation (scrape & assert) (0.5d)
- [ ] (T) Load testing scripts (k6 or artillery) + execution (1d)
- [ ] (T) Analyze & document results (0.5d)
- [ ] (T) Review & commit (0.5d)

**Exit Criteria**
1. Meets performance targets (10+ concurrent orchestrations, 20+ steps).
2. Monitoring dashboards documented in `docs/feature/matt/observability.md`.
3. Commit: `feat(orchestration): Phase 9 – Performance & monitoring`

---

### Phase 10 – Documentation, Polish & Production Readiness (Weeks 12–13)

**Goal:** Final docs, examples, security/compliance, and release checklist.

- [ ] (B) Comprehensive documentation update (architecture, API reference, best practices, troubleshooting) (1.5d)
- [ ] (T) Doc review & validation (0.75d)
- [ ] (B) Example orchestration library (marketing, content pipeline, finance) (1d)
- [ ] (T) Example validation tests (ensure definitions load/run) (0.75d)
- [ ] (B) Production readiness checklist (security audit, backups, monitoring, alerts) (0.75d)
  - Document in `docs/feature/matt/production-readiness-checklist.md`
  - Security audit:
    - Agent execution sandboxing verified
    - Parameterized SQL queries only (block injection vectors)
    - AuthN/Z enforced on all orchestration endpoints
    - Sensitive data scrubbed from logs (API keys, credentials)
    - Rate limiting on orchestration execution APIs
    - Webhook signature verification & replay protection
  - Backups, monitoring dashboards, alert thresholds captured
- [ ] (T) Execute checklist in staging (1d)
- [ ] (T) Final regression suite (all phases) + coverage summary (1d)
- [ ] (T) Prepare release notes & communicate to stakeholders (0.5d)
- [ ] (B/T/H) Final sign-off meeting; human conducts happy-path validation (0.5d)
- [ ] (T) Final commit & PR to merge orchestration branch into main (0.5d)

**Exit Criteria**
1. Documentation published in `docs/feature/matt/orchestration-guide/`.
2. Production checklist signed by tester & human.
3. Human approves release.
4. Commit: `chore(orchestration): Phase 10 – Production readiness`

---

## 8. Human Validation Gates

- **Gate A (After Phase 5)** – Human runs KPI tracking happy-path demo; approves or issues change requests.
- **Gate B (After Phase 10)** – Human validates full orchestrator suite; confirms documentation, monitoring, and rollback plans; authorizes release.

---

## 9. Risk Register (Initial Entries)

| Risk ID | Description | Impact | Likelihood | Mitigation |
|---------|-------------|--------|------------|------------|
| R-01 | Supabase migrations conflict with future schema changes | High | Medium | Lock sequence of orchestration migrations; run dry-runs in CI |
| R-02 | External agent APIs (OpenAI/Google) throttle during tests | Medium | Medium | Use mocked adapters in contract tests; throttle integration tests |
| R-03 | Parallel execution introduces race conditions | High | Medium | Comprehensive tests + load testing before enabling in production |
| R-04 | Long-running tests slow CI | Medium | Medium | Tag suites by type; create nightly cron job for heavy tests |

Risks updated weekly in `docs/feature/matt/orchestration-risks.md`.

---

## 10. Contact & Escalation

- **Primary Contacts**
  - Codex (Builder) – Slack `@codex`, email codex@orchestrator.ai
  - Claude (Tester) – Slack `@claude`, email claude@orchestrator.ai
- **Escalations**
  - If blockers exceed 1 business day, escalate to human owner.
  - Emergency DI reversions require human approval.

---

**Prepared By:** Codex (Builder) & Claude (Tester)  
