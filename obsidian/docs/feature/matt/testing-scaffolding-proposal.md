# Phase 0 Testing Scaffolding Proposal (Claude - Tester)

**Date**: 2025-10-12T14:45:00Z
**Author**: Claude (Tester)
**Purpose**: Inventory existing test helpers and propose additions for orchestration testing

## Executive Summary

**Current State**: Tests use inline mocks with no centralized helper infrastructure.
**Proposal**: Create 4 test helper modules to reduce duplication and improve orchestration test quality.

---

## Existing Test Patterns

### 1. Repository Tests (Unit with Mocks)

**Pattern Found** ([agents.repository.spec.ts](apps/api/src/agent-platform/repositories/agents.repository.spec.ts:3-9)):
```typescript
const createSupabaseMock = () => {
  const fromMock = jest.fn();
  const service: Partial<SupabaseService> = {
    getServiceClient: jest.fn(() => ({ from: fromMock }) as any),
  };
  return { fromMock, service: service as SupabaseService };
};
```

**Assessment**:
- ✅ Works for basic repository tests
- ❌ Duplicated across 5+ test files
- ❌ Doesn't handle query chain complexity (eq, is, limit, etc.)
- ❌ No transaction support for integration tests

### 2. No Test Data Factories

**Current State**: Each test creates data inline (agents.repository.spec.ts:16-32)
**Problem**: 30+ lines of sample data per test, high duplication

### 3. No Integration Test Setup

**Current State**: No integration test files found
**Problem**: Can't test database interactions end-to-end

### 4. No SSE Testing Utilities

**Current State**: No SSE/webhook test helpers found
**Problem**: Orchestration Phase 3 needs SSE stream validation

---

## Proposed Test Helper Modules

### Helper 1: Database Test Utilities

**Location**: `apps/api/src/__tests__/helpers/database-helper.ts`

**Purpose**: Database setup/teardown, transactions, cleanup

**Proposed Interface**:
```typescript
export class DatabaseTestHelper {
  // Setup/teardown
  static async setupTestDatabase(): Promise<void>
  static async teardownTestDatabase(): Promise<void>

  // Transaction support
  static async withTransaction<T>(fn: () => Promise<T>): Promise<T>

  // Cleanup utilities
  static async cleanupTestData(prefix: string): Promise<void>
  static async truncateTable(tableName: string): Promise<void>

  // Auth helper
  static async authenticateTestUser(): Promise<string> // returns JWT token

  // Query helpers
  static async rawQuery<T>(sql: string, params?: any[]): Promise<T[]>
}
```

**Usage** (in integration tests):
```typescript
beforeAll(async () => {
  await DatabaseTestHelper.setupTestDatabase();
  authToken = await DatabaseTestHelper.authenticateTestUser();
});

afterEach(async () => {
  await DatabaseTestHelper.cleanupTestData('test-orch-');
});

it('creates orchestration', async () => {
  await DatabaseTestHelper.withTransaction(async () => {
    // test code here
  });
});
```

**Estimated Effort**: 4 hours

---

### Helper 2: Mock Factories

**Location**: `apps/api/src/__tests__/helpers/mock-factories.ts`

**Purpose**: Create test data objects with sensible defaults

**Proposed Interface**:
```typescript
export class MockFactories {
  // Agent factories
  static createAgent(overrides?: Partial<Agent>): Agent
  static createContextAgent(overrides?: Partial<Agent>): Agent
  static createApiAgent(overrides?: Partial<Agent>): Agent
  static createToolAgent(overrides?: Partial<Agent>): Agent
  static createFunctionAgent(overrides?: Partial<Agent>): Agent

  // Orchestration factories
  static createOrchestrationDefinition(overrides?: Partial<OrchestrationDefinition>): OrchestrationDefinition
  static createOrchestrationRun(overrides?: Partial<OrchestrationRun>): OrchestrationRun
  static createOrchestrationStep(overrides?: Partial<OrchestrationStep>): OrchestrationStep

  // Supporting entities
  static createConversation(overrides?: Partial<Conversation>): Conversation
  static createDeliverable(overrides?: Partial<Deliverable>): Deliverable
  static createTask(overrides?: Partial<Task>): Task
}
```

**Usage**:
```typescript
it('upserts agent', async () => {
  const agent = MockFactories.createContextAgent({
    slug: 'test-agent',
    organization_slug: 'test-org'
  });

  const result = await repo.upsert(agent);
  expect(result.slug).toBe('test-agent');
});
```

**Estimated Effort**: 6 hours

---

### Helper 3: Supabase Mock Builder

**Location**: `apps/api/src/__tests__/helpers/supabase-mock-builder.ts`

**Purpose**: Fluent API for building complex Supabase mocks

**Proposed Interface**:
```typescript
export class SupabaseMockBuilder {
  static create(): SupabaseMockBuilder

  // Chain methods
  withTable(tableName: string): SupabaseMockBuilder
  withSelect(data: any[]): SupabaseMockBuilder
  withInsert(data: any): SupabaseMockBuilder
  withUpdate(data: any): SupabaseMockBuilder
  withUpsert(data: any): SupabaseMockBuilder
  withError(error: any): SupabaseMockBuilder

  // Build
  build(): SupabaseService
}
```

**Usage**:
```typescript
it('handles insert error', async () => {
  const supabase = SupabaseMockBuilder
    .create()
    .withTable('agents')
    .withInsert(null)
    .withError({ message: 'unique violation' })
    .build();

  const repo = new AgentsRepository(supabase);
  await expect(repo.create(agent)).rejects.toThrow('unique violation');
});
```

**Estimated Effort**: 5 hours

---

### Helper 4: SSE & Webhook Test Utilities

