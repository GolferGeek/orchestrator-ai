# Phase 2: CONVERSE Mode Implementation

**Status**: 🟡 Not Started
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 4-6 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 1 Complete

---

## Objective

Implement CONVERSE mode in BaseAgentRunner. Pure conversation with no deliverables or plans. Conform to A2A transport-types.

---

## Development Tasks

### Task 1: Implement Shared Helpers
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement helper methods needed by CONVERSE mode in `shared.helpers.ts`

**Acceptance Criteria**:
- [ ] `fetchConversationHistory()` - Fetches messages from ConversationsService
- [ ] `callLLM()` - Calls LLM via LLMService with proper error handling
- [ ] `resolveUserId()` - Extracts userId from request
- [ ] `resolveConversationId()` - Extracts conversationId from request
- [ ] `handleError()` - Creates error TaskResponseDto
- [ ] All methods fully implemented with proper types
- [ ] Error handling for all edge cases

**Key Signatures**:
```typescript
export async function fetchConversationHistory(
  conversationsService: ConversationsService,
  request: TaskRequestDto,
): Promise<ConversationMessage[]>;

export async function callLLM(
  llmService: LLMService,
  llmConfig: any,
  systemPrompt: string,
  userMessage: string,
  conversationHistory?: any[],
): Promise<LLMResponse>;
```

**Notes**:


**Log**:


---

### Task 2: Implement Converse Handlers
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement CONVERSE mode logic in `converse.handlers.ts`

**Acceptance Criteria**:
- [ ] `executeConverse()` - Main conversation logic
- [ ] `buildConversationalPrompt()` - Builds system prompt with conversation context
- [ ] Uses `ConverseModePayload` from transport-types
- [ ] Returns `ConverseResponseContent` with message field
- [ ] Returns `ConverseResponseMetadata` with provider, model, usage
- [ ] No plan or deliverable created
- [ ] Conversation saved to database

**Key Implementation**:
```typescript
export async function executeConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: {
    llmService: LLMService;
    conversationsService: ConversationsService;
  },
): Promise<TaskResponseDto> {
  // 1. Fetch conversation history
  const history = await fetchConversationHistory(services.conversationsService, request);

  // 2. Build conversational prompt
  const systemPrompt = buildConversationalPrompt(definition, history);

  // 3. Call LLM
  const payload = request.payload as ConverseModePayload;
  const llmResponse = await callLLM(
    services.llmService,
    { ...definition.llmConfig, ...payload },
    systemPrompt,
    request.userMessage,
    history,
  );

  // 4. Save assistant message to conversation
  // ... save logic

  // 5. Return ConverseResponseContent
  return TaskResponseDto.success(AgentTaskMode.CONVERSE, {
    message: llmResponse.content,
  });
}
```

**Notes**:


**Log**:


---

### Task 3: Wire Up Handlers in BaseAgentRunner
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Connect handlers to `handleConverse()` method in `base-agent-runner.service.ts`

**Acceptance Criteria**:
- [ ] `handleConverse()` delegates to `executeConverse()` from handlers
- [ ] Passes all required services and dependencies
- [ ] Error handling wraps handler errors
- [ ] Method stays under 20 lines

**Implementation**:
```typescript
protected async handleConverse(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  try {
    return await executeConverse(definition, request, organizationSlug, {
      llmService: this.llmService,
      conversationsService: this.conversationsService,
    });
  } catch (error) {
    return handleError(AgentTaskMode.CONVERSE, error);
  }
}
```

**Notes**:


**Log**:


---

### Task 4: Write Unit Tests
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Create unit tests for CONVERSE mode in `converse.handlers.spec.ts`

**Acceptance Criteria**:
- [ ] Test: Returns conversational response
- [ ] Test: Does not create plan
- [ ] Test: Does not create deliverable
- [ ] Test: Saves message to conversation
- [ ] Test: Includes conversation history in prompt
- [ ] Test: Respects ConverseModePayload (temperature, maxTokens)
- [ ] Test: Returns proper metadata (provider, model, usage)
- [ ] Test: Handles LLM errors gracefully
- [ ] All tests passing

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Verify Compilation
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure TypeScript compiles without errors

**Test Steps**:
```bash
cd apps/api
npx tsc --noEmit
```

**Expected Results**:
- No compilation errors
- All imports resolved

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Run Unit Tests
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Execute unit tests for CONVERSE mode

**Test Steps**:
```bash
cd apps/api
npm test -- converse.handlers.spec.ts
```

**Expected Results**:
- All tests passing
- 8+ tests executed
- Coverage > 80%

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Manual API Test - Simple Conversation
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test CONVERSE mode via API with blog-post-writer

**Test Steps**:
```bash
# Start API
npm run dev:api

# Send CONVERSE request
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "Hello, can you help me write a blog post?",
    "conversationId": "test-conv-1",
    "sessionId": "test-session-1",
    "payload": {
      "temperature": 0.7,
      "maxTokens": 500
    }
  }'
```

**Expected Results**:
- Status: 200
- Response contains `success: true`
- Response contains `content.message` with conversational reply
- Response contains `metadata` with provider, model, usage
- No plan or deliverable created in database

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Verify Conversation History
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test that conversation history is maintained across messages

**Test Steps**:
```bash
# Send first message
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "My name is Alice",
    "conversationId": "test-conv-2"
  }'

# Send follow-up message
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "What is my name?",
    "conversationId": "test-conv-2"
  }'
```

**Expected Results**:
- Second response includes "Alice" or refers to the user's name
- Shows conversation history is being used

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 5: Verify Transport-Types Conformance
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Verify response matches transport-types exactly

**Test Steps**:
```typescript
// Check response structure
const response = await testConverseMode();

// Verify ConverseModePayload accepted
assert(request.payload.temperature === 0.7);
assert(request.payload.maxTokens === 500);

// Verify ConverseResponseContent
assert(response.content.message);
assert(typeof response.content.message === 'string');

// Verify ConverseResponseMetadata
assert(response.metadata.provider); // e.g., "anthropic"
assert(response.metadata.model);    // e.g., "claude-3-5-sonnet"
assert(response.metadata.usage);    // { inputTokens, outputTokens }
```

**Expected Results**:
- All assertions pass
- Types match transport-types exactly

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] All unit tests passing
- [ ] All manual tests passing
- [ ] Transport-types conformance verified
- [ ] No compilation errors
- [ ] Ready to commit

**Commit Message**:
```
feat(agents): implement CONVERSE mode in BaseAgentRunner

- Implement executeConverse() in converse.handlers.ts
- Implement shared helpers (fetchConversationHistory, callLLM)
- Build conversational prompts with history
- Return ConverseResponseContent with message
- Full transport-types conformance
- 8+ unit tests passing

CONVERSE mode now functional for all agent types

Refs: implement-agent-modes Phase 2
```

**Commit Status**: ⬜ Not Committed

---

## Phase 2 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 3**: ⬜ Yes / ⬜ No
