# Orchestration System Implementation Plan - Claude (Tester) Version

## Overview

This plan breaks down the Orchestration System PRD into discrete, testable tasks. Each coding task is immediately followed by its testing tasks. All tasks must be checked off before a phase is considered complete.

**Workflow**:
- Builder agent completes coding tasks
- Tester agent (Claude) completes testing tasks immediately after
- Tester agent reviews code for standards compliance
- Tester agent performs git commits and pushes only when all phase tasks complete
- Both agents must agree phase is complete before moving to next phase

---

## Phase 1: Core Orchestration Infrastructure (Weeks 1-2)

**Goal**: Build the orchestration execution engine with complete test coverage

### 1.1 Database Schema

#### Task 1.1.1: Create orchestration_definitions table
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Create migration file `202510XX0001_create_orchestration_definitions.sql`
- [ ] Define table schema with all columns (id, owner_agent_slug, organization_slug, name, display_name, version, description, definition, status, created_at, updated_at, created_by)
- [ ] Add UNIQUE constraint on (owner_agent_slug, organization_slug, name, version)
- [ ] Create indexes: idx_orchestration_defs_owner, idx_orchestration_defs_org_name
- [ ] Add table and column comments

**Acceptance Criteria**:
- Migration runs without errors
- Table created with all columns
- Indexes created
- Can insert sample orchestration definition

---

#### Task 1.1.1-TEST: Test orchestration_definitions schema
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review migration file for standards compliance
- [ ] Run migration on test database
- [ ] Verify table structure matches PRD schema
- [ ] Test UNIQUE constraint (try duplicate insert, should fail)
- [ ] Verify indexes exist (query pg_indexes)
- [ ] Test INSERT with valid data
- [ ] Test INSERT with missing required fields (should fail)
- [ ] Test INSERT with duplicate (org, slug, name, version) - should fail
- [ ] Write integration test: `orchestration-definitions.repository.spec.ts`
- [ ] Verify table comments are present

**Test File**: `apps/api/src/agent-platform/repositories/__tests__/orchestration-definitions.repository.spec.ts`

**Acceptance Criteria**:
- All constraints work as expected
- Integration test passes
- Migration is idempotent (can run multiple times)

---

#### Task 1.1.2: Create orchestration_runs table
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Create migration file `202510XX0002_create_orchestration_runs.sql`
- [ ] Define table with columns (id, orchestration_definition_id, orchestration_name, conversation_id, parent_orchestration_run_id, status, current_step_id, parameters, plan, results, error_details, started_at, completed_at, created_at, updated_at, created_by)
- [ ] Add foreign key to orchestration_definitions
- [ ] Add self-referencing foreign key for parent_orchestration_run_id
- [ ] Add foreign key to conversations(id)
- [ ] Create indexes: idx_orchestration_runs_conv, idx_orchestration_runs_parent, idx_orchestration_runs_status
- [ ] Add table comments

---

#### Task 1.1.2-TEST: Test orchestration_runs schema
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review migration for standards
- [ ] Run migration on test database
- [ ] Verify foreign keys work (insert parent, then child)
- [ ] Test parent-child relationship (sub-orchestrations)
- [ ] Test conversation_id FK (should reject invalid conversation)
- [ ] Test status enum values
- [ ] Write integration test for orchestration runs CRUD
- [ ] Test cascading behavior (what happens when definition deleted?)
- [ ] Verify all indexes created

**Test File**: `apps/api/src/agent-platform/repositories/__tests__/orchestration-runs.repository.spec.ts`

---

#### Task 1.1.3: Create orchestration_steps table
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Create migration file `202510XX0003_create_orchestration_steps.sql`
- [ ] Define table with all columns (id, orchestration_run_id, step_id, step_index, agent_slug, mode, conversation_id, plan_id, deliverable_id, depends_on, status, attempt_number, checkpoint_decision, checkpoint_decided_by, checkpoint_decided_at, invalidated_at, invalidated_reason, error_details, started_at, completed_at, created_at, updated_at)
- [ ] Add FK to orchestration_runs (ON DELETE CASCADE)
- [ ] Add FK to conversations(id)
- [ ] Add UNIQUE constraint (orchestration_run_id, step_id, attempt_number)
- [ ] Create indexes: idx_orchestration_steps_run, idx_orchestration_steps_conversation, idx_orchestration_steps_status, idx_orchestration_steps_deliverable

---

#### Task 1.1.3-TEST: Test orchestration_steps schema
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review migration for standards
- [ ] Run migration on test database
- [ ] Test CASCADE delete (delete run, verify steps deleted)
- [ ] Test UNIQUE constraint with attempt_number
- [ ] Test depends_on array column (insert with dependencies)
- [ ] Test checkpoint_decision JSONB column
- [ ] Verify conversation_id links work
- [ ] Write integration test for step CRUD
- [ ] Test step retry logic (same step_id, different attempt_number)

**Test File**: `apps/api/src/agent-platform/repositories/__tests__/orchestration-steps.repository.spec.ts`

---

#### Task 1.1.4: Extend human_approvals table
**Owner**: Builder
**Estimated**: 30 minutes

**Subtasks**:
- [ ] Create migration file `202510XX0004_extend_human_approvals.sql`
- [ ] Add orchestration_run_id column (UUID, nullable, FK to orchestration_runs)
- [ ] Add orchestration_step_id column (UUID, nullable, FK to orchestration_steps)
- [ ] Create index idx_human_approvals_orch_run

---

#### Task 1.1.4-TEST: Test human_approvals extension
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Testing Subtasks**:
- [ ] Review migration
- [ ] Verify columns added without breaking existing data
- [ ] Test FK relationships
- [ ] Test checkpoint approval flow (insert approval linked to step)
- [ ] Update existing human_approvals tests if needed

---

### 1.2 Orchestration Definition Service

#### Task 1.2.1: Create OrchestrationDefinition entity
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Create `orchestration-definition.entity.ts` in `apps/api/src/agent-platform/entities/`
- [ ] Define TypeORM entity with all columns
- [ ] Add decorators (@Entity, @Column, @PrimaryGeneratedColumn, etc.)
- [ ] Define relationships (owner agent)
- [ ] Export entity

