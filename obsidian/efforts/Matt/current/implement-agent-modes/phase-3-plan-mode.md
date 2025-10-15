# Phase 3: PLAN Mode Implementation

**Status**: 🟡 Not Started
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 8-12 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 2 Complete

---

## Objective

Implement PLAN mode with all 10 actions in BaseAgentRunner. Support plan_structure from agent config. Conform to A2A transport-types.

---

## Development Tasks

### Task 1: Implement Plan Helper Methods
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement helper methods in `shared.helpers.ts` and `plan.handlers.ts`

**Acceptance Criteria**:
- [ ] `fetchExistingPlan()` - Gets plan for conversation from PlansService
- [ ] `buildPlanningPrompt()` - Builds system prompt with plan_structure if defined
- [ ] `validatePlanStructure()` - Validates plan against JSON Schema using ajv
- [ ] Handles null plan_structure gracefully
- [ ] Error handling for validation failures

**Key Implementation**:
```typescript
export function buildPlanningPrompt(
  definition: AgentRuntimeDefinition,
  conversationHistory: any[],
  planStructure?: any,
): string {
  let prompt = `${definition.systemPrompt}\n\nConversation history:\n`;
  prompt += conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  if (planStructure) {
    prompt += `\n\nYour plan must follow this structure:\n${JSON.stringify(planStructure, null, 2)}`;
  } else {
    prompt += `\n\nGenerate a structured plan based on the conversation.`;
  }

  return prompt;
}
```

**Notes**:


**Log**:


---

### Task 2: Implement PLAN Action Handlers (Part 1: Create/Read/List)
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement first 3 PLAN actions in `plan.handlers.ts`

**Acceptance Criteria**:
- [ ] `handlePlanCreate()` - Creates plan from conversation, uses plan_structure, validates
- [ ] `handlePlanRead()` - Delegates to PlansService.read()
- [ ] `handlePlanList()` - Delegates to PlansService.list()
- [ ] Returns proper `PlanCreateResponseContent`, `PlanReadResponseContent`, etc.
- [ ] Handles forceNew flag in create
- [ ] Handles versionId parameter in read

**Notes**:


**Log**:


---

### Task 3: Implement PLAN Action Handlers (Part 2: Edit/Rerun/SetCurrent)
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement next 3 PLAN actions in `plan.handlers.ts`

**Acceptance Criteria**:
- [ ] `handlePlanEdit()` - Creates new version with edited content
- [ ] `handlePlanRerun()` - Regenerates plan with new LLM config
- [ ] `handlePlanSetCurrent()` - Delegates to PlansService.setCurrent()
- [ ] Rerun uses different provider/model/temperature as specified
- [ ] Edit validates edited content if plan_structure exists

**Notes**:


**Log**:


---

### Task 4: Implement PLAN Action Handlers (Part 3: Delete/Merge/Copy)
**Assignee**: Cursor
**Status**: ✅ Complete

**Description**: Implement final 4 PLAN actions in `plan.handlers.ts`

**Acceptance Criteria**:
- [ ] `handlePlanDeleteVersion()` - Delegates to PlansService.deleteVersion()
- [ ] `handlePlanMergeVersions()` - Merges versions using LLM, validates result
- [ ] `handlePlanCopyVersion()` - Delegates to PlansService.copyVersion()
- [ ] `handlePlanDelete()` - Delegates to PlansService.delete() (entire plan)
- [ ] Merge uses LLM to intelligently combine versions
- [ ] Delete checks prevent deleting current version

**Notes**:
- LLM-backed merge now calls `PlanVersionsService.mergeVersions` with agent LLM config + plan schema
- Merge output validated against `plan_structure` when provided
- Response metadata includes provider/model/usage from merge run

**Log**:
- 2025-10-15 Codex: Wired PLAN merge handler to pass llmConfig/planStructure and implemented LLM merge pipeline in `plan-versions.service.ts` with schema validation + metadata propagation


---

### Task 5: Wire Up Handlers in BaseAgentRunner
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Connect all plan handlers to routing in `base-agent-runner.service.ts`

**Acceptance Criteria**:
- [ ] `handlePlan()` routes to all 10 action handlers
- [ ] Default action is 'create' if not specified
- [ ] Error handling wraps all handler calls
- [ ] Each handler receives proper services via DI

**Implementation**:
```typescript
protected async handlePlan(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as PlanModePayload;
  const action = payload?.action || 'create';

  try {
    switch (action) {
      case 'create':
        return await handlePlanCreate(definition, request, organizationSlug, {
          llmService: this.llmService,
          plansService: this.plansService,
          conversationsService: this.conversationsService,
        });
      // ... other 9 actions
      default:
        return TaskResponseDto.failure(AgentTaskMode.PLAN, `Unsupported action: ${action}`);
    }
  } catch (error) {
    return handleError(AgentTaskMode.PLAN, error);
  }
}
```