**Location**: `apps/api/src/__tests__/helpers/sse-test-helper.ts`

**Purpose**: Capture and assert on SSE events and webhooks

**Proposed Interface**:
```typescript
export class SSETestHelper {
  // SSE stream capture
  static captureSSEStream(url: string): SSEStreamCapture

  // Webhook mock server
  static createWebhookServer(port: number): WebhookServerMock
}

export class SSEStreamCapture {
  async waitForEvent(eventType: string, timeout?: number): Promise<SSEEvent>
  async waitForEvents(count: number, timeout?: number): Promise<SSEEvent[]>
  getAllEvents(): SSEEvent[]
  close(): void
}

export class WebhookServerMock {
  getReceivedWebhooks(): WebhookPayload[]
  waitForWebhook(timeout?: number): Promise<WebhookPayload>
  close(): void
}
```

**Usage** (Phase 3 observability tests):
```typescript
it('emits SSE events during orchestration', async () => {
  const sseCapture = SSETestHelper.captureSSEStream(
    'http://localhost:7100/api/orchestrations/stream/run-123'
  );

  // Start orchestration
  await orchestrationService.execute({ ... });

  // Assert on events
  const startedEvent = await sseCapture.waitForEvent('orchestration.started');
  expect(startedEvent.data.runId).toBe('run-123');

  const completedEvent = await sseCapture.waitForEvent('orchestration.completed');
  expect(completedEvent.data.status).toBe('completed');

  sseCapture.close();
});
```

**Estimated Effort**: 8 hours

---

## TaskStatusService Baseline

### Current Implementation

**Location**: Apps/api/src/agent2agent/tasks/* (inferred from test references)

**Purpose**: In-memory cache for task status tracking

**Current Behavior** (requires verification when Supabase running):
- Caches task status in memory
- Provides real-time status lookups
- Integration point: Task lifecycle events

**Integration Points for Orchestration**:
1. **Orchestration Start**: Create orchestration run → emit task status
2. **Step Execution**: Each step creates task → update task status cache
3. **Checkpoint Pause**: Pause orchestration → update task status to 'waiting'
4. **Orchestration Complete**: Final step done → update orchestration task status

**Proposed Testing Strategy**:
```typescript
describe('TaskStatusService with Orchestration', () => {
  it('caches orchestration run status', async () => {
    const run = await orchestrationService.start({ ... });

    const status = await taskStatusService.getStatus(run.taskId);
    expect(status.status).toBe('running');
    expect(status.metadata.orchestrationRunId).toBe(run.id);
  });

  it('updates cache when step completes', async () => {
    // Start orchestration with 2 steps
    const run = await orchestrationService.start({ ... });

    // Complete first step
    await orchestrationService.completeStep(run.id, 'step-1');

    // Verify cache updated
    const status = await taskStatusService.getStatus(run.taskId);
    expect(status.metadata.completedSteps).toContain('step-1');
  });
});
```

**Note**: Full baseline requires live Supabase instance to inspect actual behavior.

---

## Implementation Priority

**Phase 0** (before Phase 1 starts):
1. ⚠️ Helper 2: Mock Factories (6 hours) - **IMPLEMENTED BUT NEEDS TYPE ALIGNMENT**
2. ⚠️ Helper 1: Database Test Utilities (4 hours) - **IMPLEMENTED BUT NEEDS TYPE ALIGNMENT**

**Phase 1** (during integration tests):
3. ⏳ Helper 3: Supabase Mock Builder (5 hours) - **NICE TO HAVE**

**Phase 3** (observability testing):
4. ⏳ Helper 4: SSE & Webhook Utilities (8 hours) - **REQUIRED FOR PHASE 3**

---

## Acceptance Criteria

**Phase 0 Complete** when:
- ⚠️ Mock Factories implemented with 10+ factory methods (DONE but needs type alignment)
- ⚠️ Database Test Utilities implemented with transaction support (DONE but needs type alignment)
- ❌ Integration test can authenticate using SUPABASE_TEST_USER (blocked by type issues)
- ❌ Integration test can cleanup test data automatically (blocked by type issues)
- ✅ TaskStatusService baseline documented (pending live instance)

**Status**: ⚠️ **Partially Complete** - See [phase0-test-helpers-status.md](phase0-test-helpers-status.md) for details

**Phase 1 Ready** when:
- ❌ Types aligned with actual database schema
- ❌ Validation tests passing
- ❌ First orchestration unit test uses Mock Factories
- ❌ First orchestration integration test uses Database Helper

**Phase 3 Ready** when:
- ✅ SSE Test Helper implemented
- ✅ Webhook mock server working
- ✅ Full observability test uses both helpers

---

## Risk Assessment

**Risk 1: Time Investment** (Medium)
- 23 hours total effort for all 4 helpers
- Mitigation: Implement incrementally per phase

**Risk 2: Over-Engineering** (Low)
- Helpers might be too complex for simple tests
- Mitigation: Keep interfaces simple, optional usage

**Risk 3: Maintenance Burden** (Low)
- Helpers need updates as schema evolves
- Mitigation: Co-locate with tests, update incrementally

---

## Recommendation

✅ **APPROVED** - Proceed with Phase 0 implementation (Mock Factories + Database Utilities)

**Estimated Time**: 10 hours (1.25 days)
**Start**: After Codex completes lint baseline
**Completion Target**: Before Phase 1 starts

**Next Steps**:
1. Create `apps/api/src/__tests__/helpers/` directory
2. Implement Mock Factories first (most impactful)
3. Implement Database Test Utilities second
4. Write validation tests for both helpers
5. Update this document with "Implemented" status

---

**Prepared By**: Claude (Tester)
**Date**: 2025-10-12T14:45:00Z