---

#### Task 1.2.1-TEST: Test OrchestrationDefinition entity
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Testing Subtasks**:
- [ ] Review entity for standards compliance
- [ ] Verify column types match database
- [ ] Check decorators are correct
- [ ] Write unit test for entity instantiation

**Test File**: `apps/api/src/agent-platform/entities/__tests__/orchestration-definition.entity.spec.ts`

---

#### Task 1.2.2: Create OrchestrationDefinitionsRepository
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `orchestration-definitions.repository.ts` in `apps/api/src/agent-platform/repositories/`
- [ ] Implement CRUD methods:
  - [ ] `create(definition: CreateOrchestrationDefinitionDto): Promise<OrchestrationDefinition>`
  - [ ] `findById(id: string): Promise<OrchestrationDefinition | null>`
  - [ ] `findByOwner(ownerSlug: string, orgSlug: string): Promise<OrchestrationDefinition[]>`
  - [ ] `findByName(name: string, orgSlug: string): Promise<OrchestrationDefinition[]>`
  - [ ] `update(id: string, updates: Partial<OrchestrationDefinition>): Promise<OrchestrationDefinition>`
  - [ ] `delete(id: string): Promise<void>`
- [ ] Use dependency injection (@InjectRepository)
- [ ] Add error handling

---

#### Task 1.2.2-TEST: Test OrchestrationDefinitionsRepository
**Owner**: Tester (Claude)
**Estimated**: 3 hours

**Testing Subtasks**:
- [ ] Review repository code for standards
- [ ] Check proper use of TypeORM Repository pattern
- [ ] Write integration tests for all methods:
  - [ ] Test create() - happy path
  - [ ] Test create() - duplicate constraint violation
  - [ ] Test findById() - exists and not exists
  - [ ] Test findByOwner() - returns correct results
  - [ ] Test findByName() - handles multiple versions
  - [ ] Test update() - modifies correctly
  - [ ] Test delete() - removes record
- [ ] Test transaction handling
- [ ] Test concurrent operations

**Test File**: `apps/api/src/agent-platform/repositories/orchestration-definitions.repository.spec.ts`

**Test Template**:
```typescript
describe('OrchestrationDefinitionsRepository', () => {
  let repository: OrchestrationDefinitionsRepository;
  let testDb: TestDatabaseHelper;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
    repository = testDb.get(OrchestrationDefinitionsRepository);
  });

  describe('create', () => {
    it('should create orchestration definition', async () => {
      const dto = createMockOrchestrationDefinition();
      const result = await repository.create(dto);
      expect(result.id).toBeDefined();
      expect(result.name).toBe(dto.name);
    });

    it('should reject duplicate (org, owner, name, version)', async () => {
      const dto = createMockOrchestrationDefinition();
      await repository.create(dto);
      await expect(repository.create(dto)).rejects.toThrow();
    });
  });

  // ... more tests
});
```

---

#### Task 1.2.3: Create OrchestrationDefinitionService
**Owner**: Builder
**Estimated**: 3 hours

**Subtasks**:
- [ ] Create `orchestration-definition.service.ts` in `apps/api/src/agent-platform/services/`
- [ ] Inject OrchestrationDefinitionsRepository
- [ ] Implement business logic methods:
  - [ ] `createDefinition(dto: CreateOrchestrationDefinitionDto): Promise<OrchestrationDefinition>`
  - [ ] `validateDefinition(definition: any): ValidationResult` - validate YAML/JSON structure
  - [ ] `getDefinition(id: string): Promise<OrchestrationDefinition>`
  - [ ] `listDefinitionsForAgent(agentSlug: string, orgSlug: string): Promise<OrchestrationDefinition[]>`
  - [ ] `updateDefinition(id: string, updates: UpdateOrchestrationDefinitionDto): Promise<OrchestrationDefinition>`
  - [ ] `deleteDefinition(id: string): Promise<void>`
- [ ] Add validation logic (steps, parameters, agents exist, etc.)
- [ ] Add error handling with NestJS exceptions
- [ ] Add logging

---

#### Task 1.2.3-TEST: Test OrchestrationDefinitionService
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Testing Subtasks**:
- [ ] Review service for code standards
- [ ] Check dependency injection is correct
- [ ] Check error handling uses NestJS exceptions
- [ ] Write unit tests with mocked repository:
  - [ ] Test createDefinition() - calls repository correctly
  - [ ] Test validateDefinition() - catches invalid YAML
  - [ ] Test validateDefinition() - detects missing agents
  - [ ] Test validateDefinition() - detects circular dependencies in steps
  - [ ] Test validateDefinition() - validates parameter types
  - [ ] Test getDefinition() - returns definition
  - [ ] Test getDefinition() - throws NotFoundException when missing
  - [ ] Test listDefinitionsForAgent() - filters correctly
  - [ ] Test updateDefinition() - only updates allowed fields
  - [ ] Test deleteDefinition() - calls repository
- [ ] Write integration tests with real database
- [ ] Test error scenarios (invalid JSON, missing required fields, etc.)

**Test File**: `apps/api/src/agent-platform/services/__tests__/orchestration-definition.service.spec.ts`

**Test Coverage Target**: 90%+

---

### 1.3 Orchestration Runner Service

#### Task 1.3.1: Create OrchestrationRun and OrchestrationStep entities
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `orchestration-run.entity.ts`
- [ ] Create `orchestration-step.entity.ts`
- [ ] Define all columns with TypeORM decorators
- [ ] Define relationships (run ↔ steps, run ↔ parent, step ↔ conversation)
- [ ] Export entities
- [ ] Add to TypeOrmModule.forFeature() in module

---

#### Task 1.3.1-TEST: Test orchestration entities
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review entities for standards
- [ ] Verify column types and decorators
- [ ] Test entity relationships work
- [ ] Write unit tests for entity instantiation
- [ ] Verify TypeORM can load entities

---

