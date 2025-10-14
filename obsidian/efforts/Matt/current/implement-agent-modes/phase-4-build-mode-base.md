# Phase 4: BUILD Mode (Base CRUD Handlers)

**Status**: 🟡 Not Started
**Assignee**: Cursor (Dev) → Claude (Test/Commit)
**Duration**: 4-6 hours
**Branch**: `implement-agent-modes`
**Depends On**: Phase 3 Complete

---

## Objective

Implement BUILD mode CRUD action handlers in BaseAgentRunner. These handle deliverable management (read, list, edit, etc.) but NOT creation - that's Phase 5. Conform to A2A transport-types.

---

## Development Tasks

### Task 1: Implement Build Helper Methods
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement helper methods in `build.handlers.ts`

**Acceptance Criteria**:
- [ ] `validateDeliverableStructure()` - Validates against deliverable_structure using ajv
- [ ] `validateDeliverableSchema()` - Validates against io_schema.output using ajv
- [ ] `fetchExistingDeliverable()` - Gets deliverable for conversation
- [ ] Handles null deliverable_structure and io_schema gracefully
- [ ] Error handling for validation failures

**Key Implementation**:
```typescript
export function validateDeliverableStructure(content: any, structure: any): void {
  if (!structure) return; // Graceful handling

  const ajv = new Ajv();
  const valid = ajv.validate(structure, content);
  if (!valid) {
    throw new ValidationError('Deliverable does not conform to agent structure', ajv.errors);
  }
}

export function validateDeliverableSchema(content: any, schema: any): void {
  if (!schema) return; // Graceful handling

  const ajv = new Ajv();
  const valid = ajv.validate(schema, content);
  if (!valid) {
    throw new ValidationError('Deliverable output does not conform to io_schema', ajv.errors);
  }
}
```

**Notes**:


**Log**:


---

### Task 2: Implement BUILD CRUD Handlers (Part 1: Read/List)
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement read and list actions in `build.handlers.ts`

**Acceptance Criteria**:
- [ ] `handleBuildRead()` - Delegates to DeliverablesService.read()
- [ ] `handleBuildList()` - Delegates to DeliverablesService.list()
- [ ] Returns proper `BuildReadResponseContent`, `BuildListResponseContent`
- [ ] Handles versionId parameter in read
- [ ] Handles includeArchived parameter in list

**Notes**:


**Log**:


---

### Task 3: Implement BUILD CRUD Handlers (Part 2: Edit/SetCurrent/Delete)
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement edit, set_current, and delete actions in `build.handlers.ts`

**Acceptance Criteria**:
- [ ] `handleBuildEdit()` - Creates new deliverable version with edited content
- [ ] `handleBuildSetCurrent()` - Delegates to DeliverablesService.setCurrent()
- [ ] `handleBuildDelete()` - Delegates to DeliverablesService.delete() (entire deliverable)
- [ ] Edit validates against deliverable_structure and io_schema if defined
- [ ] Delete removes all versions

**Notes**:


**Log**:


---

### Task 4: Implement BUILD Advanced Handlers (Rerun/Merge/Copy/DeleteVersion)
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Implement advanced actions in `build.handlers.ts`

**Acceptance Criteria**:
- [ ] `handleBuildRerun()` - Fetches version, calls `executeBuild()` with rerun context
- [ ] `handleBuildMergeVersions()` - Calls `executeBuild()` with merged context
- [ ] `handleBuildCopyVersion()` - Delegates to DeliverablesService.copyVersion()
- [ ] `handleBuildDeleteVersion()` - Delegates to DeliverablesService.deleteVersion()
- [ ] Rerun and merge properly set up context for executeBuild to use

**Key Note**: Rerun and merge call `executeBuild()` which will be implemented in Phase 5

**Implementation Pattern**:
```typescript
export async function handleBuildRerun(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
  services: { deliverablesService: DeliverablesService },
  executeBuildFn: (definition, request, organizationSlug) => Promise<TaskResponseDto>,
): Promise<TaskResponseDto> {
  const payload = request.payload as BuildRerunPayload;

  // 1. Fetch original deliverable version
  const originalVersion = await services.deliverablesService.getVersion(payload.versionId);

  // 2. Create modified request with rerun config
  const rerunRequest = {
    ...request,
    payload: {
      ...payload,
      // Pass original context plus new LLM config
      rerunContext: originalVersion,
    },
  };

  // 3. Call executeBuild with rerun context
  return await executeBuildFn(definition, rerunRequest, organizationSlug);
}
```

