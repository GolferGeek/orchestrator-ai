# Phase 5: BUILD Execution (Context Agent)

**Status**: 🟠 In Progress
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 2-4 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 4 Complete

---

## Objective

Implement `executeBuild()` in ContextAgentRunner to actually create deliverables. Uses plan or conversation as context, applies deliverable_structure and io_schema validation.

---

## Development Tasks

### Task 1: Implement executeBuild() in ContextAgentRunner
**Assignee**: Cursor
**Status**: 🟠 In Progress

**Description**: Implement the BUILD create logic in `context-agent-runner.service.ts`

**Acceptance Criteria**:
- [x] Fetches plan (if planVersionId specified) or uses current plan
- [x] Falls back to conversation history if no plan
- [x] Builds execution prompt with deliverable_structure and io_schema
- [x] Calls LLM to generate deliverable (with manual content override support)
- [x] Validates against deliverable_structure if defined
- [x] Validates against io_schema.output if defined
- [x] Saves deliverable via DeliverablesService
- [x] Returns BuildCreateResponseContent

**Implementation**:
```typescript
protected async executeBuild(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  // 1. Fetch plan or conversation
  const payload = request.payload as BuildCreatePayload;
  let context: any;

  if (payload.planVersionId) {
    // Use specific plan version
    const planVersion = await this.plansService.getVersion(payload.planVersionId);
    context = planVersion.content;
  } else {
    // Use current plan for conversation, or fall back to conversation
    const plan = await this.fetchExistingPlan(request);
    context = plan ? plan.content : await this.fetchConversationHistory(request);
  }

  // 2. Build execution prompt with structures
  const systemPrompt = this.buildExecutionPrompt(
    definition,
    context,
    definition.deliverableStructure,
    definition.ioSchema?.output,
  );

  // 3. Call LLM
  const llmResponse = await this.callLLM(
    definition.llmConfig,
    systemPrompt,
    request.userMessage || 'Generate deliverable from plan/conversation',
  );

  // 4. Validate deliverable
  if (definition.deliverableStructure) {
    validateDeliverableStructure(llmResponse.content, definition.deliverableStructure);
  }

  if (definition.ioSchema?.output) {
    validateDeliverableSchema(llmResponse.content, definition.ioSchema.output);
  }

  // 5. Save deliverable
  const deliverable = await this.deliverablesService.create({
    conversationId: this.resolveConversationId(request),
    userId: this.resolveUserId(request),
    agentSlug: definition.slug,
    title: payload.title || 'Deliverable',
    type: payload.type || 'text',
    content: llmResponse.content,
    planVersionId: payload.planVersionId,
  });

  // 6. Return BuildCreateResponseContent
  return TaskResponseDto.success(AgentTaskMode.BUILD, {
    deliverable,
    version: deliverable.currentVersion,
    isNew: true,
  });
}
```

**Notes**:
- Added helper utilities for namespace resolution, usage normalization, metadata compaction, and rerun/merge overrides.
- ExecuteBuild now honors manual content payloads while still running validations and metadata wiring.

**Log**:
- 2025-10-15 13:52 Codex: Implemented executeBuild with plan-aware prompt assembly, validation hooks, and DeliverablesService integration. Added supporting helpers for rerun/merge flows and LLM overrides.


---

### Task 2: Implement buildExecutionPrompt()
**Assignee**: Cursor
**Status**: 🟠 In Progress

**Description**: Create helper method to build execution prompt with schemas

**Acceptance Criteria**:
- [x] Includes agent's system prompt
- [x] Includes plan or conversation context
- [x] Adds deliverable_structure guidance if defined
- [x] Adds io_schema.output guidance if defined
- [x] Gracefully handles null schemas
- [x] Clear, structured prompt

**Implementation**:
```typescript
private buildExecutionPrompt(
  definition: AgentRuntimeDefinition,
  context: any,
  deliverableStructure?: any,
  outputSchema?: any,
): string {
  let prompt = `${definition.systemPrompt}\n\n`;

  // Add context (plan or conversation)
  if (typeof context === 'string') {
    prompt += `Context:\n${context}\n\n`;
  } else {
    prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
  }

  // Add structure guidance
  if (deliverableStructure) {
    prompt += `Your deliverable must follow this structure:\n`;
    prompt += `${JSON.stringify(deliverableStructure, null, 2)}\n\n`;
  }

  // Add schema guidance
  if (outputSchema) {
    prompt += `Your output must conform to this technical schema:\n`;
    prompt += `${JSON.stringify(outputSchema, null, 2)}\n\n`;
  }

  // Final instruction
  if (deliverableStructure || outputSchema) {
    prompt += `Please generate output that validates against both the structure and schema.`;
  } else {
    prompt += `Please generate the deliverable based on the context provided.`;
  }

  return prompt;
}
```