#### Task 1.3.2: Create OrchestrationRunsRepository
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `orchestration-runs.repository.ts`
- [ ] Implement methods:
  - [ ] `create(data: CreateOrchestrationRunDto): Promise<OrchestrationRun>`
  - [ ] `findById(id: string): Promise<OrchestrationRun | null>`
  - [ ] `findByConversation(conversationId: string): Promise<OrchestrationRun[]>`
  - [ ] `findByParent(parentId: string): Promise<OrchestrationRun[]>`
  - [ ] `findByStatus(status: string): Promise<OrchestrationRun[]>`
  - [ ] `updateStatus(id: string, status: string, updates?: Partial<OrchestrationRun>): Promise<OrchestrationRun>`
- [ ] Add error handling

---

#### Task 1.3.2-TEST: Test OrchestrationRunsRepository
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Review repository code
- [ ] Write integration tests for all methods
- [ ] Test parent-child relationships
- [ ] Test status transitions
- [ ] Test cascade behavior
- [ ] Test query performance with indexes

**Test File**: `apps/api/src/agent-platform/repositories/__tests__/orchestration-runs.repository.spec.ts`

---

#### Task 1.3.3: Create OrchestrationStepsRepository
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `orchestration-steps.repository.ts`
- [ ] Implement methods:
  - [ ] `create(data: CreateOrchestrationStepDto): Promise<OrchestrationStep>`
  - [ ] `findById(id: string): Promise<OrchestrationStep | null>`
  - [ ] `findByRun(runId: string): Promise<OrchestrationStep[]>`
  - [ ] `findByConversation(conversationId: string): Promise<OrchestrationStep | null>`
  - [ ] `updateStatus(id: string, status: string, updates?: Partial<OrchestrationStep>): Promise<OrchestrationStep>`
  - [ ] `recordAttempt(stepId: string, attemptNumber: number, data: Partial<OrchestrationStep>): Promise<OrchestrationStep>`
- [ ] Add error handling

---

#### Task 1.3.3-TEST: Test OrchestrationStepsRepository
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Review repository code
- [ ] Write integration tests for all methods
- [ ] Test step retry logic (attempt_number)
- [ ] Test depends_on relationships
- [ ] Test checkpoint data storage
- [ ] Test UNIQUE constraint enforcement

**Test File**: `apps/api/src/agent-platform/repositories/__tests__/orchestration-steps.repository.spec.ts`

---

#### Task 1.3.4: Create OrchestrationStateService
**Owner**: Builder
**Estimated**: 4 hours

**Subtasks**:
- [ ] Create `orchestration-state.service.ts`
- [ ] Implement dependency resolution:
  - [ ] `resolveExecutionOrder(steps: StepDefinition[]): string[]` - topological sort
  - [ ] `detectCircularDependencies(steps: StepDefinition[]): boolean`
  - [ ] `getReadySteps(runId: string): Promise<OrchestrationStep[]>` - steps with completed dependencies
- [ ] Implement state management:
  - [ ] `initializeRun(definition: OrchestrationDefinition, params: any): Promise<OrchestrationRun>`
  - [ ] `startStep(runId: string, stepId: string): Promise<OrchestrationStep>`
  - [ ] `completeStep(stepId: string, result: any): Promise<void>`
  - [ ] `failStep(stepId: string, error: any): Promise<void>`
  - [ ] `pauseForCheckpoint(stepId: string): Promise<void>`
  - [ ] `resumeFromCheckpoint(stepId: string, decision: CheckpointDecision): Promise<void>`
- [ ] Implement step output mapping:
  - [ ] `mapStepOutput(step: OrchestrationStep): any` - extract deliverable for next step
  - [ ] `resolveInputTemplate(template: string, context: any): string` - replace {{ vars }}
- [ ] Add error handling and validation

---

#### Task 1.3.4-TEST: Test OrchestrationStateService
**Owner**: Tester (Claude)
**Estimated**: 6 hours

**Testing Subtasks**:
- [ ] Review service for standards and architecture
- [ ] Write unit tests for dependency resolution:
  - [ ] Test resolveExecutionOrder() - simple linear
  - [ ] Test resolveExecutionOrder() - parallel branches
  - [ ] Test resolveExecutionOrder() - complex DAG
  - [ ] Test detectCircularDependencies() - catches loops
  - [ ] Test getReadySteps() - returns only ready steps
- [ ] Write unit tests for state management:
  - [ ] Test initializeRun() - creates run and pending steps
  - [ ] Test startStep() - transitions to running
  - [ ] Test completeStep() - marks complete, unlocks dependents
  - [ ] Test failStep() - records error
  - [ ] Test pauseForCheckpoint() - pauses orchestration
  - [ ] Test resumeFromCheckpoint() - resumes or retries
- [ ] Write unit tests for output mapping:
  - [ ] Test mapStepOutput() - extracts deliverable
  - [ ] Test resolveInputTemplate() - replaces variables
  - [ ] Test resolveInputTemplate() - handles nested paths ($.data.field)
- [ ] Write integration tests with real repositories
- [ ] Test edge cases (missing dependencies, invalid templates, etc.)

**Test File**: `apps/api/src/agent-platform/services/__tests__/orchestration-state.service.spec.ts`

**Test Coverage Target**: 95%+

**Example Test**:
```typescript
describe('OrchestrationStateService', () => {
  describe('resolveExecutionOrder', () => {
    it('should resolve simple linear dependencies', () => {
      const steps = [
        { id: 'step1', depends_on: [] },
        { id: 'step2', depends_on: ['step1'] },
        { id: 'step3', depends_on: ['step2'] }
      ];
      const order = service.resolveExecutionOrder(steps);
      expect(order).toEqual(['step1', 'step2', 'step3']);
    });

    it('should detect circular dependencies', () => {
      const steps = [
        { id: 'step1', depends_on: ['step2'] },
        { id: 'step2', depends_on: ['step1'] }
      ];
      expect(() => service.resolveExecutionOrder(steps))
        .toThrow('Circular dependency detected');
    });

    it('should allow parallel execution of independent steps', () => {
      const steps = [
        { id: 'step1', depends_on: [] },
        { id: 'step2', depends_on: [] },
        { id: 'step3', depends_on: ['step1', 'step2'] }
      ];
      const order = service.resolveExecutionOrder(steps);
      // step1 and step2 can run in parallel (order doesn't matter)
      // step3 must be last
      expect(order[2]).toBe('step3');
    });
  });
});
```