**Notes**:


**Log**:


---

### Task 6: Write Unit Tests
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Create comprehensive unit tests in `plan.handlers.spec.ts`

**Acceptance Criteria**:
- [ ] Test: Plan create generates from conversation
- [ ] Test: Plan create uses plan_structure if defined
- [ ] Test: Plan create validates against plan_structure
- [ ] Test: Plan create returns existing if !forceNew
- [ ] Test: Plan read retrieves plan
- [ ] Test: Plan list returns all versions
- [ ] Test: Plan edit creates new version
- [ ] Test: Plan rerun uses new LLM config
- [ ] Test: Plan set_current updates current version
- [ ] Test: Plan delete_version removes specific version
- [ ] Test: Plan merge_versions combines multiple versions
- [ ] Test: Plan copy_version duplicates version
- [ ] Test: Plan delete removes entire plan
- [ ] Test: Graceful handling when plan_structure is null
- [ ] All 14+ tests passing

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Run Unit Tests
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Execute all PLAN mode unit tests

**Test Steps**:
```bash
cd apps/api
npm test -- plan.handlers.spec.ts
```

**Expected Results**:
- All 14+ tests passing
- Coverage > 85%

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: API Test - Create Plan
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test PLAN create action via API

**Test Steps**:
```bash
# First have conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "I want to write a blog post about AI agents",
    "conversationId": "test-plan-1"
  }'

# Then create plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-plan-1",
    "payload": {
      "action": "create",
      "title": "AI Agent Blog Post Plan"
    }
  }'
```

**Expected Results**:
- Status: 200
- Response contains plan with version
- Response has isNew: true
- Plan stored in database
- Plan follows plan_structure if agent has one

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: API Test - Read Plan
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test PLAN read action

**Test Steps**:
```bash
# Read current plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-plan-1",
    "payload": {
      "action": "read"
    }
  }'
```

**Expected Results**:
- Returns plan created in Test 2
- Contains current version
- Plan content matches

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: API Test - Edit Plan
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test PLAN edit action creates new version

**Test Steps**:
```bash
# Edit plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-plan-1",
    "payload": {
      "action": "edit",
      "editedContent": {
        "sections": [
          {"title": "Introduction", "key_points": ["Hook", "Context"]},
          {"title": "Main Points", "key_points": ["AI capabilities", "Use cases"]}
        ],
        "target_audience": "developers"
      },
      "comment": "Added more detail"
    }
  }'
```

**Expected Results**:
- New version created
- Version number incremented
- Content updated
- Old version still accessible

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: API Test - List Plan Versions
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test PLAN list action shows all versions

**Test Steps**:
```bash
# List all versions
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-plan-1",
    "payload": {
      "action": "list"
    }
  }'
```

**Expected Results**:
- Returns array with 2+ versions (from create and edit)
- Each version has versionId, content, createdAt
- Versions ordered by creation time

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 6: Verify plan_structure Validation
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify that plans are validated against agent's plan_structure

**Test Steps**:
1. Update blog-post-writer agent with plan_structure:
```sql
UPDATE public.agents
SET plan_structure = '{
  "type": "object",
  "required": ["sections", "target_audience"],
  "properties": {
    "sections": {"type": "array"},
    "target_audience": {"type": "string"}
  }
}'::jsonb
WHERE slug = 'blog-post-writer';
```

2. Create plan and verify it matches structure

**Expected Results**:
- Plan validates successfully against structure
- Invalid plans rejected with validation error

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 7: Test Without plan_structure
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify agents without plan_structure still work

**Test Steps**:
```bash
# Test with agent that has no plan_structure
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "some-agent-without-structure",
    "mode": "plan",
    "conversationId": "test-no-structure",
    "payload": {"action": "create"}
  }'
```

**Expected Results**:
- Plan created successfully
- No validation performed
- Uses generic plan format

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] All unit tests passing (14+)
- [ ] All manual API tests passing (7)
- [ ] Transport-types conformance verified
- [ ] plan_structure integration working
- [ ] Null plan_structure handled gracefully
- [ ] Ready to commit

**Commit Message**:
```
feat(agents): implement PLAN mode with all 10 actions

- Implement all 10 PLAN action handlers in plan.handlers.ts
- Add plan_structure integration and validation
- Create/edit/rerun plans with LLM
- Full CRUD operations via PlansService
- Merge, copy, delete version support
- Graceful handling when plan_structure is null
- 14+ unit tests passing
- Full transport-types conformance

All agents can now create and manage plans

Refs: implement-agent-modes Phase 3
```

**Commit Status**: ⬜ Not Committed

---

## Phase 3 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 4**: ⬜ Yes / ⬜ No
