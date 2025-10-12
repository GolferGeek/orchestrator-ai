# Orchestration System Delivery Plan (Codex Builder Track)

This plan captures my builder-focused breakdown of the orchestration initiative.  
For every implementation item, an adjacent testing lane is defined so the tester agent can track coverage.  
I will drive the implementation tasks; the tester agent will own the testing tasks and associated quality gates.

Legend:
- ✅ Builder Task (Coding / Architecture)
- 🧪 Tester Task (Verification / Quality)

---

## Phase 0 – Kickoff & Environment Readiness

1. ✅ **Repository Audit & Baseline Alignment**
   - Review existing modules (agent runners, conversations, tasks) for integration points.
   - Document dependencies and potential refactors needed for orchestration services.
   - Confirm coding standards, linting rules, and transport type usage.
   - Output: short baseline memo + updated TODO list.
   - 🧪 Run lint (`npm run lint`) to ensure current tree is clean; flag pre-existing issues for follow-up.

2. ✅ **Local Supabase & Test Infrastructure Prep**
   - Ensure Supabase instance includes latest TTL migrations (`task_messages`, orchestration tables stub).
   - Seed reference agents (current defaults) for smoke testing.
   - 🧪 Tester: Verify Supabase migrations apply cleanly from scratch; capture defects if any.

3. ✅ **Test Harness Utilities (Scaffolding)**
   - Provide helper factories (mock orchestration definitions, agent fixtures, SSE event capture) for later phases.
   - 🧪 Tester: Validate helpers via smoke unit tests (e.g., ensure factories produce valid DTOs).

---

## Phase 1 – Core Orchestration Infrastructure (Weeks 1-2)

1. ✅ **Database Schema Extensions**
   - Author migrations for:
     - `orchestration_definitions`
     - `orchestration_runs`
     - `orchestration_steps`
     - Extend `human_approvals` with orchestration references
   - Include rollback/forward compatibility notes.
   - 🧪 Apply migrations on clean DB; run schema diff to confirm structure. Add regression test ensuring migrations are idempotent (Supabase reset flow).

2. ✅ **OrchestrationDefinitions Repository & Service**
   - Implement CRUD operations with validation (JSON schema, ownership rules).
   - Integrate with existing agent registry for ownership checks.
   - 🧪 Tester: Unit test validation rules (missing fields, duplicate versions); integration test CRUD via test DB.

3. ✅ **OrchestrationRuns Repository & State Service**
   - Implement run creation, status transitions, parameter storage, result persistence.
   - Provide API for retrieving step history and current status.
   - 🧪 Tester: Unit test state transitions (planning → running → checkpoint → completed); integration test run persistence.

4. ✅ **OrchestrationSteps Repository & Dependency Resolver**
   - Manage per-step metadata, conversation linkage, dependency resolution logic.
   - Implement deterministic execution order calculation with cycle detection.
   - 🧪 Tester: Unit test resolver (linear, branching, cyclic); integration test step persistence + retrieval.

5. ✅ **Orchestration Runner Skeleton (Extends BaseAgentRunner)**
   - Wire repositories + conversations/tasks services.
   - Implement high-level lifecycle orchestration (no agent invocation yet): plan creation, step queuing, checkpoint handshake.
   - 🧪 Tester: Unit tests for lifecycle methods; integration tests verifying conversations are created per step stub.

6. ✅ **Transport & DTO Alignment**
   - Update/confirm DTOs implementing `@orchestrator-ai/transport-types` (TaskResponse, etc.).
   - Provide response mappers for orchestration outputs.
   - 🧪 Tester: Contract tests validating DTO compliance with transport types.

Gate 1 Criteria (Tester Sign-off):
- All unit + integration tests for repositories and services passing.
- Migrations applied/rolled back successfully on clean DB.
- Orchestration runner skeleton creates runs/steps without agent execution.

---

## Phase 2 – Human-in-the-Loop Enablement (Week 3)

1. ✅ **Checkpoint Metadata & Workflow**
   - Extend runner to insert checkpoint requests (link to `human_approvals`).
   - Implement decision handling (continue/retry/abort) at runner level.
   - 🧪 Tester: Unit tests for checkpoint decision matrix; integration tests covering approval flow persistence.

2. ✅ **Retry & Backoff Scaffolding**
   - Add attempt tracking, exponential backoff metadata to `orchestration_steps`.
   - Stub retry hooks for later agent execution integration.
   - 🧪 Tester: Unit tests verifying attempt increments/backoff calculations.

3. ✅ **API Surface for Manual Decisions**
   - Add controller endpoints for checkpoint decisions (with auth guards).
   - Ensure logging/auditing integration (structured logs).
   - 🧪 Tester: Contract tests for decision endpoints; integration tests verifying auth + logging.

4. ✅ **Webhook Notification Hooks (Stub)**
   - Provide methods on runner to emit status events (to be wired later).
   - 🧪 Tester: Ensure stub doesn’t regress; add placeholder tests (no-op assertions).

Gate 2 Criteria:
- Checkpoint flow verified via integration tests.
- Manual decision endpoints tested (auth + functionality).
- Retry scaffolding tests passing.

---

## Phase 3 – Progress Updates & Streaming Integration (Week 3)

1. ✅ **Webhook Status Emission**
   - Implement runner hooks publishing structured updates to webhook service.
   - Include orchestration metadata (run ID, step index, checkpoint state).
   - 🧪 Tester: Integration tests verifying webhook payload structure + delivery.

2. ✅ **SSE Event Stream Wiring**
   - Extend existing SSE infrastructure to broadcast orchestration events (`orchestration.*` topics).
   - Ensure conversation-metadata and step updates propagate.
   - 🧪 Tester: SSE tests capturing event sequences for sample runs (including checkpoint + completion).

3. ✅ **Status Endpoint Enhancements**
   - Implement `GET /orchestrations/:runId/status` returning aggregate state, step history, pending approvals.
   - 🧪 Tester: Contract + integration tests verifying response schema and data accuracy.

Gate 3 Criteria:
- Webhook + SSE integration tests passing.
- Status endpoint verified.
- Tester approval to proceed to agent implementation.

---

## Phase 4 – Agent Implementations (Week 4-5)

For each agent below, builder delivers configuration + wiring; tester delivers tests (unit, integration, contract). Builder ensures agent definitions adhere to YAML/JSON standards and seeds example entries. Tester confirms functionality.

### 4.1 summarizer (Context Agent)
- ✅ Build agent definition (prompt, deliverable format) and register in agent registry.
- 🧪 Contract tests verifying BUILD mode produces markdown summary; unit tests for prompt helper functions.

### 4.2 marketing-swarm (API Agent)
- ✅ Define API agent (n8n endpoint, headers, response mapping), include rate-limits + retry config.
- 🧪 Integration tests hitting mocked n8n endpoint; contract tests validating response mapping + error handling.

### 4.3 supabase-agent (Tool Agent)
- ✅ Configure MCP tools (query/insert/update/delete/rpc/schema-introspect), security filters, prompt guidelines.
- 🧪 Integration tests covering schema introspection + sample queries (mocked DB); contract tests for tool invocation sequence.

### 4.4 image-generator-openai (Function Agent)
- ✅ Implement function agent calling GPT-Image-1 with configurable quality tiers.
- 🧪 Contract tests ensuring request payload conforms to API spec (mocked HTTP); integration test with fake OpenAI server.

### 4.5 image-generator-google (Function Agent)
- ✅ Build function agent targeting Imagen 4 Fast API, handle auth token injection.
- 🧪 Contract tests verifying request format; integration test using mocked Google endpoint.

### 4.6 image-orchestrator (Orchestrator Agent)
- ✅ Register orchestrator agent with available orchestrations + subordinate agents map.
- 🧪 Contract tests ensuring orchestration metadata is exposed correctly; integration test verifying orchestrator delegates to subordinate definitions.

### 4.7 finance-manager (Orchestrator Agent)
- ✅ Register orchestrator agent for KPI workflows; map subordinate agents.
- 🧪 Contract tests verifying access control + orchestration listing; integration test confirming delegation stub works.

Gate 4 Criteria:
- All seven agents pass contract + integration tests.
- Smoke test confirms agents seeded and registrable.
- Tester approves readiness for orchestration E2E work.

---

## Phase 5 – KPI Tracking Orchestration (Week 6)

1. ✅ **Define `kpi-tracking` Orchestration**
   - Author YAML/JSON definition with steps (`fetch-kpi-data`, `summarize-results`), parameters, checkpoint.
   - Seed orchestration definition for finance-manager.
   - 🧪 Tester: Validate definition schema; unit test definition parser; integration test ensuring orchestration loads correctly.

2. ✅ **Runner Integration with Agents**
   - Wire runner to invoke agent registry for each step, pass conversation context, collect deliverables.
   - Ensure deliverables stored + mapped to step outputs.
   - 🧪 Tester: Unit tests mocking agent execution; integration tests verifying deliverable propagation.

3. ✅ **Checkpoint Execution End-to-End**
   - Ensure checkpoint decision pauses/resumes orchestration with agent context intact.
   - 🧪 Tester: E2E test covering checkpoint approval + retry path.

4. ✅ **E2E KPI Tracking Flow**
   - Run full orchestration (builder ensures sample data available).
   - 🧪 Tester: Author comprehensive E2E test verifying data fetch → summary → deliverable creation; confirm SSE + webhook outputs.

5. ✅ **Documentation & Sample Scripts**
   - Provide runbook for finance-manager using KPI orchestration.
   - 🧪 Tester: Validate documentation accuracy via manual run.

Gate 5 Criteria:
- KPI tracking E2E test passing (including checkpoint + streaming).
- Documentation reviewed by tester.
- Approval to proceed to sub-orchestration work.

---

## Phase 6 – Sub-Orchestration Support (Week 7)

1. ✅ **Parent/Child Run Linking**
   - Enhance runner to create nested `orchestration_runs` for sub-orchestrations and propagate context.
   - 🧪 Tester: Integration tests verifying parent-child relationships persisted correctly.

2. ✅ **finance-manager → kpi-tracking Invocation**
   - Implement orchestration service call path for finance-manager to trigger kpi-tracking.
   - 🧪 Tester: E2E test verifying parent orchestrator aggregates child results; error propagation checks.

3. ✅ **Parallel Sub-Orchestrations Support**
   - Add runner support for triggering multiple child orchestrations, tracking their status.
   - 🧪 Tester: Integration test simulating parallel children; confirm status aggregation.

Gate 6 Criteria:
- Parent-child integration tests passing.
- E2E finance-manager scenario verified.
- Tester approval for UI + advanced flows.

---

## Phase 7 – Orchestration & Approval UI (Week 8)

1. ✅ **Dashboard Endpoints**
   - Expose REST endpoints listing active/completed orchestrations with step summaries.
   - 🧪 Tester: Contract tests verifying response schema; integration tests with seeded runs.

2. ✅ **Checkpoint Management UI API**
   - Implement endpoints supporting UI to list pending approvals, submit decisions.
   - 🧪 Tester: Integration tests verifying pagination, filtering, decision submission.

3. ✅ **Historical Replay Support**
   - Provide API hooks to retrieve completed orchestration history for replay.
   - 🧪 Tester: Integration tests ensuring data completeness + ordering.

4. ✅ **UI Documentation Hooks (Builder Support)**
   - Supply API documentation (OpenAPI/Markdown) for frontend consumption.
   - 🧪 Tester: Validate docs accuracy with manual curl scripts.

Gate 7 Criteria:
- UI APIs tested and documented.
- Tester confirms readiness for frontend integration.

---

## Phase 8 – Error Handling & Recovery (Week 9)

1. ✅ **Retry Logic Implementation**
   - Implement exponential backoff, retry limits, and status updates in runner.
   - 🧪 Tester: Unit tests covering retry scenarios; integration tests verifying retries record attempts.

2. ✅ **Manual Recovery Actions**
   - Support human-triggered retry/abort flows post-failure.
   - 🧪 Tester: Integration tests verifying manual interventions update state correctly.

3. ✅ **Rollback Hooks (Optional)**
   - Provide framework for reversible steps (metadata + placeholder logic).
   - 🧪 Tester: Validate metadata handling; integration test for rollback flag propagation.

Gate 8 Criteria:
- Retry + recovery tests passing.
- Manual intervention flows verified.

---

## Phase 9 – Performance & Optimization (Week 10)

1. ✅ **Parallel Execution Engine**
   - Optimize runner to execute independent steps concurrently with configurable limits.
   - 🧪 Tester: Load tests simulating concurrent steps; measure throughput.

2. ✅ **Caching Layer**
   - Implement caching for orchestration definitions and step outputs (optional caching store).
   - 🧪 Tester: Integration tests ensuring cache hits reduce DB reads; measure performance improvements.

3. ✅ **Monitoring & Metrics**
   - Add instrumentation for orchestration durations, step latency, error rates.
   - 🧪 Tester: Verify metrics exposed (e.g., Prometheus endpoints) and accuracy via simulated runs.

4. ✅ **Load/Stress Testing**
   - Builder prepares scripts; tester runs scenarios (10+ concurrent orchestrations, deep step chains).
   - 🧪 Tester: Analyze results, identify bottlenecks, request adjustments.

Gate 9 Criteria:
- Load/performance targets met or remediation plan documented.
- Metrics validated.

---

## Phase 10 – Documentation, Polish & Production Readiness (Weeks 11-12)

1. ✅ **Comprehensive Documentation**
   - Architecture overview, API reference, orchestration definition guide, troubleshooting.
   - 🧪 Tester: Review documentation for accuracy; run through quickstart to validate instructions.

2. ✅ **Example Library**
   - Provide additional orchestration samples (marketing campaign, content pipeline, etc.).
   - 🧪 Tester: Spot-check samples compile/run.

3. ✅ **Security & Compliance Review Support**
   - Ensure secrets handling, audit logs, role-based access for orchestrations.
   - 🧪 Tester: Security-focused tests (authZ, secret leakage).

4. ✅ **Production Checklist**
   - Compile final checklist (migrations, smoke tests, monitoring, backups).
   - 🧪 Tester: Validate checklist steps; run final smoke tests.

Gate 10 Criteria:
- Documentation vetted by tester.
- Production checklist executed in staging environment.
- Human validation of happy-path UX complete.

---

## Cross-Cutting Responsibilities & Coordination

- Builder (Codex) focuses on architecture, implementation, documentation scaffolding.
- Tester agent enforces coding standards, writes/executes all tests (unit, integration, contract, E2E, load).
- Builder does **not** commit code; final commits handled by human once tester signs off.
- Each phase closes only after tester marks all 🧪 tasks complete and human stakeholders review, where required.

---

## Appendix – Tracking & Communication

- Maintain shared checklist (phase/task level) referencing ✅/🧪 statuses.
- Weekly sync with tester to review outstanding QA items and blockers.
- Raise architecture decisions in shared ADR log; tester reviews for alignment.
- Ensure Supabase backups captured before major schema changes.

This plan keeps implementation and testing tightly paired so every feature lands with verified coverage, enabling deliberate, high-quality progress toward the orchestration MVP.

---

# Claude (Tester) Evaluation of Codex Plan

**Date**: 2025-10-12
**Reviewer**: Claude (Tester Agent)
**Overall Assessment**: Strong strategic direction with solid phase structure. Needs more granularity for execution tracking and git workflow clarity.

---

## ✅ Strengths