---

#### Task 1.3.5: Create OrchestrationRunnerService (extends BaseAgentRunner)
**Owner**: Builder
**Estimated**: 6 hours

**Subtasks**:
- [ ] Create `orchestration-runner.service.ts` in `apps/api/src/agent2agent/services/`
- [ ] Extend `BaseAgentRunner` abstract class
- [ ] Inject dependencies: OrchestrationStateService, ConversationsService, TasksService, AgentRunnerRegistry, EventEmitter2
- [ ] Implement `execute(definition, request, orgSlug)` method:
  - [ ] Load orchestration definition
  - [ ] Validate parameters match definition
  - [ ] Initialize orchestration run (via state service)
  - [ ] Get execution order from state service
  - [ ] Loop through steps in order:
    - [ ] Check if step dependencies completed
    - [ ] Create conversation for step (with agent_slug)
    - [ ] Get agent runner from registry
    - [ ] Build A2A request with step input
    - [ ] Execute agent via runner
    - [ ] Store step output (deliverable_id)
    - [ ] Check for checkpoint_after
    - [ ] If checkpoint: pause and wait for approval
    - [ ] If error: retry or fail based on config
    - [ ] Emit SSE events for progress
  - [ ] Aggregate all step results
  - [ ] Return orchestration result
- [ ] Implement checkpoint handling:
  - [ ] `handleCheckpoint(stepId: string): Promise<CheckpointResponse>`
  - [ ] `processCheckpointDecision(stepId: string, decision: CheckpointDecision): Promise<void>`
- [ ] Implement error recovery:
  - [ ] `retryStep(stepId: string, modifications?: any): Promise<void>`
  - [ ] `abortOrchestration(runId: string, reason: string): Promise<void>`
- [ ] Add comprehensive logging
- [ ] Add error handling

---

#### Task 1.3.5-TEST: Test OrchestrationRunnerService
**Owner**: Tester (Claude)
**Estimated**: 8 hours

**Testing Subtasks**:
- [ ] Review runner service for architecture and standards
- [ ] Verify extends BaseAgentRunner correctly
- [ ] Check dependency injection
- [ ] Check error handling uses NestJS exceptions
- [ ] Write unit tests with mocks:
  - [ ] Test execute() - simple 2-step orchestration
  - [ ] Test execute() - parallel steps
  - [ ] Test execute() - step with dependencies
  - [ ] Test execute() - creates conversations for each step
  - [ ] Test execute() - resolves agent from registry
  - [ ] Test execute() - passes correct A2A request to agent
  - [ ] Test execute() - stores deliverable_id after step
  - [ ] Test execute() - handles checkpoint pause
  - [ ] Test execute() - aggregates results correctly
- [ ] Write unit tests for checkpoint handling:
  - [ ] Test handleCheckpoint() - pauses orchestration
  - [ ] Test processCheckpointDecision('continue') - resumes
  - [ ] Test processCheckpointDecision('retry') - retries step
  - [ ] Test processCheckpointDecision('abort') - stops orchestration
- [ ] Write unit tests for error recovery:
  - [ ] Test retryStep() - increments attempt_number
  - [ ] Test retryStep() - applies modifications
  - [ ] Test abortOrchestration() - marks all steps as aborted
- [ ] Write integration tests:
  - [ ] Test full orchestration with real database
  - [ ] Test sub-orchestration invocation
  - [ ] Test error propagation
- [ ] Test SSE event emission (capture events)
- [ ] Test concurrent orchestrations

**Test File**: `apps/api/src/agent2agent/services/__tests__/orchestration-runner.service.spec.ts`

**Test Coverage Target**: 90%+

---

#### Task 1.3.6: Register OrchestrationRunnerService in AgentRunnerRegistry
**Owner**: Builder
**Estimated**: 30 minutes

**Subtasks**:
- [ ] Open `agent-runner-registry.service.ts`
- [ ] Inject OrchestrationRunnerService
- [ ] Add to registry: `this.registerRunner('orchestrator', this.orchestrationRunner)`
- [ ] Verify registry returns orchestration runner for agent type 'orchestrator'

---

#### Task 1.3.6-TEST: Test registry integration
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Testing Subtasks**:
- [ ] Update `agent-runner-registry.service.spec.ts`
- [ ] Test getRunner('orchestrator') returns OrchestrationRunnerService
- [ ] Test orchestrator agents route to orchestration runner
- [ ] Verify all 5 agent types registered (context, tool, api, function, orchestrator)

---

### 1.4 Testing Infrastructure Setup

#### Task 1.4.1: Create test helpers
**Owner**: Tester (Claude)
**Estimated**: 3 hours

**Subtasks**:
- [ ] Create `apps/api/testing/helpers/database.helper.ts`:
  - [ ] `setupTestDatabase()` - initialize test DB
  - [ ] `cleanupTestDatabase()` - truncate tables
  - [ ] `seedTestData()` - insert common test fixtures
- [ ] Create `apps/api/testing/helpers/agent.helper.ts`:
  - [ ] `createMockAgent(type, overrides)` - factory for test agents
  - [ ] `createMockAgentDefinition()` - factory for agent definitions
- [ ] Create `apps/api/testing/helpers/orchestration.helper.ts`:
  - [ ] `createMockOrchestration(steps)` - factory for test orchestrations
  - [ ] `createMockOrchestrationRun()` - factory for runs
  - [ ] `createMockOrchestrationStep()` - factory for steps
- [ ] Create `apps/api/testing/helpers/sse.helper.ts`:
  - [ ] `captureSSEEvents(eventEmitter)` - capture events for testing
- [ ] Add TypeScript types for all helpers
- [ ] Document usage with examples

**Files Created**:
- `apps/api/testing/helpers/database.helper.ts`
- `apps/api/testing/helpers/agent.helper.ts`
- `apps/api/testing/helpers/orchestration.helper.ts`
- `apps/api/testing/helpers/sse.helper.ts`
- `apps/api/testing/helpers/index.ts` (exports)

