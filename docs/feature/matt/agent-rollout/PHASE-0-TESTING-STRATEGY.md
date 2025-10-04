# Phase 0: Testing Strategy - Build the Safety Net FIRST

## Why Testing in Phase 0?

**Perfect Timing:**
- You're deleting 50% of the code
- You need confidence things still work
- Tests document what SHOULD work
- Tests prevent regressions in Phases 1-5

**The Safety Net:**
Before you delete → write tests for what must survive
After you delete → tests prove it still works
During Phases 1-5 → tests catch regressions

## Testing Philosophy

### Test What Matters
**DO test:**
- ✅ API endpoints (E2E)
- ✅ Service layer (Integration)
- ✅ Critical business logic (Unit)

**DON'T test:**
- ❌ Code you're deleting
- ❌ Implementation details
- ❌ Trivial getters/setters

### Test Placement

```
apps/api/
├── test/                           # E2E tests (API level)
│   ├── agent2agent/
│   │   ├── conversations.e2e.spec.ts
│   │   ├── tasks.e2e.spec.ts
│   │   ├── deliverables.e2e.spec.ts
│   │   └── agent-execution.e2e.spec.ts
│   └── jest-e2e.json
│
└── src/
    └── agent2agent/
        ├── services/
        │   ├── agent-conversations.service.ts
        │   ├── agent-conversations.service.spec.ts      # Unit tests
        │   ├── agent-tasks.service.ts
        │   ├── agent-tasks.service.spec.ts
        │   ├── agent-deliverables.service.ts
        │   ├── agent-deliverables.service.spec.ts
        │   └── agent-mode-router.service.spec.ts
        │
        └── controllers/
            └── agent2agent.controller.spec.ts            # Integration tests
```

## Test Levels

### 1. E2E Tests (API Level)
**Location:** `apps/api/test/agent2agent/`

**What:** Full request → response flows
**Tools:** Supertest + NestJS testing utilities
**Database:** Real database (test instance)