**Notes**:


**Log**:


---

### Task 3: Update Constructor
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Ensure ContextAgentRunner has all needed services

**Acceptance Criteria**:
- [ ] Constructor includes DeliverablesService
- [ ] All services passed to super()
- [ ] No compilation errors

**Notes**:


**Log**:


---

### Task 4: Write Unit Tests
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Create unit tests in `context-agent-runner.service.spec.ts`

**Acceptance Criteria**:
- [ ] Test: BUILD create executes from plan
- [ ] Test: BUILD create executes from conversation (no plan)
- [ ] Test: BUILD create uses specific planVersionId
- [ ] Test: BUILD create validates deliverable_structure
- [ ] Test: BUILD create validates io_schema
- [ ] Test: BUILD create works without schemas (null)
- [ ] Test: BUILD create saves to database
- [ ] Test: BUILD create returns proper response
- [ ] Test: Handles LLM errors
- [ ] Test: Handles validation errors
- [ ] All 10+ tests passing

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Run Unit Tests
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Execute BUILD execution unit tests

**Test Steps**:
```bash
cd apps/api
npm test -- context-agent-runner.service.spec.ts
```

**Expected Results**:
- All 10+ tests passing
- Coverage > 85%

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: API Test - Build from Plan
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test complete Talk → Plan → Build workflow

**Test Steps**:
```bash
# 1. Have conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "I want to write about AI agents in production",
    "conversationId": "test-build-1"
  }'

# 2. Create plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "plan",
    "conversationId": "test-build-1",
    "payload": {"action": "create", "title": "AI Agents Blog Plan"}
  }'

# 3. Build deliverable from plan
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "build",
    "conversationId": "test-build-1",
    "payload": {
      "action": "create",
      "title": "AI Agents in Production",
      "type": "blog_post"
    }
  }'
```

**Expected Results**:
- Status: 200
- Response contains deliverable with content
- Deliverable follows deliverable_structure (if defined)
- Deliverable validates against io_schema (if defined)
- Deliverable stored in database
- Response has isNew: true

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: API Test - Build from Conversation (No Plan)
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test Talk → Build workflow (skip planning)

**Test Steps**:
```bash
# 1. Have conversation
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "Write a short intro about microservices",
    "conversationId": "test-build-no-plan"
  }'

# 2. Build directly (no plan)
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "build",
    "conversationId": "test-build-no-plan",
    "payload": {
      "action": "create",
      "title": "Microservices Intro"
    }
  }'
```

**Expected Results**:
- Deliverable created using conversation context
- No plan involved
- Content relevant to conversation

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Test with deliverable_structure and io_schema
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify schemas are used and validated

**Test Steps**:
1. Update blog-post-writer with full schemas:
```sql
UPDATE public.agents
SET
  deliverable_structure = '{
    "type": "object",
    "required": ["introduction", "body", "conclusion"],
    "properties": {
      "introduction": {"type": "object"},
      "body": {"type": "array"},
      "conclusion": {"type": "object"}
    }
  }'::jsonb,
  io_schema = '{
    "output": {
      "type": "object",
      "required": ["content", "metadata"],
      "properties": {
        "content": {"type": "string", "minLength": 500},
        "metadata": {"type": "object"}
      }
    }
  }'::jsonb
WHERE slug = 'blog-post-writer';
```

2. Create deliverable and verify structure

**Expected Results**:
- Deliverable validates against both schemas
- LLM prompt includes schema guidance
- Invalid deliverables rejected with validation error

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: Test BUILD Read/List/Edit
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify Phase 4 CRUD operations work with created deliverables

**Test Steps**:
```bash
# Read deliverable
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "build",
    "conversationId": "test-build-1",
    "payload": {"action": "read"}
  }'

# List versions
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "build",
    "conversationId": "test-build-1",
    "payload": {"action": "list"}
  }'
```

**Expected Results**:
- Read returns the deliverable created in Test 2
- List shows all deliverable versions
- Phase 4 CRUD operations fully functional

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] All unit tests passing (10+)
- [ ] All manual API tests passing (5)
- [ ] Full Talk → Plan → Build workflow working
- [ ] Schema validation working
- [ ] Graceful null handling verified
- [ ] Ready to commit

**Commit Message**:
```
feat(agents): implement BUILD execution in ContextAgentRunner

- Implement executeBuild() in ContextAgentRunner
- Build deliverables from plan or conversation context
- Apply deliverable_structure and io_schema validation
- Build execution prompts with schema guidance
- Full Talk → Plan → Build workflow functional
- 10+ unit tests passing

Context agents can now create deliverables!

Refs: implement-agent-modes Phase 5
```

**Commit Status**: ⬜ Not Committed

---

## Phase 5 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 6**: ⬜ Yes / ⬜ No