---

### 1.5 Phase 1 Code Review & Standards Check

#### Task 1.5.1: Comprehensive code review
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Review Checklist**:
- [ ] All files follow naming conventions
- [ ] All imports organized correctly (external → transport-types → internal → interfaces → DTOs)
- [ ] All services use dependency injection properly
- [ ] All repositories use TypeORM Repository pattern
- [ ] All DTOs implement transport-types interfaces where applicable
- [ ] All error handling uses NestJS exceptions
- [ ] All methods have proper TypeScript types (no `any`)
- [ ] All database columns match PRD schema
- [ ] All tests pass and have adequate coverage
- [ ] No duplicate code or violations of DRY principle
- [ ] All logger statements use proper levels
- [ ] All comments are accurate and helpful
- [ ] No console.log() statements

**Deliverables**:
- [ ] Create `docs/phase1-code-review.md` with findings
- [ ] Create issues for any violations that need builder attention
- [ ] Fix simple violations (imports, naming, formatting)

---

### 1.6 Phase 1 Integration Testing

#### Task 1.6.1: End-to-end Phase 1 integration test
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Test Scenarios**:
- [ ] Create orchestration definition via service
- [ ] Validate orchestration definition with invalid data
- [ ] Create orchestration run from definition
- [ ] Initialize steps for orchestration
- [ ] Resolve step execution order
- [ ] Update step status through lifecycle
- [ ] Test checkpoint pause/resume flow
- [ ] Test parent-child orchestration relationships
- [ ] Test error handling at each layer

**Test File**: `apps/api/src/agent-platform/__tests__/orchestration-integration.spec.ts`

**Test Coverage**:
- [ ] Repository → Service integration
- [ ] Service → Runner integration
- [ ] State management across services
- [ ] Database transactions and rollbacks

---

### 1.7 Phase 1 Git Commit & Push

#### Task 1.7.1: Prepare Phase 1 for commit
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Subtasks**:
- [ ] Run full test suite: `npm test`
- [ ] Verify all Phase 1 tests pass (100%)
- [ ] Run linter: `npm run lint`
- [ ] Fix any linting issues
- [ ] Run migrations on fresh database to verify
- [ ] Review all files one final time
- [ ] Verify no console.log() or debug code
- [ ] Update CHANGELOG.md with Phase 1 changes

---