**Key Tests:**
```typescript
// test/agent2agent/conversations.e2e.spec.ts
describe('Agent Conversations API (E2E)', () => {
  it('should create conversation for database agent', async () => {
    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        agentName: 'blog_post_writer',
        namespace: 'my-org'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.agentName).toBe('blog_post_writer');
  });

  it('should list user conversations', async () => {
    const response = await request(app.getHttpServer())
      .get('/agent-to-agent/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('conversations');
    expect(Array.isArray(response.body.conversations)).toBe(true);
  });
});

// test/agent2agent/agent-execution.e2e.spec.ts
describe('Agent Execution (E2E)', () => {
  it('should execute context agent in converse mode', async () => {
    // Create conversation
    const convResponse = await createConversation('blog_post_writer');
    const conversationId = convResponse.body.id;

    // Execute task
    const taskResponse = await request(app.getHttpServer())
      .post(`/agent-to-agent/my-org/blog_post_writer/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        mode: 'converse',
        userMessage: 'Help me write a blog post about AI',
        conversationId
      })
      .expect(201);

    expect(taskResponse.body).toHaveProperty('id');
    expect(taskResponse.body.status).toBe('pending');

    // Wait for completion (or use WebSocket in real test)
    await waitForTaskCompletion(taskResponse.body.id);
  });

  it('should execute function agent', async () => {
    const response = await request(app.getHttpServer())
      .post('/agent-to-agent/my-org/image_generator/tasks')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        mode: 'build',
        userMessage: 'Generate image of a sunset',
        conversationId: convId
      })
      .expect(201);

    expect(response.body.status).toBe('pending');
  });
});
```

### 2. Integration Tests (Service + Repository)
**Location:** `apps/api/src/agent2agent/services/*.spec.ts`

**What:** Service methods with real dependencies
**Tools:** NestJS testing utilities
**Database:** Test database or mocks

**Key Tests:**
```typescript
// src/agent2agent/services/agent-conversations.service.spec.ts
describe('Agent2AgentConversationsService (Integration)', () => {
  let service: Agent2AgentConversationsService;
  let supabaseService: SupabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        Agent2AgentConversationsService,
        SupabaseService,
        // ... other providers
      ],
    }).compile();

    service = module.get(Agent2AgentConversationsService);
    supabaseService = module.get(SupabaseService);
  });

  it('should create conversation with correct schema', async () => {
    const conversation = await service.createConversation(
      'user-123',
      'blog_post_writer',
      'my-org',
      { conversationId: 'conv-456' }
    );

    expect(conversation.id).toBe('conv-456');
    expect(conversation.agentName).toBe('blog_post_writer');
    expect(conversation.namespace).toBe('my-org');
    expect(conversation.userId).toBe('user-123');
  });

  it('should list conversations for user', async () => {
    const conversations = await service.listConversations('user-123', {
      limit: 10
    });

    expect(Array.isArray(conversations.conversations)).toBe(true);
    expect(conversations.total).toBeGreaterThanOrEqual(0);
  });
});
```

### 3. Unit Tests (Pure Logic)
**Location:** `apps/api/src/agent2agent/services/*.spec.ts`

**What:** Pure functions, business logic
**Tools:** Jest
**Dependencies:** All mocked

**Key Tests:**
```typescript
// src/agent2agent/services/agent-mode-router.service.spec.ts
describe('AgentModeRouterService (Unit)', () => {
  let service: AgentModeRouterService;
  let mockDispatcher: jest.Mocked<AgentRuntimeDispatchService>;

  beforeEach(() => {
    mockDispatcher = {
      dispatch: jest.fn(),
    } as any;

    service = new AgentModeRouterService(
      mockRegistry,
      mockDefinitions,
      mockPromptBuilder,
      mockDispatcher,
      // ... other mocks
    );
  });

  it('should route to converse handler for converse mode', async () => {
    const request = { mode: AgentTaskMode.CONVERSE, userMessage: 'Hello' };
    await service.execute({ agent: mockAgent, request });

    expect(mockDispatcher.dispatch).toHaveBeenCalled();
  });

  it('should reject plan mode for conversation-only agents', async () => {
    const conversationOnlyAgent = {
      ...mockAgent,
      execution_profile: 'conversation_only'
    };

    const request = { mode: AgentTaskMode.PLAN, userMessage: 'Plan this' };

    await expect(
      service.execute({ agent: conversationOnlyAgent, request })
    ).rejects.toThrow('Agent does not support plan mode');
  });
});
```

## Phase 0 Testing Implementation

### Pragmatic Approach: Minimal Smoke Tests + CI/CD

**Philosophy:**
- ✅ Automated tests that run in CI/CD
- ✅ Minimal smoke tests to catch breaking changes
- ✅ Fast feedback loop (< 30 seconds)
- ✅ Test critical paths: deliverables, conversations, tasks
- ❌ NO manual testing checklists
- ❌ NO comprehensive coverage requirements (save for Phases 1-5)

### Phase 0 Unique Challenges

**Testing the Archive Approach:**
1. Ensure no imports from `_archive-phase-0/`
2. Verify deliverables work after move to `agent2agent/`
3. Confirm frontend works without `agent.source` routing
4. Validate namespace filtering still works

**Testing the Consolidation:**
1. Deliverables API works from new location (`agent2agent/deliverables/`)
2. All deliverable endpoints still functional
3. Import paths updated correctly throughout codebase

### Phase 0.1: Minimal Smoke Tests BEFORE Deleting (2 hours)

**Bash script with curl calls using Supabase auth:**

```bash
#!/bin/bash
# test/agent2agent/smoke-test.sh

set -e  # Exit on error

# Configuration
API_URL="http://localhost:7100/api"
SUPABASE_URL="http://localhost:54321"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="testpassword123"

echo "🧪 Agent2Agent Smoke Tests"
echo "=========================="

# 1. Authenticate and get token
echo "1️⃣  Authenticating test user..."
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

ACCESS_TOKEN=$(echo $AUTH_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Authentication failed"
  exit 1
fi
echo "✅ Authenticated"

# 2. List conversations
echo ""
echo "2️⃣  Listing conversations..."
CONVERSATIONS=$(curl -s -X GET "${API_URL}/agent2agent/conversations" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo $CONVERSATIONS | jq -e '.conversations' > /dev/null; then
  echo "✅ Conversations endpoint working"
else
  echo "❌ Conversations endpoint failed"
  exit 1
fi

# 3. Get hierarchy
echo ""
echo "3️⃣  Getting agent hierarchy..."
HIERARCHY=$(curl -s -X GET "${API_URL}/.well-known/agent-hierarchy" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo $HIERARCHY | jq -e '.orchestrators' > /dev/null; then
  echo "✅ Hierarchy endpoint working"
else
  echo "❌ Hierarchy endpoint failed"
  exit 1
fi

# 4. Create conversation (optional - comment out if not needed)
# echo ""
# echo "4️⃣  Creating conversation..."
# CONV_RESPONSE=$(curl -s -X POST "${API_URL}/agent2agent/conversations" \
#   -H "Authorization: Bearer ${ACCESS_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d '{"agent_slug":"blog_post_writer"}')

echo ""
echo "=========================="
echo "✅ All smoke tests passed!"
```

**That's it.** 3 curl tests, < 10 seconds to run, catches 90% of breaking changes.

### Phase 0.2: Enhanced Smoke Tests for Phase 0 Changes

Add deliverables testing to smoke tests:

```bash
#!/bin/bash
# test/agent2agent/enhanced-smoke-test.sh

# ... (auth and conversations tests as above)

# 4. Test deliverables endpoint (CRITICAL - moved to agent2agent/)
echo ""
echo "4️⃣  Testing deliverables API..."

# Create a test conversation first
CONV_RESPONSE=$(curl -s -X POST "${API_URL}/agent2agent/conversations" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"agent_slug":"blog_post_writer","namespace":"my-org"}')

CONV_ID=$(echo $CONV_RESPONSE | jq -r '.id')

if [ "$CONV_ID" = "null" ]; then
  echo "❌ Failed to create test conversation"
  exit 1
fi

# Test deliverables endpoint
DELIVERABLES=$(curl -s -X GET "${API_URL}/agent2agent/deliverables/conversation/${CONV_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo $DELIVERABLES | jq -e '.' > /dev/null; then
  echo "✅ Deliverables endpoint working (moved to agent2agent/)"
else
  echo "❌ Deliverables endpoint failed"
  exit 1
fi

# 5. Test namespace filtering
echo ""
echo "5️⃣  Testing namespace filtering..."
NAMESPACED_CONVS=$(curl -s -X GET "${API_URL}/agent2agent/conversations?namespace=my-org" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo $NAMESPACED_CONVS | jq -e '.conversations' > /dev/null; then
  echo "✅ Namespace filtering working"
else
  echo "❌ Namespace filtering failed"
  exit 1
fi

echo ""
echo "=========================="
echo "✅ All Phase 0 smoke tests passed!"
echo "   - Auth ✅"
echo "   - Conversations ✅"
echo "   - Hierarchy ✅"
echo "   - Deliverables (agent2agent/) ✅"
echo "   - Namespace filtering ✅"
```

### Phase 0.3: Archive Validation Tests

Add static analysis to verify no imports from archive:

```bash
#!/bin/bash
# test/agent2agent/validate-archive.sh

echo "🔍 Validating archive isolation..."

# Check for any imports from _archive-phase-0/
ARCHIVE_IMPORTS=$(grep -r "from.*_archive-phase-0" apps/api/src 2>/dev/null || true)

if [ -n "$ARCHIVE_IMPORTS" ]; then
  echo "❌ Found imports from archive directory:"
  echo "$ARCHIVE_IMPORTS"
  exit 1
fi

# Check for old deliverables path imports
OLD_DELIVERABLES=$(grep -r "from '@/deliverables/" apps/api/src --exclude-dir=agent2agent 2>/dev/null || true)

if [ -n "$OLD_DELIVERABLES" ]; then
  echo "❌ Found old deliverables imports (should be '@/agent2agent/deliverables/'):"
  echo "$OLD_DELIVERABLES"
  exit 1
fi

# Check for agent.source references in frontend
AGENT_SOURCE_REFS=$(grep -r "agent\.source" apps/web/src 2>/dev/null || true)

if [ -n "$AGENT_SOURCE_REFS" ]; then
  echo "❌ Found agent.source references (should be removed):"
  echo "$AGENT_SOURCE_REFS"
  exit 1
fi

echo "✅ Archive validation passed!"
echo "   - No imports from _archive-phase-0/ ✅"
echo "   - Deliverables paths updated ✅"
echo "   - No agent.source routing ✅"
```

### Phase 0.4: Build Error Detection

Test that build succeeds after changes:

```bash
#!/bin/bash
# test/agent2agent/validate-build.sh

echo "🔨 Validating build after Phase 0 changes..."

# Backend build
echo "Building backend..."
cd apps/api
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Backend build failed"
  exit 1
fi
echo "✅ Backend build succeeded"

# Frontend build
echo "Building frontend..."
cd ../web
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Frontend build failed"
  exit 1
fi
echo "✅ Frontend build succeeded"

echo ""
echo "✅ All builds passed!"
```

### Phase 0.5: Integration Test Plan

Run all smoke tests in sequence:

```bash
#!/bin/bash
# test/agent2agent/run-all-phase-0-tests.sh

echo "🧪 Running all Phase 0 validation tests..."
echo "==========================================="

# 1. Archive validation (static)
./test/agent2agent/validate-archive.sh
if [ $? -ne 0 ]; then exit 1; fi

# 2. Build validation
./test/agent2agent/validate-build.sh
if [ $? -ne 0 ]; then exit 1; fi

# 3. Start API (background)
cd apps/api
npm run dev:api &
API_PID=$!
sleep 5  # Wait for API to start

# 4. Run smoke tests
cd ../..
./test/agent2agent/enhanced-smoke-test.sh
SMOKE_RESULT=$?

# 5. Cleanup
kill $API_PID

if [ $SMOKE_RESULT -ne 0 ]; then
  echo "❌ Smoke tests failed"
  exit 1
fi

echo ""
echo "==========================================="
echo "✅ All Phase 0 tests passed!"
echo "   - Archive isolation ✅"
echo "   - Builds successful ✅"
echo "   - API functional ✅"
echo "   - Deliverables working ✅"
echo "   - Namespace filtering ✅"
echo ""
echo "Ready for Phase 1! 🚀"
```

### Phase 0.6: CI/CD Integration (0.5 days)

Add comprehensive Phase 0 validation to GitHub Actions:

```yaml
# .github/workflows/phase-0-validation.yml
name: Phase 0 Validation

on:
  push:
    branches: [feature/agent-platform]
  pull_request:
    branches: [main, feature/agent-platform]

jobs:
  phase-0-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci --prefix apps/api
          npm ci --prefix apps/web

      - name: Validate archive isolation
        run: |
          chmod +x test/agent2agent/validate-archive.sh
          ./test/agent2agent/validate-archive.sh
        timeout-minutes: 1

      - name: Build backend
        run: npm run build --prefix apps/api
        timeout-minutes: 5

      - name: Build frontend
        run: npm run build --prefix apps/web
        timeout-minutes: 5

      - name: Start Supabase (local)
        run: |
          npx supabase start
        timeout-minutes: 3

      - name: Run smoke tests
        run: |
          chmod +x test/agent2agent/enhanced-smoke-test.sh
          npm run dev:api --prefix apps/api &
          sleep 10  # Wait for API to start
          ./test/agent2agent/enhanced-smoke-test.sh
        timeout-minutes: 3
        env:
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Summary
        if: success()
        run: |
          echo "✅ All Phase 0 validations passed!"
          echo "   - Archive isolation ✅"
          echo "   - Builds successful ✅"
          echo "   - Smoke tests passed ✅"
```

**Comprehensive testing comes in Phases 1-5** when features are being built.

## Test Data Strategy

### Test Database Setup
```typescript
// test/setup.ts
beforeAll(async () => {
  // Create test database
  await createTestDatabase();

  // Seed test agents
  await seedTestAgents([
    {
      slug: 'blog_post_writer',
      agent_type: 'context',
      status: 'active',
      // ... config
    },
    {
      slug: 'image_generator',
      agent_type: 'function',
      function_code: '...',
      status: 'active'
    }
  ]);
});

afterAll(async () => {
  await cleanupTestDatabase();
});
```

### Fixtures
```typescript
// test/fixtures/agents.fixture.ts
export const TEST_AGENTS = {
  blogPostWriter: {
    slug: 'blog_post_writer',
    name: 'Blog Post Writer',
    agent_type: 'context',
    execution_profile: 'autonomous_build',
    status: 'active',
    // ... complete config
  },

  hrAgent: {
    slug: 'hr_agent',
    agent_type: 'context',
    execution_profile: 'conversation_only',
    status: 'active',
    // ... complete config
  },

  imageGenerator: {
    slug: 'image_generator',
    agent_type: 'function',
    function_code: FUNCTION_CODE_FIXTURES.imageGenerator,
    status: 'active',
    // ... complete config
  }
};
```

## Test Coverage Goals

### Phase 0: Smoke Tests Only
- **Goal:** Prove agent2agent works after cleanup
- **Coverage:** 3 critical happy paths
- **Time:** < 30 seconds to run
- **No coverage % requirements** - just working software

### Phases 1-5: Build Comprehensive Coverage
- E2E: 90% of critical paths (added incrementally per phase)
- Integration: 80% of services (added as features built)
- Unit: 80% of business logic (added where needed)

## Testing Commands

```json
// apps/api/package.json
{
  "scripts": {
    // Phase 0: Smoke tests only (PRIORITY)
    "test:smoke": "./test/agent2agent/smoke-test.sh",

    // Run all tests (for later phases)
    "test": "npm run test:smoke && npm run test:unit && npm run test:e2e",

    // Unit tests (add in Phases 1-5)
    "test:unit": "jest --testPathPattern=src/.*\\.spec\\.ts$",

    // E2E tests (comprehensive - add in Phases 1-5)
    "test:e2e": "jest --config ./test/jest-e2e.json",

    // Watch mode
    "test:watch": "jest --watch",

    // Coverage (Phases 1-5)
    "test:cov": "jest --coverage"
  }
}
```

**Phase 0 command:**
```bash
npm run test:smoke

# Or run directly:
./test/agent2agent/smoke-test.sh
```

## Phase 0 Testing Checklist

### Before Moving Code to Archive

- [ ] All test scripts created and executable
- [ ] `chmod +x test/agent2agent/*.sh`
- [ ] Environment variables configured (SUPABASE_ANON_KEY)
- [ ] Test user exists in Supabase (test@example.com)
- [ ] Run baseline tests:
  - [ ] `./test/agent2agent/enhanced-smoke-test.sh` passes ✅
  - [ ] `./test/agent2agent/validate-build.sh` passes ✅
- [ ] Archive README and .claude.md warnings ready

### After Moving to _archive-phase-0/

- [ ] `./test/agent2agent/validate-archive.sh` passes ✅
  - [ ] No imports from _archive-phase-0/
  - [ ] Old deliverables paths updated
  - [ ] No agent.source routing
- [ ] Archive committed to git with warnings

### After Removing Imports

- [ ] `npm run build` succeeds in apps/api ✅
- [ ] `npm run build` succeeds in apps/web ✅
- [ ] No TypeScript errors
- [ ] TRIAGE-DECISIONS.md updated with all decisions

### After Consolidating Deliverables

- [ ] Deliverables moved to `agent2agent/deliverables/`
- [ ] All import paths updated
- [ ] `./test/agent2agent/enhanced-smoke-test.sh` passes ✅
  - [ ] Deliverables API works from new location
  - [ ] Conversations API works
  - [ ] Namespace filtering works

### After Frontend Cleanup

- [ ] Frontend services renamed (no agent2agent prefix)
- [ ] Frontend store renamed to agentChatStore
- [ ] All agent.source checks removed
- [ ] Namespace filtering preserved
- [ ] `npm run build` succeeds in apps/web ✅

### Final Validation

- [ ] `./test/agent2agent/run-all-phase-0-tests.sh` passes ✅
- [ ] CI/CD workflow added to GitHub Actions
- [ ] No orphaned test files
- [ ] API starts without errors: `npm run dev:api`
- [ ] blog_post_writer conversations work end-to-end
- [ ] Ready for Phase 1 ✅

## Test File Structure

### Phase 0: Enhanced Test Structure
```
apps/api/
├── test/
│   └── agent2agent/
│       ├── enhanced-smoke-test.sh          ← Main smoke tests (5 checks)
│       ├── validate-archive.sh             ← Static analysis (no archive imports)
│       ├── validate-build.sh               ← Build verification
│       └── run-all-phase-0-tests.sh        ← Master script (runs all)
```

**All Phase 0 test scripts:**
1. **enhanced-smoke-test.sh**: API smoke tests (auth, conversations, deliverables, namespace)
2. **validate-archive.sh**: Static checks (no archive imports, paths updated, no agent.source)
3. **validate-build.sh**: Build success verification (backend + frontend)
4. **run-all-phase-0-tests.sh**: Master orchestrator (runs all tests in sequence)

### Phases 1-5: Comprehensive Structure (Build Later)
```
apps/api/
├── test/
│   ├── agent2agent/
│   │   ├── smoke-test.sh                  Phase 0 ✅ (curl-based)
│   │   ├── agent-execution.e2e.spec.ts    Phase 1 (Jest + curl)
│   │   ├── conversations.e2e.spec.ts      Phase 1
│   │   ├── deliverables.e2e.spec.ts       Phase 1
│   │   ├── hierarchy.e2e.spec.ts          Phase 2
│   │   └── orchestration.e2e.spec.ts      Phase 5
│   ├── fixtures/
│   │   └── auth.sh                         Reusable auth helper
│   └── jest-e2e.json
│
└── src/agent2agent/services/
    └── *.spec.ts                           Add in Phases 1-5
```

## Success Metrics

Phase 0 testing is successful when:

- ✅ Smoke tests prove agent2agent works after cleanup
- ✅ Tests run in < 10 seconds
- ✅ CI/CD catches breaking changes
- ✅ Zero manual testing required
- ✅ Uses real Supabase auth (not mocked)
- ✅ Ready to build Phase 1 features with confidence

## Benefits for Phases 1-5

**With smoke tests from Phase 0:**

**Phase 1 (Context Agents):**
- Build comprehensive E2E tests for deliverable workflow
- Add integration tests for services as you build them
- Extend smoke tests to cover new happy paths

**Phase 2 (Conversation-Only):**
- Test execution profile enforcement
- Add tests for conversation-only UI adaptations

**Phase 3 (API Agents):**
- Test webhook/callback flow
- Test n8n integration
- Add external agent tests

**Phase 4 (Migration):**
- Smoke tests catch migration regressions
- Add parity tests comparing file vs database

**Phase 5 (Orchestration):**
- Test multi-step workflows
- Test nested orchestrations
- Comprehensive orchestration E2E suite

## The Testing Mindset

**Phase 0: Just enough to catch breaking changes**
- 3 smoke tests
- < 30 seconds
- Automated in CI/CD

**Phases 1-5: Build comprehensive coverage as you build features**
- Tests are not overhead
- Tests are freedom to refactor and ship fast

---

## Phase 0 Testing Summary

**Test Scripts to Create (2 hours):**

1. **enhanced-smoke-test.sh** - Core API validation
   - Auth + token generation
   - Conversations list
   - Hierarchy endpoint
   - Deliverables API (new location)
   - Namespace filtering

2. **validate-archive.sh** - Static analysis
   - No imports from _archive-phase-0/
   - Deliverables paths updated
   - No agent.source routing

3. **validate-build.sh** - Build verification
   - Backend build succeeds
   - Frontend build succeeds

4. **run-all-phase-0-tests.sh** - Master orchestrator
   - Runs all tests in sequence
   - Single command validation

**Testing Commands:**

```json
// apps/api/package.json
{
  "scripts": {
    "test:smoke": "./test/agent2agent/enhanced-smoke-test.sh",
    "test:archive": "./test/agent2agent/validate-archive.sh",
    "test:build": "./test/agent2agent/validate-build.sh",
    "test:phase-0": "./test/agent2agent/run-all-phase-0-tests.sh"
  }
}
```

**Execution Order:**

```bash
# Phase 0.0: Create tests (before any changes)
1. Create all 4 test scripts
2. chmod +x test/agent2agent/*.sh
3. Run baseline: npm run test:phase-0

# Phase 0.1-0.3: Make changes
4. Move code to _archive-phase-0/
5. Run: npm run test:archive (should pass)
6. Remove imports
7. Run: npm run test:build (should pass)
8. Consolidate deliverables
9. Run: npm run test:smoke (should pass)
10. Frontend cleanup
11. Run: npm run test:phase-0 (all should pass)

# Phase 0.4: CI/CD
12. Add GitHub Actions workflow
13. Push to feature branch
14. Verify CI passes ✅

# Ready for Phase 1! 🚀
```

**Timeline:** 2 hours for test creation, integrated into Phase 0 workflow
**ROI:** Safety net catches regressions, validates archive isolation, proves deliverables consolidation works

**Next Steps:** Phase 1 adds comprehensive E2E tests as features are built