**Notes**:


**Log**:


---

### Task 5: Wire Up Handlers in BaseAgentRunner
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Connect all BUILD handlers to routing in `base-agent-runner.service.ts`

**Acceptance Criteria**:
- [ ] `handleBuild()` routes to all 10 action handlers
- [ ] Action 'create' routes to abstract `executeBuild()` method
- [ ] Other 9 actions route to handlers in build.handlers.ts
- [ ] Default action is 'create' if not specified
- [ ] Error handling wraps all handler calls

**Implementation**:
```typescript
protected async handleBuild(
  definition: AgentRuntimeDefinition,
  request: TaskRequestDto,
  organizationSlug: string | null,
): Promise<TaskResponseDto> {
  const payload = request.payload as BuildModePayload;
  const action = payload?.action || 'create';

  try {
    switch (action) {
      case 'create':
        // Delegate to abstract method (implemented by subclasses)
        return await this.executeBuild(definition, request, organizationSlug);

      case 'read':
        return await handleBuildRead(definition, request, organizationSlug, {
          deliverablesService: this.deliverablesService,
        });

      case 'rerun':
        // Pass executeBuild as function so handler can call it
        return await handleBuildRerun(
          definition,
          request,
          organizationSlug,
          { deliverablesService: this.deliverablesService },
          this.executeBuild.bind(this), // Pass as callback
        );

      // ... other 7 actions

      default:
        return TaskResponseDto.failure(AgentTaskMode.BUILD, `Unsupported action: ${action}`);
    }
  } catch (error) {
    return handleError(AgentTaskMode.BUILD, error);
  }
}
```

**Notes**:


**Log**:


---

### Task 6: Write Unit Tests
**Assignee**: Cursor
**Status**: ⬜ Not Started

**Description**: Create unit tests in `build.handlers.spec.ts`

**Acceptance Criteria**:
- [ ] Test: Build read retrieves deliverable
- [ ] Test: Build list returns all versions
- [ ] Test: Build edit creates new version
- [ ] Test: Build edit validates against deliverable_structure
- [ ] Test: Build edit validates against io_schema
- [ ] Test: Build set_current updates current version
- [ ] Test: Build delete_version removes specific version
- [ ] Test: Build copy_version duplicates version
- [ ] Test: Build delete removes entire deliverable
- [ ] Test: Build rerun prepares context for executeBuild
- [ ] Test: Build merge prepares merged context for executeBuild
- [ ] Test: Graceful handling when schemas are null
- [ ] All 12+ tests passing

**Notes**:


**Log**:


---

## Testing Tasks

### Test 1: Run Unit Tests
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Execute all BUILD mode CRUD unit tests

**Test Steps**:
```bash
cd apps/api
npm test -- build.handlers.spec.ts
```

**Expected Results**:
- All 12+ tests passing
- Coverage > 85%

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 2: Verify Compilation
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: Ensure TypeScript compiles

**Test Steps**:
```bash
cd apps/api
npx tsc --noEmit
```

**Expected Results**:
- No compilation errors
- Abstract executeBuild() properly defined

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

### Test 3: Verify API Starts
**Assignee**: Claude
**Status**: ⬜ Not Started

**Description**: API starts but BUILD create will fail (not implemented yet)

**Test Steps**:
```bash
npm run dev:api
```

**Expected Results**:
- API starts successfully
- No errors in console
- CREATE action will fail (expected - Phase 5)
- Other actions should work once deliverables exist

**Actual Results**:


**Status**: ⬜ Pass / ⬜ Fail

**Notes**:


---

## Commit Checklist

**Assignee**: Claude

- [ ] All development tasks completed
- [ ] All unit tests passing (12+)
- [ ] TypeScript compiles
- [ ] API starts successfully
- [ ] Ready to commit

**Commit Message**:
```
feat(agents): implement BUILD mode CRUD handlers in base runner

- Implement 9 BUILD CRUD action handlers in build.handlers.ts
- Add deliverable_structure and io_schema validation
- Handle read, list, edit, set_current, delete operations
- Rerun and merge prepare context for executeBuild
- Full transport-types conformance
- 12+ unit tests passing

BUILD create (executeBuild) still abstract - Phase 5 next

Refs: implement-agent-modes Phase 4
```

**Commit Status**: ⬜ Not Committed

---

## Phase 4 Sign-Off

**Completed**: ⬜ Yes / ⬜ No
**Date**:
**Notes**:


**Ready for Phase 5**: ⬜ Yes / ⬜ No