#### Task 1.7.2: Git commit Phase 1
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Commit Steps**:
- [ ] Stage all Phase 1 files: `git add apps/api/src/agent-platform apps/api/src/agent2agent/services/orchestration-runner.service.ts apps/api/supabase/migrations/202510*`
- [ ] Review staged changes: `git diff --staged`
- [ ] Create commit with message:
  ```
  feat(orchestration): Phase 1 - Core orchestration infrastructure

  - Add orchestration_definitions, orchestration_runs, orchestration_steps tables
  - Implement OrchestrationDefinitionService for CRUD and validation
  - Implement OrchestrationStateService for dependency resolution and state management
  - Implement OrchestrationRunnerService extending BaseAgentRunner
  - Register orchestration runner in AgentRunnerRegistry
  - Add comprehensive test coverage (90%+ for core services)
  - Add test helpers for orchestration testing

  Tests:
  - 45 unit tests for services and repositories
  - 12 integration tests for orchestration flow
  - All migrations tested and verified

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- [ ] Push to remote: `git push origin integration/orchestration-phase1`
- [ ] Notify team Phase 1 is complete

**Branch**: `integration/orchestration-phase1`

---

## Phase 1 Completion Checklist

**Before marking Phase 1 complete, verify**:

- [ ] All 4 database tables created and tested
- [ ] All 6 repositories implemented and tested
- [ ] All 3 services implemented and tested
- [ ] OrchestrationRunnerService extends BaseAgentRunner
- [ ] Runner registered in registry
- [ ] All test helpers created
- [ ] Test coverage ≥ 90% for core services
- [ ] All integration tests pass
- [ ] Code review completed with no critical issues
- [ ] All Phase 1 tasks checked off in this plan
- [ ] Git commit and push completed
- [ ] Both agents agree Phase 1 is complete

**Phase 1 Complete**: ☐

---

## Phase 2: Human-in-the-Loop (Week 3)

**Goal**: Enable human approvals and checkpoints with full test coverage

### 2.1 Checkpoint Service

#### Task 2.1.1: Create CheckpointService
**Owner**: Builder
**Estimated**: 3 hours

**Subtasks**:
- [ ] Create `checkpoint.service.ts` in `apps/api/src/agent-platform/services/`
- [ ] Inject dependencies: OrchestrationStepsRepository, HumanApprovalsRepository, EventEmitter2
- [ ] Implement checkpoint creation:
  - [ ] `createCheckpoint(stepId: string, question: string, options: CheckpointOption[]): Promise<Checkpoint>`
  - [ ] Link to human_approvals table
  - [ ] Emit SSE event: `orchestration.checkpoint`
- [ ] Implement checkpoint resolution:
  - [ ] `processDecision(checkpointId: string, decision: CheckpointDecision, decidedBy: string): Promise<void>`
  - [ ] Update orchestration_steps with checkpoint_decision
  - [ ] Resume orchestration based on decision (continue/retry/abort)
  - [ ] Emit SSE event: `orchestration.checkpoint.resolved`
- [ ] Implement checkpoint queries:
  - [ ] `getPendingCheckpoints(userId: string): Promise<Checkpoint[]>`
  - [ ] `getCheckpointHistory(orchestrationRunId: string): Promise<Checkpoint[]>`
- [ ] Add error handling and validation

---

#### Task 2.1.1-TEST: Test CheckpointService
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Testing Subtasks**:
- [ ] Review service for standards
- [ ] Write unit tests with mocks:
  - [ ] Test createCheckpoint() - creates record
  - [ ] Test createCheckpoint() - emits SSE event
  - [ ] Test processDecision('continue') - resumes orchestration
  - [ ] Test processDecision('retry') - triggers retry
  - [ ] Test processDecision('retry') - applies modifications
  - [ ] Test processDecision('abort') - stops orchestration
  - [ ] Test getPendingCheckpoints() - filters by user
  - [ ] Test getCheckpointHistory() - returns all for run
- [ ] Write integration tests:
  - [ ] Test full checkpoint flow (create → wait → decide → resume)
  - [ ] Test checkpoint with sub-orchestration
  - [ ] Test multiple checkpoints in sequence
  - [ ] Test concurrent checkpoints
- [ ] Test SSE events are emitted correctly

**Test File**: `apps/api/src/agent-platform/services/__tests__/checkpoint.service.spec.ts`

---

### 2.2 Approval Workflow

#### Task 2.2.1: Create checkpoint DTOs
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Create `checkpoint.dto.ts` in `apps/api/src/agent-platform/dto/`
- [ ] Define DTOs:
  - [ ] `CreateCheckpointDto` - question, options, stepId
  - [ ] `CheckpointResponseDto` - checkpoint data for API
  - [ ] `CheckpointDecisionDto` - action, modifications, reason
  - [ ] `CheckpointOptionDto` - action, label, allows_modification
- [ ] Use class-validator decorators
- [ ] Export from index.ts

---

#### Task 2.2.1-TEST: Test checkpoint DTOs
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review DTOs for standards
- [ ] Test validation decorators work
- [ ] Test invalid DTOs are rejected
- [ ] Write unit tests for DTO validation

---

#### Task 2.2.2: Create CheckpointController
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `checkpoint.controller.ts` in `apps/api/src/agent-platform/controllers/`
- [ ] Inject CheckpointService
- [ ] Implement endpoints:
  - [ ] `GET /checkpoints/pending` - get user's pending checkpoints
  - [ ] `GET /checkpoints/:id` - get checkpoint details
  - [ ] `POST /checkpoints/:id/decide` - submit decision
  - [ ] `GET /orchestrations/:runId/checkpoints` - get run's checkpoints
- [ ] Add authentication guards
- [ ] Add validation pipes
- [ ] Add Swagger decorators
- [ ] Add error handling

---

#### Task 2.2.2-TEST: Test CheckpointController
**Owner**: Tester (Claude)
**Estimated**: 3 hours

**Testing Subtasks**:
- [ ] Review controller for standards
- [ ] Check guards and pipes are applied
- [ ] Write unit tests with mocked service:
  - [ ] Test GET /checkpoints/pending - returns user's checkpoints
  - [ ] Test GET /checkpoints/:id - returns checkpoint
  - [ ] Test GET /checkpoints/:id - 404 when not found
  - [ ] Test POST /checkpoints/:id/decide - processes decision
  - [ ] Test POST /checkpoints/:id/decide - validates decision DTO
  - [ ] Test GET /orchestrations/:runId/checkpoints - returns all
- [ ] Write integration tests (e2e):
  - [ ] Test full approval flow via HTTP
  - [ ] Test authentication is enforced
  - [ ] Test authorization (can only decide own checkpoints)
  - [ ] Test invalid checkpoint ID returns 404
  - [ ] Test invalid decision returns 400

**Test Files**:
- `apps/api/src/agent-platform/controllers/__tests__/checkpoint.controller.spec.ts` (unit)
- `apps/api/test/checkpoint.e2e-spec.ts` (e2e)

---

### 2.3 Notification System

#### Task 2.3.1: Add checkpoint webhook notifications
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Update `webhooks.controller.ts` to handle checkpoint events
- [ ] Add webhook payload format for checkpoints:
  ```json
  {
    "event": "orchestration.checkpoint",
    "orchestrationRunId": "...",
    "stepId": "...",
    "checkpointId": "...",
    "question": "Review query results?",
    "options": [...],
    "timestamp": "..."
  }
  ```
- [ ] Send webhook when checkpoint created
- [ ] Send webhook when checkpoint resolved
- [ ] Add webhook retry logic for failures
- [ ] Add logging

---

#### Task 2.3.1-TEST: Test webhook notifications
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Review webhook code
- [ ] Write unit tests:
  - [ ] Test checkpoint event triggers webhook
  - [ ] Test webhook payload is correct
  - [ ] Test webhook retry on failure
  - [ ] Test webhook timeout handling
- [ ] Write integration tests:
  - [ ] Test webhook actually sends HTTP POST
  - [ ] Test webhook with mock server
  - [ ] Test webhook failure doesn't block orchestration

**Test File**: `apps/api/src/webhooks/__tests__/checkpoint-webhooks.spec.ts`

---

#### Task 2.3.2: Add SSE events for checkpoints
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Update CheckpointService to emit events via EventEmitter2
- [ ] Define SSE events:
  - [ ] `orchestration.checkpoint` - checkpoint created
  - [ ] `orchestration.checkpoint.resolved` - decision made
- [ ] Ensure SSE endpoint subscribes to these events
- [ ] Test SSE events appear in stream

---

#### Task 2.3.2-TEST: Test SSE events
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Capture SSE events in tests
- [ ] Verify checkpoint events are emitted
- [ ] Verify event payload is correct
- [ ] Test SSE stream receives events
- [ ] Test multiple clients receive events

**Test File**: `apps/api/src/agent-platform/services/__tests__/checkpoint-sse.spec.ts`

---

### 2.4 Phase 2 Integration Testing

#### Task 2.4.1: End-to-end checkpoint flow test
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Test Scenarios**:
- [ ] Create orchestration with checkpoint_after
- [ ] Execute orchestration, verify pause at checkpoint
- [ ] Submit 'continue' decision, verify resume
- [ ] Submit 'retry' decision, verify step retries
- [ ] Submit 'abort' decision, verify orchestration stops
- [ ] Test checkpoint with modifications applied
- [ ] Test multiple checkpoints in one orchestration
- [ ] Test checkpoint timeout (if configured)
- [ ] Verify SSE events fired
- [ ] Verify webhooks sent

**Test File**: `apps/api/src/agent-platform/__tests__/checkpoint-flow.integration.spec.ts`

---

### 2.5 Phase 2 Code Review & Git Commit

#### Task 2.5.1: Code review Phase 2
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Review Checklist**:
- [ ] All Phase 2 files follow standards
- [ ] CheckpointService properly structured
- [ ] Controller uses proper guards and validation
- [ ] DTOs use class-validator
- [ ] Webhook code has error handling
- [ ] SSE events properly emitted
- [ ] All tests pass
- [ ] No code duplication

---

#### Task 2.5.2: Git commit Phase 2
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Commit Steps**:
- [ ] Run full test suite
- [ ] Stage Phase 2 files
- [ ] Create commit:
  ```
  feat(orchestration): Phase 2 - Human-in-the-loop checkpoints

  - Implement CheckpointService for checkpoint lifecycle
  - Add CheckpointController for API endpoints
  - Integrate checkpoints with orchestration runner
  - Add webhook notifications for checkpoint events
  - Add SSE events for real-time checkpoint updates
  - Implement continue/retry/abort decision flow

  Tests:
  - 28 unit tests for checkpoint service and controller
  - 8 integration tests for checkpoint flow
  - E2E tests for full approval workflow

  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```
- [ ] Push to branch
- [ ] Notify team

---

## Phase 2 Completion Checklist

- [ ] CheckpointService implemented and tested
- [ ] CheckpointController with all endpoints
- [ ] Webhook notifications working
- [ ] SSE events working
- [ ] Full checkpoint flow tested end-to-end
- [ ] Test coverage ≥ 90%
- [ ] Code review completed
- [ ] Git commit and push completed
- [ ] Both agents agree Phase 2 is complete

**Phase 2 Complete**: ☐

---

## Phase 3: Progress Updates & Streaming (Week 3-4)

**Goal**: Real-time orchestration visibility via SSE and webhooks

### 3.1 SSE Event System

#### Task 3.1.1: Define orchestration SSE events
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Document all SSE event types in `apps/api/src/agent-platform/events/orchestration-events.ts`:
  - [ ] `orchestration.started` - orchestration begins
  - [ ] `orchestration.plan.created` - plan generated
  - [ ] `orchestration.plan.approved` - plan approved
  - [ ] `orchestration.step.started` - step begins
  - [ ] `orchestration.step.progress` - step progress update
  - [ ] `orchestration.step.completed` - step finished
  - [ ] `orchestration.checkpoint` - waiting for decision
  - [ ] `orchestration.checkpoint.resolved` - decision made
  - [ ] `orchestration.completed` - all steps done
  - [ ] `orchestration.failed` - orchestration failed
- [ ] Define TypeScript interfaces for each event payload
- [ ] Export event types and interfaces

---

#### Task 3.1.1-TEST: Test event definitions
**Owner**: Tester (Claude)
**Estimated**: 1 hour

**Testing Subtasks**:
- [ ] Review event definitions
- [ ] Verify all events documented
- [ ] Check TypeScript interfaces are complete
- [ ] Test event payloads serialize correctly

---

#### Task 3.1.2: Emit orchestration lifecycle events
**Owner**: Builder
**Estimated**: 3 hours

**Subtasks**:
- [ ] Update OrchestrationRunnerService to emit events:
  - [ ] Emit `orchestration.started` when execute() begins
  - [ ] Emit `orchestration.step.started` when step starts
  - [ ] Emit `orchestration.step.progress` during step execution (if supported by agent)
  - [ ] Emit `orchestration.step.completed` when step finishes
  - [ ] Emit `orchestration.completed` when all steps done
  - [ ] Emit `orchestration.failed` on error
- [ ] Include all relevant data in event payloads (runId, stepId, progress %, etc.)
- [ ] Add tests for event emission

---

#### Task 3.1.2-TEST: Test event emission
**Owner**: Tester (Claude)
**Estimated**: 3 hours

**Testing Subtasks**:
- [ ] Capture events in tests using helper
- [ ] Test orchestration.started emitted at beginning
- [ ] Test orchestration.step.started for each step
- [ ] Test orchestration.step.completed for each step
- [ ] Test orchestration.completed at end
- [ ] Test orchestration.failed on error
- [ ] Test event payloads contain correct data
- [ ] Test events fired in correct order
- [ ] Test concurrent orchestrations emit separate events

**Test File**: `apps/api/src/agent2agent/services/__tests__/orchestration-runner-events.spec.ts`

---

### 3.2 Webhook Progress Updates

#### Task 3.2.1: Implement orchestration webhook updates
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Update `webhooks.controller.ts` to send orchestration updates
- [ ] Define webhook payload format:
  ```json
  {
    "event": "orchestration.step.progress",
    "orchestrationRunId": "uuid",
    "currentStep": "fetch-kpi-data",
    "currentStepIndex": 1,
    "totalSteps": 3,
    "status": "running",
    "percent": 33,
    "message": "Fetching KPI data from database",
    "timestamp": "ISO-8601"
  }
  ```
- [ ] Send webhook for each major event
- [ ] Add webhook retry logic
- [ ] Add rate limiting (don't spam webhooks)

---

#### Task 3.2.1-TEST: Test webhook updates
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Test webhooks sent for each event type
- [ ] Test webhook payload format correct
- [ ] Test webhook retry on failure
- [ ] Test webhook rate limiting
- [ ] Test webhook doesn't block orchestration
- [ ] Mock webhook endpoint to verify calls

**Test File**: `apps/api/src/webhooks/__tests__/orchestration-webhooks.spec.ts`

---

### 3.3 Orchestration Status Endpoint

#### Task 3.3.1: Create OrchestrationStatusService
**Owner**: Builder
**Estimated**: 2 hours

**Subtasks**:
- [ ] Create `orchestration-status.service.ts`
- [ ] Implement methods:
  - [ ] `getRunStatus(runId: string): Promise<OrchestrationStatusDto>`
  - [ ] `getStepStatus(stepId: string): Promise<StepStatusDto>`
  - [ ] `getExecutionHistory(runId: string): Promise<ExecutionHistoryDto>`
- [ ] Include real-time progress calculation
- [ ] Include estimated completion time
- [ ] Format for UI consumption

---

#### Task 3.3.1-TEST: Test OrchestrationStatusService
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Write unit tests for each method
- [ ] Test progress calculation accuracy
- [ ] Test with running orchestration
- [ ] Test with completed orchestration
- [ ] Test with failed orchestration
- [ ] Test estimated time calculation

**Test File**: `apps/api/src/agent-platform/services/__tests__/orchestration-status.service.spec.ts`

---

#### Task 3.3.2: Add status endpoints to controller
**Owner**: Builder
**Estimated**: 1 hour

**Subtasks**:
- [ ] Add to existing orchestration controller or create new
- [ ] Implement endpoints:
  - [ ] `GET /orchestrations/:runId/status` - current status
  - [ ] `GET /orchestrations/:runId/history` - execution history
  - [ ] `GET /orchestrations/:runId/steps/:stepId` - step details
- [ ] Add Swagger docs
- [ ] Add auth guards

---

#### Task 3.3.2-TEST: Test status endpoints
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Testing Subtasks**:
- [ ] Write unit tests for controller
- [ ] Write e2e tests for endpoints
- [ ] Test status updates in real-time
- [ ] Test history includes all events
- [ ] Test step details include conversation, deliverable, etc.

---

### 3.4 Phase 3 Integration Testing

#### Task 3.4.1: Full orchestration observability test
**Owner**: Tester (Claude)
**Estimated**: 4 hours

**Test Scenarios**:
- [ ] Start orchestration, verify 'started' event
- [ ] Monitor SSE stream, verify all events appear
- [ ] Check status endpoint, verify real-time updates
- [ ] Complete orchestration, verify 'completed' event
- [ ] Check webhooks were sent for all events
- [ ] Verify execution history is complete
- [ ] Test with failing orchestration
- [ ] Test with checkpoint pause

**Test File**: `apps/api/src/agent-platform/__tests__/orchestration-observability.integration.spec.ts`

---

### 3.5 Phase 3 Code Review & Git Commit

#### Task 3.5.1: Code review Phase 3
**Owner**: Tester (Claude)
**Estimated**: 2 hours

**Review all Phase 3 code for standards**

---

#### Task 3.5.2: Git commit Phase 3
**Owner**: Tester (Claude)
**Estimated**: 30 minutes

**Commit Phase 3 with message**:
```
feat(orchestration): Phase 3 - Progress updates & streaming