### 1. **Excellent Strategic Vision**
- Phase 0 (Kickoff) is brilliant - establishing baseline before building is critical
- Phases align perfectly with PRD goals
- Clear separation of concerns between builder and tester
- Good gate criteria at each phase

### 2. **Thoughtful Architecture Decisions**
- "Steps Have Conversations" architecture clearly understood
- Parent-child orchestration relationships well-planned
- Sub-orchestration support appropriately placed (Phase 6)
- Performance considerations included (Phase 9)

### 3. **Testing Integration**
- Good use of ✅/🧪 markers for visibility
- Testing tasks paired with implementation tasks
- Multiple test types mentioned (unit, integration, contract, E2E, load)
- Tester sign-off at each gate

### 4. **Realistic Scope Management**
- 12-week timeline is reasonable
- Phases build incrementally
- UI separated from core engine (Phase 7)
- Polish and documentation at end (Phase 10)

---

## 🔍 Areas Needing More Detail

### 1. **Git Workflow & Commit Strategy** ⚠️ **CRITICAL GAP**

**Issue**: Line 315 states "Builder does **not** commit code; final commits handled by human" but we need tester (Claude) to commit at phase boundaries.

**What's Missing**:
- Who commits? (Should be: Tester commits when phase complete)
- When? (Should be: End of each phase after all tests pass)
- Branch strategy? (Need: One branch per phase or single integration branch?)
- Commit message format? (Need: Standardized format with phase, tests, coverage)
- How to handle work-in-progress? (Need: Tester stages changes but doesn't commit until phase done)

**Recommendation**:
```
Add section: "Git Workflow"
- Tester commits at end of each phase
- Commit message includes: phase number, tests added, coverage %
- Branch strategy: integration/orchestration-phaseN
- WIP: Use git stash or temporary local commits, squash before final commit
- Push only after both agents agree phase complete
```

---

### 2. **Task Granularity** ⚠️ **MODERATE GAP**

**Issue**: Tasks are high-level (e.g., "OrchestrationDefinitions Repository & Service" combines 2 distinct components).

**What's Missing**:
- Subtasks with checkboxes for tracking progress
- Estimated hours per task
- Explicit file names/paths for new files
- Clear "Definition of Done" for each task

**Example - Phase 1, Task 2**:
Current:
```
2. ✅ **OrchestrationDefinitions Repository & Service**
   - Implement CRUD operations with validation
```

Needs:
```
2.1 ✅ **Create OrchestrationDefinition Entity**
   - [ ] Create orchestration-definition.entity.ts in apps/api/src/agent-platform/entities/
   - [ ] Define all columns with TypeORM decorators
   - [ ] Add relationships
   - Estimated: 1 hour

2.2 ✅ **Create OrchestrationDefinitionsRepository**
   - [ ] Create orchestration-definitions.repository.ts
   - [ ] Implement create()
   - [ ] Implement findById()
   - [ ] Implement findByOwner()
   - [ ] Implement update()
   - [ ] Implement delete()
   - Estimated: 2 hours

2.2-TEST 🧪 **Test OrchestrationDefinitionsRepository**
   - [ ] Write integration tests for all CRUD methods
   - [ ] Test duplicate constraint violation
   - [ ] Test transaction handling
   - Test File: apps/api/src/agent-platform/repositories/__tests__/orchestration-definitions.repository.spec.ts
   - Estimated: 3 hours
```

**Recommendation**: Break each phase task into 3-5 subtasks with checkboxes.

---

### 3. **Testing Task Details** ⚠️ **MODERATE GAP**

**Issue**: Testing tasks mention "unit tests" and "integration tests" but lack specifics.

**What's Missing**:
- Exact test file paths (where will tests be written?)
- Number of tests expected (e.g., "Write 8 unit tests covering...")
- Test coverage targets per file (90% for services, 85% for repositories, etc.)
- Specific test scenarios (not just "unit tests")
- How to handle test failures (what if builder code doesn't pass tests?)

**Example - Phase 1, Testing**:
Current:
```
🧪 Tester: Unit test validation rules (missing fields, duplicate versions)
```

Needs:
```
Task 2.2-TEST: Test OrchestrationDefinitionService
Owner: Tester (Claude)
Estimated: 4 hours

Testing Subtasks:
- [ ] Write unit tests with mocked repository:
  - [ ] Test createDefinition() - happy path
  - [ ] Test createDefinition() - missing required fields (throws BadRequestException)
  - [ ] Test createDefinition() - duplicate version (throws ConflictException)
  - [ ] Test validateDefinition() - invalid YAML structure
  - [ ] Test validateDefinition() - circular dependencies in steps
  - [ ] Test getDefinition() - not found (throws NotFoundException)
- [ ] Write integration tests with real database:
  - [ ] Test full CRUD lifecycle
  - [ ] Test version constraint enforcement

Test File: apps/api/src/agent-platform/services/__tests__/orchestration-definition.service.spec.ts
Coverage Target: 90%+
```

**Recommendation**: Every 🧪 task should specify test file path, coverage target, and specific scenarios.

---

### 4. **Code Standards Enforcement** ⚠️ **MODERATE GAP**

**Issue**: No explicit mention of when/how code standards are checked.

**What's Missing**:
- When tester reviews code for standards (after each task? after each phase?)
- Checklist of what to review (imports, naming, error handling, TypeScript types, transport-types usage)
- What happens when standards violated (tester fixes simple ones, builder re-does complex ones)
- Linting/formatting enforcement

**Recommendation**:
Add to each phase:
```
Phase N Code Review (Tester Task)
- [ ] Review all files for naming conventions
- [ ] Verify import organization (external → transport-types → internal → DTOs)
- [ ] Check error handling uses NestJS exceptions
- [ ] Verify no `any` types
- [ ] Confirm DTOs implement transport-types interfaces
- [ ] Run ESLint and fix violations
- [ ] Document violations for builder (if architectural issues)
```

---

### 5. **Specific Agent Implementation Details** ⚠️ **LOW PRIORITY**

**Issue**: Phase 4 (agents) is very high-level. Each agent needs migration + seed data.

**What's Missing**:
- Database migration for each agent (insert into `agents` table)
- Seed data format (YAML/JSON for agent definitions)
- Agent configuration specifics (MCP server URLs, API keys, etc.)
- How agents are registered in registry

**Example - supabase-agent**:
Current:
```
### 4.3 supabase-agent (Tool Agent)
- ✅ Configure MCP tools (query/insert/update/delete/rpc/schema-introspect)
- 🧪 Integration tests covering schema introspection + sample queries
```

Needs:
```
### Task 4.3.1: Create supabase-agent migration
Owner: Builder
- [ ] Create migration 202510XX000X_seed_supabase_agent.sql
- [ ] Define agent config with MCP tools array
- [ ] Insert into agents table with organization_slug='global'
- [ ] Add security filters (allowed_tables, denied_operations)

### Task 4.3.1-TEST: Test supabase-agent seed
Owner: Tester
- [ ] Verify migration runs cleanly
- [ ] Verify agent appears in agents table
- [ ] Test agent can be loaded by registry

### Task 4.3.2: Test supabase-agent functionality
Owner: Tester
- [ ] Write contract tests for MCP tool invocation
- [ ] Test schema introspection returns table list
- [ ] Test query execution returns results
- [ ] Test security filters block dangerous operations
```

**Recommendation**: Each agent needs 2-3 subtasks (migration, config, tests).

---

### 6. **Test Infrastructure Setup** ⚠️ **LOW PRIORITY**

**Issue**: Phase 0 mentions "helper factories" but doesn't detail what's needed.

**What's Missing**:
- Complete list of test helpers needed
- When they should be created (Phase 0 or as-needed?)
- File structure for test helpers

**Recommendation**:
Add to Phase 0:
```
Task 0.3: Create Test Helpers
Owner: Tester (Claude)

Files to Create:
- apps/api/testing/helpers/database.helper.ts
  - setupTestDatabase()
  - cleanupTestDatabase()
  - seedTestData()

- apps/api/testing/helpers/agent.helper.ts
  - createMockAgent(type, overrides)
  - createMockAgentDefinition()

- apps/api/testing/helpers/orchestration.helper.ts
  - createMockOrchestration(steps)
  - createMockOrchestrationRun()
  - createMockOrchestrationStep()

- apps/api/testing/helpers/sse.helper.ts
  - captureSSEEvents(eventEmitter)

Estimated: 3 hours
```

---

### 7. **Phase Completion Criteria Needs Expansion** ⚠️ **LOW PRIORITY**

**Issue**: Gate criteria are good but could be more specific.

**Example - Gate 1**:
Current:
```
Gate 1 Criteria (Tester Sign-off):
- All unit + integration tests for repositories and services passing.
- Migrations applied/rolled back successfully on clean DB.
- Orchestration runner skeleton creates runs/steps without agent execution.
```

Better:
```
Gate 1 Criteria (Tester Sign-off):
- [ ] All 45 unit tests passing (0 failures, 0 skipped)
- [ ] All 12 integration tests passing
- [ ] Test coverage ≥ 90% for services, ≥ 85% for repositories
- [ ] All 4 migrations apply cleanly on fresh DB
- [ ] Migrations are idempotent (can run twice without error)
- [ ] Orchestration runner creates OrchestrationRun record
- [ ] Orchestration runner creates OrchestrationStep records for each step
- [ ] Orchestration runner creates Conversation for each step
- [ ] No `any` types in new code
- [ ] No console.log() statements
- [ ] ESLint passes with 0 warnings
- [ ] Code review completed, all violations addressed
- [ ] Git commit prepared but not pushed
- [ ] Both agents agree Phase 1 complete
```

---

## 🎯 Critical Missing Elements

### 1. **Error Handling Strategy Between Agents**

**Not Addressed**: What happens when:
- Builder code doesn't compile?
- Builder code fails tests?
- Builder violates standards?
- Tester finds bugs during testing?

**Recommendation**:
```
Error Resolution Protocol:
1. Tester runs tests after builder completes task
2. If tests fail:
   a. Tester analyzes failures
   b. Simple bugs (typos, imports) → Tester fixes directly
   c. Logic bugs → Tester documents, builder fixes
   d. Architectural issues → Tester documents, builder re-designs
3. Tester re-runs tests after fixes
4. Repeat until all tests pass
5. Only then move to next task
```

### 2. **Concurrent Work Protocol**

**Not Addressed**: Can builder move ahead while tester is testing previous task?

**Recommendation**:
```
Work Sequencing:
- Builder completes Task N
- Builder notifies tester: "Task N code complete"
- Tester begins Task N-TEST
- Builder CAN start Task N+1 (independent work)
- If Task N-TEST finds issues:
  - Builder pauses Task N+1
  - Builder fixes Task N issues
  - Builder resumes Task N+1 after fix
- Tester must complete Task N-TEST before phase ends
```

### 3. **Rollback Strategy**

**Not Addressed**: What if we need to undo a phase?

**Recommendation**:
```
Rollback Protocol:
- Each phase committed to separate branch (orchestration-phaseN)
- If Phase N fails critical test:
  - Revert phase branch
  - Return to Phase N-1 baseline
  - Re-plan Phase N tasks
  - Re-implement
- Only merge to main after human validation (Phase 5, 10)
```

---

## 💡 Suggestions for Improvement

### 1. **Add Task Tracking Section**

```markdown
## Task Tracking

| Phase | Total Tasks | Builder Tasks | Tester Tasks | Status |
|-------|-------------|---------------|--------------|--------|
| 0     | 3           | 2             | 3            | ☐      |
| 1     | 12          | 6             | 9            | ☐      |
| 2     | 8           | 4             | 6            | ☐      |
| ...   | ...         | ...           | ...          | ...    |

Legend:
- ☐ Not Started
- 🟡 In Progress
- ✅ Complete
```

### 2. **Add Time Estimates**

Every task should have:
- Estimated hours
- Cumulative phase hours
- Running total vs. allocated time

### 3. **Add Risk Register**

```markdown
## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Builder code fails tests | High | Medium | Tester fixes simple bugs, escalates complex ones |
| Migration breaks existing data | Low | High | Test on fresh DB first, validate rollback |
| Agent runner performance issues | Medium | Medium | Phase 9 load testing, optimize if needed |
```

---

## 📊 Comparison with Claude's Plan

**Similarities**:
- Same 10 phases (+ Phase 0 in Codex plan)
- Same testing paired with implementation approach
- Same gate criteria concept
- Same recognition of tester as quality owner

**Key Differences**:

| Aspect | Codex Plan | Claude Plan | Recommendation |
|--------|------------|-------------|----------------|
| **Granularity** | High-level tasks | Subtasks with checkboxes | Use Claude's granularity |
| **Git Workflow** | Unclear | Tester commits at phase end | Use Claude's approach |
| **Test File Paths** | Not specified | Explicit paths | Use Claude's specificity |
| **Coverage Targets** | Mentioned | Explicit % by component | Use Claude's targets |
| **Time Estimates** | None | Hours per task | Use Claude's estimates |
| **Phase 0** | Included | Not included | Include Codex's Phase 0 |
| **Standards Review** | Implicit | Explicit checklist | Use Claude's checklist |
| **Agent Details** | High-level | Migration + seed + tests | Use Claude's detail level |

---

## ✅ Recommended Merge Strategy

1. **Keep from Codex Plan**:
   - Phase 0 (Kickoff & Environment Readiness) - excellent addition
   - Strategic vision and architecture decisions
   - Cross-cutting responsibilities section
   - ADR log mention

2. **Keep from Claude Plan**:
   - Subtask granularity with checkboxes
   - Explicit test file paths
   - Time estimates per task
   - Coverage targets
   - Git commit workflow (tester commits at phase end)
   - Code standards review checklists
   - Detailed test scenarios

3. **Add Missing Elements**:
   - Error resolution protocol
   - Concurrent work protocol
   - Rollback strategy
   - Task tracking table
   - Risk register

4. **Structure**:
   ```
   Phase N: [Name]
   ├── N.1 [Builder Task]
   │   ├── Subtask checkboxes
   │   ├── Files to create
   │   ├── Estimated hours
   │   └── Acceptance criteria
   ├── N.1-TEST [Tester Task]
   │   ├── Testing subtasks
   │   ├── Test file path
   │   ├── Coverage target
   │   └── Estimated hours
   ├── N.2 [Builder Task]
   ├── N.2-TEST [Tester Task]
   └── N.X Code Review & Git Commit [Tester Task]
   ```

---

## 🎯 Final Recommendation

**Codex's plan is strategically sound** but needs execution-level detail from Claude's plan to be trackable and actionable.

**Proposed Next Steps**:
1. Merge both plans using structure above
2. Expand Phase 1 fully (as in Claude's plan) to set pattern
3. Keep Phases 2-10 at Codex's strategic level for now
4. Expand each phase in detail as we approach it
5. Add missing elements (git workflow, error protocol, etc.)
6. Both agents review merged plan
7. Human approves final unified plan

**Estimate for Unified Plan**:
- Phase 0: 3 tasks → 9 subtasks (Codex detail)
- Phase 1: 6 tasks → 31 subtasks (Claude detail) ✅
- Phases 2-10: Expand as we go (Codex level → Claude level)
- Total: ~200-250 subtasks across all phases

**This merged approach gives us**:
- Strategic vision (Codex)
- Tactical execution detail (Claude)
- Clear tracking (checkboxes)
- Quality gates (both)
- Realistic timeline (both)

---

**Ready to collaborate on unified plan! 🤝**

