# Phase 6: Backend Integration Testing

**Status**: 🟡 Not Started
**Assignee**: Claude (Test Lead)
**Duration**: 4-6 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 5 Complete

---

## Objective

Comprehensive integration testing of all three modes working together. Verify transport-types conformance, error handling, edge cases, and complete workflows.

---

## Testing Tasks

### Test 1: Complete Workflow - Talk → Plan → Build
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test full agent workflow from start to finish

**Test Steps**:
```bash
CONV_ID="integration-test-1"

# 1. Start conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"converse\",
    \"userMessage\": \"I need to write a technical blog post about Kubernetes best practices\",
    \"conversationId\": \"$CONV_ID\"
  }"

# 2. Continue conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"converse\",
    \"userMessage\": \"Target audience is DevOps engineers with 2-3 years experience\",
    \"conversationId\": \"$CONV_ID\"
  }"

# 3. Create plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"plan\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {\"action\": \"create\", \"title\": \"Kubernetes Best Practices Plan\"}
  }"

# 4. Read plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"plan\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {\"action\": \"read\"}
  }"

# 5. Edit plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"plan\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {
      \"action\": \"edit\",
      \"editedContent\": {\"sections\": [...], \"target_audience\": \"DevOps engineers\"},
      \"comment\": \"Added more detail to sections\"
    }
  }"

# 6. Build deliverable
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"build\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {
      \"action\": \"create\",
      \"title\": \"Kubernetes Best Practices\",
      \"type\": \"blog_post\"
    }
  }"

# 7. Read deliverable
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"build\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {\"action\": \"read\"}
  }"
```

**Expected Results**:
- All 7 requests succeed
- Conversation maintains context
- Plan created from conversation
- Plan edited and new version created
- Deliverable created from plan
- All data persisted correctly
- All responses conform to transport-types

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Skip Planning Workflow - Talk → Build
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test building directly from conversation without plan

**Test Steps**:
```bash
CONV_ID="integration-test-2"

# 1. Conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"converse\",
    \"userMessage\": \"Write a quick intro paragraph about Docker containers\",
    \"conversationId\": \"$CONV_ID\"
  }"

# 2. Build directly (no plan)
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d "{
    \"agentSlug\": \"blog-post-writer\",
    \"mode\": \"build\",
    \"conversationId\": \"$CONV_ID\",
    \"payload\": {
      \"action\": \"create\",
      \"title\": \"Docker Intro\"
    }
  }"
```

**Expected Results**:
- Deliverable created without plan
- Uses conversation context
- Content relevant to request

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Multiple Plan Versions
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test creating and managing multiple plan versions

**Test Steps**:
```bash
CONV_ID="integration-test-3"

# Setup conversation
# ... (create conversation)

# Create plan v1
# Edit to create v2
# Edit to create v3
# List all versions
# Set v2 as current
# Build from v2
# Set v3 as current
# Build from v3
# Compare deliverables
```

**Expected Results**:
- 3 plan versions created
- Can switch between versions
- Can build from specific versions
- Deliverables differ based on plan version used

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Multiple Deliverable Versions
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test deliverable versioning (edit, rerun)

**Test Steps**:
```bash
CONV_ID="integration-test-4"

# Create initial deliverable
# Edit deliverable (creates v2)
# Rerun with different temperature (creates v3)
# List all deliverable versions
# Set v1 as current
# Read (should get v1)
# Set v3 as current
```

**Expected Results**:
- Multiple deliverable versions created
- Edit creates new version
- Rerun creates new version with different LLM output
- Can switch between versions

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: Error Handling - Invalid Actions
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test error responses for invalid actions

**Test Steps**:
```bash
# Invalid PLAN action
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-errors",
    "payload": {"action": "invalid_action"}
  }'

# Invalid BUILD action
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "build",
    "conversationId": "test-errors",
    "payload": {"action": "bad_action"}
  }'
```

**Expected Results**:
- Proper error responses
- Status: 400 or similar
- Clear error messages
- No server crashes

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 6: Error Handling - Validation Failures
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test schema validation error handling

**Test Steps**:
1. Create agent with strict plan_structure
2. Force plan creation that violates structure
3. Verify validation error returned
4. Same for deliverable_structure and io_schema

**Expected Results**:
- Validation errors caught
- Clear error messages about schema violations
- Includes details of validation failure

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 7: Null Schema Handling
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify agents without schemas work correctly

**Test Steps**:
```bash
# Test with agent that has no plan_structure, deliverable_structure, or io_schema
# (Use default agent or one without schemas)

# Create plan - should work without validation
# Create deliverable - should work without validation
```

**Expected Results**:
- Plans and deliverables created successfully
- No validation performed
- Generic structure used

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 8: Transport-Types Conformance Check
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify all responses match transport-types exactly

**Test Script**:
```typescript
// Create test script: verify-transport-types.ts
import { TaskResponseDto } from '@transport-types';

// Test CONVERSE response
const converseResponse = await testConverse();
assert(converseResponse.mode === 'converse');
assert(converseResponse.content.message);
assert(converseResponse.metadata.provider);
assert(converseResponse.metadata.model);
assert(converseResponse.metadata.usage);

// Test PLAN create response
const planCreateResponse = await testPlanCreate();
assert(planCreateResponse.content.plan);
assert(planCreateResponse.content.version);
assert(planCreateResponse.content.isNew !== undefined);

// Test BUILD create response
const buildCreateResponse = await testBuildCreate();
assert(buildCreateResponse.content.deliverable);
assert(buildCreateResponse.content.version);
assert(buildCreateResponse.content.isNew !== undefined);

// Test all 10 PLAN actions return correct types
// Test all 10 BUILD actions return correct types
```

**Expected Results**:
- All responses match transport-types
- No extra or missing fields
- Correct TypeScript types

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 9: Concurrent Requests
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test multiple simultaneous requests

**Test Steps**:
```bash
# Run 5 CONVERSE requests simultaneously
# Run 3 PLAN creates simultaneously (different conversations)
# Run 2 BUILD creates simultaneously (different conversations)
```

**Expected Results**:
- All requests succeed
- No race conditions
- No data corruption
- Correct conversation isolation

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 10: Database State Verification
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify database state after all tests

**Test Steps**:
```sql
-- Check conversations created
SELECT COUNT(*) FROM public.conversations;

-- Check messages saved
SELECT COUNT(*) FROM public.conversation_messages;

-- Check plans created
SELECT COUNT(*) FROM public.plans;

-- Check plan versions
SELECT COUNT(*) FROM public.plan_versions;

-- Check deliverables created
SELECT COUNT(*) FROM public.deliverables;

-- Check deliverable versions
SELECT COUNT(*) FROM public.deliverable_versions;

-- Verify foreign key relationships intact
-- Verify no orphaned records
```

**Expected Results**:
- All data persisted correctly
- Counts match expectations
- Relationships intact
- No orphaned records

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Integration Test Summary

**Total Tests**: 10
**Passed**: 0
**Failed**: 0
**Blocked**: 0

**Issues Found**:


**Performance Notes**:


**Ready for Phase 7**: ⬜ Yes / ⬜ No

---

## Commit Checklist

**Assignee**: Claude

- [ ] All integration tests passing
- [ ] No critical issues found
- [ ] Performance acceptable
- [ ] Database state verified
- [ ] Transport-types conformance confirmed
- [ ] Ready for frontend work

**Notes**:


**Sign-Off Date**:
