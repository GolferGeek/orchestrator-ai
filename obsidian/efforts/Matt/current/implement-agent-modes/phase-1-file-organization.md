# Phase 1: File Organization & Base Structure

**Status**: 🟡 Not Started
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 4-6 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 0 Complete

---

## Objective

Set up file structure for base agent runner with focused modules. Create directory structure and stub out all methods to establish the architecture.

---

## Development Tasks

### Task 1: Create Directory Structure
**Assignee**: Cursor
**Status**: ✅ Complete

**Description**: Create base-agent-runner subdirectory with handler files

**Acceptance Criteria**:
- [x] Directory created: `apps/api/src/agent2agent/services/base-agent-runner/`
- [x] Four handler files created with empty exports
- [x] Files: `converse.handlers.ts`, `plan.handlers.ts`, `build.handlers.ts`, `shared.helpers.ts`

**Files to Create**:
```
apps/api/src/agent2agent/services/
├── base-agent-runner/
│   ├── converse.handlers.ts
│   ├── plan.handlers.ts
│   ├── build.handlers.ts
│   └── shared.helpers.ts
```

**Notes**:


**Log**:


---

### Task 2: Update BaseAgentRunner Main File
**Assignee**: Cursor
**Status**: ✅ Complete

**Description**: Update `base-agent-runner.service.ts` with complete routing structure

**Acceptance Criteria**:
- [x] Add `deliverablesService` to constructor dependencies
- [x] Implement complete `handleConverse()` routing (delegate to handler)
- [x] Implement complete `handlePlan()` routing with all 10 actions
- [x] Implement complete `handleBuild()` routing with all 10 actions
- [x] Keep `executeBuild()` as abstract method
- [x] Add method signatures for all handler methods (stubs)
- [x] File stays under 250 lines

**Key Changes**:
```typescript
export abstract class BaseAgentRunner implements IAgentRunner {
  constructor(
    protected readonly llmService: LLMService,
    protected readonly contextOptimization: ContextOptimizationService,
    protected readonly plansService: PlansService,
    protected readonly conversationsService: ConversationsService,
    protected readonly deliverablesService: DeliverablesService, // NEW
  ) {}

  // Complete routing for all three modes
  protected async handleConverse(...) { /* Route to converse.handlers */ }
  protected async handlePlan(...) { /* Route to plan.handlers */ }
  protected async handleBuild(...) { /* Route to build.handlers */ }

  protected abstract executeBuild(...): Promise<TaskResponseDto>; // Only abstract method

  // Stub all handler methods (20+ methods)
  protected async handlePlanCreate(...) { throw new Error('Not implemented'); }
  // ... etc
}
```

**Notes**:


**Log**:


---

### Task 3: Create Method Stubs in Handler Files
**Assignee**: Cursor
**Status**: ✅ Complete

**Description**: Add method signatures to all four handler files

**Acceptance Criteria**:
- [x] `converse.handlers.ts`: `executeConverse()`, `buildConversationalPrompt()`
- [x] `plan.handlers.ts`: All 10 plan action handlers + helpers (12+ methods)
- [x] `build.handlers.ts`: All 9 BUILD CRUD handlers + validators (11+ methods)
- [x] `shared.helpers.ts`: Common utilities (8+ methods)
- [x] All methods throw "Not implemented" errors
- [x] All methods have proper TypeScript signatures
- [x] JSDoc comments on each method

**Example Stub**:
```typescript
/**
 * Creates a new plan from conversation history
 * @param definition - Agent runtime definition
 * @param request - Task request DTO
 * @param organizationSlug - Organization context
 */
export async function handlePlanCreate(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  throw new Error('handlePlanCreate not implemented');
}
```

**Notes**:


**Log**:


---

### Task 4: Update Module Registration
**Assignee**: Cursor
**Status**: ✅ Complete

**Description**: Update NestJS module to wire up DeliverablesService

**Acceptance Criteria**:
- [x] `agent2agent.module.ts` includes DeliverablesService in providers
- [x] BaseAgentRunner receives DeliverablesService via DI
- [x] All runner subclasses (Context, API, Orchestrator) updated to pass through
- [x] No compilation errors

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Verify File Structure
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure all files created correctly

**Test Steps**:
```bash
# Check directory exists
ls -la apps/api/src/agent2agent/services/base-agent-runner/

# Count files
find apps/api/src/agent2agent/services/base-agent-runner/ -name "*.ts" | wc -l
```

**Expected Results**:
- Directory exists
- 4 files present: converse.handlers.ts, plan.handlers.ts, build.handlers.ts, shared.helpers.ts

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Verify Compilation
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
- No type errors

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Verify API Starts
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure API starts without runtime errors

**Test Steps**:
```bash
npm run dev:api
```

**Expected Results**:
- API starts successfully
- No module resolution errors
- No DI errors
- Ready to accept requests

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 4: Verify Stub Behavior
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Test that stub methods return "not implemented" errors

**Test Steps**:
```bash
# Call CONVERSE endpoint (should fail gracefully)
curl -X POST http://localhost:7100/api/a2a/task \
  -H "Content-Type: application/json" \
  -d '{
    "agentSlug": "blog-post-writer",
    "mode": "converse",
    "userMessage": "Hello"
  }'
```

**Expected Results**:
- Request accepted
- Returns error: "Not implemented" or similar
- No server crash

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] All tests passing
- [ ] File structure correct
- [ ] TypeScript compiles
- [ ] API starts successfully
- [ ] Ready to commit

**Commit Message**:
```
feat(agents): set up base agent runner file structure

- Create base-agent-runner subdirectory with 4 handler files
- Update BaseAgentRunner with complete mode routing
- Add deliverablesService to constructor dependencies
- Stub all handler methods (30+ methods)
- Update module registration for DI

All methods throw "Not implemented" - ready for Phase 2

Refs: implement-agent-modes Phase 1
```

**Commit Status**: ⬜ Not Committed

---

## Phase 1 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 2**: ⬜ Yes / ⬜ No