- Define all orchestration SSE event types
- Emit lifecycle events from OrchestrationRunner
- Implement webhook progress updates
- Add OrchestrationStatusService for real-time status
- Add status API endpoints
- Full observability for orchestration execution

Tests:
- 22 unit tests for events and status
- 6 integration tests for observability
- E2E tests for SSE and webhooks

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Phase 3 Completion Checklist

- [ ] All SSE events defined and emitted
- [ ] Webhook updates implemented
- [ ] Status endpoints working
- [ ] Full observability tested
- [ ] Test coverage ≥ 90%
- [ ] Code review completed
- [ ] Git commit and push completed
- [ ] Both agents agree Phase 3 is complete

**Phase 3 Complete**: ☐

---

## Summary of Remaining Phases

**Phase 4: New Agents Implementation** (Weeks 4-5)
- 7 agents to implement (summarizer, marketing-swarm, supabase-agent, image-generator-openai, image-generator-google, image-orchestrator, finance-manager)
- Each agent gets: code task → test task → standards review
- Contract tests for each agent
- Smoke tests for all agents

**Phase 5: KPI Tracking Orchestration** (Week 6)
- Implement kpi-tracking orchestration definition
- E2E test for full flow
- Test checkpoint approval
- Test error handling

**Phase 6: Sub-Orchestration Support** (Week 7)
- finance-manager invokes kpi-tracking
- Parent-child relationships tested
- Result aggregation tested

**Phase 7-10**: UI, Error Handling, Performance, Documentation
- Each with code tasks + test tasks + standards reviews
- Each phase committed separately

---

## Plan Metrics

**Total Phases**: 10
**Total Estimated Weeks**: 11-16 weeks
**Tasks per Phase**: 10-20 tasks
**Tests per Phase**: 50-100 tests
**Commit Cadence**: End of each phase (10 commits total)

**Testing Breakdown**:
- Unit tests: ~400 tests total
- Integration tests: ~80 tests total
- E2E tests: ~30 tests total
- Contract tests: ~20 tests total

**Test Coverage Goals**:
- Core services: 90%+
- Repositories: 85%+
- Controllers: 80%+
- Overall: 85%+

---

## Key Principles

1. **No code without tests**: Every coding task has immediate testing task
2. **Tester owns quality**: All tests written by Claude
3. **Standards enforced**: Code review after every phase
4. **Incremental commits**: One commit per phase (never incomplete work)
5. **Both agents agree**: Phase only complete when both check it off
6. **Human involvement**: Only at quality gates (Phase 5, 10)

---

## Next Steps

1. Builder agent creates their version of plan
2. Both agents compare plans and merge
3. Human approves final unified plan
4. Begin Phase 1 implementation
5. Tester commits Phase 1 when complete
6. Repeat for remaining phases

**Ready to collaborate on unified plan!**

---

## Codex Notes (Builder Review)

Overall this tester-focused plan for phases 1–3 is extremely thorough—thank you. A few gaps I spotted while comparing against my builder track:

1. **Environment & Baseline Preparation**  
   - Before Phase 1 starts we should explicitly call out the environment readiness work (Supabase reset, seed data refresh, lint baseline) so the tester can verify the ground truth matches what the runner expects.

2. **Later Phases Need the Same Task/Test Breakdown**  
   - The summary bullets for Phases 4–10 are helpful, but the PRD asks for detailed tasks with adjacent testing work. Let’s mirror the structure you used for Phase 1–3 so we can both track progress phase by phase.

3. **Observability Hooks vs. TaskStatus Cache**  
   - In Phase 3 we emit SSE/webhook events, but we should also confirm TaskStatusService integration (or any in-memory caches) is exercised and tested—the plan doesn’t explicitly list that verification.

4. **Documentation & Release Readiness**  
   - Later phases (documentation, production checklist) will need concrete checklist items/testing just like coding tasks. We can fold those into the detailed breakdown when you expand the remaining phases.

I’m happy to help reconcile these once you expand the later phases—this already gives us a strong template.
